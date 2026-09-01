// Which points a dense chart lets a phone reach, and the labels that make them reachable.
//
// The scatters that carry the seasonality argument plot 297 to 316 units, and at 390px a 44px tap
// covers a mean of 34 to 116 of them. So the honest tap target is not "a point" but "a point worth
// naming", and the story answers which those are: the countries its own prose names. There are
// twelve. A reader who met Lithuania in a paragraph can find Lithuania in the chart; nobody is
// looking for the 213th anonymous dot, and pretending a tap found it would be a lie the reader
// would believe.
//
// The representatives are labelled on the chart, which is what separates this from a lottery — the
// reader can see the targets before aiming. Labels are also the reason the set has to stay small:
// see labelRepresentatives, which drops any label that will not fit and so keeps "every target is
// visible" true rather than aspirational.
import type * as d3 from "d3";
import { nearestWithin, type PickCandidate } from "./touchPick";

// Every country docs/ROADMAP.md names, in the order the story first mentions them, with the ISO3
// code the region-level data keys on. Hand-authored because it is an editorial list, not a derived
// one — and covered by a test against the prose and against i18n-iso-countries, because a
// hand-authored table that can drift silently is the failure mode this project has been bitten by
// before. Country names are never translated in the data, so one list serves every locale.
//
// The codes are here rather than resolved through i18n-iso-countries because these charts are
// client components: twelve pairs cost nothing, and the library would follow the whole ISO table
// into the browser bundle for a lookup this narrow. The test carries the cost instead.
export const NAMED_IN_PROSE_COUNTRIES: ReadonlyArray<{ name: string; iso3: string }> = [
  { name: "Mexico", iso3: "MEX" },
  { name: "Lithuania", iso3: "LTU" },
  { name: "Bulgaria", iso3: "BGR" },
  { name: "Germany", iso3: "DEU" },
  { name: "Ireland", iso3: "IRL" },
  { name: "Sweden", iso3: "SWE" },
  { name: "Spain", iso3: "ESP" },
  { name: "Japan", iso3: "JPN" },
  { name: "India", iso3: "IND" },
  { name: "Brazil", iso3: "BRA" },
  { name: "South Africa", iso3: "ZAF" },
  { name: "Togo", iso3: "TGO" },
];

export const NAMED_IN_PROSE: readonly string[] = NAMED_IN_PROSE_COUNTRIES.map((c) => c.name);

const NAME_BY_ISO3 = new Map(NAMED_IN_PROSE_COUNTRIES.map((c) => [c.iso3, c.name]));

// The display name for a region's ISO3, or null when the story never names that country. The
// region-level series key on ISO3 — SubnationalSeasonalityRegion.country is "MEX", not "Mexico" —
// so this is what turns a region into a candidate representative and gives its label something a
// reader recognises.
export function namedCountryOf(iso3: string): string | null {
  return NAME_BY_ISO3.get(iso3) ?? null;
}

interface RepresentativeOptions<T> {
  // The country a point belongs to. For a country-level series that is the point itself; for a
  // region-level one it is the region's country, so "Jalisco (Mexico)" can stand for Mexico.
  countryOf: (point: T) => string;
  // Which point wins when a named country has several in this chart — a region-level cloud has one
  // per admin-1 unit. Higher wins. Amplitude is the usual answer: it is the axis the chart argues
  // about, so the most extreme region is both the most defensible pick and the most interesting.
  rank: (point: T) => number;
}

// At most one point per named country, so a chart with 32 Mexican states offers Mexico once.
export function representatives<T>(
  points: readonly T[],
  { countryOf, rank }: RepresentativeOptions<T>,
): T[] {
  const best = new Map<string, T>();
  const named = new Set(NAMED_IN_PROSE);
  for (const point of points) {
    const country = countryOf(point);
    if (!named.has(country)) continue;
    const held = best.get(country);
    if (!held || rank(point) > rank(held)) best.set(country, point);
  }
  // Ordered as NAMED_IN_PROSE is, so the labels are placed in the story's own order of mention and
  // the ones dropped for want of room are the later-mentioned ones rather than an arbitrary set.
  return NAMED_IN_PROSE.flatMap((country) => {
    const point = best.get(country);
    return point ? [point] : [];
  });
}

// A label's footprint, estimated rather than measured: getBBox on a fresh <text> would force a
// layout per label, and the chart tick face is close enough to monospace at this size for the
// estimate to be conservative.
const CHAR_W = 5.2;
const LINE_H = 11;
const GAP = 4;

interface LabelOptions<T extends PickCandidate> {
  points: readonly T[];
  text: (point: T) => string;
  // The plot's own box, so a label cannot be placed off the edge of it.
  width: number;
  height: number;
}

// Draws a label beside each representative, skipping any that would collide with one already
// placed or fall outside the plot. Returns the points that actually got a label — which is what the
// caller must use as its tap candidates, because an unlabelled representative is a target the
// reader cannot see.
export function labelRepresentatives<T extends PickCandidate>(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  { points, text, width, height }: LabelOptions<T>,
): T[] {
  const placed: Array<{ x0: number; y0: number; x1: number; y1: number }> = [];
  const labelled: T[] = [];

  for (const point of points) {
    const label = text(point);
    const w = label.length * CHAR_W;
    // Right of the dot by preference, left when that would leave the plot.
    const toLeft = point.x + GAP + w > width;
    const x0 = toLeft ? point.x - GAP - w : point.x + GAP;
    const y0 = point.y - LINE_H / 2;
    const box = { x0, y0, x1: x0 + w, y1: y0 + LINE_H };
    if (box.x0 < 0 || box.x1 > width || box.y0 < 0 || box.y1 > height) continue;
    if (placed.some((p) => box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0)) {
      continue;
    }
    placed.push(box);
    labelled.push(point);
    g.append("text")
      .attr("class", "chart-point-label")
      .attr("x", toLeft ? point.x - GAP : point.x + GAP)
      .attr("y", point.y + 3)
      .attr("text-anchor", toLeft ? "end" : "start")
      .text(label);
    g.append("circle")
      .attr("class", "chart-point-labelled")
      .attr("cx", point.x)
      .attr("cy", point.y)
      .attr("r", 3.4)
      .attr("fill", "none");
  }

  return labelled;
}

// Whether a tap would reach a given representative — exported for the tests, which assert that the
// labelled set really does partition the plot rather than leaving holes.
export function reachedBy<T extends PickCandidate>(candidates: readonly T[], x: number, y: number) {
  return nearestWithin(candidates, x, y, Infinity);
}
