import * as d3 from "d3";
import type { SeasonalityData } from "./types";

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

export function strength(values: number[]): number {
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

export function latitudeStrength(absLat: number, seasonality: SeasonalityData): number {
  const fallback = seasonality.fallback;
  const tropicMaxAbsLat = fallback.tropicMaxAbsLat ?? 0;
  const plateauAbsLat = fallback.plateauAbsLat ?? 0;
  const t = Math.max(
    0,
    Math.min(1, (absLat - tropicMaxAbsLat) / (plateauAbsLat - tropicMaxAbsLat)),
  );
  return t * strength(fallback.north);
}

export function fallbackAmplitudeForLat(lat: number, seasonality: SeasonalityData): number {
  const fallback = seasonality.fallback || ({} as SeasonalityData["fallback"]);
  const absLat = Math.abs(lat);
  if (Array.isArray(fallback.amplitudeCoef) && Array.isArray(fallback.ampClamp)) {
    const [a, b, c] = fallback.amplitudeCoef;
    const [lo, hi] = fallback.ampClamp;
    const pct = Math.max(lo, Math.min(hi, a * absLat * absLat + b * absLat + c));
    return pct / 100;
  }
  return latitudeStrength(absLat, seasonality);
}

// The five Köppen–Geiger families, tropics → poles, with a display colour each. Shared by
// the climate-zone scatter and the latitude-correlation scatter, so a family reads as the
// same colour in both charts.
export const KG_FAMILIES: { key: string; name: string; color: string }[] = [
  { key: "A", name: "Tropical", color: "#3a7d5b" },
  { key: "B", name: "Arid", color: "#c7a24a" },
  { key: "C", name: "Temperate", color: "#5aa9d6" },
  { key: "D", name: "Continental", color: "#7e6bd0" },
  { key: "E", name: "Polar", color: "#9fb4c4" },
];

const KG_FAMILY_COLOR = new Map(KG_FAMILIES.map((f) => [f.key, f.color]));

// Colour for a country's Köppen–Geiger family, or a neutral grey when it's unmapped.
export function kgFamilyColor(kgFamily: string | undefined): string {
  return (kgFamily && KG_FAMILY_COLOR.get(kgFamily)) || "#8a93a3";
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
// *shape* despite spanning very different latitudes and death tolls. Default
// selection for the interactive country-comparison chart.
export const COUNTRY_CURVE_PICKS = [
  { id: 250, name: "France", color: "#ff6b6b" },
  { id: 703, name: "Slovakia", color: "#ffb26b" },
  { id: 840, name: "USA", color: "#f4d35e" },
  { id: 752, name: "Sweden", color: "#4ade80" },
  { id: 392, name: "Japan", color: "#2dd4bf" },
  { id: 191, name: "Croatia", color: "#6ba8ff" },
  { id: 56, name: "Belgium", color: "#818cf8" },
  { id: 826, name: "United Kingdom", color: "#c084fc" },
  { id: 756, name: "Switzerland", color: "#f472b6" },
  { id: 528, name: "Netherlands", color: "#facc15" },
];

// Seven countries spanning both hemispheres, the tropics, and the equator, each with a
// directly-measured mortality curve, for the temperature-vs-mortality overlay (step 5).
// Ordered north→south; `lat` is the population-weighted latitude label shown in the
// dropdown. The set is chosen so the phase flip is visible (the northern picks peak in
// mortality in January, the southern ones in July–August, both when temperature bottoms
// out) and so the coupling visibly fades toward the equator, where Ecuador's temperature
// and mortality are both nearly flat.
export const TEMPERATURE_PICKS = [
  { id: 752, name: "Sweden", lat: "59°N" },
  { id: 840, name: "United States", lat: "37°N" },
  { id: 484, name: "Mexico", lat: "21°N" },
  { id: 764, name: "Thailand", lat: "14°N" },
  { id: 218, name: "Ecuador", lat: "2°S" },
  { id: 76, name: "Brazil", lat: "17°S" },
  { id: 36, name: "Australia", lat: "33°S" },
];

// Extra hues for countries added beyond the default 10, checked against the picks
// above with the dataviz skill's validate_palette.js (dark mode, --pairs all) — they
// don't introduce any colorblind-safety collision worse than the existing palette's.
export const EXTRA_CURVE_COLORS = ["#a3e635", "#38bdf8", "#f97316", "#0891b2"];

// Total distinct colors available — the cap on how many countries can be compared
// at once (beyond this, colors would repeat and series would become ambiguous).
export const MAX_COMPARE_COUNTRIES = COUNTRY_CURVE_PICKS.length + EXTRA_CURVE_COLORS.length;

export function styleAxis(g: d3.Selection<SVGGElement, unknown, Element | null, unknown>): void {
  g.selectAll("path,line").attr("class", "chart-axis");
  g.selectAll("text").attr("class", "chart-tick");
}
