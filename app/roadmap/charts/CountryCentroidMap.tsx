"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { expGap, REAL_MEAN_GAP_MS, MAP_GRATICULE } from "../chartHelpers";
import { showTooltip, hideTooltip } from "../tooltip";
import type { CountryFeature, DeathsPerYearById } from "../types";

interface Dot {
  id: number;
  x: number;
  y: number;
  born: number;
}

interface CountryEntry {
  name: string;
  deathsPerYear: number;
  xy: [number, number];
}

interface CountryCentroidMapProps {
  features: CountryFeature[] | null;
  deathsPerYearById: DeathsPerYearById | null;
}

const WIDTH = 860;
const HEIGHT = 360;
const DOT_LIFETIME_MS = 5200;

// Step 2: same animated-dot idea as GlobalRandomMap, but every death lands on its country's
// geographic centroid instead of a uniformly random point — "right count per country, wrong
// place within it" (density, step 3, fixes the placement). Rendered as SVG.
export default function CountryCentroidMap({
  features,
  deathsPerYearById,
}: CountryCentroidMapProps) {
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!ref.current || !features || !deathsPerYearById || !deathsPerYearById.size) return;
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

    // Static base: sphere + country outlines.
    svg
      .append("path")
      .datum<d3.GeoSphere>({ type: "Sphere" })
      .attr("d", path)
      .attr("fill", "rgba(15,15,30,0.02)")
      .attr("stroke", "rgba(15,15,30,0.14)");
    svg
      .append("g")
      .selectAll("path")
      .data(features)
      .join("path")
      .attr("class", "map-outline")
      .attr("d", path);
    svg.append("path").datum(MAP_GRATICULE).attr("class", "map-graticule").attr("d", path);

    // One weighted entry per country with a known death rate.
    const countries: CountryEntry[] = features
      .map((feature): CountryEntry | null => {
        const deathsPerYear = deathsPerYearById.get(Number(feature.id));
        if (!(deathsPerYear && deathsPerYear > 0)) return null;
        const xy = projection(d3.geoCentroid(feature));
        if (!xy) return null;
        return { name: feature.properties?.name ?? "Unknown", deathsPerYear, xy };
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
        const c = pickCountry();
        dots.push({ id: nextId++, x: c.xy[0], y: c.xy[1], born: nextAt });
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
        .attr("fill", "#6b3df0")
        .attr("fill-opacity", (d) => Math.max(0, 1 - (now - d.born) / DOT_LIFETIME_MS) * 0.9)
        .attr("stroke", "#6b3df0")
        .attr("stroke-opacity", (d) => Math.max(0, 1 - (now - d.born) / DOT_LIFETIME_MS) * 0.42);
      rafId = requestAnimationFrame(frame);
    }

    // Hover: country under the pointer and its real deaths/year (exact geoContains hit-test).
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
        const deathsPerYear = deathsPerYearById.get(Number(hit.id));
        const label = deathsPerYear
          ? `${hit.properties?.name ?? "Unknown"}: ${Math.round(deathsPerYear).toLocaleString()} deaths/yr`
          : `${hit.properties?.name ?? "Unknown"}: no rate data`;
        showTooltip(label, event.clientX, event.clientY);
      })
      .on("pointerleave", hideTooltip);

    rafId = requestAnimationFrame(frame);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [features, deathsPerYearById]);

  return (
    <section className="chart-panel wide">
      <p className="chart-copy">
        Each country now fires deaths at its own real rate — populous countries pulse faster — but
        every death still lands on the same single point: that country&apos;s geographic center.
        Step 3 spreads them out realistically inside each border.
      </p>
      <svg
        ref={ref}
        id="country-centroid-map-chart"
        className="seasonality-chart"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="World map where dots appear at each country's real death rate, all landing on that country's geographic center"
      />
    </section>
  );
}
