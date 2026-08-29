"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import {
  buildSpatialSeasonality,
  type AppliedSeasonalityFallbacks,
} from "@/lib/spatial-seasonality";
import {
  bucketsByMonth,
  buildMonthValues,
  domainOf,
  quantise,
  resolveCellCurves,
  TIER_REGION,
  type CellCurveUnit,
} from "./amplitudeCells";
import { useCanvasScale, useFigureWidth } from "./useFigureSize";
import { fitProjection, inflateCell, projectCell, type Bbox } from "./basemap";
import { divergingHarmony, parseSky } from "../palette";
import { useDict } from "../I18nContext";
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
  buckets: Int32Array[][];
  edges: number[];
  domain: number;
  outlines: Outline[];
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
  const dict = useDict();
  const t = dict.charts.amplitudeMap;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [sizeRef, measured] = useFigureWidth<HTMLDivElement>();
  const scale = useCanvasScale();
  const [month] = useState(0);
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
    const values = buildMonthValues(cells, resolved.monthly);
    const { bins, edges, domain } = quantise(values, STEPS, domainOf(values, visible));
    const buckets = bucketsByMonth(bins, STEPS, visible);

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

    return { rings, buckets, edges, domain, outlines };
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

  // Half two, and the only side effect here: the month. Walks the cached rings a colour bucket at
  // a time and refills — no projection, no binning, no geometry of any kind.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !cache) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Cleared rather than painted: the sea and the empty margin are the page itself, which is how
    // the reader can tell "nobody lives here" from "the map stops here".
    ctx.clearRect(0, 0, width, height);
    const lists = cache.buckets[month];
    if (!lists) return;
    for (let bin = 0; bin < STEPS; bin += 1) {
      const list = lists[bin];
      if (!list?.length) continue;
      // One fillStyle per bin, and one fill per cell. Not one path per bin: measured on this
      // figure, nine batched paths of ~3,000 quads each take 188ms to fill against 6ms for the
      // same quads filled one at a time, because a path that large falls off the rasteriser's
      // fast route. Group the colour, not the geometry.
      ctx.fillStyle = RAMP[bin] as string;
      for (let k = 0; k < list.length; k += 1) {
        const ring = cache.rings[list[k] as number];
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
  }, [cache, month, width, height]);

  return (
    <section className="chart-panel">
      <div className="amplitude-map-frame" ref={sizeRef}>
        <canvas
          ref={canvasRef}
          id="amplitude-map-chart"
          className="story-figure"
          width={width}
          height={height}
          role="img"
          aria-label={t.aria}
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
          {cache?.outlines.map((outline, index) => (
            <path
              key={index}
              d={outline.d}
              className={outline.measured ? "is-measured" : "is-estimated"}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      </div>
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

// The legend's numbers are the quantiser's own edges, not a second rounding of the same data:
// `edges` is what the cells were binned on, so the strip and the map cannot disagree.
function fillEdges(template: string, edges: number[], domain: number): string {
  const neutral = edges[0] ?? 1;
  return template
    .replace("{neutral}", d3.format(",.0f")(neutral))
    .replace("{domain}", d3.format(",.0f")(domain));
}
