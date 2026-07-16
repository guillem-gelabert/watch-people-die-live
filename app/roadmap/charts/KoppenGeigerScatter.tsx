"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { KG_FAMILIES, correlationRatio, fmtPlainPct, strength, styleAxis } from "../chartHelpers";
import { showTooltip, hideTooltip } from "../tooltip";
import type { CountryFeature, SeasonalityData, SeasonalityProxies } from "../types";

interface Row {
  name: string;
  family: string;
  amplitude: number;
}

interface KoppenGeigerScatterProps {
  unified: SeasonalityData | null;
  proxies: SeasonalityProxies | null;
  features: CountryFeature[] | null;
}

// Amplitude by dominant Köppen–Geiger climate family: a jittered strip scatter, one dot per
// country that reports a curve, grouped by the family that covers most of its population.
export default function KoppenGeigerScatter({
  unified,
  proxies,
  features,
}: KoppenGeigerScatterProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!unified || !proxies || !features || !svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const nameById = new Map(features.map((f) => [Number(f.id), f.properties?.name ?? ""]));
    const rows: Row[] = Object.entries(unified.countries)
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
      .domain([0, Math.max(0.18, d3.max(rows, (d) => d.amplitude) || 0.18)])
      .nice()
      .range([innerH, 0]);
    const colorByFamily = new Map(KG_FAMILIES.map((f) => [f.key, f.color]));
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // A deterministic horizontal jitter within each band, so overlapping dots spread out
    // without moving between runs (Math.random is avoided elsewhere in the pipeline too).
    const bw = x.bandwidth();
    const jitter = (i: number) => {
      const golden = (i * 0.61803398875) % 1;
      return (golden - 0.5) * bw * 0.82;
    };

    // Mean amplitude per family with ±1 SD error band and mean line.
    for (const f of KG_FAMILIES) {
      const group = rows.filter((r) => r.family === f.key);
      if (!group.length) continue;
      const mean = d3.mean(group, (d) => d.amplitude) ?? 0;
      const sd = Math.sqrt(d3.mean(group, (d) => (d.amplitude - mean) ** 2) ?? 0) || 0;
      const cx = (x(f.key) ?? 0) + bw / 2;
      // Error band: mean ± 1 SD, clipped to [0, y.domain[1]]
      const yMax = (y.domain() as [number, number])[1];
      const bandTop = Math.max(0, mean - sd);
      const bandBottom = Math.min(yMax, mean + sd);
      g.append("rect")
        .attr("class", "chart-band")
        .attr("x", cx - (bw / 2) * 0.7)
        .attr("width", bw * 0.7)
        .attr("y", y(bandBottom))
        .attr("height", y(bandTop) - y(bandBottom));
      // Mean line
      g.append("line")
        .attr("x1", cx - bw / 2)
        .attr("x2", cx + bw / 2)
        .attr("y1", y(mean))
        .attr("y2", y(mean))
        .attr("stroke", f.color)
        .attr("stroke-width", 2)
        .attr("stroke-opacity", 0.9);
    }

    g.selectAll("circle")
      .data(rows)
      .join("circle")
      .attr("class", "chart-point")
      .attr("cx", (d, i) => (x(d.family) ?? 0) + bw / 2 + jitter(i))
      .attr("cy", (d) => y(d.amplitude))
      .attr("r", 3.6)
      .style("fill", (d) => colorByFamily.get(d.family) ?? "#8888aa")
      .style("cursor", "pointer")
      .on("pointermove", (event, d) =>
        showTooltip(`${d.name}: ${fmtPlainPct(d.amplitude)}`, event.clientX, event.clientY),
      )
      .on("pointerleave", hideTooltip);

    // Climate family is categorical, so Pearson r is undefined — use the correlation
    // ratio η (share of amplitude variance explained by the family means) instead.
    const groups = new Map<string, number[]>();
    for (const row of rows) {
      const arr = groups.get(row.family) ?? [];
      arr.push(row.amplitude);
      groups.set(row.family, arr);
    }
    const eta = correlationRatio(groups);
    if (eta != null) {
      g.append("text")
        .attr("class", "chart-note")
        .attr("x", 0)
        .attr("y", 10)
        .text(`η = ${eta.toFixed(2)}`);
    }

    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickFormat((k) => KG_FAMILIES.find((f) => f.key === k)?.name ?? k))
      .call(styleAxis);
    g.append("g").call(d3.axisLeft(y).ticks(5).tickFormat(fmtPlainPct)).call(styleAxis);
  }, [unified, proxies, features]);

  return (
    <section className="chart-panel">
      <h4 className="chart-title">Amplitude by Climate Zone</h4>
      <p className="chart-copy">
        Each country grouped by its dominant Köppen–Geiger climate family, from tropical to polar.
        Temperate and continental zones carry the strongest seasonal swing; the tropics barely move.
        The bar marks each family&apos;s mean.
      </p>
      <svg
        ref={svgRef}
        id="koppen-geiger-scatter-chart"
        className="seasonality-chart"
        viewBox="0 0 420 260"
        role="img"
        aria-label="Strip scatter plot of seasonal mortality amplitude grouped by dominant Köppen–Geiger climate family"
      />
    </section>
  );
}
