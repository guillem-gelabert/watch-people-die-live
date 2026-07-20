"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { fmtPlainPct, pearson, strength, styleAxis } from "../chartHelpers";
import { showTooltip, hideTooltip } from "../tooltip";
import type { CountryFeature, SeasonalityData, SeasonalityProxies } from "../types";

interface Row {
  name: string;
  gdpPerCapita: number;
  amplitude: number;
}

interface GdpScatterProps {
  unified: SeasonalityData | null;
  proxies: SeasonalityProxies | null;
  features: CountryFeature[] | null;
}

const fmtUsd = d3.format("$,.0f");
const fmtAxisUsd = (value: d3.NumberValue) => `$${d3.format("~s")(value)}`;

// Amplitude vs. GDP per capita (World Bank NY.GDP.PCAP.CD, current USD). Log-scale x-axis
// since GDP per capita spans three orders of magnitude across the reporting countries.
export default function GdpScatter({ unified, proxies, features }: GdpScatterProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!unified || !proxies || !features || !svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const nameById = new Map(features.map((f) => [Number(f.id), f.properties?.name ?? ""]));
    const rows: Row[] = Object.entries(unified.countries)
      .map(([id, curve]): Row | null => {
        const row = proxies.byM49[id];
        if (!row || row.gdpPerCapita == null) return null;
        return {
          name: nameById.get(Number(id)) || id,
          gdpPerCapita: row.gdpPerCapita,
          amplitude: strength(curve),
        };
      })
      .filter((r): r is Row => r !== null);

    const width = 420;
    const height = 260;
    const margin = { top: 16, right: 18, bottom: 42, left: 52 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const [gdpMin, gdpMax] = d3.extent(rows, (d) => d.gdpPerCapita) as [number, number];
    const domainMin = Math.max(1, gdpMin || 1) * 0.9;
    const domainMax = (gdpMax || 10) * 1.1;
    const x = d3.scaleLog().domain([domainMin, domainMax]).range([0, innerW]);

    // Only label powers of ten (log-scale .ticks() otherwise emits every 1-9 multiple
    // within a decade, which overlaps into an unreadable smear at this chart width).
    const firstDecade = Math.floor(Math.log10(domainMin));
    const lastDecade = Math.ceil(Math.log10(domainMax));
    const decadeTicks = d3.range(firstDecade, lastDecade + 1).map((p) => 10 ** p);
    const y = d3
      .scaleLinear()
      .domain([0, Math.max(0.18, d3.max(rows, (d) => d.amplitude) || 0.18)])
      .nice()
      .range([innerH, 0]);
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    g.selectAll("circle")
      .data(rows)
      .join("circle")
      .attr("class", "chart-point")
      .attr("cx", (d) => x(d.gdpPerCapita))
      .attr("cy", (d) => y(d.amplitude))
      .attr("r", 3.6)
      .style("cursor", "pointer")
      .on("pointermove", (event, d) =>
        showTooltip(
          `${d.name}: ${fmtUsd(d.gdpPerCapita)}, ${fmtPlainPct(d.amplitude)}`,
          event.clientX,
          event.clientY,
        ),
      )
      .on("pointerleave", hideTooltip);

    // Correlate on log10(GDP) to match the log x-axis (GDP spans three orders of magnitude).
    const r = pearson(
      rows.map((d) => Math.log10(d.gdpPerCapita)),
      rows.map((d) => d.amplitude),
    );
    if (r != null) {
      g.append("text")
        .attr("class", "chart-note")
        .attr("x", 0)
        .attr("y", 10)
        .text(`r = ${r.toFixed(2)}`);
    }

    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickValues(decadeTicks).tickFormat(fmtAxisUsd))
      .call(styleAxis);
    g.append("g").call(d3.axisLeft(y).ticks(5).tickFormat(fmtPlainPct)).call(styleAxis);
    g.append("text")
      .attr("class", "chart-label")
      .attr("x", innerW / 2)
      .attr("y", innerH + 36)
      .attr("text-anchor", "middle")
      .text("GDP per capita (current USD, log scale)");
  }, [unified, proxies, features]);

  return (
    <svg
      ref={svgRef}
      id="gdp-scatter-chart"
      className="seasonality-chart"
      viewBox="0 0 420 260"
      role="img"
      aria-label="Scatter plot of seasonal mortality amplitude against GDP per capita on a logarithmic scale"
    />
  );
}
