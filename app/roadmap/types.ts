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

// --- data/admin1-10m.json (Natural Earth 10m Admin-1, topojson) ---------------------
// One feature per first-level region; joined to subnational rates by `adm1_code`.
export interface Admin1Properties {
  adm1_code: string;
  name: string;
  adm0_a3: string;
  iso_3166_2?: string;
  type_en?: string;
  latitude?: number;
  longitude?: number;
}
export type Admin1Feature = Feature<Geometry, Admin1Properties>;

// --- data/nuts2-20m.json (Eurostat GISCO NUTS-2, topojson) --------------------------
// Europe's finer layer; joined to subnational rates by `NUTS_ID`.
export interface Nuts2Properties {
  NUTS_ID: string;
  NAME_LATN: string;
  NAME_ENGL?: string;
  CNTR_CODE?: string;
}
export type Nuts2Feature = Feature<Geometry, Nuts2Properties>;

// --- data/subnational-cdr.json (baked by notebooks/data/build-subnational.ipynb) ----
// One flat list across both geometry layers; `key` joins to Admin-1 `adm1_code`
// (geo:"adm1") or NUTS-2 `NUTS_ID` (geo:"nuts2").
export interface SubnationalRegion {
  geo: "adm1" | "nuts2";
  key: string;
  name: string;
  country: string; // ISO3
  cdrPer1000: number;
  ratePer100k: number;
}
export interface SubnationalCdr {
  meta: {
    sources: string[];
    year: number;
    unit: string;
    note: string;
    geoLayers: Record<string, string>;
    nutsCountriesIso3: string[]; // Natural Earth features in these countries are drawn as NUTS instead
    regionCount: number;
    adm1Count: number;
    nuts2Count: number;
    countryCount: number;
    countryFallbackCount: number;
    license: string;
  };
  regions: SubnationalRegion[];
  countryRates: Record<string, number>; // ISO3 -> rate per 100k, national fallback for regionless countries
}
// region key (adm1_code or NUTS_ID) -> rate per 100k, for the choropleth join.
export type RatePer100kByKey = Map<string, number>;
// ISO3 country code -> national rate per 100k, drawn where a region has no subnational rate.
export type RatePer100kByCountry = Map<string, number>;
