"use client";

import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import { MONTHS, styleAxis } from "../chartHelpers";
import { showTooltip, hideTooltip } from "../tooltip";
import type { LooValidation, LooPerCountry } from "../types";
import LineSwatch from "./LineSwatch";

interface PredictionComparisonProps {
  looValidation: LooValidation | null;
}

// One line per method, all on the same mortality-multiplier axis (mean 1) — so a single
// y-axis is correct (dataviz: never dual-axis). "Actual" reuses the mortality red used
// throughout step 5; temperature reuses the temperature blue from the overlay above, so
// the colors carry the same meaning across charts. Latitude/climate take two more hues
// from the roadmap's validated curve palette. Each method also gets its own dash pattern
// (dataviz: a second, non-color encoding so the series stay distinguishable in greyscale,
// print, or for colorblind readers). Actual stays solid — it's the reference line.
const SERIES = [
  { key: "actual", label: "Actual (measured)", color: "#ff6b6b", anchor: true, dash: "" },
  {
    key: "temperature_prediction",
    label: "Temperature",
    color: "#38bdf8",
    anchor: false,
    dash: "7 4",
  },
  { key: "latitude_prediction", label: "Latitude", color: "#f4d35e", anchor: false, dash: "2 3" },
  {
    key: "climate_prediction",
    label: "Climate class",
    color: "#4ade80",
    anchor: false,
    dash: "9 3 2 3",
  },
] as const;

// The three proxy methods, each tied to its prediction curve + RMSE column in the data and
// to its SERIES color. "Best/worst" is judged by RMSE — the notebook's own win metric.
const PROXIES = [
  {
    predKey: "temperature_prediction",
    rmseKey: "temperature_rmse",
    label: "Temperature",
    color: "#38bdf8",
  },
  { predKey: "latitude_prediction", rmseKey: "latitude_rmse", label: "Latitude", color: "#f4d35e" },
  {
    predKey: "climate_prediction",
    rmseKey: "climate_rmse",
    label: "Climate class",
    color: "#4ade80",
  },
] as const;

const fmtFactor = d3.format(".2f");

interface Pick extends LooPerCountry {
  methodLabel: string;
  methodColor: string;
  featuredKey: string; // which SERIES line to emphasize (the featured proxy)
  kind: "best" | "worst";
}

// One small-multiple panel: a country's measured curve vs. its three proxy reconstructions,
// with the featured proxy's line emphasized so the "works best / works worst" read is instant.
function CountryPanel({ pick, yDomain }: { pick: Pick; yDomain: [number, number] }) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 360;
    const height = 220;
    const margin = { top: 30, right: 14, bottom: 30, left: 38 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const lines = SERIES.map((s) => ({ ...s, curve: pick[s.key] as number[] })).filter(
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

    // Panel heading: country name (left) + which method this panel features and whether it's
    // that method's best or worst case (right, in the method's own color).
    g.append("text")
      .attr("x", 0)
      .attr("y", -16)
      .attr("class", "chart-tick")
      .style("font-weight", 600)
      .style("font-size", "0.82rem")
      .text(pick.name);
    g.append("text")
      .attr("x", innerW)
      .attr("y", -16)
      .attr("text-anchor", "end")
      .attr("class", "chart-tick")
      .attr("fill", pick.methodColor)
      .style("font-weight", 600)
      .text(`${pick.methodLabel} ${pick.kind}`);

    g.append("line")
      .attr("class", "chart-gridline")
      .attr("x1", 0)
      .attr("x2", innerW)
      .attr("y1", y(1))
      .attr("y2", y(1));

    // Draw non-featured proxies first (dimmed), then the featured proxy, then actual on top.
    const order = (s: (typeof lines)[number]) =>
      s.anchor ? 3 : s.key === pick.featuredKey ? 2 : 1;
    const ordered = [...lines].sort((a, b) => order(a) - order(b));
    for (const s of ordered) {
      const featured = s.key === pick.featuredKey;
      g.append("path")
        .attr("fill", "none")
        .attr("stroke", s.color)
        .attr("stroke-width", s.anchor ? 2.6 : featured ? 2.6 : 1.5)
        .attr("stroke-opacity", s.anchor || featured ? 1 : 0.45)
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

    // Vertical hover: nearest month, all four values.
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
        showTooltip(`${pick.name} — ${MONTHS[i]}\n${rows}`, event.clientX, event.clientY);
      });
  }, [pick, yDomain]);

  return (
    <svg
      ref={svgRef}
      className="seasonality-chart"
      viewBox="0 0 360 220"
      role="img"
      aria-label={`${pick.name}: the country where ${pick.methodLabel} reconstruction works ${pick.kind}, shown against the measured curve and the other proxies`}
    />
  );
}

export default function PredictionComparison({ looValidation }: PredictionComparisonProps) {
  // Pick, for each proxy, the one country where it works BEST (lowest RMSE of the three, by
  // the largest margin) and the one where it works WORST (highest RMSE, by the largest
  // margin) — six distinct countries. Top row = each method at its best (its line lands on
  // the measured curve); bottom row = each method at its worst (its line pulls away while
  // the others stay closer). "Best/worst" is by RMSE, the notebook's own win metric.
  const picks = useMemo<Pick[]>(() => {
    const rows = looValidation?.perCountry ?? [];
    if (rows.length < 6) return [];

    const scored = rows.map((c) => {
      const ranked = [...PROXIES].sort(
        (a, b) => (c[a.rmseKey] as number) - (c[b.rmseKey] as number),
      );
      const best = ranked[0]!;
      const worst = ranked[2]!;
      return {
        country: c,
        bestKey: best.predKey,
        worstKey: worst.predKey,
        winMargin: (c[ranked[1]!.rmseKey] as number) - (c[best.rmseKey] as number),
        loseMargin: (c[worst.rmseKey] as number) - (c[ranked[1]!.rmseKey] as number),
      };
    });

    const chosen = new Set<number>();
    const make = (proxy: (typeof PROXIES)[number], kind: "best" | "worst"): Pick | null => {
      const candidates = scored
        .filter((s) => !chosen.has(s.country.m49))
        .filter((s) => (kind === "best" ? s.bestKey : s.worstKey) === proxy.predKey)
        .sort((a, b) =>
          kind === "best" ? b.winMargin - a.winMargin : b.loseMargin - a.loseMargin,
        );
      const top = candidates[0];
      if (!top) return null;
      chosen.add(top.country.m49);
      return {
        ...top.country,
        methodLabel: proxy.label,
        methodColor: proxy.color,
        featuredKey: proxy.predKey,
        kind,
      };
    };

    // Top row: each method's best case. Bottom row: each method's worst case.
    const best = PROXIES.map((p) => make(p, "best"));
    const worst = PROXIES.map((p) => make(p, "worst"));
    return [...best, ...worst].filter((p): p is Pick => p !== null);
  }, [looValidation]);

  // Shared y-domain across all six panels so their curves are directly comparable.
  const yDomain = useMemo<[number, number]>(() => {
    const all = picks.flatMap((p) => [
      ...p.actual,
      ...p.temperature_prediction,
      ...p.latitude_prediction,
      ...p.climate_prediction,
    ]);
    return (d3.extent(all) as [number, number]) ?? [0.9, 1.1];
  }, [picks]);

  if (!looValidation || picks.length < 6) return null;

  return (
    <section className="chart-panel wide">
      <h4 className="chart-title">Predictions vs. Measured Curve</h4>
      <p className="chart-copy">
        For countries that <em>do</em> report a curve, hold each one out and rebuild it from every
        proxy as if it were missing, then compare the reconstructions to the measured curve. These
        six pin down where each method works and where it fails. <strong>Top row</strong> — the
        country where each proxy reconstructs the curve <em>best</em>: its (highlighted) line lands
        on the red measured curve. <strong>Bottom row</strong> — where each proxy does{" "}
        <em>worst</em>: its line pulls away while the others stay closer.
      </p>

      <div className="prediction-grid">
        {picks.map((p) => (
          <CountryPanel key={p.m49} pick={p} yDomain={yDomain} />
        ))}
      </div>

      <div className="chart-legend">
        {SERIES.map((s) => (
          <span key={s.key}>
            <LineSwatch color={s.color} dash={s.dash} /> {s.label}
          </span>
        ))}
      </div>
    </section>
  );
}
