"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { fmtPlainPct, pearson, strength, styleAxis } from "../chartHelpers";
import { showTooltip, hideTooltip } from "../tooltip";
import type { CountryFeature, SeasonalityData, SeasonalityProxies } from "../types";

interface Row {
  name: string;
  pop65: number;
  amplitude: number;
  gdp: number | null;
}

// Dots without a GDP figure fall back to this neutral grey.
const NO_GDP_COLOR = "#5a6473";
const fmtGdp = d3.format("$.3~s");

interface Pop65ScatterProps {
  unified: SeasonalityData | null;
  proxies: SeasonalityProxies | null;
  features: CountryFeature[] | null;
}

// Amplitude vs. share of population aged 65+ (World Bank SP.POP.65UP.TO.ZS). One dot per
// country that both reports a seasonal curve and has an age-structure figure.
export default function Pop65Scatter({ unified, proxies, features }: Pop65ScatterProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const legendRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!unified || !proxies || !features || !svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const nameById = new Map(features.map((f) => [Number(f.id), f.properties?.name ?? ""]));
    const rows: Row[] = Object.entries(unified.countries)
      .map(([id, curve]): Row | null => {
        const row = proxies.byM49[id];
        if (!row || row.pop65 == null) return null;
        return {
          name: nameById.get(Number(id)) || id,
          pop65: row.pop65,
          amplitude: strength(curve),
          gdp: row.gdpPerCapita ?? null,
        };
      })
      .filter((r): r is Row => r !== null);

    // GDP per capita is heavily right-skewed, so colour on a log scale.
    const gdpExtent = d3.extent(rows, (d) => d.gdp ?? undefined) as
      [number, number] | [undefined, undefined];
    const [gdpMin, gdpMax] = gdpExtent[0] != null ? gdpExtent : [1, 1];
    const gdpColor = d3.scaleSequentialLog(d3.interpolateYlOrRd).domain([gdpMin, gdpMax]);
    const colorFor = (gdp: number | null) => (gdp == null ? NO_GDP_COLOR : gdpColor(gdp));

    const width = 420;
    const height = 260;
    const margin = { top: 16, right: 18, bottom: 42, left: 52 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const x = d3
      .scaleLinear()
      .domain([0, Math.max(30, d3.max(rows, (d) => d.pop65) || 30)])
      .nice()
      .range([0, innerW]);
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
      .attr("cx", (d) => x(d.pop65))
      .attr("cy", (d) => y(d.amplitude))
      .attr("r", 3.6)
      .style("fill", (d) => colorFor(d.gdp))
      .style("cursor", "pointer")
      .on("pointermove", (event, d) =>
        showTooltip(
          `${d.name}: ${d.pop65.toFixed(1)}% aged 65+, ${fmtPlainPct(d.amplitude)}${
            d.gdp != null ? ` · ${fmtGdp(d.gdp)}/cap` : ""
          }`,
          event.clientX,
          event.clientY,
        ),
      )
      .on("pointerleave", hideTooltip);

    const r = pearson(
      rows.map((d) => d.pop65),
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
      .call(
        d3
          .axisBottom(x)
          .ticks(5)
          .tickFormat((d) => `${d}%`),
      )
      .call(styleAxis);
    g.append("g").call(d3.axisLeft(y).ticks(5).tickFormat(fmtPlainPct)).call(styleAxis);
    g.append("text")
      .attr("class", "chart-label")
      .attr("x", innerW / 2)
      .attr("y", innerH + 36)
      .attr("text-anchor", "middle")
      .text("share of population aged 65+");

    // Log-spaced colour stops for the gradient bar (matches the log colour scale).
    const stops = d3
      .range(0, 1.001, 0.1)
      .map((t) => gdpColor(gdpMin * Math.pow(gdpMax / gdpMin, t)))
      .join(", ");
    const legend = d3.select(legendRef.current);
    legend.html(
      `<span>${fmtGdp(gdpMin)}</span>` +
        `<span class="gradient-bar" style="background:linear-gradient(90deg, ${stops})"></span>` +
        `<span>${fmtGdp(gdpMax)}</span>` +
        `<span class="legend-caption">GDP per capita</span>`,
    );
  }, [unified, proxies, features]);

  return (
    <section className="chart-panel">
      <h4 className="chart-title">Amplitude vs. Population 65+</h4>
      <p className="chart-copy">
        Each country&apos;s measured seasonal amplitude against the share of its population aged
        65+. Older populations skew toward the wealthier, more temperate countries where the winter
        swing is strongest.
      </p>
      <svg
        ref={svgRef}
        id="pop65-scatter-chart"
        className="seasonality-chart"
        viewBox="0 0 420 260"
        role="img"
        aria-label="Scatter plot of seasonal mortality amplitude against the share of population aged 65 and over, coloured by GDP per capita on a log scale"
      />
      <div className="chart-legend" ref={legendRef} id="pop65-scatter-legend" aria-hidden="true" />
    </section>
  );
}
