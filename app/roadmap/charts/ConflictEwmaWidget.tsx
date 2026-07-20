"use client";

import { useId, useMemo, useState } from "react";
import * as d3 from "d3";
import { showTooltip, hideTooltip } from "../tooltip";
import type { ConflictDailyStack } from "../types";

interface ConflictEwmaWidgetProps {
  dailyStack: ConflictDailyStack | undefined;
}

// Stacked-segment colours: each named country a categorical hue, "Others" (last) a muted grey.
// The named set is dynamic (day-share threshold), so use a palette rather than fixed slots.
// There's no legend — hovering a segment names its country (and splits "Others").
const NAMED_COLORS = d3.schemeTableau10;
const OTHERS_COLOR = "#8b93a1";
const PREDICTION_COLOR = "#e8eaed";
const CLAMP_COLOR = "#9aa3af";

// Linear-interpolation percentile (numpy default) — matches the worked example in the copy
// (P10 = 20.6, P90 = 52.8 for [20,22,21,90,24,26,28]).
function percentile(sortedAsc: number[], p: number): number {
  const n = sortedAsc.length;
  if (n === 0) return 0;
  if (p <= 0) return sortedAsc[0]!;
  if (p >= 100) return sortedAsc[n - 1]!;
  const rank = (p / 100) * (n - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sortedAsc[lo]!;
  return sortedAsc[lo]! + (rank - lo) * (sortedAsc[hi]! - sortedAsc[lo]!);
}

const fmt1 = d3.format(".1f");
const fmtInt = d3.format(",");
const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
// Day-of-month number, except a month name at the first day shown of each month (the boundary
// between one month and the next) so the numbers stay anchored to a month.
function axisLabel(iso: string, prevIso: string | null): string {
  const [, mm = "", dd = ""] = iso.split("-");
  const monthChanged = !prevIso || iso.slice(0, 7) !== prevIso.slice(0, 7);
  return monthChanged ? (MONTH_ABBR[Number(mm) - 1] ?? mm) : String(Number(dd));
}
// Named countries fill the leading slots; the final slot ("Others") is grey.
const colorAt = (si: number, namedCount: number) =>
  si < namedCount ? NAMED_COLORS[si % NAMED_COLORS.length]! : OTHERS_COLOR;

// Interactive Robust EWMA over the last 14 days of conflict fatalities. Each day is a stacked
// bar (top-6 countries + Others); the prediction clamps each day's *total* to a [P, 100-P]
// band, then takes a half-life-weighted average — "today's" expected conflict deaths.
export default function ConflictEwmaWidget({ dailyStack }: ConflictEwmaWidgetProps) {
  const [halfLife, setHalfLife] = useState(4);
  const [clampP, setClampP] = useState(10);
  const [hover, setHover] = useState<{ i: number; si: number } | null>(null);
  const uid = useId();

  const days = useMemo(() => dailyStack?.days ?? [], [dailyStack]);
  const segLabels = useMemo(() => dailyStack?.countries ?? [], [dailyStack]);

  const model = useMemo(() => {
    const totals = days.map((d) => d.values.reduce((a, b) => a + b, 0));
    const n = totals.length;
    if (n === 0 || totals.every((v) => v === 0)) return null;
    const sorted = [...totals].sort((a, b) => a - b);
    const plo = percentile(sorted, clampP);
    const phi = percentile(sorted, 100 - clampP);
    const clamped = totals.map((v) => Math.min(Math.max(v, plo), phi));
    const weights = totals.map((_, i) => Math.pow(0.5, (n - 1 - i) / halfLife));
    const wsum = weights.reduce((a, b) => a + b, 0);
    const prediction = wsum > 0 ? clamped.reduce((s, v, i) => s + v * weights[i]!, 0) / wsum : 0;
    const plainMean = totals.reduce((a, b) => a + b, 0) / n;
    return { totals, n, plo, phi, prediction, plainMean };
  }, [days, halfLife, clampP]);

  if (!model) {
    return (
      <p className="chart-status">
        No conflict fatalities have been reported in the trailing {days.length || 14} days (or the
        live ACLED layer is unavailable), so there is no recent series for the prediction to run on.
      </p>
    );
  }

  const { totals, n, plo, phi, prediction, plainMean } = model;

  const width = 640;
  const height = 240;
  const margin = { top: 14, right: 16, bottom: 26, left: 46 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const x = d3
    .scaleBand<string>()
    .domain(days.map((d) => d.date))
    .range([0, innerW])
    .padding(0); // no gaps between bars
  const maxV = Math.max(phi, d3.max(totals) ?? 1, prediction) * 1.08 || 1;
  const y = d3.scaleLinear().domain([0, maxV]).nice().range([innerH, 0]);
  const yTicks = y.ticks(4);
  const namedCount = segLabels.length - 1; // last slot is "Others"
  // Stacking order, bottom → top: "Others" at the bottom, then named countries with the
  // biggest (index 0, by window total) on top. It's the segment index order reversed.
  const order = Array.from({ length: segLabels.length }, (_, k) => segLabels.length - 1 - k);

  return (
    <div className="ewma-widget">
      <svg
        className="seasonality-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Daily conflict fatalities over the last ${n} days, stacked by country (each day's sub-10% countries grouped as Others at the bottom), with a robust exponentially-weighted prediction of ${fmt1(prediction)} deaths for today; half-life ${halfLife} days, outlier clamp P${clampP}–P${100 - clampP}`}
      >
        <g transform={`translate(${margin.left},${margin.top})`}>
          {yTicks.map((t) => (
            <g key={t} transform={`translate(0,${y(t)})`}>
              <line className="chart-gridline" x1={0} x2={innerW} />
              <text className="chart-tick" x={-8} y={3} textAnchor="end">
                {t}
              </text>
            </g>
          ))}

          {/* Robust-clamp band [P, 100-P] on each day's total. */}
          <line
            className="ewma-clamp"
            x1={0}
            x2={innerW}
            y1={y(phi)}
            y2={y(phi)}
            stroke={CLAMP_COLOR}
          />
          <line
            className="ewma-clamp"
            x1={0}
            x2={innerW}
            y1={y(plo)}
            y2={y(plo)}
            stroke={CLAMP_COLOR}
          />

          {/* One stacked bar per day: Others at the bottom, then named countries (biggest on top). */}
          {days.map((d, i) => {
            let cum = 0;
            return (
              <g key={d.date}>
                {order.map((si) => {
                  const v = d.values[si]!;
                  const y0 = y(cum);
                  const y1 = y(cum + v);
                  cum += v;
                  if (v <= 0) return null;
                  return (
                    <rect
                      key={si}
                      className={hover?.i === i && hover?.si === si ? "ewma-seg-focus" : undefined}
                      x={x(d.date)}
                      y={y1}
                      // +1 so adjacent days overlap by a hair — kills the sub-pixel seam between bars
                      width={x.bandwidth() + 1}
                      height={Math.max(0, y0 - y1)}
                      fill={colorAt(si, namedCount)}
                    />
                  );
                })}
              </g>
            );
          })}

          {/* The prediction: half-life-weighted average of the clamped daily totals. */}
          <line
            className="ewma-prediction"
            x1={0}
            x2={innerW}
            y1={y(prediction)}
            y2={y(prediction)}
            stroke={PREDICTION_COLOR}
          />
          <text
            className="chart-tick ewma-prediction-label"
            x={innerW}
            y={y(prediction) - 5}
            textAnchor="end"
          >
            today ≈ {fmt1(prediction)}/day
          </text>

          {days.map((d, i) => (
            <text
              key={d.date}
              className="chart-tick"
              x={(x(d.date) ?? 0) + x.bandwidth() / 2}
              y={innerH + 16}
              textAnchor="middle"
            >
              {axisLabel(d.date, i > 0 ? days[i - 1]!.date : null)}
            </text>
          ))}

          {/* Transparent overlay: resolves the pointer to a single day + segment, so hovering a
              country's slice shows only that country and hovering "Others" shows its split. */}
          <rect
            x={0}
            y={0}
            width={innerW}
            height={innerH}
            fill="transparent"
            pointerEvents="all"
            onPointerMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              if (r.width <= 0 || r.height <= 0) return;
              const i = Math.max(
                0,
                Math.min(n - 1, Math.floor(((e.clientX - r.left) / r.width) * n)),
              );
              const value = y.invert(((e.clientY - r.top) / r.height) * innerH);
              const day = days[i]!;
              let cum = 0;
              let seg = -1;
              for (const si of order) {
                const v = day.values[si]!;
                if (v > 0 && value >= cum && value < cum + v) {
                  seg = si;
                  break;
                }
                cum += v;
              }
              if (seg < 0) {
                setHover(null);
                hideTooltip();
                return;
              }
              setHover({ i, si: seg });
              const isOthers = seg === segLabels.length - 1;
              let text: string;
              if (!isOthers) {
                text = `${segLabels[seg]}: ${fmtInt(day.values[seg]!)} deaths`;
              } else {
                const bd = day.othersBreakdown ?? [];
                const lines = bd.slice(0, 8).map((o) => `${o.country}: ${fmtInt(o.fatalities)}`);
                const rest = bd.slice(8);
                if (rest.length) {
                  lines.push(
                    `+${rest.length} more: ${fmtInt(rest.reduce((s, o) => s + o.fatalities, 0))}`,
                  );
                }
                text =
                  `Others: ${fmtInt(day.values[seg]!)} deaths` +
                  (lines.length ? `\n${lines.join("\n")}` : "");
              }
              showTooltip(text, e.clientX, e.clientY);
            }}
            onPointerLeave={() => {
              setHover(null);
              hideTooltip();
            }}
          />
        </g>
      </svg>

      <div className="ewma-controls">
        <label htmlFor={`${uid}-hl`}>
          <span>
            Half-life <strong>{halfLife} days</strong>
          </span>
          <input
            id={`${uid}-hl`}
            type="range"
            min={1}
            max={14}
            step={0.5}
            value={halfLife}
            onChange={(e) => setHalfLife(Number(e.target.value))}
          />
        </label>
        <label htmlFor={`${uid}-cl`}>
          <span>
            Smoothing{" "}
            <strong>
              P{clampP}–P{100 - clampP} clamp
            </strong>
          </span>
          <input
            id={`${uid}-cl`}
            type="range"
            min={0}
            max={25}
            step={1}
            value={clampP}
            onChange={(e) => setClampP(Number(e.target.value))}
          />
        </label>
        <p className="ewma-readout">
          Predicted today: <strong>{fmt1(prediction)}</strong> deaths/day
          <span className="ewma-readout-aside"> (plain average: {fmt1(plainMean)})</span>
        </p>
      </div>
    </div>
  );
}
