"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { expGap, randomPointOnSphere, REAL_MEAN_GAP_MS } from "../chartHelpers";
import { showTooltip, hideTooltip } from "../tooltip";
import {
  appendGrayEarthBasemap,
  fitRegionProjection,
  insideViewport,
  useIsMobileMap,
  type Bbox,
} from "./basemap";
import { useSkin } from "../SkinContext";
import { mapColor } from "../palette";
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
const HEIGHT = 430;
const MOBILE_SIZE = 430;
const DOT_LIFETIME_MS = 5200;

// Pacific + South America — open ocean on the left (no country weighting yet, so an
// empty expanse is exactly the point) with a continent on the right for scale.
const BBOX: Bbox = [
  [-150, -60],
  [-30, 20],
];

// Same center as BBOX, cropped to a square and zoomed in for the 1:1 mobile panel.
const MOBILE_BBOX: Bbox = [
  [-120, -50],
  [-60, 10],
];

// Chart 1: animated Poisson-dot world map, rendered as SVG.
export default function GlobalRandomMap({ features }: GlobalRandomMapProps) {
  const { skin } = useSkin();
  // Authored accent, re-expressed in whichever sky is on screen (handoff README, mapColor).
  const accent = mapColor("#2f4bff", skin);
  const ref = useRef<SVGSVGElement | null>(null);
  const isMobile = useIsMobileMap();
  const width = isMobile ? MOBILE_SIZE : WIDTH;
  const height = isMobile ? MOBILE_SIZE : HEIGHT;
  const bbox = isMobile ? MOBILE_BBOX : BBOX;

  useEffect(() => {
    if (!ref.current || !features) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const projection = fitRegionProjection(bbox, width, height);
    const content = appendGrayEarthBasemap(svg, projection, width, height, "global-random-map");

    const meanGapMs = REAL_MEAN_GAP_MS;

    const dotsG = content.append("g").attr("class", "map-dots");
    const dots: Dot[] = [];
    let nextId = 0;
    let nextAt = performance.now() + expGap(meanGapMs);
    let rafId = 0;
    let cancelled = false;

    function frame(now: number) {
      if (cancelled) return;
      while (now >= nextAt) {
        // Points still spawn at the real global rate, uniformly over the whole sphere —
        // only those landing inside the cropped region are kept, so the visible slice
        // shows the same rate it always would, just for a smaller part of Earth.
        const xy = projection(randomPointOnSphere());
        if (insideViewport(xy, width, height)) {
          dots.push({ id: nextId++, x: xy[0], y: xy[1], born: nextAt });
        }
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
        .attr("fill", accent)
        .attr("fill-opacity", (d) => Math.max(0, 1 - (now - d.born) / DOT_LIFETIME_MS) * 0.9)
        .attr("stroke", accent)
        .attr("stroke-opacity", (d) => Math.max(0, 1 - (now - d.born) / DOT_LIFETIME_MS) * 0.42);
      rafId = requestAnimationFrame(frame);
    }

    // Hover: country under the pointer, or plain coordinates over open ocean.
    svg
      .append("rect")
      .attr("width", width)
      .attr("height", height)
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
  }, [features, bbox, width, height, accent]);

  return (
    <section className="chart-panel wide no-card">
      <p className="chart-copy">
        Blue dots appear at exponentially random intervals, averaging nearly two events every second
        (~0.5s between deaths), and at uniformly random points on the Earth&apos;s surface. This
        first layer has no country, density, or seasonality weighting.
      </p>
      <svg
        ref={ref}
        id="global-random-map-chart"
        className="seasonality-chart map-bleed"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Map of the Pacific and South America where blue dots appear randomly at the global mortality rate"
      />
    </section>
  );
}
