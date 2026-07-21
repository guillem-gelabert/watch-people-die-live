"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { expGap, REAL_MEAN_GAP_MS } from "../chartHelpers";
import { showTooltip, hideTooltip } from "../tooltip";
import {
  drawGrayEarthBasemap,
  fitRegionProjection,
  insideViewport,
  loadGrayEarth,
  useIsMobileMap,
  type Bbox,
} from "./basemap";
import type { CountryFeature, DensityGrid, DeathsPerYearById } from "../types";

interface Dot {
  xy: [number, number];
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

// East Asia — China and India, plus enough margin to keep both whole.
const BBOX: Bbox = [
  [65, 5],
  [140, 55],
];
const MOBILE_SIZE = 430;

// Same center as BBOX, cropped to a square and zoomed in for the 1:1 mobile panel.
const MOBILE_BBOX: Bbox = [
  [83.5, 11],
  [121.5, 49],
];

// Chart 3: population-density choropleth (canvas), GPWv4 grid cells, with the same
// animated Poisson-dot layer as steps 1-2 — except a death now lands on a country's
// grid cell chosen in proportion to that cell's population, instead of the country's
// single centroid.
export default function DensityMap({ grid, features, deathsPerYearById }: DensityMapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [logScale, setLogScale] = useState(true);
  const isMobile = useIsMobileMap();
  const width = isMobile ? MOBILE_SIZE : 860;
  const height = isMobile ? MOBILE_SIZE : 430;
  const bbox = isMobile ? MOBILE_BBOX : BBOX;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !grid || !features) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const projection = fitRegionProjection(bbox, width, height);

    // Static layer (background, ~60k density cells, legend) is expensive to redraw at
    // 60fps, so it's rendered once to an offscreen canvas and blitted every frame; only
    // the dots are redrawn live.
    const bg = document.createElement("canvas");
    bg.width = width;
    bg.height = height;
    const bgCtx = bg.getContext("2d");
    if (!bgCtx) return;

    // Solid black immediately — "space" backdrop while the relief image loads, and the
    // base the relief (below) and the overlay-blended density cells (below that) composite onto.
    bgCtx.fillStyle = "#000000";
    bgCtx.fillRect(0, 0, width, height);

    // Map a raw population to the value the color scale reads: log-compressed
    // (long tail spread out) or linear (a handful of dense cells dominate).
    const maxPop = d3.max(grid.cells, (c) => c[2]) ?? 0;
    const scaleValue = (pop: number) => (logScale ? Math.log1p(pop) : pop);
    const maxValue = scaleValue(maxPop);
    // Black → red → white ramp: black → red eases across the first three quarters of
    // the scale, then red → white burns out over the densest quarter. Empty cells sink
    // into black; only the biggest cities reach white.
    const color = d3
      .scaleLinear<string>()
      .domain([0, maxValue * 0.75, maxValue])
      .range(["#000000", "#ff2b2b", "#ffffff"])
      .interpolate(d3.interpolateRgb)
      .clamp(true);

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

    // Relief drawn once the image resolves, then the density cells overlay-blended on
    // top: black/white in the relief (ocean, ice) stay black/white regardless of the
    // density color, while mid-gray relief (most land) is fully tinted by it — unlike
    // hard-light, which branches on the density color's own brightness instead of the
    // basemap's, so it doesn't reliably preserve the basemap's black/white extremes.
    void loadGrayEarth().then((image) => {
      drawGrayEarthBasemap(bgCtx, projection, image);

      bgCtx.save();
      bgCtx.globalCompositeOperation = "overlay";
      for (const [lon, lat, pop] of visibleCells) {
        const p0 = projection([lon, lat + cellsize]);
        const p1 = projection([lon + cellsize, lat]);
        if (!p0 || !p1) continue;
        const x = Math.min(p0[0], p1[0]);
        const y = Math.min(p0[1], p1[1]);
        const w = Math.max(1, Math.abs(p1[0] - p0[0]));
        const h = Math.max(1, Math.abs(p1[1] - p0[1]));
        bgCtx.fillStyle = color(scaleValue(pop));
        bgCtx.fillRect(x, y, w, h);
      }
      bgCtx.restore();
    });

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

    const canAnimate = countries.length > 0 && totalDeathsPerYear > 0;
    const dots: Dot[] = [];
    const meanGapMs = REAL_MEAN_GAP_MS;
    const dotLifetimeMs = 5200;
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
          if (insideViewport(xy, width, height)) dots.push({ xy, born: nextAt });
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

      for (let i = dots.length - 1; i >= 0; i--) {
        const dot = dots[i];
        if (!dot) continue;
        const age = now - dot.born;
        const alpha = Math.max(0, 1 - age / dotLifetimeMs);
        if (alpha <= 0) {
          dots.splice(i, 1);
          continue;
        }
        const [x, y] = dot.xy;
        const radius = 2.2 + age / 850;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha * 0.9})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.42})`;
        ctx.lineWidth = 1;
        ctx.stroke();
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
  }, [grid, features, deathsPerYearById, logScale, bbox, width, height]);

  return (
    <section className="chart-panel wide no-card">
      <p className="chart-copy">
        GPWv4 population counts on the 0.5° grid, equirectangular projection. Brighter cells hold
        more people. Dots now land on a grid cell chosen in proportion to that cell&apos;s
        population, instead of a country&apos;s single geographic center.
      </p>
      <div className="chart-toggle" role="group" aria-label="Color scale">
        <button
          type="button"
          className={logScale ? "active" : ""}
          aria-pressed={logScale}
          onClick={() => setLogScale(true)}
        >
          Log scale
        </button>
        <button
          type="button"
          className={!logScale ? "active" : ""}
          aria-pressed={!logScale}
          onClick={() => setLogScale(false)}
        >
          Linear scale
        </button>
      </div>
      <canvas
        ref={canvasRef}
        id="density-map-chart"
        className="seasonality-chart map-bleed"
        width={width}
        height={height}
        role="img"
        aria-label="Map of China and India colored by population density per grid cell, with dots landing on cells in proportion to their population"
      />
      <div className="density-legend" aria-hidden="true">
        <span>low</span>
        <span className="density-legend-bar" />
        <span>high</span>
        <span className="density-legend-caption">
          people per cell ({logScale ? "log" : "linear"} scale)
        </span>
      </div>
    </section>
  );
}
