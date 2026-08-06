"use client";

import { useMemo, useState } from "react";
import * as d3 from "d3";
import { figureHeight, useFigureWidth } from "./useFigureSize";
import { useSkin } from "../SkinContext";
import { harmony, marks } from "../palette";
import { showTooltip, hideTooltip } from "../tooltip";
import type { ConflictDailyStack } from "../types";

interface ConflictEwmaWidgetProps {
  dailyStack: ConflictDailyStack | undefined;
}

// Stacked-segment colours: each named country a categorical hue, "Others" (last) a muted grey.
// The named set is dynamic (day-share threshold), so use a palette rather than fixed slots.
// There's no legend — hovering a segment names its country (and splits "Others").
// One hue per named conflict from the section's own palette, plus three neutral tones from the
// skin for the roll-up, the prediction and the clamp — the widget is the last figure in the
// conflicts chapter and has to wear the same colours as everything above it.
const NAMED_COUNT = 8;
// Wide and shallow: fourteen days across a shallow band of counts.
const SHAPE = { aspect: 0.61, min: 210, max: 280 };

// The clamp the worked example in the copy describes — P10–P90, fixed, because the prose commits
// to those two percentiles by name.
const CLAMP_P = 10;
const DEFAULT_HALF_LIFE = 4;
// `0` is the flat mean. Labels carry the unit because the section's tables are in days.
const HALF_LIFE_PRESETS: ReadonlyArray<readonly [string, number]> = [
  ["Half-life 2 days", 2],
  ["Half-life 4 days", DEFAULT_HALF_LIFE],
  ["Flat mean", 0],
];
// Label every third day, so fourteen ticks do not collide at ~23px apart.
const AXIS_LABEL_EVERY = 3;

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
// Day of the month, prefixed with the month's name at the first labelled day and again whenever
// the month turns over, so the run of bare numbers always has a month to hang off. The month
// never replaces the number — a lone "Jul" among day numbers reads as a data point, not a label.
function axisLabel(iso: string, prevIso: string | null): string {
  const [, mm = "", dd = ""] = iso.split("-");
  const day = String(Number(dd));
  const monthChanged = !prevIso || iso.slice(0, 7) !== prevIso.slice(0, 7);
  return monthChanged ? `${MONTH_ABBR[Number(mm) - 1] ?? mm} ${day}` : day;
}
// Interactive Robust EWMA over the last 14 days of conflict fatalities. Each day is a stacked
// bar (top-6 countries + Others); the prediction clamps each day's *total* to a [P, 100-P]
// band, then takes a half-life-weighted average — "today's" expected conflict deaths.
export default function ConflictEwmaWidget({ dailyStack }: ConflictEwmaWidgetProps) {
  const { sky, skin } = useSkin();
  const [sizeRef, width] = useFigureWidth<SVGSVGElement>();
  // One hue per named conflict from the section's own palette; the roll-up, the prediction and the
  // clamp band take neutral tones from the skin, because they are not conflicts.
  const namedColors = useMemo(() => marks(harmony(NAMED_COUNT, sky, true), sky), [sky]);
  const othersColor = skin.mute;
  const predictionColor = skin.ink;
  const clampColor = skin.mute;
  // Named countries fill the leading slots; the final slot ("Others") is the neutral tone.
  const colorAt = (si: number, namedCount: number) =>
    si < namedCount ? namedColors[si % namedColors.length]! : othersColor;

  // Three presets rather than a free slider: the section is arguing that the half-life matters,
  // and two settings plus the naive alternative make that case faster than a continuous control.
  // A half-life of 0 is the flat mean — the comparison the whole section argues against, where a
  // massacre four days ago counts exactly as much as yesterday.
  const [halfLife, setHalfLife] = useState(DEFAULT_HALF_LIFE);
  const flat = halfLife === 0;
  const [hover, setHover] = useState<{ i: number; si: number } | null>(null);

  const days = useMemo(() => dailyStack?.days ?? [], [dailyStack]);
  const segLabels = useMemo(() => dailyStack?.countries ?? [], [dailyStack]);

  const model = useMemo(() => {
    const totals = days.map((d) => d.values.reduce((a, b) => a + b, 0));
    const n = totals.length;
    if (n === 0 || totals.every((v) => v === 0)) return null;
    const sorted = [...totals].sort((a, b) => a - b);
    const plo = percentile(sorted, CLAMP_P);
    const phi = percentile(sorted, 100 - CLAMP_P);
    const clamped = totals.map((v) => Math.min(Math.max(v, plo), phi));
    // A flat mean is the same weighted average with every weight set to one, and no clamp —
    // it is the naive figure, so it should be shown naively.
    const series = flat ? totals : clamped;
    const plainMean = totals.reduce((a, b) => a + b, 0) / n;
    // The mean as it stood on each day: the same half-life kernel, re-anchored at every day so it
    // only ever looks backwards. Drawing it as a line rather than one horizontal rule is what
    // shows the spike being damped instead of just asserting it — and the last point is by
    // construction today's prediction, so the curve and the readout cannot disagree.
    const curve = flat
      ? series.map(() => plainMean)
      : series.map((_, i) => {
          let weightSum = 0;
          let valueSum = 0;
          for (let j = 0; j <= i; j++) {
            const w = Math.pow(0.5, (i - j) / halfLife);
            weightSum += w;
            valueSum += series[j]! * w;
          }
          return weightSum > 0 ? valueSum / weightSum : 0;
        });
    const prediction = curve[curve.length - 1] ?? 0;
    return { totals, n, plo, phi, prediction, plainMean, curve };
  }, [days, halfLife, flat]);

  if (!model) {
    return (
      <p className="chart-status">
        No conflict fatalities have been reported in the trailing {days.length || 14} days (or the
        live ACLED layer is unavailable), so there is no recent series for the prediction to run on.
      </p>
    );
  }

  const { totals, n, plo, phi, prediction, plainMean, curve } = model;

  const height = figureHeight(width, SHAPE);
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
        ref={sizeRef}
        className="story-figure"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Daily conflict fatalities over the last ${n} days, stacked by country (each day's sub-10% countries grouped as Others at the bottom), with a robust exponentially-weighted prediction of ${fmt1(prediction)} deaths for today; , outlier clamp P–P`}
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
            stroke={clampColor}
          />
          <line
            className="ewma-clamp"
            x1={0}
            x2={innerW}
            y1={y(plo)}
            y2={y(plo)}
            stroke={clampColor}
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

          {/* The weighted mean as it stood on each day, ending at today's prediction. */}
          <polyline
            className="ewma-prediction"
            points={curve
              .map((v, i) => `${(x(days[i]!.date) ?? 0) + x.bandwidth() / 2},${y(v)}`)
              .join(" ")}
            fill="none"
            stroke={predictionColor}
          />
          <text
            className="chart-tick ewma-prediction-label"
            x={innerW}
            y={y(prediction) - 7}
            textAnchor="end"
          >
            today ≈ {fmt1(prediction)}/day
          </text>

          {days.map((d, i) => {
            // Count back from the last day so today always carries a label.
            if ((n - 1 - i) % AXIS_LABEL_EVERY !== 0) return null;
            return (
              <text
                key={d.date}
                className="chart-tick"
                x={(x(d.date) ?? 0) + x.bandwidth() / 2}
                y={innerH + 16}
                textAnchor="middle"
              >
                {axisLabel(d.date, i > 0 ? days[i - 1]!.date : null)}
              </text>
            );
          })}

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
        <div className="ewma-presets" role="group" aria-label="Weighting">
          {HALF_LIFE_PRESETS.map(([label, value]) => (
            <button
              key={value}
              type="button"
              className="ewma-preset"
              aria-pressed={halfLife === value}
              onClick={() => setHalfLife(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="ewma-readout">
          Predicted today: <strong>{fmt1(prediction)}</strong> deaths/day
          {flat ? (
            <span className="ewma-readout-aside">
              {" "}
              — the spike is averaged away instead of damped
            </span>
          ) : (
            <span className="ewma-readout-aside">
              {" "}
              (plain average: {fmt1(plainMean)}, clamped to P{CLAMP_P}–P{100 - CLAMP_P})
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
