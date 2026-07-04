"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import {
  expGap,
  randomPointOnSphere,
  REAL_MEAN_GAP_MS,
  FAST_MEAN_GAP_MS,
  formatMeanGap,
} from "../chartHelpers";
import { showTooltip, hideTooltip } from "../tooltip";
import type { CountryFeature } from "../types";

interface Dot {
  xy: [number, number];
  born: number;
}

interface GlobalRandomMapProps {
  features: CountryFeature[] | null;
}

// Chart 1: animated Poisson-dot world map (canvas, rAF loop).
export default function GlobalRandomMap({ features }: GlobalRandomMapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState("Loading random simulation…");
  const [fast, setFast] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !features) return;

    const width = canvas.width;
    const height = canvas.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const projection = d3.geoEqualEarth().fitExtent(
      [
        [18, 18],
        [width - 18, height - 18],
      ],
      { type: "Sphere" },
    );
    const path = d3.geoPath(projection, ctx);
    const dots: Dot[] = [];
    const meanGapMs = fast ? FAST_MEAN_GAP_MS : REAL_MEAN_GAP_MS;
    const dotLifetimeMs = 5200;
    let nextAt = performance.now() + expGap(meanGapMs);
    let rafId: number;
    let cancelled = false;

    setStatus(
      `Running at ${fast ? "a sped-up preview rate" : "the global average"}: one randomly placed dot every ${formatMeanGap(meanGapMs)} on average.`,
    );

    function frame(now: number) {
      if (cancelled) return;
      while (now >= nextAt) {
        const xy = projection(randomPointOnSphere());
        if (xy) dots.push({ xy, born: nextAt });
        nextAt += expGap(meanGapMs);
      }
      draw(now);
      rafId = requestAnimationFrame(frame);
    }

    function draw(now: number) {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "rgba(255,255,255,0.025)";
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      path({ type: "Sphere" });
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 0.45;
      if (features)
        for (const feature of features) {
          ctx.beginPath();
          path(feature);
          ctx.stroke();
        }

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

    // Hover: report the country under the pointer (hit-test against the same features
    // used to draw borders); falls back to plain coordinates over open ocean.
    function onPointerMove(event: PointerEvent) {
      if (!features) return;
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
      const hit = features.find((f) => d3.geoContains(f, lonLat));
      const label = hit
        ? (hit.properties?.name ?? "Unknown")
        : `${lonLat[1].toFixed(1)}°, ${lonLat[0].toFixed(1)}°`;
      showTooltip(label, event.clientX, event.clientY);
    }
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", hideTooltip);

    rafId = requestAnimationFrame(frame);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", hideTooltip);
    };
  }, [features, fast]);

  return (
    <section className="chart-panel wide">
      <h4 className="chart-title">Baseline Random Simulation</h4>
      <p className="chart-copy">
        White dots appear at exponentially random intervals, averaging nearly two events every
        second (~0.5s between deaths), and at uniformly random points on the Earth&apos;s surface.
        This first layer has no country, density, or seasonality weighting.
      </p>
      <div className="speed-toggle" role="group" aria-label="Simulation speed">
        <button
          type="button"
          className={!fast ? "active" : ""}
          aria-pressed={!fast}
          onClick={() => setFast(false)}
        >
          Real speed ({formatMeanGap(REAL_MEAN_GAP_MS)} avg)
        </button>
        <button
          type="button"
          className={fast ? "active" : ""}
          aria-pressed={fast}
          onClick={() => setFast(true)}
        >
          Fast preview ({formatMeanGap(FAST_MEAN_GAP_MS)} avg)
        </button>
      </div>
      <canvas
        ref={canvasRef}
        id="global-random-map-chart"
        className="seasonality-chart"
        width="860"
        height="360"
        role="img"
        aria-label="World map where white dots appear randomly at the global mortality rate"
      />
      <p id="random-map-status" className="chart-status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
