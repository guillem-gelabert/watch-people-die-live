"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { fmtPlainPct, pearson, strength, styleAxis } from "../chartHelpers";
import { showTooltip, hideTooltip } from "../tooltip";
import type { CountryFeature, NeighborsByM49, SeasonalityData } from "../types";

interface Row {
  name: string;
  neighborMean: number;
  amplitude: number;
  donors: number; // bordering neighbours that report a curve
  totalNeighbors: number; // all bordering neighbours
  coverage: number; // donors / totalNeighbors, in [0, 1]
}

interface NeighbourScatterProps {
  unified: SeasonalityData | null;
  features: CountryFeature[] | null;
  neighborsByM49: NeighborsByM49 | null;
}

// Colour ramp for the share of a country's neighbours that report a curve: warm amber at
// low coverage (the point rests on one or two donors, so distrust it) to bright cyan when
// every neighbour has data. Interpolated through HSL for maximum contrast across the range.
const coverageColor = d3
  .scaleSequential<string>()
  .domain([0, 1])
  .interpolator(d3.interpolateHsl("#f59e0b", "#22d3ee"));

// Amplitude vs. the plain mean amplitude of a country's bordering neighbours that also
// report a curve (shared-border adjacency from the topojson topology, not a distance
// threshold). Countries whose neighbours are all missing data are excluded — there's no
// neighbour amplitude to plot for them. Dots are coloured by the share of bordering
// neighbours that actually report a curve, so single-donor points read as low-confidence.
export default function NeighbourScatter({
  unified,
  features,
  neighborsByM49,
}: NeighbourScatterProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const legendRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!unified || !features || !neighborsByM49 || !svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const nameById = new Map(features.map((f) => [Number(f.id), f.properties?.name ?? ""]));
    const amplitudeById = new Map(
      Object.entries(unified.countries).map(([id, curve]) => [Number(id), strength(curve)]),
    );

    let excluded = 0;
    const rows: Row[] = [...amplitudeById.entries()]
      .map(([id, amplitude]): Row | null => {
        const neighborIds = neighborsByM49.get(id) ?? [];
        const neighborAmplitudes = neighborIds
          .map((n) => amplitudeById.get(n))
          .filter((v): v is number => v != null);
        if (!neighborAmplitudes.length) {
          excluded += 1;
          return null;
        }
        return {
          name: nameById.get(id) || String(id),
          neighborMean: d3.mean(neighborAmplitudes) ?? 0,
          amplitude,
          donors: neighborAmplitudes.length,
          totalNeighbors: neighborIds.length,
          coverage: neighborIds.length ? neighborAmplitudes.length / neighborIds.length : 0,
        };
      })
      .filter((r): r is Row => r !== null);

    const width = 420;
    const height = 260;
    const margin = { top: 16, right: 18, bottom: 42, left: 52 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const domainMax = Math.max(
      0.18,
      d3.max(rows, (d) => d.amplitude) || 0.18,
      d3.max(rows, (d) => d.neighborMean) || 0.18,
    );
    const x = d3.scaleLinear().domain([0, domainMax]).nice().range([0, innerW]);
    const y = d3.scaleLinear().domain([0, domainMax]).nice().range([innerH, 0]);
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const r = pearson(
      rows.map((d) => d.neighborMean),
      rows.map((d) => d.amplitude),
    );
    if (r != null) {
      g.append("text")
        .attr("class", "chart-note")
        .attr("x", 0)
        .attr("y", 4)
        .text(`r = ${r.toFixed(2)}`);
    }

    g.selectAll("circle")
      .data(rows)
      .join("circle")
      .attr("class", "chart-point")
      .attr("cx", (d) => x(d.neighborMean))
      .attr("cy", (d) => y(d.amplitude))
      .attr("r", 3.6)
      .style("fill", (d) => coverageColor(d.coverage))
      .style("cursor", "pointer")
      .on("pointermove", (event, d) =>
        showTooltip(
          `${d.name}: own ${fmtPlainPct(d.amplitude)}, neighbours ${fmtPlainPct(d.neighborMean)} · ` +
            `${d.donors}/${d.totalNeighbors} neighbours with data (${fmtPlainPct(d.coverage)})`,
          event.clientX,
          event.clientY,
        ),
      )
      .on("pointerleave", hideTooltip);

    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(fmtPlainPct))
      .call(styleAxis);
    g.append("g").call(d3.axisLeft(y).ticks(5).tickFormat(fmtPlainPct)).call(styleAxis);
    g.append("text")
      .attr("class", "chart-label")
      .attr("x", innerW / 2)
      .attr("y", innerH + 36)
      .attr("text-anchor", "middle")
      .text("mean amplitude of bordering neighbours");

    if (excluded > 0) {
      svg
        .append("text")
        .attr("class", "chart-note")
        .attr("x", width - margin.right)
        .attr("y", 14)
        .attr("text-anchor", "end")
        .text(`${excluded} excluded — no bordering donor`);
    }

    const stops = d3
      .range(0, 1.001, 0.1)
      .map((t) => coverageColor(t))
      .join(", ");
    d3.select(legendRef.current).html(
      `<span>0%</span>` +
        `<span class="gradient-bar" style="background:linear-gradient(90deg, ${stops})"></span>` +
        `<span>100%</span>` +
        `<span class="legend-caption">share of bordering neighbours with a curve</span>`,
    );
  }, [unified, features, neighborsByM49]);

  return (
    <section className="chart-panel">
      <h4 className="chart-title">Amplitude vs. Neighbouring Countries</h4>
      <p className="chart-copy">
        Each country&apos;s own amplitude against the plain mean amplitude of its bordering
        neighbours that also report a curve (shared-border adjacency, not distance). Where a
        country&apos;s amplitude tracks its neighbours&apos;, geography alone predicts the swing;
        scatter is where a shared border doesn&apos;t imply a shared climate. Dots are coloured by
        the share of bordering neighbours that report a curve — amber points rest on just one or two
        donors and should be read with caution, cyan points on a fuller set. Countries with no
        bordering donor are dropped rather than guessed at.
      </p>
      <svg
        ref={svgRef}
        id="neighbour-scatter-chart"
        className="seasonality-chart"
        viewBox="0 0 420 260"
        role="img"
        aria-label="Scatter plot of each country's seasonal mortality amplitude against the mean amplitude of its bordering neighbours, coloured by the share of neighbours that report a curve"
      />
      <div
        className="chart-legend"
        ref={legendRef}
        id="neighbour-scatter-legend"
        aria-hidden="true"
      />
    </section>
  );
}
