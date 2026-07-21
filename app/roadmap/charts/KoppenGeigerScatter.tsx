"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { KG_FAMILIES, correlationRatio, fmtPlainPct, strength, styleAxis } from "../chartHelpers";
import { showTooltip, hideTooltip } from "../tooltip";
import LayerToggle from "./LayerToggle";
import type {
  CountryFeature,
  SeasonalityData,
  SeasonalityProxies,
  SubnationalSeasonalityRegion,
} from "../types";

interface Row {
  name: string;
  family: string;
  amplitude: number;
}

interface KoppenGeigerScatterProps {
  unified: SeasonalityData | null;
  proxies: SeasonalityProxies | null;
  features: CountryFeature[] | null;
  regions: SubnationalSeasonalityRegion[] | null;
}

// A deterministic horizontal jitter within a band, so overlapping dots spread out without moving
// between runs (Math.random is avoided elsewhere in the pipeline too).
const jitterAt = (i: number, bandwidth: number) =>
  (((i * 0.61803398875) % 1) - 0.5) * bandwidth * 0.82;

const etaByFamily = (rows: Row[]) => {
  const groups = new Map<string, number[]>();
  for (const row of rows) {
    const arr = groups.get(row.family) ?? [];
    arr.push(row.amplitude);
    groups.set(row.family, arr);
  }
  return correlationRatio(groups);
};

// Amplitude by dominant Köppen–Geiger climate family: a jittered strip scatter, one dot per
// country (filled) and, when enabled, one hollow dot per measured Admin-1 region, grouped by the
// family that covers most of its population.
export default function KoppenGeigerScatter({
  unified,
  proxies,
  features,
  regions,
}: KoppenGeigerScatterProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const legendRef = useRef<HTMLDivElement | null>(null);
  const [showCountries, setShowCountries] = useState(true);
  const [showRegions, setShowRegions] = useState(true);

  useEffect(() => {
    if (!unified || !proxies || !features || !svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const nameById = new Map(features.map((f) => [Number(f.id), f.properties?.name ?? ""]));
    const countryRows: Row[] = Object.entries(unified.countries)
      .map(([id, curve]): Row | null => {
        const row = proxies.byM49[id];
        if (!row || !row.kgFamily) return null;
        return {
          name: nameById.get(Number(id)) || id,
          family: row.kgFamily,
          amplitude: strength(curve),
        };
      })
      .filter((r): r is Row => r !== null);

    // Region dots use their own centroid-sampled Köppen family; climate-modeled estimates are
    // not measurements and are excluded, matching the other measured-region charts.
    const regionRows: Row[] = (regions ?? [])
      .filter((r) => r.measurement !== "climate-modeled" && r.kgFamily)
      .map((r) => ({
        name: `${r.name} (${r.country})`,
        family: r.kgFamily as string,
        amplitude: strength(r.curve),
      }));

    const width = 420;
    const height = 260;
    const margin = { top: 16, right: 18, bottom: 42, left: 52 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const x = d3
      .scaleBand<string>()
      .domain(KG_FAMILIES.map((f) => f.key))
      .range([0, innerW])
      .padding(0.35);
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
    const colorByFamily = new Map(KG_FAMILIES.map((f) => [f.key, f.color]));
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const bw = x.bandwidth();

    // Mean amplitude per family with ±1 SD error band and mean line — tied to the country
    // distribution (the primary signal), so it only shows while countries are visible.
    if (showCountries) {
      for (const f of KG_FAMILIES) {
        const group = countryRows.filter((r) => r.family === f.key);
        if (!group.length) continue;
        const mean = d3.mean(group, (d) => d.amplitude) ?? 0;
        const sd = Math.sqrt(d3.mean(group, (d) => (d.amplitude - mean) ** 2) ?? 0) || 0;
        const cx = (x(f.key) ?? 0) + bw / 2;
        const yMax = (y.domain() as [number, number])[1];
        const bandTop = Math.max(0, mean - sd);
        const bandBottom = Math.min(yMax, mean + sd);
        g.append("rect")
          .attr("class", "chart-band")
          .attr("x", cx - (bw / 2) * 0.7)
          .attr("width", bw * 0.7)
          .attr("y", y(bandBottom))
          .attr("height", y(bandTop) - y(bandBottom));
        g.append("line")
          .attr("x1", cx - bw / 2)
          .attr("x2", cx + bw / 2)
          .attr("y1", y(mean))
          .attr("y2", y(mean))
          .attr("stroke", f.color)
          .attr("stroke-width", 2)
          .attr("stroke-opacity", 0.9);
      }
    }

    if (showRegions) {
      g.selectAll("circle.region-pt")
        .data(regionRows)
        .join("circle")
        .attr("class", "region-pt")
        .attr("cx", (d, i) => (x(d.family) ?? 0) + bw / 2 + jitterAt(i, bw))
        .attr("cy", (d) => y(d.amplitude))
        .attr("r", 3)
        .attr("fill", "none")
        .attr("stroke", (d) => colorByFamily.get(d.family) ?? "#8888aa")
        .attr("stroke-width", 0.9)
        .attr("opacity", 0.75)
        .style("cursor", "pointer")
        .on("pointermove", (event, d) =>
          showTooltip(`${d.name}: ${fmtPlainPct(d.amplitude)}`, event.clientX, event.clientY),
        )
        .on("pointerleave", hideTooltip);
    }

    if (showCountries) {
      g.selectAll("circle.country-pt")
        .data(countryRows)
        .join("circle")
        .attr("class", "country-pt chart-point")
        .attr("cx", (d, i) => (x(d.family) ?? 0) + bw / 2 + jitterAt(i, bw))
        .attr("cy", (d) => y(d.amplitude))
        .attr("r", 3.6)
        .style("fill", (d) => colorByFamily.get(d.family) ?? "#8888aa")
        .style("cursor", "pointer")
        .on("pointermove", (event, d) =>
          showTooltip(`${d.name}: ${fmtPlainPct(d.amplitude)}`, event.clientX, event.clientY),
        )
        .on("pointerleave", hideTooltip);
    }

    // Climate family is categorical, so Pearson r is undefined — use the correlation ratio η
    // (share of amplitude variance explained by the family means) instead, per visible layer.
    const etaCountry = etaByFamily(countryRows);
    const etaRegion = regionRows.length ? etaByFamily(regionRows) : null;
    const noteParts: string[] = [];
    if (showCountries && etaCountry != null)
      noteParts.push(`countries η = ${etaCountry.toFixed(2)}`);
    if (showRegions && etaRegion != null) noteParts.push(`regions η = ${etaRegion.toFixed(2)}`);
    if (noteParts.length) {
      g.append("text")
        .attr("class", "chart-note")
        .attr("x", 0)
        .attr("y", 10)
        .text(noteParts.join("  ·  "));
    }

    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickFormat((k) => KG_FAMILIES.find((f) => f.key === k)?.name ?? k))
      .call(styleAxis);
    g.append("g").call(d3.axisLeft(y).ticks(5).tickFormat(fmtPlainPct)).call(styleAxis);

    // Shape legend (colour carries the family, so the swatches are neutral and only mark
    // the country-dot vs region-ring convention shared across the seasonality scatters).
    const legend = d3.select(legendRef.current);
    legend.selectAll("span").remove();
    if (showCountries) {
      legend
        .append("span")
        .html('<span class="swatch-dot" style="background:#9aa3af"></span>each country');
    }
    if (showRegions) {
      legend
        .append("span")
        .html(
          '<span class="swatch-dot" style="background:none;border:1.5px solid #9aa3af"></span>each region',
        );
    }
  }, [unified, proxies, features, regions, showCountries, showRegions]);

  return (
    <>
      <LayerToggle
        showCountries={showCountries}
        showRegions={showRegions}
        onShowCountries={setShowCountries}
        onShowRegions={setShowRegions}
      />
      <svg
        ref={svgRef}
        id="koppen-geiger-scatter-chart"
        className="seasonality-chart"
        viewBox="0 0 420 260"
        role="img"
        aria-label="Strip scatter plot of seasonal mortality amplitude grouped by dominant Köppen–Geiger climate family, with each country as a solid dot and each measured region as a hollow dot"
      />
      <div
        className="chart-legend"
        ref={legendRef}
        id="koppen-geiger-scatter-legend"
        aria-hidden="true"
      />
    </>
  );
}
