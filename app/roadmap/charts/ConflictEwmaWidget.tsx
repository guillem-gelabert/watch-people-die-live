"use client";

import { useMemo, useState } from "react";
import * as d3 from "d3";
import { robustEwma } from "@/lib/conflict-model";
import type { ConflictStackSegment, ConflictWeeklyStack } from "../types";
import { figureHeight, useFigureWidth } from "./useFigureSize";
import { useI18n } from "../I18nContext";
import { fill } from "@/lib/i18n/fill";
import { hideTooltip, showTooltip } from "../tooltip";

interface ConflictEwmaWidgetProps {
  weeklyStack: ConflictWeeklyStack | undefined;
}

const DEFAULT_CLAMP_P = 10;
const DEFAULT_HALF_LIFE = 4;
const HALF_LIFE_RANGE = { min: 0, max: 12, step: 0.5 };
const CLAMP_RANGE = { min: 0, max: 25, step: 1 };
const ESTIMATE_SLOT = "__estimate__";
// How many member countries a rolled-up band names in its tooltip before it summarises the tail.
const TOOLTIP_MEMBERS = 8;
const COUNTRY_COLORS = 6;
const REGION_COLORS = 8;
const SHAPE = { aspect: 0.61, min: 210, max: 280 };
const fmt1 = d3.format(".1f");
const fmtInt = d3.format(",");
const fmtHalfLife = (weeks: number) => (Number.isInteger(weeks) ? String(weeks) : weeks.toFixed(1));

function axisLabel(iso: string, locale: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year!, month! - 1, day!)));
}

export default function ConflictEwmaWidget({ weeklyStack }: ConflictEwmaWidgetProps) {
  const { locale, d: dict } = useI18n();
  const t = dict.ewma;
  const [sizeRef, width] = useFigureWidth<SVGSVGElement>();
  const [halfLife, setHalfLife] = useState(DEFAULT_HALF_LIFE);
  const [clampP, setClampP] = useState(DEFAULT_CLAMP_P);
  const [hover, setHover] = useState<{ i: number; si: number } | null>(null);
  const weeks = useMemo(() => weeklyStack?.weeks ?? [], [weeklyStack]);
  // Which band takes which colour, decided once for the window rather than per bar.
  //
  // Two constraints pull against each other. Membership is per week, so a country named in one
  // bar and absent from the next has to keep its colour across the gap — that rules out colouring
  // by position in the bar. But there are more keys than either ramp has colours, so something
  // has to repeat. Repeating by rank puts two identical fills in the same bar, which with no
  // legend reads as one band.
  //
  // So: colour the graph of "these two bands are drawn in the same bar as each other". Greedy in
  // rank order gives every key one fixed colour that no band it ever shares a bar with also has.
  // On the current window that needs exactly the six country hues and eight region shades.
  const paint = useMemo(() => {
    const byKey = new Map<string, string>();
    const weeks = weeklyStack?.weeks ?? [];
    const ramps = [
      { kind: "country", name: "--conflict-color", size: COUNTRY_COLORS },
      { kind: "region", name: "--conflict-region-color", size: REGION_COLORS },
    ] as const;
    for (const ramp of ramps) {
      const keys = (weeklyStack?.keys ?? [])
        .filter((entry) => entry.kind === ramp.kind)
        .map((entry) => entry.key);
      const rank = new Map(keys.map((key, index) => [key, index]));
      const sharesABarWith = keys.map(() => new Set<number>());
      for (const week of weeks) {
        const here = week.segments
          .filter((segment) => segment.kind === ramp.kind)
          .map((segment) => rank.get(segment.key)!);
        for (const a of here) {
          for (const b of here) if (a !== b) sharesABarWith[a]!.add(b);
        }
      }
      const slots = new Array<number>(keys.length).fill(-1);
      keys.forEach((key, index) => {
        const used = new Set(
          [...sharesABarWith[index]!].map((other) => slots[other]!).filter((slot) => slot >= 0),
        );
        let slot = 0;
        while (slot < ramp.size && used.has(slot)) slot += 1;
        // A bar with more bands of one kind than the ramp has colours. Fall back to rank, which
        // still gives a stable colour per place and puts the repeat as far down the bar as it can.
        slots[index] = slot < ramp.size ? slot : index % ramp.size;
        byKey.set(key, `var(${ramp.name}-${slots[index]})`);
      });
    }
    return byKey;
  }, [weeklyStack]);
  const totals = useMemo(
    () => weeks.map((week) => week.segments.reduce((sum, segment) => sum + segment.fatalities, 0)),
    [weeks],
  );
  const model = useMemo(() => robustEwma(totals, halfLife, clampP), [totals, halfLife, clampP]);

  if (weeks.length === 0 || totals.every((value) => value === 0)) {
    return <p className="chart-status">{fill(t.empty, { n: weeks.length || 12 })}</p>;
  }

  const height = figureHeight(width, SHAPE);
  const margin = { top: 14, right: 16, bottom: 30, left: 50 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const x = d3
    .scaleBand<string>()
    .domain([...weeks.map((week) => week.week), ESTIMATE_SLOT])
    .range([0, innerW])
    .padding(0);
  const observedW = x(ESTIMATE_SLOT) ?? innerW;
  const maxValue = Math.max(model.upper, d3.max(totals) ?? 1, model.prediction) * 1.08 || 1;
  const y = d3.scaleLinear().domain([0, maxValue]).nice().range([innerH, 0]);
  const yTicks = y.ticks(4);
  // A band's key is the country's own name, a UN M49 code, or the residual marker. Country names
  // are never translated — they arrive worded from ACLED — but the region names are ours.
  const label = (segment: ConflictStackSegment): string => {
    if (segment.kind === "country") return segment.key;
    if (segment.kind === "elsewhere") return t.elsewhere;
    return dict.geoscheme[Number(segment.key) as keyof typeof dict.geoscheme] ?? segment.key;
  };
  const colorOf = (segment: ConflictStackSegment): string =>
    paint.get(segment.key) ?? "var(--mute)";
  // A rolled-up band has to say what it rolled up, or the reader has traded one opaque "Others"
  // for several. A country band's members are just itself, so it prints the one line it always
  // did.
  const describe = (segment: ConflictStackSegment): string => {
    const head = fill(t.tooltipDeaths, {
      country: label(segment),
      n: fmtInt(segment.fatalities),
    });
    if (segment.kind === "country") return head;
    const lines = segment.members
      .slice(0, TOOLTIP_MEMBERS)
      .map((member) =>
        fill(t.tooltipDeaths, { country: member.country, n: fmtInt(member.fatalities) }),
      );
    const rest = segment.members.slice(TOOLTIP_MEMBERS);
    if (rest.length) {
      lines.push(
        fill(t.tooltipMore, {
          n: rest.length,
          total: fmtInt(rest.reduce((sum, member) => sum + member.fatalities, 0)),
        }),
      );
    }
    return lines.length ? `${head}\n${lines.join("\n")}` : head;
  };
  const flat = halfLife === 0;
  const clamped = clampP > 0;

  return (
    <div className="ewma-widget">
      <svg
        ref={sizeRef}
        className="story-figure"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={fill(t.ariaLabel, {
          n: weeks.length,
          weighting: flat
            ? t.weightingFlat
            : fill(t.weightingHalfLife, { halfLife: fmtHalfLife(halfLife) }),
          prediction: fmt1(model.prediction),
          clamp: clamped ? fill(t.clampOn, { lo: clampP, hi: 100 - clampP }) : t.clampOff,
        })}
      >
        <g transform={`translate(${margin.left},${margin.top})`}>
          {yTicks.map((tick) => (
            <g key={tick} transform={`translate(0,${y(tick)})`}>
              <line className="chart-gridline" x1={0} x2={innerW} />
              <text className="chart-tick" x={-8} y={3} textAnchor="end">
                {tick}
              </text>
            </g>
          ))}

          {clamped ? (
            <>
              <line
                className="ewma-clamp"
                x1={0}
                x2={observedW}
                y1={y(model.upper)}
                y2={y(model.upper)}
                stroke="var(--mute)"
              />
              <line
                className="ewma-clamp"
                x1={0}
                x2={observedW}
                y1={y(model.lower)}
                y2={y(model.lower)}
                stroke="var(--mute)"
              />
            </>
          ) : null}

          {weeks.map((week, i) => {
            let cumulative = 0;
            // Drawn largest-first from the axis up, which is the order buildWeeklyStack sorts
            // into, so the tallest bands sit together at the bottom of every bar.
            return (
              <g key={week.week}>
                {week.segments.map((segment, si) => {
                  const y0 = y(cumulative);
                  const y1 = y(cumulative + segment.fatalities);
                  cumulative += segment.fatalities;
                  if (segment.fatalities <= 0) return null;
                  return (
                    <rect
                      key={segment.key}
                      className={hover?.i === i && hover.si === si ? "ewma-seg-focus" : undefined}
                      x={x(week.week)}
                      y={y1}
                      width={x.bandwidth() + 1}
                      height={Math.max(0, y0 - y1)}
                      fill={colorOf(segment)}
                    />
                  );
                })}
              </g>
            );
          })}

          <rect
            className="ewma-today-bar"
            x={observedW}
            y={y(model.prediction)}
            width={x.bandwidth()}
            height={Math.max(0, innerH - y(model.prediction))}
            fill="var(--ink)"
            stroke="var(--ink)"
          />
          <polyline
            className="ewma-prediction"
            points={[
              ...model.curve.map(
                (value, index) => `${(x(weeks[index]!.week) ?? 0) + x.bandwidth() / 2},${y(value)}`,
              ),
              `${observedW + x.bandwidth() / 2},${y(model.prediction)}`,
            ].join(" ")}
            fill="none"
            stroke="var(--ink)"
          />
          <text
            className="chart-tick ewma-prediction-label"
            x={innerW}
            y={Math.max(9, y(model.prediction) - 7)}
            textAnchor="end"
          >
            {fill(t.estimateApprox, { value: fmt1(model.prediction) })}
          </text>

          {weeks.map((week, index) =>
            index % 2 === 0 || index === weeks.length - 1 ? (
              <text
                key={week.week}
                className="chart-tick"
                x={(x(week.week) ?? 0) + x.bandwidth() / 2}
                y={innerH + 16}
                textAnchor="middle"
              >
                {axisLabel(week.week, locale)}
              </text>
            ) : null,
          )}
          <text
            className="chart-tick ewma-today-tick"
            x={observedW + x.bandwidth() / 2}
            y={innerH + 16}
            textAnchor="middle"
          >
            {t.estimate}
          </text>

          <rect
            x={0}
            y={0}
            width={observedW}
            height={innerH}
            fill="transparent"
            pointerEvents="all"
            onPointerMove={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect();
              if (bounds.width <= 0 || bounds.height <= 0) return;
              const index = Math.max(
                0,
                Math.min(
                  weeks.length - 1,
                  Math.floor(((event.clientX - bounds.left) / bounds.width) * weeks.length),
                ),
              );
              const valueAtPointer = y.invert(
                ((event.clientY - bounds.top) / bounds.height) * innerH,
              );
              const week = weeks[index]!;
              let cumulative = 0;
              let segmentIndex = -1;
              for (const [candidate, segment] of week.segments.entries()) {
                if (
                  segment.fatalities > 0 &&
                  valueAtPointer >= cumulative &&
                  valueAtPointer < cumulative + segment.fatalities
                ) {
                  segmentIndex = candidate;
                  break;
                }
                cumulative += segment.fatalities;
              }
              const segment = week.segments[segmentIndex];
              if (!segment) {
                setHover(null);
                hideTooltip();
                return;
              }
              setHover({ i: index, si: segmentIndex });
              showTooltip(describe(segment), event.clientX, event.clientY);
            }}
            onPointerLeave={() => {
              setHover(null);
              hideTooltip();
            }}
          />
        </g>
      </svg>

      <div className="ewma-controls">
        <div className="ewma-sliders">
          <label className="ewma-slider">
            <span className="ewma-slider-head">
              <span className="ewma-slider-name">{t.halfLifeName}</span>
              <span className="ewma-slider-value">
                {flat ? t.halfLifeFlat : fill(t.halfLifeWeeks, { n: fmtHalfLife(halfLife) })}
              </span>
            </span>
            <input
              type="range"
              min={HALF_LIFE_RANGE.min}
              max={HALF_LIFE_RANGE.max}
              step={HALF_LIFE_RANGE.step}
              value={halfLife}
              onChange={(event) => setHalfLife(Number(event.target.value))}
              aria-valuetext={
                flat ? t.halfLifeFlatSpoken : fill(t.halfLifeWeeks, { n: fmtHalfLife(halfLife) })
              }
            />
            <span className="ewma-slider-note">{t.halfLifeNote}</span>
          </label>

          <label className="ewma-slider">
            <span className="ewma-slider-head">
              <span className="ewma-slider-name">{t.dampingName}</span>
              <span className="ewma-slider-value">
                {clamped ? fill(t.dampingBand, { lo: clampP, hi: 100 - clampP }) : t.dampingOff}
              </span>
            </span>
            <input
              type="range"
              min={CLAMP_RANGE.min}
              max={CLAMP_RANGE.max}
              step={CLAMP_RANGE.step}
              value={clampP}
              onChange={(event) => setClampP(Number(event.target.value))}
              aria-valuetext={
                clamped
                  ? fill(t.dampingSpokenOn, { lo: clampP, hi: 100 - clampP })
                  : t.dampingSpokenOff
              }
            />
            <span className="ewma-slider-note">{t.dampingNote}</span>
          </label>
        </div>

        <p className="ewma-readout">
          {t.readout} <strong>{fmt1(model.prediction)}</strong> {t.readoutUnit}
          <span className="ewma-readout-aside">
            {" "}
            {fill(t.readoutAsidePlain, { mean: fmt1(model.plainMean) })}
            {clamped
              ? fill(t.readoutAsideClamped, { lo: clampP, hi: 100 - clampP })
              : t.readoutAsideUnclamped}
            {flat ? t.readoutAsideFlat : ""})
          </span>
        </p>
      </div>
    </div>
  );
}
