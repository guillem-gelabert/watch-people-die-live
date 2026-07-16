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

// Shared-border adjacency (topojson-client neighbors()), keyed by M49 numeric id. Used
// by the step-5 "amplitude vs. neighbouring countries" scatter.
export type NeighborsByM49 = Map<number, number[]>;

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

// --- data/seasonality-proxies.json (baked by notebooks/seasonality.ipynb) -----------
// Per-country descriptive signals for the amplitude scatter plots, keyed by the same
// M49 numeric string as SeasonalityData.countries. `pop65` is World Bank % population
// aged 65+ (SP.POP.65UP.TO.ZS); `kgFamily` is the dominant Köppen–Geiger family (A–E);
// `gdpPerCapita` is World Bank GDP per capita in current USD (NY.GDP.PCAP.CD).
export interface SeasonalityProxyRow {
  pop65?: number;
  kgFamily?: string;
  kgFamilyName?: string;
  kgClass?: string;
  gdpPerCapita?: number;
}
export interface SeasonalityProxies {
  meta: { source: string; year?: number; pop65Indicator?: string; gdpPerCapitaIndicator?: string };
  byM49: Record<string, SeasonalityProxyRow>;
}

// --- data/temperature-curves.json (baked by notebooks/seasonality.ipynb) ------------
// Population-weighted mean 2 m temperature (°C) per calendar month, from the ERA5-Land
// 1996–2025 climatology weighted over data/density-grid.json. Keyed by the same M49
// numeric string as SeasonalityData.countries, so the step-5 chart can overlay a
// country's temperature curve on its seasonal mortality curve (temperature-as-proxy).
export interface TemperatureCurves {
  meta: { source: string; units: string };
  months: number;
  byM49: Record<string, number[]>;
}

// --- data/seasonality-loo-validation.json (baked by notebooks/seasonality.ipynb) ----
// Leave-one-country-out validation of the three seasonality proxies. Each perCountry
// row carries the country's day-weighted mean-1 measured curve plus the curve each
// proxy reconstructs for it when it's held out, so the roadmap can plot predictions
// against the actual for any country. climateZones aggregates the same curves within
// latitude bands (climate has no per-zone curve — only latitude and temperature).
export interface LooPerCountry {
  m49: number;
  name: string;
  actual: number[];
  latitude_prediction: number[];
  temperature_prediction: number[];
  climate_prediction: number[];
  latitude_rmse: number;
  temperature_rmse: number;
  temperature_rmse_rotated: number;
  climate_rmse: number;
}
export interface LooClimateZone {
  zone: string;
  n: number;
  actual: number[];
  latitude_prediction: number[];
  temperature_prediction: number[];
  latitude_median_rmse: number;
  temperature_median_rmse: number;
  temperature_win_rate: number;
}
export interface LooValidation {
  meta: { source: string; nCountries: number; droppedNoTemperature: number[] };
  comparisonTable: Array<Record<string, number | string>>;
  perCountry: LooPerCountry[];
  climateZones: LooClimateZone[];
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
// --- /api/conflicts (ACLED conflict fatalities, runtime) ----------------------------
// Re-exported from the server producer so the route and the roadmap/globe consumers share
// one shape. `cells` are annualised fatalities snapped to the same 0.5° grid the globe
// samples; `byCountry` is the per-country roll-up the Step 6 chart reads. See lib/acled.ts.
export type { ConflictsPayload, ConflictCell, ConflictCountry } from "@/lib/acled";

// region key (adm1_code or NUTS_ID) -> rate per 100k, for the choropleth join.
export type RatePer100kByKey = Map<string, number>;
// ISO3 country code -> national rate per 100k, drawn where a region has no subnational rate.
export type RatePer100kByCountry = Map<string, number>;
