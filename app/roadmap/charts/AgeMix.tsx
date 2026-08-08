"use client";

import { useMemo } from "react";
import { useFigureWidth } from "./useFigureSize";
import { useDict } from "../I18nContext";
import { fill } from "@/lib/i18n/fill";
import { causeLabel, type CauseLabels } from "@/lib/i18n/causes";
import {
  bandLabel,
  usePersonaTables,
  type CauseTable,
  type MortalityTable,
} from "./usePersonaTables";

// Named causes shown separately; everything else is summed into the tail. Four is what fits in
// one legend row on a phone, and past the fourth the segments are too thin to compare anyway.
const NAMED_CAUSES = 4;
const LEFT = 46;
const RIGHT = 14;
// Room for the "18%" printed past the end of a bar.
const VALUE_GUTTER = 26;
const TOP = 34;
const BOTTOM = 26;
const ROW_HEIGHT = 26;
const BAR_INSET = 3;

interface Band {
  label: string;
  // This band's share of all deaths, 0–1.
  share: number;
  // Cause shares within the band, 0–1, in legend order and summing to 1.
  mix: number[];
}

interface Model {
  bands: Band[];
  causes: string[];
}

// Age bands with their cause mixes, from the same two tables a persona is drawn from. Sexes are
// summed: the figure is about age carrying the cause, and splitting it by sex here would ask the
// reader to hold six series in their head instead of five.
function buildModel(
  mortality: MortalityTable,
  causes: CauseTable,
  labels: CauseLabels,
  tail: string,
): Model | null {
  const entry = mortality.global;
  const causeEntry = causes.global;
  if (!entry || !causeEntry) return null;

  const totals = entry.m.map((m, i) => m + (entry.f[i] ?? 0));
  const allDeaths = totals.reduce((a, b) => a + b, 0);
  if (!(allDeaths > 0)) return null;

  // Which causes to name: the biggest across the whole table, so one legend serves every row.
  const weightByCause = new Map<number, number>();
  for (const sex of ["m", "f"] as const) {
    for (const cell of causeEntry[sex] ?? []) {
      for (const [index, weight] of Object.entries(cell)) {
        const i = Number(index);
        if (causes.causes[i] === "other causes") continue;
        weightByCause.set(i, (weightByCause.get(i) ?? 0) + weight);
      }
    }
  }
  const named = [...weightByCause.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, NAMED_CAUSES)
    .map(([index]) => index);

  const bands = totals.map((total, band) => {
    const perCause = new Map<number, number>();
    let bandTotal = 0;
    for (const sex of ["m", "f"] as const) {
      const cell = causeEntry[sex]?.[band];
      if (!cell) continue;
      for (const [index, weight] of Object.entries(cell)) {
        perCause.set(Number(index), (perCause.get(Number(index)) ?? 0) + weight);
        bandTotal += weight;
      }
    }
    const mix = named.map((index) => (bandTotal > 0 ? (perCause.get(index) ?? 0) / bandTotal : 0));
    const rest = Math.max(0, 1 - mix.reduce((a, b) => a + b, 0));
    return {
      label: bandLabel(mortality.bands[band] ?? [0, 0], band === mortality.bands.length - 1),
      share: total / allDeaths,
      mix: [...mix, rest],
    };
  });

  return {
    bands,
    causes: [...named.map((i) => causeLabel(labels, causes.causes[i] ?? "")), tail],
  };
}

// Where the deaths are, by age, and what they are. Bar length is the age band's share of all
// deaths; the segments inside it are that band's own cause mix — which is the argument for
// sampling age before cause rather than the other way round.
export default function AgeMix() {
  const d = useDict();
  const t = d.charts.ageMix;
  const [sizeRef, WIDTH] = useFigureWidth<SVGSVGElement>();
  const { mortality, causes } = usePersonaTables();

  const model = useMemo(
    () => (mortality && causes ? buildModel(mortality, causes, d.causes, t.tail) : null),
    [mortality, causes, d.causes, t.tail],
  );

  // One hue per named cause plus a muted tail, all legible against whatever sky is in view.
  const colors = useMemo(
    () => [
      ...Array.from({ length: NAMED_CAUSES }, (_, i) => `var(--cause-color-${i})`),
      "var(--mute)",
    ],
    [],
  );

  if (!model) {
    return (
      <section className="chart-panel">
        <p className="chart-status" aria-live="polite">
          {t.loading}
        </p>
      </section>
    );
  }

  const height = TOP + model.bands.length * ROW_HEIGHT + BOTTOM;
  // The share sits at the end of its own bar, so the widest bar has to stop short of the edge by
  // enough to print it — otherwise the largest band is the one whose number gets clipped.
  const plot = WIDTH - LEFT - RIGHT - VALUE_GUTTER;
  // The widest band sets the scale, so the tallest bar fills the panel rather than the figure
  // being mostly the empty right-hand side of a 0–100% axis.
  const widest = Math.max(...model.bands.map((b) => b.share)) || 1;

  return (
    <section className="chart-panel">
      <svg
        ref={sizeRef}
        className="story-figure"
        viewBox={`0 0 ${WIDTH} ${height}`}
        role="img"
        aria-label={model.bands
          .map((b) => fill(t.ariaBand, { label: b.label, share: (b.share * 100).toFixed(0) }))
          .join("; ")}
      >
        {model.causes.map((cause, i) => {
          // The legend wraps to a second row when four causes plus the tail do not fit.
          const perRow = WIDTH < 360 ? 2 : 3;
          const column = i % perRow;
          const row = Math.floor(i / perRow);
          const x = LEFT + column * ((plot - 4) / perRow);
          const y = 10 + row * 13;
          return (
            <g key={cause}>
              <rect x={x} y={y} width={9} height={9} rx={2} fill={colors[i]} />
              <text className="chart-label" x={x + 13} y={y + 8}>
                {cause}
              </text>
            </g>
          );
        })}

        {model.bands.map((band, i) => {
          const y = TOP + i * ROW_HEIGHT;
          const full = (band.share / widest) * plot;
          let x = LEFT;
          return (
            <g key={band.label}>
              <text className="chart-tick" x={LEFT - 6} y={y + ROW_HEIGHT / 2 + 3} textAnchor="end">
                {band.label}
              </text>
              {band.mix.map((fraction, k) => {
                const w = full * fraction;
                const segment = (
                  <rect
                    key={model.causes[k]}
                    x={x}
                    y={y + BAR_INSET}
                    width={Math.max(0, w)}
                    height={ROW_HEIGHT - BAR_INSET * 2 - 3}
                    fill={colors[k]}
                  />
                );
                x += w;
                return segment;
              })}
              <text className="chart-value" x={LEFT + full + 5} y={y + ROW_HEIGHT / 2 + 3}>
                {(band.share * 100).toFixed(0)}%
              </text>
            </g>
          );
        })}

        <text className="chart-label" x={LEFT} y={height - 8}>
          {t.barCaption}
        </text>
      </svg>
    </section>
  );
}
