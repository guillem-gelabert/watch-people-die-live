"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { MONTHS, styleAxis } from "../chartHelpers";
import { showTooltip, hideTooltip } from "../tooltip";
import type { LooValidation, LooClimateZone } from "../types";
import LineSwatch from "./LineSwatch";

interface ClimateZoneCurvesProps {
  looValidation: LooValidation | null;
}

// Three lines per zone; climate class has no per-zone curve in the validation export
// (only latitude and temperature do), so this compares those two proxies against the
// measured average. Same semantic colors AND dash patterns as the prediction chart, so a
// line's identity reads the same way across both step-5 validation charts (and survives
// greyscale/colorblind). Actual stays solid — it's the reference line.
const ZONE_SERIES = [
  { key: "actual", label: "Actual", color: "#ff6b6b", anchor: true, dash: "" },
  {
    key: "temperature_prediction",
    label: "Temperature",
    color: "#38bdf8",
    anchor: false,
    dash: "7 4",
  },
  { key: "latitude_prediction", label: "Latitude", color: "#f4d35e", anchor: false, dash: "2 3" },
] as const;

const fmtFactor = d3.format(".2f");

// One small-multiple panel: the zone's mean measured curve vs. the two proxy
// reconstructions, drawn on a y-scale shared across all zones so panels compare directly.
function ZonePanel({ zone, yDomain }: { zone: LooClimateZone; yDomain: [number, number] }) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 340;
    const height = 210;
    const margin = { top: 30, right: 14, bottom: 30, left: 38 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const lines = ZONE_SERIES.map((s) => ({ ...s, curve: zone[s.key] as number[] })).filter(
      (s) => Array.isArray(s.curve) && s.curve.length === 12,
    );

    const x = d3.scalePoint().domain(MONTHS).range([0, innerW]).padding(0.2);
    const y = d3.scaleLinear().domain(yDomain).nice().range([innerH, 0]);
    const line = d3
      .line<number>()
      .x((_, i) => x(MONTHS[i]!) ?? 0)
      .y((d) => y(d))
      .curve(d3.curveMonotoneX);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Panel heading: zone name + sample size + how often temperature beat latitude here.
    g.append("text")
      .attr("x", 0)
      .attr("y", -16)
      .attr("class", "chart-tick")
      .style("font-weight", 600)
      .style("font-size", "0.8rem")
      .text(`${zone.zone} · n=${zone.n}`);
    g.append("text")
      .attr("x", innerW)
      .attr("y", -16)
      .attr("text-anchor", "end")
      .attr("class", "chart-tick")
      .text(`temp wins ${Math.round(zone.temperature_win_rate * 100)}%`);

    g.append("line")
      .attr("class", "chart-gridline")
      .attr("x1", 0)
      .attr("x2", innerW)
      .attr("y1", y(1))
      .attr("y2", y(1));

    const ordered = [...lines].sort(
      (a, b) => Number(a.anchor ?? false) - Number(b.anchor ?? false),
    );
    for (const s of ordered) {
      g.append("path")
        .attr("fill", "none")
        .attr("stroke", s.color)
        .attr("stroke-width", s.anchor ? 2.6 : 1.8)
        .attr("stroke-dasharray", s.dash || null)
        .attr("stroke-linecap", "round")
        .attr("d", line(s.curve));
    }

    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(
        d3
          .axisBottom(x)
          .tickValues([MONTHS[0]!, MONTHS[3]!, MONTHS[6]!, MONTHS[9]!])
          .tickSizeOuter(0),
      )
      .call(styleAxis);
    g.append("g")
      .call(
        d3
          .axisLeft(y)
          .ticks(4)
          .tickFormat((d) => fmtFactor(Number(d))),
      )
      .call(styleAxis);

    // Vertical hover: nearest month, all three values.
    const focus = g.append("g").style("display", "none");
    focus
      .append("line")
      .attr("class", "chart-gridline")
      .attr("y1", 0)
      .attr("y2", innerH)
      .style("stroke-dasharray", "none");
    const dots = lines.map((s) => focus.append("circle").attr("r", 3).attr("fill", s.color));
    const step = innerW / (MONTHS.length - 1);
    g.append("rect")
      .attr("width", innerW)
      .attr("height", innerH)
      .attr("fill", "none")
      .attr("pointer-events", "all")
      .on("pointerenter", () => focus.style("display", null))
      .on("pointerleave", () => {
        focus.style("display", "none");
        hideTooltip();
      })
      .on("pointermove", (event) => {
        const [px] = d3.pointer(event, g.node());
        const i = Math.max(0, Math.min(MONTHS.length - 1, Math.round(px / step)));
        const mx = x(MONTHS[i]!) ?? 0;
        focus.select("line").attr("x1", mx).attr("x2", mx);
        lines.forEach((s, k) => dots[k]!.attr("cx", mx).attr("cy", y(s.curve[i]!)));
        const rows = lines.map((s) => `${s.label}: ${fmtFactor(s.curve[i]!)}×`).join("\n");
        showTooltip(`${zone.zone} — ${MONTHS[i]}\n${rows}`, event.clientX, event.clientY);
      });
  }, [zone, yDomain]);

  return (
    <svg
      ref={svgRef}
      className="seasonality-chart"
      viewBox="0 0 340 210"
      role="img"
      aria-label={`Seasonal mortality in the ${zone.zone} zone: measured average versus temperature and latitude reconstructions`}
    />
  );
}

export default function ClimateZoneCurves({ looValidation }: ClimateZoneCurvesProps) {
  const zones = looValidation?.climateZones ?? [];
  if (!zones.length) return null;

  // Shared y-domain across every panel so the flatter tropics and steeper mid-latitudes
  // are visually comparable rather than each auto-scaled to fill its own panel.
  const allValues = zones.flatMap((z) => [
    ...(z.actual ?? []),
    ...(z.latitude_prediction ?? []),
    ...(z.temperature_prediction ?? []),
  ]);
  const yDomain = (d3.extent(allValues) as [number, number]) ?? [0.9, 1.1];

  return (
    <section className="chart-panel wide">
      <h4 className="chart-title">Reconstruction By Climate Zone</h4>
      <p className="chart-copy">
        The same held-out test, averaged within latitude bands. Temperature&apos;s edge over
        latitude concentrates in the tropics and at the poles; across the broad middle latitudes the
        two are close, because there latitude alone already captures the winter swing. Each panel
        shares a y-scale, so the tropics&apos; flatter seasonality reads against the sharper
        mid-latitude curves.
      </p>

      <div className="climate-zone-grid">
        {zones.map((zone) => (
          <ZonePanel key={zone.zone} zone={zone} yDomain={yDomain} />
        ))}
      </div>

      <div className="chart-legend">
        {ZONE_SERIES.map((s) => (
          <span key={s.key}>
            <LineSwatch color={s.color} dash={s.dash} /> {s.label}
          </span>
        ))}
      </div>
    </section>
  );
}
