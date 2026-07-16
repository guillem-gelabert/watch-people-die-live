"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import {
  KG_FAMILIES,
  fmtPlainPct,
  kgFamilyColor,
  pearson,
  strength,
  styleAxis,
} from "../chartHelpers";
import { showTooltip, hideTooltip } from "../tooltip";
import type { CountryFeature, SeasonalityData, SeasonalityProxies } from "../types";

interface Row {
  name: string;
  lat: number;
  absLat: number;
  deviation: number;
  color: string;
  kg: string | null;
}

interface LatBin {
  center: number;
  n: number;
  mean: number;
  sd: number;
}

interface LatitudeCorrelationProps {
  unified: SeasonalityData | null;
  proxies: SeasonalityProxies | null;
  features: CountryFeature[] | null;
}

const LAT_BIN_WIDTH = 10;

// Groups rows into fixed-width latitude bins and returns each bin's mean and
// population SD of `deviation`. Bins with fewer than 2 countries are dropped —
// a single point can't support a meaningful spread.
function computeLatBins(rows: Row[]): LatBin[] {
  const bins = new Map<number, number[]>();
  rows.forEach((r) => {
    const binStart = Math.floor(r.absLat / LAT_BIN_WIDTH) * LAT_BIN_WIDTH;
    const arr = bins.get(binStart) ?? [];
    arr.push(r.deviation);
    bins.set(binStart, arr);
  });
  return Array.from(bins.entries())
    .map(([binStart, values]) => {
      const n = values.length;
      const mean = d3.mean(values) ?? 0;
      const sd = Math.sqrt(d3.mean(values, (v) => (v - mean) ** 2) ?? 0);
      return { center: binStart + LAT_BIN_WIDTH / 2, n, mean, sd };
    })
    .filter((b) => b.n >= 2)
    .sort((a, b) => a.center - b.center);
}

// Chart 6: latitude vs seasonal-deviation scatter, coloured by Köppen–Geiger climate family.
export default function LatitudeCorrelation({
  unified,
  proxies,
  features,
}: LatitudeCorrelationProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const legendRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!unified || !proxies || !features || !svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const rows: Row[] = Object.entries(unified.countries)
      .map(([id, curve]): Row | null => {
        const feature = features.find((f) => Number(f.id) === Number(id));
        if (!feature) return null;
        const lat = d3.geoCentroid(feature)[1];
        const absLat = Math.abs(lat);
        const proxy = proxies.byM49[id];
        const kg = proxy?.kgClass
          ? proxy.kgFamilyName
            ? `${proxy.kgClass} (${proxy.kgFamilyName})`
            : proxy.kgClass
          : null;
        return {
          name: feature.properties?.name ?? "Unknown",
          lat,
          absLat,
          deviation: strength(curve),
          color: kgFamilyColor(proxy?.kgFamily),
          kg,
        };
      })
      .filter((r): r is Row => r !== null);

    const latBins = computeLatBins(rows);

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
    const maxBandTop = d3.max(latBins, (b) => b.mean + b.sd) || 0;
    const y = d3
      .scaleLinear()
      .domain([0, Math.max(0.18, d3.max(rows, (d) => d.deviation) || 0.18, maxBandTop)])
      .nice()
      .range([innerH, 0]);
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Tropic and polar boundaries
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

    if (latBins.length > 0) {
      const band = d3
        .area<LatBin>()
        .x((d) => x(d.center))
        .y0((d) => y(Math.max(0, d.mean - d.sd)))
        .y1((d) => y(d.mean + d.sd))
        .curve(d3.curveMonotoneX);
      g.append("path").datum(latBins).attr("class", "chart-band").attr("d", band);
    }

    g.selectAll("circle")
      .data(rows)
      .join("circle")
      .attr("class", "chart-point")
      .attr("cx", (d) => x(d.absLat))
      .attr("cy", (d) => y(d.deviation))
      .attr("r", 3.6)
      .style("fill", (d) => d.color)
      .style("cursor", "pointer")
      .on("pointermove", (event, d) =>
        showTooltip(
          `${d.name}: ${d.absLat.toFixed(1)}° lat, ${fmtPlainPct(d.deviation)}${
            d.kg ? ` · ${d.kg}` : ""
          }`,
          event.clientX,
          event.clientY,
        ),
      )
      .on("pointerleave", hideTooltip);

    const r = pearson(
      rows.map((d) => d.absLat),
      rows.map((d) => d.deviation),
    );
    if (r != null) {
      g.append("text")
        .attr("class", "chart-note")
        .attr("x", 0)
        .attr("y", 10)
        .text(`R² = ${(r * r).toFixed(2)}`);
    }

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
      .data(KG_FAMILIES)
      .join("span")
      .html((d) => `<span class="swatch" style="color:${d.color}"></span>${d.name}`);
  }, [unified, proxies, features]);

  return (
    <section className="chart-panel">
      <h4 className="chart-title">Latitude Correlation</h4>
      <p className="chart-copy">
        89 countries from the unified dataset, plotted by latitude and coloured by Köppen–Geiger
        climate family. Amplitude peaks in the middle latitudes rather than rising all the way to
        the poles, unlike the old fallback&apos;s flat plateau past 40°. The shaded ribbon shows ± 1
        SD of amplitude around the mean within each 10° latitude band.
      </p>
      <svg
        ref={svgRef}
        id="latitude-correlation-chart"
        className="seasonality-chart"
        viewBox="0 0 420 260"
        role="img"
        aria-label="Scatter plot of latitude and seasonal mortality amplitude, coloured by Köppen–Geiger climate family, with a per-10-degree mean ± 1 SD band"
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
