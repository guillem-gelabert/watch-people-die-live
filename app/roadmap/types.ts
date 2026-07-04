// Shared type shapes for the JSON data the roadmap page consumes. These mirror the
// on-disk shapes in data/*.json and the /api/mortality response (see lib/worldbank.js),
// not a redesign — kept intentionally loose (arrays of tuples, string-keyed records)
// to match the real files byte for byte.
import type { Feature, Geometry } from "geojson";

// --- Country polygons (topojson-client feature() output) --------------------------
export interface CountryProperties {
  name?: string;
}
export type CountryFeature = Feature<Geometry, CountryProperties>;

// --- data/seasonality.json & data/seasonality-unified.json -------------------------
// Both files share the same top-level shape; only the `fallback` sub-shape differs
// (seasonality.json uses a latitude-plateau model, seasonality-unified.json uses a
// quadratic amplitude-coefficient model — chartHelpers.fallbackAmplitudeForLat()
// branches on which fields are present).
export interface SeasonalityFallback {
  north: number[];
  tropicMaxAbsLat?: number;
  plateauAbsLat?: number;
  amplitudeCoef?: [number, number, number];
  ampClamp?: [number, number];
}

export interface SeasonalityData {
  source: string;
  method: string;
  months: number;
  countries: Record<string, number[]>;
  fallback: SeasonalityFallback;
}

// --- data/density-grid.json ---------------------------------------------------------
// cells: [lon, lat, population, m49CountryCode][]
export type DensityCell = [number, number, number, number];

export interface DensityGrid {
  resolution: string;
  cellsize: number;
  year: number;
  source: string;
  count: number;
  cells: DensityCell[];
}

// --- data/rate-grid.json (baked offline by notebooks/combine.ipynb) -----------------
// The same combined grid the globe samples: one row per populated cell, `w` = that
// cell's expected deaths/year. The roadmap sums `w` per country for its step-2 chart,
// so its numbers and country coverage match the globe exactly (no live /api/mortality).
// cells: [lon, lat, m49CountryCode, expectedDeathsPerYear][]
export type RateCell = [number, number, number, number];

export interface RateGrid {
  meta: {
    year: number;
    sources: string[];
    baseRatePerPersonYear: number;
    totalDeathsPerYear: number;
  };
  names: Record<string, string>;
  cellsize: number;
  cells: RateCell[];
}

export type DeathsPerYearById = Map<number, number>;
