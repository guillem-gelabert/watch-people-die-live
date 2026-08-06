import * as d3 from "d3";
import { harmony, marks, skinFromSky, type Rgb } from "./palette";
import type { Dictionary } from "@/lib/i18n/en";
import { isHarmonicCurve, sampleHarmonicCurve, type HarmonicCurve } from "@/lib/seasonal-curve";

export const MONTHS = [
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
export const fmtPct = d3.format("+.0%");
export const fmtPlainPct = d3.format(".0%");

export function rotateSix(values: number[]): number[] {
  return values.slice(6).concat(values.slice(0, 6));
}

export function strength(values: number[] | HarmonicCurve): number {
  if (isHarmonicCurve(values)) {
    values = sampleHarmonicCurve(
      values,
      d3.range(720).map((index) => index / 720),
    );
  }
  return d3.max(values, (d) => Math.abs(d - 1)) ?? 0;
}

// Pearson correlation coefficient between two equal-length numeric series.
// Returns null when there are fewer than 2 points or either series has zero variance.
export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  const mx = d3.mean(xs) ?? 0;
  const my = d3.mean(ys) ?? 0;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = (xs[i] ?? 0) - mx;
    const dy = (ys[i] ?? 0) - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

// Correlation ratio η (eta) between a categorical grouping and a numeric value — the
// share of total variance explained by the group means, the analog of |r| for a
// categorical predictor. Ranges [0, 1]. Returns null when there aren't enough points.
export function correlationRatio(groups: Map<string, number[]>): number | null {
  const all: number[] = [];
  for (const values of groups.values()) all.push(...values);
  if (all.length < 2) return null;
  const grand = d3.mean(all) ?? 0;
  let between = 0;
  let total = 0;
  for (const values of groups.values()) {
    const gm = d3.mean(values) ?? 0;
    between += values.length * (gm - grand) ** 2;
  }
  for (const v of all) total += (v - grand) ** 2;
  if (total === 0) return null;
  return Math.sqrt(between / total);
}

// The five Köppen–Geiger families, tropics → poles. Shared by the climate-zone scatter and
// the latitude-correlation scatter, so a family reads as the same colour in both.
// Keys only: the family's name is copy and lives in the dictionary (see kgFamilyName).
export const KG_FAMILY_KEYS = [
  { key: "A" },
  { key: "B" },
  { key: "C" },
  { key: "D" },
  { key: "E" },
] as const;

// Colours are generated from the section's sky rather than fixed, so the families sit in
// whatever palette is on screen. Five distinct hues from the analogous scheme, then through
// marks() because these land on transparent SVG over the sky itself.
export function kgFamilies(sky: Rgb): { key: string; color: string }[] {
  const cols = marks(harmony(KG_FAMILY_KEYS.length, sky, true), sky);
  return KG_FAMILY_KEYS.map((f, i) => ({ ...f, color: cols[i] as string }));
}

// A Köppen–Geiger family's name in the reader's language. The key (A–E) is the identity; the
// word beside it is copy, so it comes from the dictionary rather than from the key table.
export function kgFamilyName(d: Dictionary, key: string): string {
  return d.charts.kgFamilies[key as keyof Dictionary["charts"]["kgFamilies"]] ?? key;
}

// Colour for a country's Köppen–Geiger family, or the section's muted tone when unmapped.
export function kgFamilyColor(kgFamily: string | undefined, sky: Rgb): string {
  const hit = kgFamily && kgFamilies(sky).find((f) => f.key === kgFamily);
  return hit ? hit.color : skinFromSky(sky).mute;
}

export function expGap(meanMs: number): number {
  return -Math.log(1 - Math.random()) * meanMs;
}

// The real global average gap between deaths, shared by the animated-dot roadmap
// charts. ~61.6M deaths/year worldwide (the same total baked into data/rate-grid.json
// that the globe samples) is ~1.95 deaths per second — a mean gap of ~0.51s, NOT "one
// death every ~2 seconds".
export const REAL_MEAN_GAP_MS = 512;

export function formatMeanGap(meanMs: number): string {
  return meanMs >= 1000 ? `${(meanMs / 1000).toFixed(2)}s` : `${meanMs}ms`;
}

export function randomPointOnSphere(): [number, number] {
  const lon = Math.random() * 360 - 180;
  const lat = (Math.asin(2 * Math.random() - 1) * 180) / Math.PI;
  return [lon, lat];
}

// Ten countries found (notebooks/seasonality.ipynb) to be mutually similar in curve
// *shape* despite spanning very different latitudes and death tolls. Default selection for
// the interactive country-comparison chart.
export const COUNTRY_CURVE_PICKS = [
  { id: 250, name: "France" },
  { id: 703, name: "Slovakia" },
  { id: 840, name: "USA" },
  { id: 752, name: "Sweden" },
  { id: 392, name: "Japan" },
  { id: 191, name: "Croatia" },
  { id: 56, name: "Belgium" },
  { id: 826, name: "United Kingdom" },
  { id: 756, name: "Switzerland" },
  { id: 528, name: "Netherlands" },
];

// Series colours for the country-comparison chart, generated from the section's sky.
// Capped at six hues and cycled, matching the prototype — past six the harmony rule would
// fall back to shades of one hue, which is unreadable for overlapping curves.
export function curveColors(sky: Rgb, count: number): string[] {
  const pool = marks(harmony(Math.max(2, Math.min(6, count)), sky), sky);
  return Array.from({ length: Math.max(count, 1) }, (_, i) => pool[i % pool.length] as string);
}

// Cap on how many countries can be compared at once. Colours cycle every six, so past this
// the legend stops being able to tell series apart at a glance.
export const MAX_COMPARE_COUNTRIES = 14;

export function styleAxis(g: d3.Selection<SVGGElement, unknown, Element | null, unknown>): void {
  g.selectAll("path,line").attr("class", "chart-axis");
  g.selectAll("text").attr("class", "chart-tick");
}
