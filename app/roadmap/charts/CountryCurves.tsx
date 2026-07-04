"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { MONTHS, fmtPct, COUNTRY_CURVE_PICKS, styleAxis } from "../chartHelpers";
import { showTooltip, hideTooltip } from "../tooltip";
import type { SeasonalityData } from "../types";

interface Series {
  id: number;
  name: string;
  color: string;
  curve: number[];
}

interface CountryCurvesProps {
  seasonality: SeasonalityData | null;
}

// Chart 3: multi-line seasonal mortality curves for 10 countries.
export default function CountryCurves({ seasonality }: CountryCurvesProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const legendRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!seasonality || !svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 700;
    const height = 280;
    const margin = { top: 16, right: 18, bottom: 38, left: 48 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    const series: Series[] = COUNTRY_CURVE_PICKS.map((d) => ({
      ...d,
      curve: seasonality.countries[String(d.id)]!,
    })).filter((d) => d.curve);
    if (!series.length) return;

    const x = d3.scalePoint().domain(MONTHS).range([0, innerW]).padding(0.35);
    const y = d3
      .scaleLinear()
      .domain(d3.extent(series.flatMap((d) => d.curve)) as [number, number])
      .nice()
      .range([innerH, 0]);
    const line = d3
      .line<number>()
      .x((_, i) => x(MONTHS[i]!) ?? 0)
      .y((d) => y(d))
      .curve(d3.curveMonotoneX);
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    g.append("line")
      .attr("class", "chart-gridline")
      .attr("x1", 0)
      .attr("x2", innerW)
      .attr("y1", y(1))
      .attr("y2", y(1));
    g.selectAll("path.country-curve")
      .data(series)
      .join("path")
      .attr("class", "country-curve")
      .attr("fill", "none")
      .attr("stroke", (d) => d.color)
      .attr("stroke-width", 2.2)
      .attr("d", (d) => line(d.curve))
      .style("cursor", "pointer")
      .on("pointermove", (event, d) => {
        // Nearest month under the pointer for this series.
        const [px] = d3.pointer(event, g.node());
        let i = 0;
        let best = Infinity;
        for (let j = 0; j < MONTHS.length; j++) {
          const dist = Math.abs((x(MONTHS[j]!) ?? 0) - px);
          if (dist < best) {
            best = dist;
            i = j;
          }
        }
        showTooltip(
          `${d.name}, ${MONTHS[i]}: ${fmtPct(d.curve[i]! - 1)}`,
          event.clientX,
          event.clientY,
        );
      })
      .on("pointerleave", hideTooltip);
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickSizeOuter(0))
      .call(styleAxis);
    g.append("g")
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickFormat((d) => fmtPct(Number(d) - 1)),
      )
      .call(styleAxis);

    const legend = d3.select(legendRef.current);
    legend
      .selectAll("span")
      .data(series)
      .join("span")
      .html((d) => `<span class="swatch" style="color:${d.color}"></span>${d.name}`);
  }, [seasonality]);

  return (
    <section className="chart-panel wide">
      <h4 className="chart-title">A Cluster Of Similar Curves</h4>
      <p className="chart-copy">
        Ten countries whose measured curves are mutually similar in shape (average pairwise
        correlation r=0.994) despite spanning very different latitudes and death tolls — Japan and
        the USA track the same winter/summer timing as France, the UK, and the Benelux countries.
      </p>
      <svg
        ref={svgRef}
        id="country-curves-chart"
        className="seasonality-chart"
        viewBox="0 0 700 280"
        role="img"
        aria-label="Line chart comparing the seasonal mortality curves of France, Slovakia, USA, Sweden, Japan, Croatia, Belgium, United Kingdom, Switzerland, and the Netherlands"
      />
      <div className="chart-legend" ref={legendRef} id="country-curves-legend" aria-hidden="true" />
      <p className="chart-copy">
        6 of these 10 curves come from the notebook&apos;s unified sources above, not the 27-country{" "}
        <code>data/seasonality.json</code> shipped today.
      </p>
    </section>
  );
}
