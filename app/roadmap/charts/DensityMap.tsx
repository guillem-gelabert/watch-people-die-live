"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { expGap, REAL_MEAN_GAP_MS } from "../chartHelpers";
import { showTooltip, hideTooltip } from "../tooltip";
import {
  fitProjection,
  GRATICULE_WIDTH,
  inflateCell,
  insideViewport,
  projectCell,
  type Bbox,
} from "./basemap";
import ScaleDiagonalToggle from "./ScaleDiagonalToggle";
import { useCanvasScale, useFigureWidth } from "./useFigureSize";
import type { CountryFeature, DensityGrid, DeathsPerYearById } from "../types";
import { useDict } from "../I18nContext";
import { fill } from "@/lib/i18n/fill";
import { useNearViewport, useReducedMotion } from "../useNearViewport";

interface Dot {
  xy: [number, number];
  // Local north at the landing point, in radians, so the crosshair follows the graticule.
  bearing: number;
  born: number;
}

interface CountryEntry {
  id: number;
  deathsPerYear: number;
  centroidXY: [number, number];
}

interface DensityMapProps {
  grid: DensityGrid | null;
  features: CountryFeature[] | null;
  deathsPerYearById: DeathsPerYearById | null;
}

// India in the middle of the frame, with the Indo-Gangetic plain the copy names across its north,
// the Chinese coast reaching the eastern edge, and the emptiness between the two — which is where
// the difference between a log and a linear scale is most of the picture.
//
// Fixed literals rather than palette-derived, matching the design: this map keeps a dark plate
// through every sky, so its cells stay in one register instead of following the section hue. Held
// as channels rather than a hex string because every cell fill is this plate mixed with the density
// hue at the cell's own weight, resolved to an opaque colour before it is drawn (see cellFill).
const PLATE_RGB: [number, number, number] = [37, 31, 43]; // #251f2b
const DENSITY_RGB: [number, number, number] = [143, 246, 197]; // #8ff6c5
// Centred on India (~80°E, 22°N) at a 58° span, so the subcontinent sits in the middle of the frame
// with the Chinese coast still reaching the eastern edge.
const BBOX: Bbox = [
  [51, -7],
  [109, 51],
];
// The canvas is drawn at the display's own pixel density so the 0.5° cells stay square-edged rather
// than resampled, and capped so a wide screen does not ask for a four-megapixel raster.
const MAX_SIDE = 560;
const CROSSHAIR = 10;
const DART = "#e86d83";
// How far each cell grows past its own edge, in device pixels. Canvas has no way to turn
// antialiasing off — the SVG cell maps use shape-rendering: crispEdges — so a little overlap is the
// only way to stop two exact neighbours each covering half their shared edge and letting the plate
// through as a grid. It has to stay small: the fills are opaque, so whatever a cell overlaps it
// covers outright, and a cell here is only about 2.3px across.
const CELL_OVERLAP = 0.25;

// The density layer, and the only figure in the story that is still a canvas: it shades tens of
// thousands of grid cells, which as SVG would be tens of thousands of DOM nodes. A death now lands
// on one of those cells, picked in proportion to how many people are in it, instead of on its
// country's single centroid.
export default function DensityMap({ grid, features, deathsPerYearById }: DensityMapProps) {
  const d = useDict();
  const t = d.charts.densityMap;
  const unknown = d.charts.common.unknown;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const near = useNearViewport(canvasRef);
  const reduceMotion = useReducedMotion();
  const animate = near && !reduceMotion;
  const animateRef = useRef(animate);
  const animationRef = useRef<{ start: () => void; stop: () => void } | null>(null);
  const [logScale, setLogScale] = useState(true);
  const [sizeRef, measured] = useFigureWidth<HTMLDivElement>();
  const scale = useCanvasScale();
  const side = Math.min(MAX_SIDE, measured);
  const width = Math.round(side * scale);
  const height = width;

  useEffect(() => {
    animateRef.current = animate;
  }, [animate]);

  // Central meridian and centre track BBOX — a conic left pointed at its old meridian would put
  // India far off-axis and hand it that distortion. Standard parallels sit at a sixth and five
  // sixths of the latitude span, which is where a conic equal-area is truest.
  //
  // Held here rather than inside the effect because the graticule overlay needs it too, and it is
  // fully determined by the panel size.
  const projection = useMemo(
    () =>
      fitProjection(
        d3.geoConicEqualArea().parallels([3, 41]).rotate([-80, 0]).center([0, 22]),
        BBOX,
        width,
        height,
        0,
      ),
    [width, height],
  );

  // Derived, not state: the grid of parallels and meridians depends on nothing but the projection.
  const graticuleD = useMemo(
    () => d3.geoPath(projection)(d3.geoGraticule().step([10, 10])()) ?? "",
    [projection],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !grid || !features) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Static layer (background, ~60k density cells, legend) is expensive to redraw at
    // 60fps, so it's rendered once to an offscreen canvas and blitted every frame; only
    // the dots are redrawn live.
    const bg = document.createElement("canvas");
    bg.width = width;
    bg.height = height;
    const bgCtx = bg.getContext("2d");
    if (!bgCtx) return;

    // Map a raw population to the value the alpha scale reads: log-compressed (the long tail
    // spread out) or linear (a handful of dense cells taking the whole range).
    const maxPop = d3.max(grid.cells, (c) => c[2]) ?? 0;
    const scaleValue = (pop: number) => (logScale ? Math.log1p(pop) : pop);
    const maxValue = scaleValue(maxPop);
    const [dr, dg, db] = DENSITY_RGB;
    const [pr, pg, pb] = PLATE_RGB;
    // Opaque, not translucent, and this is the fix for the grid the cells used to show. The fills
    // carried the population in their alpha, and because the cells overlap slightly (see below) every
    // shared edge was composited twice — so each edge came out darker than either cell, drawing a
    // lattice over the whole crop. Mixing the alpha into the plate here and filling with the result
    // gives the identical colour with none of that: painting one opaque colour twice is the same as
    // painting it once.
    const cellFill = (pop: number) => {
      const t = maxValue > 0 ? Math.min(1, scaleValue(pop) / maxValue) : 0;
      const a = 0.08 + t * 0.92;
      const mix = (plate: number, dense: number) => Math.round(plate + (dense - plate) * a);
      return `rgb(${mix(pr, dr)},${mix(pg, dg)},${mix(pb, db)})`;
    };

    // The plate, matching the close-ups above: this figure's whole point is how much of the land is
    // empty, and with the page showing through, "nobody lives here" and "no map here" would be the
    // same colour. It is painted at the population-zero fill rather than at the bare plate, so a
    // cell the grid has no row for reads as nobody rather than as a hole in the map — and taking
    // that colour from cellFill(0) is what keeps the two exactly equal.
    bgCtx.fillStyle = cellFill(0);
    bgCtx.fillRect(0, 0, width, height);

    // Cells outside the panel can't be visible, so they're skipped before ever touching the
    // projection — that cuts the loop from ~60k global cells down to the ones the crop can actually
    // show. Filtering by the raw BBOX would be wrong: whenever the panel's aspect ratio doesn't match
    // the bbox's, fitExtent pads the short axis, so the panel shows more than the bbox asked for.
    //
    // The window is therefore measured off the canvas itself — but off a grid of points across it,
    // not off its four corners. A conic projects parallels as arcs, so the highest latitude along the
    // top edge is at its middle, several degrees above either top corner. Sampling only the corners
    // understated the range and filtered those cells away, leaving the top of the map an empty black
    // arc where the data actually reaches. Sampling the interior too covers the same trap on any
    // projection whose extremes fall inside an edge rather than on a corner.
    const cellsize = grid.cellsize;
    const STEPS = 24;
    const seen: [number, number][] = [];
    for (let i = 0; i <= STEPS; i++) {
      for (let j = 0; j <= STEPS; j++) {
        const p = projection.invert?.([(width * i) / STEPS, (height * j) / STEPS]);
        if (p && Number.isFinite(p[0]) && Number.isFinite(p[1])) seen.push([p[0], p[1]]);
      }
    }
    const lons = seen.map((p) => p[0]);
    const lats = seen.map((p) => p[1]);
    const visLon0 = Math.min(...lons) - cellsize;
    const visLon1 = Math.max(...lons) + cellsize;
    const visLat0 = Math.min(...lats) - cellsize;
    const visLat1 = Math.max(...lats) + cellsize;
    const visibleCells = grid.cells.filter(
      ([lon, lat]) => lon >= visLon0 && lon <= visLon1 && lat >= visLat0 && lat <= visLat1,
    );

    // The cells, then a graticule in the page's own colour over the top — the only geographic
    // reference the figure gets, and the one thing that tells the reader these squares are on a
    // sphere.
    //
    // Each cell is the quadrilateral its four corners actually project to, not an axis-aligned
    // rectangle between two of them. A 0.5° cell is a rectangle in lon/lat and a tilted quad on a
    // conic: at the edges of this crop the tilt reaches about 12° and a rectangle misses the true
    // corner by ~0.7px on a cell only ~2.3px across — a quarter of the cell, which is what the
    // stair-stepping along the frame edges was. Filled only, never stroked; inflateCell is what
    // closes the seams (see basemap.ts) in place of the old half-pixel rectangular overdraw.
    for (const [lon, lat, pop] of visibleCells) {
      const ring = projectCell(projection, lon, lat, cellsize);
      if (!ring) continue;
      const grown = inflateCell(ring, CELL_OVERLAP);
      bgCtx.fillStyle = cellFill(pop);
      bgCtx.beginPath();
      bgCtx.moveTo(grown[0]![0], grown[0]![1]);
      for (let i = 1; i < grown.length; i++) bgCtx.lineTo(grown[i]![0], grown[i]![1]);
      bgCtx.closePath();
      bgCtx.fill();
    }

    // The graticule is not drawn here at all any more — it is the SVG overlay in the render below.
    // On the canvas it was a rasterised 1.1 device-pixel stroke, barely half a CSS pixel on a 2×
    // screen, thin and visibly aliased; and its colour had to be baked into the static layer, so
    // following the section's background would have meant re-projecting eleven thousand cells on
    // every sky change. As vector it is crisp at any density, takes its width from the same constant
    // as every other square map, and follows the sky through a CSS variable for free.

    // Group cells by their owning country (m49) so a death can be routed: country
    // (weighted by real death rate) → cell within that country (weighted by population).
    // Uses every cell worldwide, not just the visible ones, so a death still lands on
    // the right cell even for a country outside this crop (it's just then filtered out
    // below, same as the other maps) rather than skewing toward China/India's own cells.
    interface CellEntry {
      cells: { lon: number; lat: number; pop: number }[];
      totalPop: number;
    }
    const cellsByCountry = new Map<number, CellEntry>();
    for (const [lon, lat, pop, m49] of grid.cells) {
      const id = Number(m49);
      let entry = cellsByCountry.get(id);
      if (!entry) {
        entry = { cells: [], totalPop: 0 };
        cellsByCountry.set(id, entry);
      }
      entry.cells.push({ lon, lat, pop });
      entry.totalPop += pop;
    }

    const countries: CountryEntry[] = deathsPerYearById
      ? features
          .map((feature): CountryEntry | null => {
            const id = Number(feature.id);
            const deathsPerYear = deathsPerYearById.get(id);
            if (!(deathsPerYear && deathsPerYear > 0)) return null;
            const centroidXY = projection(d3.geoCentroid(feature));
            if (!centroidXY) return null;
            return { id, deathsPerYear, centroidXY };
          })
          .filter((c): c is CountryEntry => c !== null)
      : [];
    const totalDeathsPerYear = d3.sum(countries, (c) => c.deathsPerYear);

    function pickCountry(): CountryEntry {
      let r = Math.random() * totalDeathsPerYear;
      for (const c of countries) {
        r -= c.deathsPerYear;
        if (r < 0) return c;
      }
      return countries[countries.length - 1]!;
    }

    // Weighted by population within the chosen country; falls back to its centroid
    // when the country owns no grid cell (small island states at 0.5° resolution).
    function placeDeath(): [number, number] | null {
      const country = pickCountry();
      const entry = cellsByCountry.get(country.id);
      if (!entry || !entry.cells.length) return country.centroidXY;
      let r = Math.random() * entry.totalPop;
      let cell = entry.cells[entry.cells.length - 1]!;
      for (const c of entry.cells) {
        r -= c.pop;
        if (r < 0) {
          cell = c;
          break;
        }
      }
      const lon = cell.lon + Math.random() * grid!.cellsize;
      const lat = cell.lat + Math.random() * grid!.cellsize;
      return projection([lon, lat]);
    }

    const bearingAt = (xy: [number, number]) => {
      const lonLat = projection.invert?.(xy);
      if (!lonLat) return 0;
      const north = projection([lonLat[0], Math.min(90, lonLat[1] + 0.5)]);
      if (!north) return 0;
      return Math.atan2(north[0] - xy[0], xy[1] - north[1]);
    };

    const canAnimate = countries.length > 0 && totalDeathsPerYear > 0;
    const dots: Dot[] = [];
    const meanGapMs = REAL_MEAN_GAP_MS;
    const dotLifetimeMs = 20800;
    let nextAt = 0;
    let rafId = 0;
    let disposed = false;

    function frame(now: number) {
      if (disposed || rafId === 0) return;
      if (canAnimate) {
        while (now >= nextAt) {
          // Deaths are still placed at each country's real global rate and cell
          // population — only those landing inside the cropped region are kept.
          const xy = placeDeath();
          if (insideViewport(xy, width, height)) {
            dots.push({ xy, bearing: bearingAt(xy), born: nextAt });
          }
          nextAt += expGap(meanGapMs);
        }
      }
      draw(now);
      if (canAnimate && rafId !== 0) rafId = requestAnimationFrame(frame);
    }

    function draw(now: number) {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(bg, 0, 0);

      // Same crosshair as the maps before it, squared to the local graticule, so the reader sees
      // the same mark moving from "anywhere on Earth" to "in this cell, because people are here".
      for (let i = dots.length - 1; i >= 0; i--) {
        const dot = dots[i];
        if (!dot) continue;
        const age = now - dot.born;
        const k = Math.max(0, 1 - age / dotLifetimeMs);
        if (k <= 0) {
          dots.splice(i, 1);
          continue;
        }
        const alpha = k * k;
        ctx.save();
        ctx.translate(dot.xy[0], dot.xy[1]);
        ctx.rotate(dot.bearing);
        ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(-CROSSHAIR, 0);
        ctx.lineTo(CROSSHAIR, 0);
        ctx.moveTo(0, -CROSSHAIR);
        ctx.lineTo(0, CROSSHAIR);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, 2.1, 0, Math.PI * 2);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = DART;
        ctx.fill();
        ctx.restore();
      }
    }

    draw(performance.now());
    const controller = {
      start() {
        if (disposed || !canAnimate || rafId !== 0) return;
        nextAt = performance.now() + expGap(meanGapMs);
        rafId = requestAnimationFrame(frame);
      },
      stop() {
        if (rafId === 0) return;
        cancelAnimationFrame(rafId);
        rafId = 0;
      },
    };
    animationRef.current = controller;
    if (animateRef.current) controller.start();

    // Hover: the grid cell under the pointer. A cell the grid has no row for reads as zero people
    // rather than as missing — the same treatment it already gets in the fill, where the background
    // is painted at cellFill(0) so an unmapped cell and a mapped empty one are the same colour.
    // Saying "no data" here would contradict what the reader can see, and for this grid the two
    // really are the same claim: the source covers the whole land surface, so a cell with no row is
    // a cell with nobody in it, not a gap in the coverage.
    function onPointerMove(event: PointerEvent) {
      if (!grid || !features) return;
      const rect = canvas!.getBoundingClientRect();
      const scaleX = canvas!.width / rect.width;
      const scaleY = canvas!.height / rect.height;
      const x = (event.clientX - rect.left) * scaleX;
      const y = (event.clientY - rect.top) * scaleY;
      const lonLat = projection.invert?.([x, y]);
      if (!lonLat) {
        hideTooltip();
        return;
      }
      const [lon, lat] = lonLat;
      const size = grid.cellsize;
      const cellLon = Math.floor(lon / size) * size;
      const cellLat = Math.floor(lat / size) * size;
      const cell = grid.cells.find((c) => c[0] === cellLon && c[1] === cellLat);
      const people = Math.round(cell ? cell[2] : 0).toLocaleString();
      if (cell) {
        showTooltip(`${people} people/cell`, event.clientX, event.clientY);
      } else {
        // The country name still comes along when there is one, so an empty cell on land reads
        // differently from empty sea without either of them claiming to be missing data.
        const hit = features.find((f) => d3.geoContains(f, lonLat));
        showTooltip(
          hit
            ? fill(t.peoplePerCell, { name: hit.properties?.name ?? unknown, n: people })
            : `${people} people/cell`,
          event.clientX,
          event.clientY,
        );
      }
    }
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", hideTooltip);
    return () => {
      disposed = true;
      controller.stop();
      if (animationRef.current === controller) animationRef.current = null;
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", hideTooltip);
    };
  }, [grid, features, deathsPerYearById, logScale, projection, width, height, t, unknown]);

  useEffect(() => {
    const animation = animationRef.current;
    if (!animation) return;
    if (animate) animation.start();
    else animation.stop();
  }, [animate]);

  return (
    <section className="chart-panel wide">
      {/* The toggle sits on the map, so switching scales and seeing what changed are the same
          glance. No legend: the two words on the control are the legend. */}
      <div className="density-map-frame" ref={sizeRef}>
        <canvas
          ref={canvasRef}
          id="density-map-chart"
          className="story-figure"
          width={width}
          height={height}
          role="img"
          aria-label={t.aria}
        />
        {/* The graticule, over the cells and in the section's own colour: vector so it stays crisp
            over a canvas that is redrawn at device resolution, and non-scaling-stroke so its width is
            the same on screen as every other square map's regardless of the viewBox scale. */}
        <svg
          className="density-graticule"
          viewBox={`0 0 ${width} ${height}`}
          aria-hidden="true"
          focusable="false"
        >
          <path
            d={graticuleD}
            fill="none"
            strokeWidth={GRATICULE_WIDTH}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <ScaleDiagonalToggle id="density-scale" logOn={logScale} onToggle={setLogScale} />
      </div>
    </section>
  );
}
