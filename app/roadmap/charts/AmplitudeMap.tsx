"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import {
  buildSpatialSeasonality,
  type AppliedSeasonalityFallbacks,
} from "@/lib/spatial-seasonality";
import {
  bandEdges,
  buildMonthValues,
  createFrameBinner,
  domainOf,
  resolveCellCurves,
  TIER_REGION,
  type CellCurveUnit,
  type Frame,
} from "./amplitudeCells";
import { evaluateHarmonicCurve, type HarmonicCurve } from "@/lib/seasonal-curve";
import { showTooltip, hideTooltip } from "../tooltip";
import { fill } from "@/lib/i18n/fill";
import { useCanvasScale, useFigureWidth } from "./useFigureSize";
import { fitProjection, inflateCell, projectCell, type Bbox } from "./basemap";
import { divergingHarmony, parseSky } from "../palette";
import { useI18n } from "../I18nContext";
import type { Dictionary } from "@/lib/i18n/en";
import { useNearViewport, useReducedMotion } from "../useNearViewport";
import type {
  Admin1Feature,
  CountryFeature,
  NeighborsByM49,
  RateGrid,
  RegionKeys,
  SeasonalityData,
  SubnationalSeasonalityRegion,
} from "../types";

interface AmplitudeMapProps {
  seasonality: SeasonalityData | null;
  features: CountryFeature[] | null;
  neighborsByM49: NeighborsByM49 | null;
  regions: SubnationalSeasonalityRegion[] | null;
  admin1Features: Admin1Feature[] | null;
  appliedFallbacks: AppliedSeasonalityFallbacks | null;
  rateGrid: RateGrid | null;
  regionKeys: RegionKeys | null;
}

// Norway to South Africa, Mauritania to Bangladesh: the four countries the surrounding prose
// invites the reader to compare. The argument this map closes is hemispheric — winter in one half
// is summer in the other — so the frame has to hold both halves at once, whatever that costs in
// cell size.
const BBOX: Bbox = [
  [-18, -36],
  [93, 72],
];

// Equal Earth, turned to put the frame's own mid-meridian up the middle. Colour encodes a quantity
// per unit of ground here, so an equal-area projection is not a preference: on anything else the
// same value covers more pixels at high latitude than at the equator and Scandinavia reads as more
// of the picture than it is. Equirectangular (what every other square map in the story uses) is
// not equal-area and stretches Norway; Natural Earth 1 gives more uniform cells but is not
// equal-area either; a conic is wrong because this frame crosses the equator.
const PROJECTION = () => d3.geoEqualEarth().rotate([-37.5, 0]);

// Same cap and reasoning as the density map: draw at the display's own pixel density so the cells
// stay square-edged rather than resampled, and stop before a wide screen asks for a four-megapixel
// raster.
const MAX_SIDE = 560;

// Nine bins: four either side of a neutral one. Odd by necessity — the quantity has a real zero
// and the reader has to see which side of it a cell is on before they see how far.
const STEPS = 9;

// The section's own sky (`when-seasonality`, docs/ROADMAP.md), resolved once at module scope.
// Canvas cannot read a CSS variable, so this ramp is literal RGB rather than `var(--...)`, the
// same trade the density and region maps already make. The cost is real and worth naming: the
// cells no longer follow the live sky cross-fade between sections the way the old SVG choropleth
// did. The legend below is painted from this same array, so the two cannot drift apart.
const SKY = parseSky("#bcd8ee");
const RAMP = divergingHarmony(STEPS, SKY);

// How far each cell grows past its own edge, in device pixels. Canvas has no way to turn
// antialiasing off, so without this two exact neighbours each cover about half their shared edge,
// the halves do not add back up to one, and the page shows through as a lattice over the whole
// map. The density map uses 0.25 for a 2.3px cell; a cell here runs 1.8px on a 393px phone at 1x
// to 5px on a full-width panel at 2x, so this sits a little higher to close the seam at the small
// end without bleeding at the large one.
const CELL_OVERLAP = 0.35;

// A day per step. The curve behind every cell is continuous — an order-4 Fourier fit, evaluated at
// any phase — and the figure used to show twelve samples of it because it precomputed every frame
// at load, which a twelve-position control makes possible. Binning a frame on demand turned out to
// cost 0.29ms against the ~6ms it takes to paint, so the twelve were costing memory and buying
// nothing. A day is the finest step whose label is a date a reader can read.
//
// What twelve samples were not was lossy: nine coefficients, fastest component four cycles a year,
// so twelve samples sit above the Nyquist rate and over-determine the curve. Sliding between them
// interpolates a curve that was already pinned — it reads as motion, not as new information, and
// the note under the control says as much.
const DAYS = 365;
const DAY_RANGE = { min: 0, max: DAYS - 1, step: 1 };

// One unattended sweep through the year when the figure first comes into view, so a reader who
// never touches the control still sees the thing the control is for. It is not a loop and it is
// not a play button: it runs once, it stops the instant the reader takes the slider, and it does
// not run at all under prefers-reduced-motion. On a frame clock now rather than a timer, because
// with a day per step the sweep can glide instead of stepping twelve times.
const SWEEP_MS = 9000;

// The inverted-lattice window that decides which cells can be on screen. Corner sampling
// understates a pseudocylindrical projection's range — its parallels are curves, so the highest
// latitude along the top edge is at its middle, above either corner.
const WINDOW_STEPS = 25;

interface Outline {
  d: string;
  // Solid where the unit's curve was measured on the ground, dashed where it was reconstructed.
  measured: boolean;
}

interface RenderCache {
  rings: ([number, number][] | null)[];
  // Point in the year → that frame's cells grouped by colour. Reuses its own buffers, so the
  // Frame it returns is only valid until the next call.
  frameAt: (phase: number) => Frame;
  edges: number[];
  domain: number;
  outlines: Outline[];
  // Everything the hover needs, indexed rather than searched. `byCell` is "lon,lat" → cell, built
  // in the same pass as the rings: the density map's hover does a linear Array.find over sixty
  // thousand rows on every pointermove, which is a cost this figure does not have to inherit.
  byCell: Map<string, number>;
  unit: Int32Array;
  units: CellCurveUnit[];
  curves: HarmonicCurve[];
}

// The last figure of the seasonality chapter, and the one that stops pretending mortality is
// uniform inside a border. Every 0.5° grid cell is coloured by the deaths the season adds to, or
// takes from, its ordinary month — from the curve of the finest unit that has one. The outlines
// on top are those units, so the reader can see the cells and the curves are not the same shape.
export default function AmplitudeMap({
  seasonality,
  features,
  neighborsByM49,
  regions,
  admin1Features,
  appliedFallbacks,
  rateGrid,
  regionKeys,
}: AmplitudeMapProps) {
  const { locale, d: dict } = useI18n();
  const t = dict.charts.amplitudeMap;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [sizeRef, measured] = useFigureWidth<HTMLDivElement>();
  const scale = useCanvasScale();
  const [day, setDay] = useState(0);
  // Once the reader has moved the slider themselves, the figure never moves on its own again.
  const [taken, setTaken] = useState(false);
  const near = useNearViewport(frameRef);
  const reduceMotion = useReducedMotion();
  const phase = (day + 0.5) / DAYS;

  // Dates are not translated anywhere in this codebase — chartHelpers' MONTHS is twelve English
  // literals and no dictionary has ever carried a month name — so they come from the platform in
  // the reader's own locale rather than from strings nobody would review. 2001 because it is not a
  // leap year: the label is a point in an ordinary year, not a date in a real one.
  const dateNames = useMemo(() => {
    // en-GB rather than bare "en", which Intl resolves to US ordering and would print "January 16"
    // under prose that says colour, modelled and neighbour. Catalan and German are day-first
    // already, so this is the only locale that needed saying out loud.
    const format = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });
    return Array.from({ length: DAYS }, (_, index) =>
      format.format(Date.UTC(2001, 0, 1) + index * 86400000),
    );
  }, [locale]);
  const side = Math.min(MAX_SIDE, measured);
  const width = Math.round(side * scale);
  const height = width;

  const projection = useMemo(
    () => fitProjection(PROJECTION(), BBOX, width, height, 0),
    [width, height],
  );

  const estimates = useMemo(
    () =>
      seasonality && features && neighborsByM49
        ? buildSpatialSeasonality(
            features,
            neighborsByM49,
            seasonality,
            regions ?? [],
            appliedFallbacks,
          )
        : null,
    [seasonality, features, neighborsByM49, regions, appliedFallbacks],
  );

  // Half one of two: everything that does not depend on the month. Projecting twenty-odd thousand
  // cells and binning twelve months of values costs about a tenth of a second, and it is wasted
  // entirely if it runs again when only the month changed — the projection is the same in January
  // and July. This split is what makes the control below affordable. A memo rather than an effect
  // because none of it is a side effect: it is one pure function of the data and the panel size.
  const cache = useMemo<RenderCache | null>(() => {
    if (!rateGrid?.cells || !features || !estimates) return null;

    const cells = rateGrid.cells;
    const cellsize = rateGrid.cellsize;

    // Which cells the panel can show, measured off a lattice of inverse-projected points across
    // the canvas rather than off its four corners.
    let west = Infinity;
    let east = -Infinity;
    let south = Infinity;
    let north = -Infinity;
    for (let i = 0; i <= WINDOW_STEPS; i += 1) {
      for (let j = 0; j <= WINDOW_STEPS; j += 1) {
        const point = projection.invert?.([
          (width * i) / WINDOW_STEPS,
          (height * j) / WINDOW_STEPS,
        ]);
        if (!point || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) continue;
        west = Math.min(west, point[0]);
        east = Math.max(east, point[0]);
        south = Math.min(south, point[1]);
        north = Math.max(north, point[1]);
      }
    }

    const rings: ([number, number][] | null)[] = new Array(cells.length).fill(null);
    for (let i = 0; i < cells.length; i += 1) {
      const cell = cells[i];
      if (!cell) continue;
      const [lon, lat] = cell;
      if (lon + cellsize < west || lon > east || lat + cellsize < south || lat > north) continue;
      const ring = projectCell(projection, lon, lat, cellsize);
      if (ring) rings[i] = inflateCell(ring, CELL_OVERLAP);
    }
    const visible = (cell: number) => rings[cell] != null;

    const names: Record<string, string> = {};
    for (const feature of features) {
      const name = feature.properties?.name;
      if (name) names[String(Number(feature.id))] = name;
    }

    const resolved = resolveCellCurves({
      cells,
      regionKeys,
      regions,
      estimates,
      regionOverrides: appliedFallbacks?.regions ?? null,
      names,
    });
    // The domain still comes off the twelve monthly samples even though the figure is read at any
    // point in the year. Those twelve over-determine an order-4 curve, so the extremes they find
    // are the year's extremes — and taking the domain from a denser sample would cost a sort of
    // millions of magnitudes to move the 99.5th percentile by nothing.
    const values = buildMonthValues(cells, resolved.monthly);
    const domain = domainOf(values, visible);
    const edges = bandEdges(domain, (STEPS - 1) / 2);
    const shown: number[] = [];
    for (let i = 0; i < cells.length; i += 1) if (rings[i]) shown.push(i);
    const frameAt = createFrameBinner({
      cells,
      visible: Int32Array.from(shown),
      unit: resolved.unit,
      curves: resolved.curves,
      edges,
      steps: STEPS,
    });

    // The provenance layer, and the figure's actual argument: not two hundred outlines for
    // decoration but one outline per unit whose curve some visible cell borrowed, drawn over the
    // cells that borrowed it. Where a region answered, the reader sees a region; where only a
    // country could, they see a whole country's border enclosing cells that differ inside it —
    // which is the "borders are the wrong unit" point made without a sentence.
    const used = new Set<number>();
    for (let i = 0; i < cells.length; i += 1) {
      if (rings[i]) used.add(resolved.unit[i] ?? -1);
    }
    const path = d3.geoPath(projection);
    const countryById = new Map(features.map((f) => [Number(f.id), f]));
    const regionByCode = new Map(
      (admin1Features ?? []).map((f) => [f.properties?.adm1_code ?? "", f]),
    );
    const outlines: Outline[] = [];
    for (const id of used) {
      const unit = id >= 0 ? resolved.units[id] : undefined;
      if (!unit) continue;
      const feature =
        unit.tier === TIER_REGION
          ? regionByCode.get(unit.regionKey ?? "")
          : countryById.get(unit.m49 ?? -1);
      const d = feature ? path(feature) : null;
      if (d) outlines.push({ d, measured: isMeasured(unit) });
    }

    // "lon,lat" → cell, built here so the hover below is a lookup rather than a scan.
    const byCell = new Map<string, number>();
    for (let i = 0; i < cells.length; i += 1) {
      const cell = cells[i];
      if (!cell || !rings[i]) continue;
      byCell.set(`${cell[0]},${cell[1]}`, i);
    }

    return {
      rings,
      frameAt,
      edges,
      domain,
      outlines,
      byCell,
      unit: resolved.unit,
      units: resolved.units,
      curves: resolved.curves,
    };
  }, [
    rateGrid,
    regionKeys,
    regions,
    features,
    admin1Features,
    appliedFallbacks,
    estimates,
    projection,
    width,
    height,
  ]);

  // The hover. A grid cell has no name of its own, so what a tooltip can honestly say is: whose
  // curve this is, what that curve is worth here this month, and how that curve was arrived at.
  //
  // No country-polygon fallback for a pointer that lands on no cell, unlike the density map: there
  // the subject is how much land is empty, so an empty cell is worth naming. Here a cell with no
  // row is not drawn at all, and there is nothing to say about it.
  const describe = (cell: number): string | null => {
    if (!cache || !rateGrid) return null;
    const id = cache.unit[cell] ?? -1;
    const unit = id >= 0 ? cache.units[id] : undefined;
    const deaths = rateGrid.cells[cell]?.[3] ?? 0;
    const curve = id >= 0 ? cache.curves[id] : undefined;
    const multiplier = curve ? evaluateHarmonicCurve(curve, phase) : 1;
    const where =
      unit == null
        ? dict.charts.common.unknown
        : unit.tier === TIER_REGION && unit.country
          ? fill(t.cellUnitRegion, { region: unit.name, country: unit.country })
          : unit.name;
    return fill(t.cellTooltip, {
      unit: where,
      excess: fmtExcess(t, (deaths * (multiplier - 1)) / 12),
      date: dateNames[day] ?? "",
      multiplier: fmtMultiplier(multiplier),
      basis: basisOf(t, unit),
    });
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !cache || !rateGrid) return;
    const rect = canvas.getBoundingClientRect();
    const point = projection.invert?.([
      ((event.clientX - rect.left) * canvas.width) / rect.width,
      ((event.clientY - rect.top) * canvas.height) / rect.height,
    ]);
    if (!point) {
      hideTooltip();
      return;
    }
    const size = rateGrid.cellsize;
    const key = `${Math.floor(point[0] / size) * size},${Math.floor(point[1] / size) * size}`;
    const cell = cache.byCell.get(key);
    const text = cell == null ? null : describe(cell);
    if (text) showTooltip(text, event.clientX, event.clientY);
    else hideTooltip();
  };

  // Four hundred vector paths that do not depend on the date, held still as the slider moves.
  // Without this React diffs every one of them on every tick, which costs more than the twenty-odd
  // thousand cells the tick actually exists to repaint.
  const outlinePaths = useMemo(
    () =>
      cache?.outlines.map((outline, index) => (
        <path
          key={index}
          d={outline.d}
          className={outline.measured ? "is-measured" : "is-estimated"}
          vectorEffect="non-scaling-stroke"
        />
      )) ?? null,
    [cache],
  );

  // Half two, and the only side effect here: the point in the year. Bins this one frame and walks
  // it a colour at a time — no projection, no re-fit, no geometry of any kind.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !cache) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Cleared rather than painted: the sea and the empty margin are the page itself, which is how
    // the reader can tell "nobody lives here" from "the map stops here".
    ctx.clearRect(0, 0, width, height);
    const { order, offsets } = cache.frameAt(phase);
    for (let bin = 0; bin < STEPS; bin += 1) {
      const from = offsets[bin] ?? 0;
      const to = offsets[bin + 1] ?? 0;
      if (to === from) continue;
      // One fillStyle per bin, and one fill per cell. Not one path per bin: measured on this
      // figure, nine batched paths of ~3,000 quads each take 188ms to fill against 6ms for the
      // same quads filled one at a time, because a path that large falls off the rasteriser's
      // fast route. Group the colour, not the geometry.
      ctx.fillStyle = RAMP[bin] as string;
      for (let k = from; k < to; k += 1) {
        const ring = cache.rings[order[k] as number];
        if (!ring) continue;
        ctx.beginPath();
        ctx.moveTo(ring[0]![0], ring[0]![1]);
        for (let corner = 1; corner < ring.length; corner += 1) {
          ctx.lineTo(ring[corner]![0], ring[corner]![1]);
        }
        ctx.closePath();
        ctx.fill();
      }
    }
  }, [cache, phase, width, height]);

  // The sweep. A frame clock rather than a timer: with a day per step it can glide through the
  // year instead of stepping twelve times, which is most of the reason the control stopped being
  // twelve positions.
  useEffect(() => {
    if (!cache || !near || taken || reduceMotion) return;
    let raf = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const through = (now - start) / SWEEP_MS;
      setDay(Math.min(DAYS - 1, Math.floor(through * DAYS)));
      if (through < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cache, near, taken, reduceMotion]);

  return (
    <section className="chart-panel">
      <div
        className="amplitude-map-frame"
        ref={(node) => {
          frameRef.current = node;
          sizeRef(node);
        }}
      >
        <canvas
          ref={canvasRef}
          id="amplitude-map-chart"
          className="story-figure"
          width={width}
          height={height}
          role="img"
          aria-label={t.aria}
          onPointerMove={onPointerMove}
          onPointerLeave={hideTooltip}
        />
        {/* The provenance outlines, over the cells and in vector: about two hundred paths against
            twenty-odd thousand cells, they never change with the month, and as SVG they stay crisp
            over a canvas drawn at device resolution. */}
        <svg
          className="amplitude-map-outlines"
          viewBox={`0 0 ${width} ${height}`}
          aria-hidden="true"
          focusable="false"
        >
          {outlinePaths}
        </svg>
      </div>
      <label className="amplitude-phase">
        <span className="amplitude-phase-head">
          <span className="amplitude-phase-name">{t.phaseName}</span>
          <span className="amplitude-phase-value">{dateNames[day]}</span>
        </span>
        <input
          type="range"
          min={DAY_RANGE.min}
          max={DAY_RANGE.max}
          step={DAY_RANGE.step}
          value={day}
          onChange={(event) => {
            setTaken(true);
            setDay(Number(event.target.value));
          }}
          aria-label={t.phaseName}
          aria-valuetext={dateNames[day]}
        />
        <span className="amplitude-phase-note">{t.phaseNote}</span>
      </label>
      {cache && (
        <div className="amplitude-legend">
          <div className="amplitude-legend-scale">
            <span className="amplitude-legend-end">{t.legendFewer}</span>
            <span className="amplitude-legend-bar">
              {RAMP.map((color, index) => (
                <span key={index} style={{ background: color }} />
              ))}
            </span>
            <span className="amplitude-legend-end">{t.legendMore}</span>
          </div>
          <p className="amplitude-legend-caption">
            {fillEdges(t.legendCaption, cache.edges, cache.domain)}
          </p>
          <p className="amplitude-legend-provenance">
            <span className="amplitude-legend-rule is-measured" />
            {t.provenanceMeasured}
            <span className="amplitude-legend-rule is-estimated" />
            {t.provenanceEstimated}
          </p>
        </div>
      )}
    </section>
  );
}

// A unit's curve was measured where somebody counted deaths in it — its own registrations, or its
// own regions' — and estimated where the story reconstructed it from a neighbour, a climate class
// or a latitude. India's and China's regions are a Köppen blend and count as estimated, however
// fine their outline looks.
function isMeasured(unit: CellCurveUnit): boolean {
  if (unit.tier === TIER_REGION) return unit.measurement !== "climate-modeled";
  return unit.source === "observed" || unit.source === "own-regions";
}

// Whole deaths, signed, always. A cell where the season barely moves reads "+0 deaths", which is
// the truth about that cell rather than a gap in the tooltip. The noun is part of the string
// because one death is not "1 deaths" in any of the three languages.
function fmtExcess(t: Dictionary["charts"]["amplitudeMap"], value: number): string {
  const whole = Math.round(value) === 0 ? 0 : value;
  const n = d3.format("+,.0f")(whole);
  return fill(Math.abs(Math.round(whole)) === 1 ? t.cellDeathsOne : t.cellDeaths, { n });
}

function fmtMultiplier(value: number): string {
  return `${d3.format(".2f")(value)}\u00d7`;
}

// How the curve behind this cell was arrived at. The five country strings are the ones the old
// choropleth already used — they describe the same five tiers of buildSpatialSeasonality — now
// wrapped in the sentence that matters at cell resolution: this is one curve for a whole unit,
// and the unit is bigger than what you are pointing at.
function basisOf(t: Dictionary["charts"]["amplitudeMap"], unit: CellCurveUnit | undefined): string {
  if (!unit) return t.sourceNone;
  if (unit.tier === TIER_REGION) {
    if (unit.measurement === "climate-modeled") return t.sourceRegionClimate;
    if (unit.imputedFrom?.length) {
      return fill(t.sourceRegionImputed, { donors: unit.imputedFrom.join(", ") });
    }
    return t.sourceRegionMeasured;
  }
  const donors = unit.donorNames ?? [];
  const basis =
    unit.source === "observed"
      ? t.sourceObserved
      : unit.source === "own-regions"
        ? fill(t.sourceOwnRegions, { n: donors.length })
        : unit.source === "bordering-countries"
          ? fill(t.sourceBorderingCountries, { donors: donors.join(", ") })
          : unit.source === "climate"
            ? fill(t.sourceClimate, { donor: donors[0] ?? "" })
            : fill(t.sourceLatitude, { donor: donors[0] ?? "" });
  return fill(t.sourceWholeCountry, { basis });
}

// The legend's numbers are the quantiser's own edges, not a second rounding of the same data:
// `edges` is what the cells were binned on, so the strip and the map cannot disagree.
function fillEdges(template: string, edges: number[], domain: number): string {
  const neutral = edges[0] ?? 1;
  return template
    .replace("{neutral}", d3.format(",.0f")(neutral))
    .replace("{domain}", d3.format(",.0f")(domain));
}
