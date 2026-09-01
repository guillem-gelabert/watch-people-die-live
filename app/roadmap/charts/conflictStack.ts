// The weekly conflict stack's two presentation rules, kept out of the widget so they can be
// tested: what order the bands are drawn in, and what colour each one takes.
//
// Both are presentation, not data. `buildWeeklyStack` sorts a week's bands biggest-first and
// `data/conflicts.json` is baked that way; re-sorting the payload to change a drawing order would
// mean rebuilding the snapshot for something no consumer of the data wants, and the builder's
// order is what its `keys` ranking and the tooltip's member lists read.
import { CONTINENTS, continentOf } from "@/lib/m49-geoscheme";
import { CONFLICT_CONTINENT_SHADES } from "../palette";
import type { ConflictStackSegment, ConflictWeeklyStack } from "../types";

// The residual band is not a place — it collects leftovers from every continent plus the
// countries with no M49 at all, and it spans more than one continent in every week of the
// committed window. So it takes a neutral of its own rather than any continent's hue.
export const OTHER_FILL = "var(--conflict-other)";

export interface BandFill {
  // Index into CONTINENTS, which is also the hue slot. Null for the residual band.
  continent: number | null;
  shade: number;
}

// Bottom to top: the residual, then everything else ascending, so the biggest band is at the top
// of the bar and Others is always the floor it stands on. The widget draws in this order
// accumulating from the axis up.
//
// Ties break on key so a re-render cannot reorder two equal bands under the reader.
export function drawOrder(segments: readonly ConflictStackSegment[]): ConflictStackSegment[] {
  const others = segments.filter((segment) => segment.kind === "elsewhere");
  const rest = segments
    .filter((segment) => segment.kind !== "elsewhere")
    .sort((a, b) => a.fatalities - b.fatalities || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return [...others, ...rest];
}

// A band's continent, taken from its members rather than its key. A country band's key is a name
// and a region band's key is a grouping code, but every band carries the countries it is made of,
// and a rolled-up band's members all sit inside it — so one member answers for the band.
//
// Scans rather than trusting members[0]: a band whose first member has no M49 would otherwise
// report no continent when its second member knows one.
export function bandContinent(segment: ConflictStackSegment): number | null {
  if (segment.kind === "elsewhere") return null;
  for (const member of segment.members) {
    const continent = member.m49 == null ? null : continentOf(member.m49);
    if (continent != null) return continent;
  }
  return null;
}

// Which fill each key takes, decided once for the window rather than per bar.
//
// The hue is the band's continent, and it is a fixed slot rather than a ranked one: a continent
// keeps its colour across weeks it misses, across a snapshot rebuild, and across a change to the
// stack's floor. That is stronger than the ranked scheme this replaces, which was stable only for
// as long as the ranking was.
//
// The shade is collision avoidance and nothing else — it does not encode whether a band is a
// country or a rolled-up region, which the tooltip says. It has to exist because two bands share
// a continent in 11 of the 12 bars in the committed window (Myanmar beside Asia, Western Africa
// beside Eastern Africa, Sub-Saharan Africa beside Burkina Faso), and one colour per continent
// would draw those as one band to a reader with no legend. So: greedy over the graph of "these
// two bands are drawn in the same bar as each other", exactly as the previous scheme did, but run
// inside a continent's ramp instead of across one global ramp per kind.
export function assignFills(
  stack: ConflictWeeklyStack | undefined,
  shades = CONFLICT_CONTINENT_SHADES,
): Map<string, BandFill> {
  const out = new Map<string, BandFill>();
  const weeks = stack?.weeks ?? [];

  const continentOfKey = new Map<string, number | null>();
  for (const week of weeks) {
    for (const segment of week.segments) {
      if (!continentOfKey.has(segment.key)) {
        continentOfKey.set(segment.key, bandContinent(segment));
      }
    }
  }

  for (const [index] of CONTINENTS.entries()) {
    const continent = CONTINENTS[index]!;
    const keys = (stack?.keys ?? [])
      .filter((entry) => continentOfKey.get(entry.key) === continent)
      .map((entry) => entry.key);
    if (keys.length === 0) continue;

    const rank = new Map(keys.map((key, position) => [key, position]));
    const sharesABarWith = keys.map(() => new Set<number>());
    for (const week of weeks) {
      const here = week.segments
        .map((segment) => rank.get(segment.key))
        .filter((position): position is number => position !== undefined);
      for (const a of here) {
        for (const b of here) if (a !== b) sharesABarWith[a]!.add(b);
      }
    }

    const slots = new Array<number>(keys.length).fill(-1);
    keys.forEach((key, position) => {
      const used = new Set(
        [...sharesABarWith[position]!].map((other) => slots[other]!).filter((slot) => slot >= 0),
      );
      let shade = 0;
      while (shade < shades && used.has(shade)) shade += 1;
      // More bands of one continent in a single bar than the ramp is deep. Fall back to rank,
      // which still gives a stable shade per place and puts the repeat as far down the bar as it
      // can. Never reached on the committed window — the deepest bar holds two.
      slots[position] = shade < shades ? shade : position % shades;
      out.set(key, { continent: index, shade: slots[position]! });
    });
  }

  // Anything with no continent — the residual, and any band whose members all lack an M49.
  for (const [key, continent] of continentOfKey) {
    if (continent == null) out.set(key, { continent: null, shade: 0 });
  }

  return out;
}

export function fillVar(band: BandFill | undefined): string {
  if (!band || band.continent == null) return OTHER_FILL;
  return `var(--conflict-continent-${band.continent}-${band.shade})`;
}
