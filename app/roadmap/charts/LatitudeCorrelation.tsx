"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { fmtPlainPct, strength, CLIMATE_ZONES, styleAxis } from "../chartHelpers";
import { showTooltip, hideTooltip } from "../tooltip";
import type { CountryFeature, SeasonalityData } from "../types";

interface Row {
  name: string;
  lat: number;
  absLat: number;
  deviation: number;
}

interface LatitudeCorrelationProps {
  unified: SeasonalityData | null;
  features: CountryFeature[] | null;
}

// Chart 6: latitude vs seasonal-deviation scatter, with climate-zone bands.
export default function LatitudeCorrelation({ unified, features }: LatitudeCorrelationProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const legendRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!unified || !features || !svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const rows: Row[] = Object.entries(unified.countries)
      .map(([id, curve]): Row | null => {
        const feature = features.find((f) => Number(f.id) === Number(id));
        if (!feature) return null;
        const lat = d3.geoCentroid(feature)[1];
        return {
          name: feature.properties?.name ?? "Unknown",
          lat,
          absLat: Math.abs(lat),
          deviation: strength(curve),
        };
      })
      .filter((r): r is Row => r !== null);

    const width = 420;
    const height = 260;
    const margin = { top: 16, right: 18, bottom: 42, left: 52 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    const maxAbsLat = d3.max(rows, (d) => d.absLat) || 70;
    const x = d3
      .scaleLinear()
      .domain([0, Math.max(70, maxAbsLat)])
      .range([0, innerW]);
    const y = d3
      .scaleLinear()
      .domain([0, Math.max(0.18, d3.max(rows, (d) => d.deviation) || 0.18)])
      .nice()
      .range([innerH, 0]);
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const [latMin, latMax] = x.domain() as [number, number];
    g.selectAll("rect.climate-band")
      .data(CLIMATE_ZONES)
      .join("rect")
      .attr("class", "climate-band")
      .attr("x", (d) => x(Math.max(d.lo, latMin)))
      .attr("width", (d) => x(Math.min(d.hi, latMax)) - x(Math.max(d.lo, latMin)))
      .attr("y", 0)
      .attr("height", innerH)
      .attr("fill", (d) => d.color)
      .attr("fill-opacity", 0.55)
      .style("cursor", "pointer")
      .on("pointermove", (event, d) =>
        showTooltip(`${d.name} climate zone`, event.clientX, event.clientY),
      )
      .on("pointerleave", hideTooltip);
    [23.5, 35, 66.5].forEach((boundary) => {
      if (boundary > latMax) return;
      g.append("line")
        .attr("class", "climate-band-boundary")
        .attr("x1", x(boundary))
        .attr("x2", x(boundary))
        .attr("y1", 0)
        .attr("y2", innerH);
    });

    g.selectAll("circle")
      .data(rows)
      .join("circle")
      .attr("class", "chart-point")
      .attr("cx", (d) => x(d.absLat))
      .attr("cy", (d) => y(d.deviation))
      .attr("r", 3.6)
      .style("cursor", "pointer")
      .on("pointermove", (event, d) =>
        showTooltip(
          `${d.name}: ${d.absLat.toFixed(1)}° lat, ${fmtPlainPct(d.deviation)}`,
          event.clientX,
          event.clientY,
        ),
      )
      .on("pointerleave", hideTooltip);
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
    legend
      .selectAll("span")
      .data(CLIMATE_ZONES)
      .join("span")
      .html((d) => `<span class="swatch" style="color:${d.color}"></span>${d.name}`);
  }, [unified, features]);

  return (
    <section className="chart-panel">
      <h4 className="chart-title">Latitude Correlation</h4>
      <p className="chart-copy">
        87 countries from the unified dataset, plotted by latitude and climate zone. Amplitude peaks
        in the middle latitudes rather than rising all the way to the poles, unlike the old
        fallback&apos;s flat plateau past 40°.
      </p>
      <svg
        ref={svgRef}
        id="latitude-correlation-chart"
        className="seasonality-chart"
        viewBox="0 0 420 260"
        role="img"
        aria-label="Scatter plot of latitude and seasonal mortality deviation, with climate zone bands and a quadratic fit"
      />
      <div
        className="chart-legend"
        ref={legendRef}
        id="latitude-correlation-legend"
        aria-hidden="true"
      />
    </section>
  );
}
