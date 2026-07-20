"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { fmtPlainPct, pearson, strength, styleAxis } from "../chartHelpers";
import { showTooltip, hideTooltip } from "../tooltip";
import type {
  CountryFeature,
  NeighborsByM49,
  RegionNeighborsByCode,
  SeasonalityData,
  SubnationalSeasonalityRegion,
} from "../types";

interface Row {
  name: string;
  amplitude: number;
  neighborMean: number;
}

interface RegionNeighbourScatterProps {
  regions: SubnationalSeasonalityRegion[] | null;
  regionNeighbors: RegionNeighborsByCode | null;
  unified: SeasonalityData | null;
  features: CountryFeature[] | null;
  neighborsByM49: NeighborsByM49 | null;
}

// Region-level analog of NeighbourScatter. Only Admin-1 regions participate; partido rows have
// no checked-in boundary topology and therefore cannot enter a border calculation.
export default function RegionNeighbourScatter({
  regions,
  regionNeighbors,
  unified,
  features,
  neighborsByM49,
}: RegionNeighbourScatterProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const legendRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!regions || !regionNeighbors || !unified || !features || !neighborsByM49 || !svgRef.current)
      return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const borderedRegions = regions.filter((r) => r.geo === "adm1");
    const ampByKey = new Map(borderedRegions.map((r) => [r.key, strength(r.curve)]));
    const regionRows: Row[] = borderedRegions
      .map((r) => {
        const nb = (regionNeighbors.get(r.key) ?? [])
          .map((k) => ampByKey.get(k))
          .filter((v): v is number => v != null);
        if (!nb.length) return null;
        return { name: r.name, amplitude: strength(r.curve), neighborMean: d3.mean(nb) ?? 0 };
      })
      .filter((r): r is Row => r !== null);

    const amplitudeById = new Map(
      Object.entries(unified.countries).map(([id, curve]) => [Number(id), strength(curve)]),
    );
    const countryRows: Row[] = [...amplitudeById.entries()]
      .map(([id, amplitude]) => {
        const nb = (neighborsByM49.get(id) ?? [])
          .map((n) => amplitudeById.get(n))
          .filter((v): v is number => v != null);
        if (!nb.length) return null;
        return { name: "", amplitude, neighborMean: d3.mean(nb) ?? 0 };
      })
      .filter((r): r is Row => r !== null);

    const width = 420;
    const height = 260;
    const margin = { top: 16, right: 18, bottom: 42, left: 52 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    const domainMax = Math.max(
      0.14,
      d3.max(regionRows, (d) => Math.max(d.amplitude, d.neighborMean)) || 0.14,
      d3.max(countryRows, (d) => Math.max(d.amplitude, d.neighborMean)) || 0.14,
    );
    const x = d3.scaleLinear().domain([0, domainMax]).nice().range([0, innerW]);
    const y = d3.scaleLinear().domain([0, domainMax]).nice().range([innerH, 0]);
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    g.append("line")
      .attr("x1", 0)
      .attr("y1", innerH)
      .attr("x2", x(domainMax))
      .attr("y2", y(domainMax))
      .attr("stroke", "#444")
      .attr("stroke-width", 0.8);

    g.selectAll("circle.country-pt")
      .data(countryRows)
      .join("circle")
      .attr("class", "country-pt")
      .attr("cx", (d) => x(d.neighborMean))
      .attr("cy", (d) => y(d.amplitude))
      .attr("r", 3)
      .attr("fill", "none")
      .attr("stroke", "#888")
      .attr("stroke-width", 0.8)
      .attr("opacity", 0.6);

    g.selectAll("circle.region-pt")
      .data(regionRows)
      .join("circle")
      .attr("class", "region-pt chart-point")
      .attr("cx", (d) => x(d.neighborMean))
      .attr("cy", (d) => y(d.amplitude))
      .attr("r", 3.2)
      .style("cursor", "pointer")
      .on("pointermove", (event, d) =>
        showTooltip(
          `${d.name}: own ${fmtPlainPct(d.amplitude)}, neighbours ${fmtPlainPct(d.neighborMean)}`,
          event.clientX,
          event.clientY,
        ),
      )
      .on("pointerleave", hideTooltip);

    const rCountriesOnly = pearson(
      countryRows.map((d) => d.neighborMean),
      countryRows.map((d) => d.amplitude),
    );
    // Pooled across both populations: every country and every region as one point cloud of
    // own-amplitude vs bordering-units' mean amplitude.
    const bothRows = [...countryRows, ...regionRows];
    const rBoth = pearson(
      bothRows.map((d) => d.neighborMean),
      bothRows.map((d) => d.amplitude),
    );
    g.append("text")
      .attr("class", "chart-note")
      .attr("x", 0)
      .attr("y", 4)
      .text(
        `only countries r = ${rCountriesOnly != null ? rCountriesOnly.toFixed(2) : "—"}  ·  countries & regions r = ${rBoth != null ? rBoth.toFixed(2) : "—"}`,
      );

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

    const legend = d3.select(legendRef.current);
    legend.selectAll("span").remove();
    legend.append("span").html('<span class="swatch" style="color:#5aa9d6"></span>regions');
    legend
      .append("span")
      .html('<span class="swatch" style="color:#888"></span>countries (outline)');
  }, [regions, regionNeighbors, unified, features, neighborsByM49]);

  return (
    <>
      <svg
        ref={svgRef}
        id="region-neighbour-scatter-chart"
        className="seasonality-chart"
        viewBox="0 0 420 260"
        role="img"
        aria-label="Scatter plot of each measured Admin-1 region's seasonal amplitude against the mean amplitude of its bordering measured regions, with countries overlaid as grey outlines"
      />
      <div
        className="chart-legend"
        ref={legendRef}
        id="region-neighbour-scatter-legend"
        aria-hidden="true"
      />
    </>
  );
}
