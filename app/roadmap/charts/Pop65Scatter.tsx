"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import {
  buildLegendSteps,
  fmtPlainPct,
  pearson,
  renderGradientLegend,
  strength,
  styleAxis,
} from "../chartHelpers";
import { showTooltip, hideTooltip } from "../tooltip";
import type { CountryFeature, SeasonalityData, SeasonalityProxies } from "../types";

interface Row {
  name: string;
  pop65: number;
  amplitude: number;
  gdp: number | null;
  step: number; // index into the GDP legend steps, or -1 when GDP is unknown
}

const N_STEPS = 5;
// Dots without a GDP figure fall back to this neutral grey and step index -1.
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
  const visualRef = useRef<HTMLDivElement | null>(null);
  const sweepPlayedRef = useRef(false);

  useEffect(() => {
    if (
      !unified ||
      !proxies ||
      !features ||
      !svgRef.current ||
      !legendRef.current ||
      !visualRef.current
    )
      return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const nameById = new Map(features.map((f) => [Number(f.id), f.properties?.name ?? ""]));
    const raw = Object.entries(unified.countries)
      .map((entry) => {
        const [id, curve] = entry;
        const row = proxies.byM49[id];
        if (!row || row.pop65 == null) return null;
        return {
          name: nameById.get(Number(id)) || id,
          pop65: row.pop65,
          amplitude: strength(curve),
          gdp: row.gdpPerCapita ?? null,
        };
      })
      .filter((r): r is Omit<Row, "step"> => r !== null);

    // GDP per capita is heavily right-skewed, so bin by quantile on a log scale — each
    // step then covers roughly a fifth of the countries, not a fifth of the dollar range.
    const gdpExtent = d3.extent(raw, (d) => d.gdp ?? undefined) as
      [number, number] | [undefined, undefined];
    const [gdpMin, gdpMax] = gdpExtent[0] != null ? gdpExtent : [1, 1];
    const gdpLogValues = raw
      .map((r) => r.gdp)
      .filter((g): g is number => g != null)
      .map((g) => Math.log10(g));
    const { steps: gdpSteps, scale: gdpStepScale } = buildLegendSteps(
      gdpLogValues,
      N_STEPS,
      d3.interpolateYlOrRd,
      fmtGdp,
      (v) => 10 ** v,
    );
    const stepOf = (gdp: number | null) => (gdp == null ? -1 : gdpStepScale(Math.log10(gdp)));
    const colorOf = (step: number) =>
      step < 0 ? NO_GDP_COLOR : (gdpSteps[step]?.color ?? NO_GDP_COLOR);
    const rows: Row[] = raw.map((r) => ({ ...r, step: stepOf(r.gdp) }));

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

    const points = g
      .selectAll<SVGCircleElement, Row>("circle")
      .data(rows)
      .join("circle")
      .attr("class", "chart-point")
      .attr("cx", (d) => x(d.pop65))
      .attr("cy", (d) => y(d.amplitude))
      .attr("r", 3.6)
      .style("fill", (d) => colorOf(d.step))
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

    const cleanupLegend = renderGradientLegend(
      legendRef.current,
      gdpSteps,
      "GDP per capita",
      [fmtGdp(gdpMin), fmtGdp(gdpMax)],
      points,
      {
        guidedSweep: {
          visibilityTarget: visualRef.current,
          hasPlayed: sweepPlayedRef,
          durationMs: 2200,
        },
      },
    );
    if (rows.some((r) => r.gdp == null)) {
      d3.select(legendRef.current)
        .append("span")
        .html(`<span class="swatch-dot" style="background:${NO_GDP_COLOR}"></span>no data`);
    }
    return cleanupLegend;
  }, [unified, proxies, features]);

  return (
    <div className="guided-legend-visual" ref={visualRef}>
      <svg
        ref={svgRef}
        id="pop65-scatter-chart"
        className="seasonality-chart"
        viewBox="0 0 420 260"
        role="img"
        aria-label="Scatter plot of seasonal mortality amplitude against the share of population aged 65 and over, coloured by GDP per capita in five log-spaced steps; hovering a legend step highlights its dots"
      />
      <div className="chart-legend" ref={legendRef} id="pop65-scatter-legend" aria-hidden="true" />
    </div>
  );
}
