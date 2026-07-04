"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { MONTHS, fmtPct, rotateSix, styleAxis } from "../chartHelpers";
import { showTooltip, hideTooltip } from "../tooltip";
import type { SeasonalityData } from "../types";

interface SeasonalCurveProps {
  seasonality: SeasonalityData | null;
}

// Chart 5: canonical north/south seasonal curves (two lines).
export default function SeasonalCurve({ seasonality }: SeasonalCurveProps) {
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!seasonality || !ref.current) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const width = 420;
    const height = 260;
    const margin = { top: 16, right: 18, bottom: 38, left: 48 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    const north = seasonality.fallback.north;
    const south = rotateSix(north);
    const x = d3.scalePoint().domain(MONTHS).range([0, innerW]).padding(0.35);
    const y = d3
      .scaleLinear()
      .domain(d3.extent(north.concat(south)) as [number, number])
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

    // Invisible hit-columns per month drive the hover tooltip for both series.
    const bandWidth = innerW / MONTHS.length;
    g.selectAll("rect.hit")
      .data(MONTHS)
      .join("rect")
      .attr("class", "hit")
      .attr("x", (month) => (x(month) ?? 0) - bandWidth / 2)
      .attr("y", 0)
      .attr("width", bandWidth)
      .attr("height", innerH)
      .attr("fill", "transparent")
      .style("pointer-events", "all")
      .on("pointermove", (event, month) => {
        const i = MONTHS.indexOf(month);
        showTooltip(
          `${month}: North ${fmtPct(north[i]! - 1)}, South ${fmtPct(south[i]! - 1)}`,
          event.clientX,
          event.clientY,
        );
      })
      .on("pointerleave", hideTooltip);

    g.append("path").attr("class", "chart-line-north").attr("d", line(north));
    g.append("path").attr("class", "chart-line-south").attr("d", line(south));
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
    g.append("text")
      .attr("class", "chart-label")
      .attr("x", innerW)
      .attr("y", y(d3.max(north) ?? 0) - 8)
      .attr("text-anchor", "end")
      .text(`${fmtPct((d3.max(north) ?? 0) - 1)} peak`);
  }, [seasonality]);

  return (
    <section className="chart-panel">
      <h4 className="chart-title">Seasonal Curve</h4>
      <p className="chart-copy">
        Canonical curve averaged across the unified dataset&apos;s best-covered countries
        (phase-aligned across hemispheres first), shown north and south. This is the shape the
        continuous fallback below rescales to match each country&apos;s predicted amplitude.
      </p>
      <svg
        ref={ref}
        id="seasonal-curve-chart"
        className="seasonality-chart"
        viewBox="0 0 420 260"
        role="img"
        aria-label="Line chart of northern and southern seasonal mortality curves"
      />
      <div className="chart-legend" aria-hidden="true">
        <span>
          <span className="swatch north" />
          North
        </span>
        <span>
          <span className="swatch south" />
          South
        </span>
      </div>
    </section>
  );
}
