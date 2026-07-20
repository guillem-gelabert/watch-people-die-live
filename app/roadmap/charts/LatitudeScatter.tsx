"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { fmtPlainPct, pearson, strength, styleAxis } from "../chartHelpers";
import { showTooltip, hideTooltip } from "../tooltip";
import partidoLatitudeData from "../../../data/argentina-partido-latitudes.json";
import type {
  Admin1Feature,
  CountryFeature,
  SeasonalityData,
  SubnationalSeasonalityRegion,
} from "../types";

interface CountryRow {
  name: string;
  absLat: number;
  amplitude: number;
}

interface RegionRow {
  name: string;
  country: string;
  absLat: number;
  amplitude: number;
}

interface LatitudeScatterProps {
  unified: SeasonalityData | null;
  features: CountryFeature[] | null;
  regions: SubnationalSeasonalityRegion[] | null;
  admin1Features: Admin1Feature[] | null;
}

const ACCENT = "#ff6b6b";
const partidoLatitudes = partidoLatitudeData.latitudes as Record<string, number>;

// Latitude vs. seasonal amplitude, country-level and region-level points in one scatter —
// countries as solid dots, regions as hollow dots. The region dots make visible what a
// country-only view hides: inside Russia and the US, higher-latitude regions are *less*
// seasonal, not more, while Argentina keeps the cross-country sign.
export default function LatitudeScatter({
  unified,
  features,
  regions,
  admin1Features,
}: LatitudeScatterProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const legendRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!unified || !features || !svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const countryRows: CountryRow[] = Object.entries(unified.countries)
      .map(([id, curve]): CountryRow | null => {
        const feature = features.find((f) => Number(f.id) === Number(id));
        if (!feature) return null;
        return {
          name: feature.properties?.name ?? "Unknown",
          absLat: Math.abs(d3.geoCentroid(feature)[1]),
          amplitude: strength(curve),
        };
      })
      .filter((r): r is CountryRow => r !== null);

    const admin1ByCode = new Map((admin1Features ?? []).map((f) => [f.properties?.adm1_code, f]));
    const regionRows: RegionRow[] = (regions ?? [])
      .filter((r) => r.measurement !== "climate-modeled") // observed regions only
      .map((r) => {
        const lat =
          r.geo === "partido"
            ? partidoLatitudes[r.key]
            : admin1ByCode.get(r.key)?.properties?.latitude;
        if (lat == null) return null;
        return {
          name: r.name,
          country: r.country,
          absLat: Math.abs(lat),
          amplitude: strength(r.curve),
        };
      })
      .filter((r): r is RegionRow => r !== null);

    const width = 420;
    const height = 260;
    const margin = { top: 16, right: 18, bottom: 42, left: 52 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    const maxAbsLat = Math.max(
      d3.max(countryRows, (d) => d.absLat) || 70,
      d3.max(regionRows, (d) => d.absLat) || 70,
    );
    const x = d3
      .scaleLinear()
      .domain([0, Math.max(70, maxAbsLat)])
      .range([0, innerW]);
    const y = d3
      .scaleLinear()
      .domain([
        0,
        Math.max(
          0.18,
          d3.max(countryRows, (d) => d.amplitude) || 0.18,
          d3.max(regionRows, (d) => d.amplitude) || 0.18,
        ),
      ])
      .nice()
      .range([innerH, 0]);
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const boundaries = [
      { lat: 23.5, label: "Tropic" },
      { lat: 66.5, label: "Polar Circle" },
    ];
    boundaries.forEach((b) => {
      if (b.lat > (x.domain() as [number, number])[1]) return;
      g.append("line")
        .attr("class", "climate-band-boundary")
        .attr("x1", x(b.lat))
        .attr("x2", x(b.lat))
        .attr("y1", 0)
        .attr("y2", innerH);
      g.append("text")
        .attr("class", "chart-label")
        .attr("x", x(b.lat))
        .attr("y", -4)
        .attr("text-anchor", "middle")
        .attr("font-size", "9px")
        .text(b.label);
    });

    g.selectAll("circle.country-pt")
      .data(countryRows)
      .join("circle")
      .attr("class", "country-pt chart-point")
      .attr("cx", (d) => x(d.absLat))
      .attr("cy", (d) => y(d.amplitude))
      .attr("r", 3.2)
      .style("cursor", "pointer")
      .on("pointermove", (event, d) =>
        showTooltip(
          `${d.name}: ${d.absLat.toFixed(1)}° lat, ${fmtPlainPct(d.amplitude)}`,
          event.clientX,
          event.clientY,
        ),
      )
      .on("pointerleave", hideTooltip);

    // Regions drawn on top as hollow rings, matching the hollow-dot weight used across the other
    // seasonality scatters (r 3, stroke-width 0.8) so the two charts read as one family.
    g.selectAll("circle.region-pt")
      .data(regionRows)
      .join("circle")
      .attr("class", "region-pt")
      .attr("cx", (d) => x(d.absLat))
      .attr("cy", (d) => y(d.amplitude))
      .attr("r", 3)
      .attr("fill", "none")
      .attr("stroke", ACCENT)
      .attr("stroke-width", 0.8)
      .attr("opacity", 0.7)
      .style("cursor", "pointer")
      .on("pointermove", (event, d) =>
        showTooltip(
          `${d.name} (${d.country}): ${d.absLat.toFixed(1)}° lat, ${fmtPlainPct(d.amplitude)}`,
          event.clientX,
          event.clientY,
        ),
      )
      .on("pointerleave", hideTooltip);

    const rCountry = pearson(
      countryRows.map((d) => d.absLat),
      countryRows.map((d) => d.amplitude),
    );
    const rRegion = regionRows.length
      ? pearson(
          regionRows.map((d) => d.absLat),
          regionRows.map((d) => d.amplitude),
        )
      : null;
    const r2 = (r: number | null) => (r != null ? (r * r).toFixed(2) : "—");
    g.append("text")
      .attr("class", "chart-note")
      .attr("x", 0)
      .attr("y", 10)
      .text(
        rRegion != null
          ? `countries R² = ${r2(rCountry)}  ·  regions R² = ${r2(rRegion)}`
          : `R² = ${r2(rCountry)}`,
      );

    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(5)
          .tickFormat((d) => `${d}°`),
      )
      .call(styleAxis);
    g.append("g").call(d3.axisLeft(y).ticks(5).tickFormat(fmtPlainPct)).call(styleAxis);
    g.append("text")
      .attr("class", "chart-label")
      .attr("x", innerW / 2)
      .attr("y", innerH + 36)
      .attr("text-anchor", "middle")
      .text("absolute latitude");

    const legend = d3.select(legendRef.current);
    legend.selectAll("span").remove();
    legend
      .append("span")
      .html(`<span class="swatch-dot" style="background:${ACCENT}"></span>each country`);
    legend
      .append("span")
      .html(
        `<span class="swatch-dot" style="background:none;border:1.5px solid ${ACCENT}"></span>each region`,
      );
  }, [unified, features, regions, admin1Features]);

  return (
    <>
      <svg
        ref={svgRef}
        id="latitude-scatter-chart"
        className="seasonality-chart"
        viewBox="0 0 420 260"
        role="img"
        aria-label="Scatter plot of absolute latitude against seasonal mortality amplitude, with each country as a solid dot and each measured region as a hollow dot"
      />
      <div
        className="chart-legend"
        ref={legendRef}
        id="latitude-scatter-legend"
        aria-hidden="true"
      />
    </>
  );
}
