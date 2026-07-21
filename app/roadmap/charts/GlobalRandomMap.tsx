"use client";

import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import {
  expGap,
  randomPointOnSphere,
  REAL_MEAN_GAP_MS,
  formatMeanGap,
  MAP_GRATICULE,
} from "../chartHelpers";
import { showTooltip, hideTooltip } from "../tooltip";
import type { CountryFeature } from "../types";

interface Dot {
  id: number;
  x: number;
  y: number;
  born: number;
}

interface GlobalRandomMapProps {
  features: CountryFeature[] | null;
}

const WIDTH = 860;
const HEIGHT = 360;
const DOT_LIFETIME_MS = 5200;

// Chart 1: animated Poisson-dot world map, rendered as SVG.
export default function GlobalRandomMap({ features }: GlobalRandomMapProps) {
  const ref = useRef<SVGSVGElement | null>(null);

  // Derived (not effect state) so the status can't trigger a cascading render.
  const status = useMemo(() => {
    if (!features) return "Loading random simulation…";
    return `Running at the global average: one randomly placed dot every ${formatMeanGap(REAL_MEAN_GAP_MS)} on average.`;
  }, [features]);

  useEffect(() => {
    if (!ref.current || !features) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const projection = d3.geoEquirectangular().fitExtent(
      [
        [18, 18],
        [WIDTH - 18, HEIGHT - 18],
      ],
      { type: "Sphere" },
    );
    const path = d3.geoPath(projection);

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
    svg.append("path").datum(MAP_GRATICULE).attr("class", "map-graticule").attr("d", path);

    const meanGapMs = REAL_MEAN_GAP_MS;

    const dotsG = svg.append("g").attr("class", "map-dots");
    const dots: Dot[] = [];
    let nextId = 0;
    let nextAt = performance.now() + expGap(meanGapMs);
    let rafId = 0;
    let cancelled = false;

    function frame(now: number) {
      if (cancelled) return;
      while (now >= nextAt) {
        const xy = projection(randomPointOnSphere());
        if (xy) dots.push({ id: nextId++, x: xy[0], y: xy[1], born: nextAt });
        nextAt += expGap(meanGapMs);
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
        .attr("fill", "#ffffff")
        .attr("fill-opacity", (d) => Math.max(0, 1 - (now - d.born) / DOT_LIFETIME_MS) * 0.9)
        .attr("stroke", "#ffffff")
        .attr("stroke-opacity", (d) => Math.max(0, 1 - (now - d.born) / DOT_LIFETIME_MS) * 0.42);
      rafId = requestAnimationFrame(frame);
    }

    // Hover: country under the pointer, or plain coordinates over open ocean.
    svg
      .append("rect")
      .attr("width", WIDTH)
      .attr("height", HEIGHT)
      .attr("fill", "transparent")
      .on("pointermove", (event) => {
        const [x, y] = d3.pointer(event, ref.current);
        const lonLat = projection.invert?.([x, y]);
        if (!lonLat) {
          hideTooltip();
          return;
        }
        const hit = features.find((f) => d3.geoContains(f, lonLat));
        const label = hit
          ? (hit.properties?.name ?? "Unknown")
          : `${lonLat[1].toFixed(1)}°, ${lonLat[0].toFixed(1)}°`;
        showTooltip(label, event.clientX, event.clientY);
      })
      .on("pointerleave", hideTooltip);

    rafId = requestAnimationFrame(frame);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [features]);

  return (
    <section className="chart-panel wide">
      <h4 className="chart-title">Baseline Random Simulation</h4>
      <p className="chart-copy">
        White dots appear at exponentially random intervals, averaging nearly two events every
        second (~0.5s between deaths), and at uniformly random points on the Earth&apos;s surface.
        This first layer has no country, density, or seasonality weighting.
      </p>
      <svg
        ref={ref}
        id="global-random-map-chart"
        className="seasonality-chart"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="World map where white dots appear randomly at the global mortality rate"
      />
      <p id="random-map-status" className="chart-status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
