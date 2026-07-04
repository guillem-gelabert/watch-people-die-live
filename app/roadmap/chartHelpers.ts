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

// Climate zone bands (absolute degrees) used by both the latitude-correlation
// scatter and its legend.
export const CLIMATE_ZONES = [
  { name: "Tropical", lo: 0, hi: 23.5, color: "#5b3a42" },
  { name: "Subtropical", lo: 23.5, hi: 35, color: "#7a3f3f" },
  { name: "Middle latitude", lo: 35, hi: 66.5, color: "#8a4a5a" },
  { name: "Polar", lo: 66.5, hi: 90, color: "#2f4a63" },
];

export function expGap(meanMs: number): number {
  return -Math.log(1 - Math.random()) * meanMs;
}

// Two speeds shared by the animated-dot roadmap charts: the real global average gap
// between deaths, and a sped-up preview rate. ~61.6M deaths/year worldwide (the same
// total baked into data/rate-grid.json that the globe samples) is ~1.95 deaths per
// second — a mean gap of ~0.51s, NOT "one death every ~2 seconds".
export const REAL_MEAN_GAP_MS = 512;
export const FAST_MEAN_GAP_MS = 120;

export function formatMeanGap(meanMs: number): string {
  return meanMs >= 1000 ? `${(meanMs / 1000).toFixed(2)}s` : `${meanMs}ms`;
}

export function randomPointOnSphere(): [number, number] {
  const lon = Math.random() * 360 - 180;
  const lat = (Math.asin(2 * Math.random() - 1) * 180) / Math.PI;
  return [lon, lat];
}

// Ten countries found (notebooks/seasonality.ipynb) to be mutually similar in curve
// *shape* despite spanning very different latitudes and death tolls.
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

export function styleAxis(g: d3.Selection<SVGGElement, unknown, Element | null, unknown>): void {
  g.selectAll("path,line").attr("class", "chart-axis");
  g.selectAll("text").attr("class", "chart-tick");
}
