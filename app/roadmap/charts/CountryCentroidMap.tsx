"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { expGap, REAL_MEAN_GAP_MS, FAST_MEAN_GAP_MS, formatMeanGap } from "../chartHelpers";
import { showTooltip, hideTooltip } from "../tooltip";
import type { CountryFeature, DeathsPerYearById } from "../types";

interface Dot {
  xy: [number, number];
  born: number;
}

interface CountryEntry {
  feature: CountryFeature;
  name: string;
  deathsPerYear: number;
  centroid: [number, number];
  xy: [number, number];
}

interface CountryCentroidMapProps {
  features: CountryFeature[] | null;
  deathsPerYearById: DeathsPerYearById | null;
}

// Step 2: same animated-dot idea as GlobalRandomMap, but every death lands on its
// country's geographic centroid instead of a uniformly random point — "right count
// per country, wrong place within it" (density, step 3, fixes the placement).
export default function CountryCentroidMap({
  features,
  deathsPerYearById,
}: CountryCentroidMapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState("Loading country death rates…");
  const [fast, setFast] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !features || !deathsPerYearById || !deathsPerYearById.size) return;

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

    // One weighted entry per country with a known death rate: centroid, projected
    // point, and its share of the global total (drives spawn frequency).
    const countries: CountryEntry[] = features
      .map((feature): CountryEntry | null => {
        const deathsPerYear = deathsPerYearById.get(Number(feature.id));
        if (!(deathsPerYear && deathsPerYear > 0)) return null;
        const centroid = d3.geoCentroid(feature);
        const xy = projection(centroid);
        if (!xy) return null;
        return {
          feature,
          name: feature.properties?.name ?? "Unknown",
          deathsPerYear,
          centroid,
          xy,
        };
      })
      .filter((c): c is CountryEntry => c !== null);
    const totalDeathsPerYear = d3.sum(countries, (c) => c.deathsPerYear);
    if (!countries.length || !(totalDeathsPerYear > 0)) return;

    function pickCountry(): CountryEntry {
      let r = Math.random() * totalDeathsPerYear;
      for (const c of countries) {
        r -= c.deathsPerYear;
        if (r < 0) return c;
      }
      return countries[countries.length - 1]!;
    }

    const dots: Dot[] = [];
    const meanGapMs = fast ? FAST_MEAN_GAP_MS : REAL_MEAN_GAP_MS; // same global average as step 1
    const dotLifetimeMs = 5200;
    let nextAt = performance.now() + expGap(meanGapMs);
    let rafId: number;
    let cancelled = false;

    setStatus(
      `${countries.length} countries with a known death rate, one dot every ${formatMeanGap(meanGapMs)} on average. Every death lands on its country's single geographic center.`,
    );

    function frame(now: number) {
      if (cancelled) return;
      while (now >= nextAt) {
        const country = pickCountry();
        dots.push({ xy: country.xy, born: nextAt });
        nextAt += expGap(meanGapMs);
      }
      draw(now);
      rafId = requestAnimationFrame(frame);
    }

    function draw(now: number) {
      if (!ctx || !features) return;
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
        ctx.fillStyle = `rgba(255,107,107,${alpha * 0.9})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(255,107,107,${alpha * 0.42})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Hover: report the country under the pointer and its real deaths/year.
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
      if (!hit) {
        hideTooltip();
        return;
      }
      const deathsPerYear = deathsPerYearById?.get(Number(hit.id));
      const label = deathsPerYear
        ? `${hit.properties?.name ?? "Unknown"}: ${Math.round(deathsPerYear).toLocaleString()} deaths/yr`
        : `${hit.properties?.name ?? "Unknown"}: no rate data`;
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
  }, [features, deathsPerYearById, fast]);

  return (
    <section className="chart-panel wide">
      <h4 className="chart-title">Right Count, Wrong Place</h4>
      <p className="chart-copy">
        Each country now fires deaths at its own real rate — populous countries pulse faster — but
        every death still lands on the same single point: that country&apos;s geographic center.
        Step 3 spreads them out realistically inside each border.
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
        id="country-centroid-map-chart"
        className="seasonality-chart"
        width="860"
        height="360"
        role="img"
        aria-label="World map where dots appear at each country's real death rate, all landing on that country's geographic center"
      />
      <p id="centroid-map-status" className="chart-status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
