"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { expGap, REAL_MEAN_GAP_MS } from "../chartHelpers";
import { showTooltip, hideTooltip } from "../tooltip";
import { fitProjection, insideViewport, type Bbox } from "./basemap";
import ScaleDiagonalToggle from "./ScaleDiagonalToggle";
import { useCanvasScale, useFigureWidth } from "./useFigureSize";
import type { CountryFeature, DensityGrid, DeathsPerYearById } from "../types";

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

// South and east Asia: the Indo-Gangetic plain, the Chinese coast and the emptiness between
// them, which is where the difference between a log and a linear scale is most of the picture.
//
// Fixed literals rather than palette-derived, matching the design: this map keeps a dark plate
// through every sky, so its cells stay in one register instead of following the section hue.
const PLATE = "#251f2b";
const DENSITY_RGB = [143, 246, 197]; // #8ff6c5
const GRATICULE = "#f6c58f";
const BBOX: Bbox = [
  [88, 2],
  [122, 40],
];
// The canvas is drawn at the display's own pixel density so the 0.5° cells stay square-edged rather
// than resampled, and capped so a wide screen does not ask for a four-megapixel raster.
const MAX_SIDE = 560;
const CROSSHAIR = 10;
const DART = "#e86d83";

// The density layer, and the only figure in the story that is still a canvas: it shades tens of
// thousands of grid cells, which as SVG would be tens of thousands of DOM nodes. A death now lands
// on one of those cells, picked in proportion to how many people are in it, instead of on its
// country's single centroid.
export default function DensityMap({ grid, features, deathsPerYearById }: DensityMapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [logScale, setLogScale] = useState(true);
  const [sizeRef, measured] = useFigureWidth<HTMLDivElement>();
  const scale = useCanvasScale();
  const side = Math.min(MAX_SIDE, measured);
  const width = Math.round(side * scale);
  const height = width;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !grid || !features) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const projection = fitProjection(
      d3.geoConicEqualArea().parallels([12, 40]).rotate([-105, 0]).center([0, 20]),
      BBOX,
      width,
      height,
      0,
    );

    // Static layer (background, ~60k density cells, legend) is expensive to redraw at
    // 60fps, so it's rendered once to an offscreen canvas and blitted every frame; only
    // the dots are redrawn live.
    const bg = document.createElement("canvas");
    bg.width = width;
    bg.height = height;
    const bgCtx = bg.getContext("2d");
    if (!bgCtx) return;

    // The plate, matching the close-ups above: this figure's whole point is how much of the land
    // is empty, and with the page showing through, "nobody lives here" and "no map here" would be
    // the same colour. Painted first, under the cells.
    bgCtx.fillStyle = PLATE;
    bgCtx.fillRect(0, 0, width, height);

    // Map a raw population to the value the alpha scale reads: log-compressed (the long tail
    // spread out) or linear (a handful of dense cells taking the whole range).
    const maxPop = d3.max(grid.cells, (c) => c[2]) ?? 0;
    const scaleValue = (pop: number) => (logScale ? Math.log1p(pop) : pop);
    const maxValue = scaleValue(maxPop);
    const [dr, dg, db] = DENSITY_RGB;
    const cellFill = (pop: number) => {
      const t = maxValue > 0 ? Math.min(1, scaleValue(pop) / maxValue) : 0;
      return `rgba(${dr},${dg},${db},${(0.08 + t * 0.92).toFixed(3)})`;
    };

    // Cells outside the panel can't be visible, so they're skipped before ever touching
    // the projection — cuts the loop from ~60k global cells down to the ones the crop
    // can actually show. The visible window is wider than BBOX itself whenever the
    // panel's aspect ratio doesn't match the bbox's (fitExtent pads the short axis to
    // fill the panel), so it's measured directly by inverting the canvas corners —
    // filtering by the raw bbox instead would clip cells inside a still-visible margin,
    // leaving a hard rectangular seam where valid data cuts off early.
    const cellsize = grid.cellsize;
    const corners = [
      projection.invert?.([0, 0]),
      projection.invert?.([width, 0]),
      projection.invert?.([0, height]),
      projection.invert?.([width, height]),
    ].filter((c): c is [number, number] => Boolean(c));
    const visLon0 = Math.min(...corners.map((c) => c[0])) - cellsize;
    const visLon1 = Math.max(...corners.map((c) => c[0])) + cellsize;
    const visLat0 = Math.min(...corners.map((c) => c[1])) - cellsize;
    const visLat1 = Math.max(...corners.map((c) => c[1])) + cellsize;
    const visibleCells = grid.cells.filter(
      ([lon, lat]) => lon >= visLon0 && lon <= visLon1 && lat >= visLat0 && lat <= visLat1,
    );

    // The cells, then a graticule in the page's own colour over the top — the only geographic
    // reference the figure gets, and the one thing that tells the reader these squares are on a
    // sphere. Half a pixel of overdraw closes the seams a conic projection opens between rows.
    for (const [lon, lat, pop] of visibleCells) {
      const p0 = projection([lon, lat + cellsize]);
      const p1 = projection([lon + cellsize, lat]);
      if (!p0 || !p1) continue;
      const x = Math.min(p0[0], p1[0]);
      const y = Math.min(p0[1], p1[1]);
      const w = Math.max(1, Math.abs(p1[0] - p0[0]));
      const h = Math.max(1, Math.abs(p1[1] - p0[1]));
      bgCtx.fillStyle = cellFill(pop);
      bgCtx.fillRect(x, y, w + 0.6, h + 0.6);
    }

    const graticulePath = d3.geoPath(projection, bgCtx);
    bgCtx.save();
    bgCtx.beginPath();
    graticulePath(d3.geoGraticule().step([10, 10])());
    bgCtx.strokeStyle = GRATICULE;
    bgCtx.lineWidth = 1.1;
    bgCtx.globalAlpha = 0.5;
    bgCtx.stroke();
    bgCtx.restore();

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
    let nextAt = performance.now() + expGap(meanGapMs);
    let rafId: number;
    let cancelled = false;

    function frame(now: number) {
      if (cancelled) return;
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
      if (canAnimate) rafId = requestAnimationFrame(frame);
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
    if (canAnimate) rafId = requestAnimationFrame(frame);

    // Hover: nearest grid cell under the pointer (falls back to country name if the
    // exact cell has no data, e.g. ocean).
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
      if (cell) {
        showTooltip(
          `${Math.round(cell[2]).toLocaleString()} people/cell`,
          event.clientX,
          event.clientY,
        );
      } else {
        const hit = features.find((f) => d3.geoContains(f, lonLat));
        showTooltip(
          hit ? `${hit.properties?.name ?? "Unknown"}: no data` : "Ocean",
          event.clientX,
          event.clientY,
        );
      }
    }
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", hideTooltip);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", hideTooltip);
    };
  }, [grid, features, deathsPerYearById, logScale, width, height]);

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
          aria-label="South and east Asia shaded by population per grid cell, with deaths landing on cells in proportion to their population"
        />
        <ScaleDiagonalToggle id="density-scale" logOn={logScale} onToggle={setLogScale} />
      </div>
    </section>
  );
}
