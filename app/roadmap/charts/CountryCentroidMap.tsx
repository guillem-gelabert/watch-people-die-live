"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { expGap, REAL_MEAN_GAP_MS } from "../chartHelpers";
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
const HEIGHT = 430;
const MOBILE_SIZE = 430;
const DOT_LIFETIME_MS = 5200;

// Europe — Iceland to the Urals, Mediterranean to Scandinavia.
const BBOX: Bbox = [
  [-25, 34],
  [45, 72],
];

// Same center as BBOX, cropped to a square and zoomed in for the 1:1 mobile panel.
const MOBILE_BBOX: Bbox = [
  [-4, 39],
  [24, 67],
];

// Step 2: same animated-dot idea as GlobalRandomMap, but every death lands on its country's
// geographic centroid instead of a uniformly random point — "right count per country, wrong
// place within it" (density, step 3, fixes the placement). Rendered as SVG.
export default function CountryCentroidMap({
  features,
  deathsPerYearById,
}: CountryCentroidMapProps) {
  const { skin } = useSkin();
  // Authored accent, re-expressed in whichever sky is on screen (handoff README, mapColor).
  const accent = mapColor("#6b3df0", skin);
  const ref = useRef<SVGSVGElement | null>(null);
  const isMobile = useIsMobileMap();
  const width = isMobile ? MOBILE_SIZE : WIDTH;
  const height = isMobile ? MOBILE_SIZE : HEIGHT;
  const bbox = isMobile ? MOBILE_BBOX : BBOX;

  useEffect(() => {
    if (!ref.current || !features || !deathsPerYearById || !deathsPerYearById.size) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const projection = fitRegionProjection(bbox, width, height);
    const content = appendGrayEarthBasemap(svg, projection, width, height, "country-centroid-map");

    // One weighted entry per country with a known death rate. The pick stays weighted
    // over every country in the world (not just the ones visible here) so Europe still
    // pulses at its own real share of global mortality — dots for the rest of the world
    // are simply dropped after picking (below), same as GlobalRandomMap's approach.
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

    const dotsG = content.append("g").attr("class", "map-dots");
    const dots: Dot[] = [];
    let nextId = 0;
    let nextAt = performance.now() + expGap(meanGapMs);
    let rafId = 0;
    let cancelled = false;

    function frame(now: number) {
      if (cancelled) return;
      while (now >= nextAt) {
        const c = pickCountry();
        if (insideViewport(c.xy, width, height)) {
          dots.push({ id: nextId++, x: c.xy[0], y: c.xy[1], born: nextAt });
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

    // Hover: country under the pointer and its real deaths/year (exact geoContains hit-test).
    svg
      .append("rect")
      .attr("width", width)
      .attr("height", height)
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
  }, [features, deathsPerYearById, bbox, width, height, accent]);

  return (
    <section className="chart-panel wide no-card">
      <p className="chart-copy">
        Each country now fires deaths at its own real rate — populous countries pulse faster — but
        every death still lands on the same single point: that country&apos;s geographic center.
        Step 3 spreads them out realistically inside each border.
      </p>
      <svg
        ref={ref}
        id="country-centroid-map-chart"
        className="seasonality-chart map-bleed"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Map of Europe where dots appear at each country's real death rate, all landing on that country's geographic center"
      />
    </section>
  );
}
