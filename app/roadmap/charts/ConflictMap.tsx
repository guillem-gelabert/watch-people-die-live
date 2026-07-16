"use client";

import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import { expGap } from "../chartHelpers";
import { showTooltip, hideTooltip } from "../tooltip";
import type { ConflictsPayload, CountryFeature } from "../types";

interface Dot {
  id: number;
  x: number;
  y: number;
  born: number;
}

interface ConflictPoint {
  x: number;
  y: number;
  fatalities: number; // annualised deaths/year for this cell
}

interface ConflictMapProps {
  features: CountryFeature[] | null;
  conflicts: ConflictsPayload | null;
}

const WIDTH = 860;
const HEIGHT = 360;
const DOT_LIFETIME_MS = 5200;
// Illustrative tempo: dots are placed in proportion to each cell's fatalities so the spatial
// concentration is real; the pace itself is chosen for legibility (the true counts are in the
// status line), the same convention the earlier map steps use.
const MEAN_GAP_MS = 200;

// Step 6: the same animated-dot idea as the earlier map steps, but every dot lands where ACLED
// recorded conflict fatalities over the last year — the deadliest cells pulse fastest. This is
// the exact spatial layer the globe folds into its sampler. Rendered as SVG.
export default function ConflictMap({ features, conflicts }: ConflictMapProps) {
  const ref = useRef<SVGSVGElement | null>(null);

  const status = useMemo(() => {
    if (!features) return "Loading map…";
    if (!conflicts) return "Loading conflict data…";
    if (!conflicts.cells.length) {
      return conflicts.note
        ? `No conflict data available (${conflicts.note}).`
        : "No conflict fatalities in the current window.";
    }
    const months = Math.max(1, Math.round(conflicts.window.days / 30));
    const top = conflicts.byCountry
      .slice(0, 3)
      .map((c) => c.country)
      .join(", ");
    return `${conflicts.totalFatalities.toLocaleString()} conflict fatalities over the last ${months} months across ${conflicts.byCountry.length} countries. Deadliest: ${top}. Each dot is placed where ACLED recorded them.`;
  }, [features, conflicts]);

  useEffect(() => {
    if (!ref.current || !features || !conflicts || !conflicts.cells.length) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const projection = d3.geoEqualEarth().fitExtent(
      [
        [18, 18],
        [WIDTH - 18, HEIGHT - 18],
      ],
      { type: "Sphere" },
    );
    const path = d3.geoPath(projection);

    // Static base: sphere + country outlines.
    svg
      .append("path")
      .datum<d3.GeoSphere>({ type: "Sphere" })
      .attr("d", path)
      .attr("fill", "rgba(255,255,255,0.025)")
      .attr("stroke", "rgba(255,255,255,0.16)");
    svg
      .append("g")
      .selectAll("path")
      .data(features)
      .join("path")
      .attr("class", "map-outline")
      .attr("d", path);

    // One weighted point per conflict cell, projected at the cell centre.
    const half = conflicts.cellsize / 2;
    const points: ConflictPoint[] = conflicts.cells
      .map((cell): ConflictPoint | null => {
        const [lon, lat, fatalities] = cell;
        if (!(fatalities > 0)) return null;
        const xy = projection([lon + half, lat + half]);
        if (!xy) return null;
        return { x: xy[0], y: xy[1], fatalities };
      })
      .filter((p): p is ConflictPoint => p !== null);
    const totalWeight = d3.sum(points, (p) => p.fatalities);
    if (!points.length || !(totalWeight > 0)) return;

    function pickPoint(): ConflictPoint {
      let r = Math.random() * totalWeight;
      for (const p of points) {
        r -= p.fatalities;
        if (r < 0) return p;
      }
      return points[points.length - 1]!;
    }

    const dotsG = svg.append("g").attr("class", "map-dots");
    const dots: Dot[] = [];
    let nextId = 0;
    let nextAt = performance.now() + expGap(MEAN_GAP_MS);
    let rafId = 0;
    let cancelled = false;

    function frame(now: number) {
      if (cancelled) return;
      while (now >= nextAt) {
        const p = pickPoint();
        dots.push({ id: nextId++, x: p.x, y: p.y, born: nextAt });
        nextAt += expGap(MEAN_GAP_MS);
      }
      for (let i = dots.length - 1; i >= 0; i--) {
        if (now - dots[i]!.born >= DOT_LIFETIME_MS) dots.splice(i, 1);
      }
      dotsG
        .selectAll<SVGCircleElement, Dot>("circle")
        .data(dots, (d) => d.id)
        .join((enter) =>
          enter
            .append("circle")
            .attr("cx", (d) => d.x)
            .attr("cy", (d) => d.y),
        )
        .attr("r", (d) => 2.2 + (now - d.born) / 850)
        .attr("fill", "#ff6b6b")
        .attr("fill-opacity", (d) => Math.max(0, 1 - (now - d.born) / DOT_LIFETIME_MS) * 0.9)
        .attr("stroke", "#ff6b6b")
        .attr("stroke-opacity", (d) => Math.max(0, 1 - (now - d.born) / DOT_LIFETIME_MS) * 0.42);
      rafId = requestAnimationFrame(frame);
    }

    // Hover: country under the pointer + its ACLED fatalities over the window (exact-name join).
    const fatalitiesByCountry = new Map(conflicts.byCountry.map((c) => [c.country, c.fatalities]));
    svg
      .append("rect")
      .attr("width", WIDTH)
      .attr("height", HEIGHT)
      .attr("fill", "transparent")
      .on("pointermove", (event) => {
        const [x, y] = d3.pointer(event, ref.current);
        const lonLat = projection.invert?.([x, y]);
        const hit = lonLat ? features.find((f) => d3.geoContains(f, lonLat)) : undefined;
        if (!hit) {
          hideTooltip();
          return;
        }
        const name = hit.properties?.name ?? "Unknown";
        const fatalities = fatalitiesByCountry.get(name);
        const label = fatalities
          ? `${name}: ${fatalities.toLocaleString()} conflict deaths (window)`
          : `${name}: no recorded conflict fatalities`;
        showTooltip(label, event.clientX, event.clientY);
      })
      .on("pointerleave", hideTooltip);

    rafId = requestAnimationFrame(frame);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [features, conflicts]);

  return (
    <section className="chart-panel wide">
      <h4 className="chart-title">Where Conflicts Kill</h4>
      <p className="chart-copy">
        Every dot lands where ACLED recorded a conflict fatality over the last year. The pattern is
        sparse and concentrated — a handful of regions carry almost all of it — which is exactly why
        the globe folds these deaths into the specific cells they happened in rather than smearing
        them across a country.
      </p>
      <svg
        ref={ref}
        id="conflict-map-chart"
        className="seasonality-chart"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="World map where dots appear in the regions with recorded conflict fatalities over the last year"
      />
      <p id="conflict-map-status" className="chart-status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
