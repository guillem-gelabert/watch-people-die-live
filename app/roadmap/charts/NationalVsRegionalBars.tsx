"use client";

import { useMemo } from "react";
import * as d3 from "d3";
import { useFigureWidth } from "./useFigureSize";
import { useSkin } from "../SkinContext";
import { mapColor } from "../palette";
import type { SubnationalCdr } from "../types";
import { useDict } from "../I18nContext";
import { fill } from "@/lib/i18n/fill";

interface NationalVsRegionalBarsProps {
  subnational: SubnationalCdr | null;
}

// Two countries, four regions each, plus the label rows and the gap between blocks. Height comes
// from the content; only the width follows the column.
const MIN_HEIGHT = 230;
const LEFT = 104;
const RIGHT = 40;
const ROW_PITCH = 20;
const BAR_HEIGHT = 11;
// A fixed ceiling rather than a per-country max: the two blocks have to be read against each
// other, and a scale that rescaled per country would hide that France's spread is the wider one.
const MAX_RATE = 1400;

// The countries the figure argues with. Both report every region, both have a national rate, and
// between them they show the two ways a border lies: France's regions spread more than four-fold
// around its national figure, Spain's a little over two-fold.
const PICKS: { iso3: string; label: string }[] = [
  { iso3: "ESP", label: "Spain" },
  { iso3: "FRA", label: "France" },
];
// Three regions per country — six in all, as in the design — spread evenly through that country's
// own ranking. Taking the highest and lowest instead would fill the figure with enclaves and
// overseas departments — true, but it would read as a trick, and the argument is about ordinary
// regions.
const PER_COUNTRY = 3;

interface Row {
  name: string;
  rate: number;
}

// The label column is 98px wide, which fits about this much. Official names run long
// ("Principado de Asturias"), so the administrative prefix goes first and the rest is clipped;
// the full name stays in the figure's accessible description either way.
const LABEL_MAX = 17;

function shorten(name: string): string {
  const trimmed = name.replace(
    /^(Principado de|Comunidad de|Ciudad de|Región de|Provincia de) /,
    "",
  );
  return trimmed.length > LABEL_MAX ? `${trimmed.slice(0, LABEL_MAX - 1)}…` : trimmed;
}

interface Block {
  label: string;
  national: number;
  rows: Row[];
}

// The last thing wrong with *where*: a national rate is not a fact about anywhere inside the
// country. Each block is one country's national figure as a dashed line, with four of its own
// regions measured against it — every one of them wrong, in one direction or the other.
export default function NationalVsRegionalBars({ subnational }: NationalVsRegionalBarsProps) {
  const t = useDict().charts.nationalVsRegional;
  const [sizeRef, WIDTH] = useFigureWidth<SVGSVGElement>();
  const { skin } = useSkin();
  const above = mapColor("#ff3b30", skin);
  const below = mapColor("#2f4bff", skin);

  const blocks = useMemo<Block[]>(() => {
    if (!subnational) return [];
    return PICKS.flatMap(({ iso3, label }) => {
      const national = subnational.countryRates[iso3];
      if (national == null) return [];
      const regions = subnational.regions
        .filter((r) => r.country === iso3)
        .sort((a, b) => d3.descending(a.ratePer100k, b.ratePer100k));
      if (regions.length < PER_COUNTRY) return [];
      // Ranks 0, ⅓, ⅔ and last: the top of the spread, the bottom, and two ordinary regions in
      // between, so the line is crossed rather than just straddled.
      const picked = Array.from(
        { length: PER_COUNTRY },
        (_, i) => regions[Math.round((i / (PER_COUNTRY - 1)) * (regions.length - 1))]!,
      );
      return [
        {
          label,
          national,
          rows: picked.map((r) => ({ name: r.name, rate: r.ratePer100k })),
        },
      ];
    });
  }, [subnational]);

  if (!blocks.length) {
    return (
      <section className="chart-panel wide">
        <p className="chart-status" aria-live="polite">
          {t.loading}
        </p>
      </section>
    );
  }

  const x = (rate: number) => LEFT + (Math.min(rate, MAX_RATE) / MAX_RATE) * (WIDTH - LEFT - RIGHT);

  let y = 14;
  const drawn = blocks.map((block) => {
    const top = y;
    // The country heading takes its own line rather than sitting beside the first row: real
    // region names run to "Principado de Asturias", which would collide with it.
    const rows = block.rows.map((row, i) => ({ ...row, y: top + 20 + i * ROW_PITCH }));
    y += 20 + block.rows.length * ROW_PITCH + 26;
    return { ...block, top, rows };
  });

  return (
    <section className="chart-panel wide">
      <h3 className="chart-title">{t.title}</h3>
      <p className="chart-copy">{t.copy}</p>
      <svg
        ref={sizeRef}
        className="story-figure"
        viewBox={`0 0 ${WIDTH} ${Math.max(MIN_HEIGHT, y)}`}
        role="img"
        aria-label={drawn
          .map((b) =>
            fill(t.ariaBlock, {
              label: b.label,
              national: Math.round(b.national),
              regions: b.rows.map((r) => `${r.name} ${Math.round(r.rate)}`).join(", "),
            }),
          )
          .join(". ")}
      >
        {drawn.map((block) => (
          <g key={block.label}>
            <text className="bars-country" x={6} y={block.top + 8}>
              {block.label}
              <tspan className="bars-national" dx={7}>
                {fill(t.national, { n: Math.round(block.national) })}
              </tspan>
            </text>
            {/* The national figure as a line rather than a bar: it is the claim the regions are
                being measured against, not another measurement. */}
            <line
              className="bars-reference"
              x1={x(block.national)}
              x2={x(block.national)}
              y1={block.top + 14}
              y2={block.top + 20 + block.rows.length * ROW_PITCH - 4}
              stroke={below}
            />
            {block.rows.map((row) => (
              <g key={row.name}>
                <text className="bars-region" x={LEFT - 6} y={row.y + 8}>
                  <title>{row.name}</title>
                  {shorten(row.name)}
                </text>
                <rect
                  x={LEFT}
                  y={row.y}
                  width={Math.max(1, x(row.rate) - LEFT)}
                  height={BAR_HEIGHT}
                  fill={row.rate > block.national ? above : below}
                  fillOpacity={row.rate > block.national ? 0.75 : 0.5}
                />
                <text className="bars-value" x={x(row.rate) + 5} y={row.y + 9}>
                  {Math.round(row.rate)}
                </text>
              </g>
            ))}
          </g>
        ))}
      </svg>
      <p className="chart-note-copy">{t.note}</p>
    </section>
  );
}
