// Shared type shapes for the JSON data the roadmap page consumes. These mirror the
// on-disk shapes in data/*.json and the /api/mortality response (see lib/worldbank.js),
// not a redesign — kept intentionally loose (arrays of tuples, string-keyed records)
// to match the real files byte for byte.
import type { Feature, Geometry } from "geojson";
import type { ClimateFallbackModel } from "@/lib/spatial-seasonality";
import type { HarmonicCurve } from "@/lib/seasonal-curve";

// --- Country polygons (topojson-client feature() output) --------------------------
export interface CountryProperties {
  name?: string;
}
export type CountryFeature = Feature<Geometry, CountryProperties>;

// --- data/closeup-outlines.json ---------------------------------------------------
// Same shape as a CountryFeature, plus the crop it was clipped to. Built offline from
// world-atlas countries-10m by scripts/build-closeup-outlines.ts: the regional close-ups
// zoom far past what the 110m outlines everything else uses can carry, and 10m clipped to
// three small windows costs a fraction of the 10m world. Grouped by `crop` on load.
export interface CloseupOutlineProperties extends CountryProperties {
  crop: string;
}
export type CloseupOutlineFeature = Feature<Geometry, CloseupOutlineProperties>;
export type CloseupOutlinesByCrop = Map<string, CloseupOutlineFeature[]>;

// Shared-border adjacency (topojson-client neighbors()), keyed by M49 numeric id. Used
// by the step-5 "amplitude vs. neighbouring countries" scatter.
export type NeighborsByM49 = Map<number, number[]>;

// --- data/seasonality.json & data/seasonality-unified.json -------------------------
// Both files share the same top-level shape; only the legacy `fallback` metadata differs.
// Runtime missing-country curves prefer measured regions and neighbouring countries;
// these latitude parameters are used only when neither exists (lib/spatial-seasonality.ts).
export interface SeasonalityFallback {
  north: HarmonicCurve;
  tropicMaxAbsLat?: number;
  plateauAbsLat?: number;
  amplitudeCoef?: [number, number, number];
  ampClamp?: [number, number];
}

export interface SeasonalityData {
  source: string;
  method: string;
  harmonicOrder: number;
  continuous: true;
  covidExcluded: number[];
  exposureAdjustment: string;
  countries: Record<string, HarmonicCurve>;
  quality?: Record<string, { annualDeaths?: number; nYears?: number }>;
  fallback: SeasonalityFallback;
  climate?: ClimateFallbackModel; // attached at fetch, feeds the spatial estimator's climate tier
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

// --- data/seasonality-loo-validation.json (baked by notebooks/seasonality.ipynb) ----
// Leave-one-country-out validation of the seasonality proxies. Each perCountry row
// carries the country's day-weighted mean-1 measured curve plus the curve each proxy
// reconstructs for it when it's held out, so the roadmap can plot predictions against
// the actual for any country. (Fields for proxies no longer surfaced on the roadmap —
// e.g. temperature — may still exist in the JSON but are intentionally untyped here.)
export interface LooPerCountry {
  m49: number;
  name: string;
  actual: number[];
  latitude_prediction: number[];
  climate_prediction: number[];
  neighbor_prediction: number[];
  latitude_rmse: number;
  climate_rmse: number;
  neighbor_rmse: number;
}
export interface LooValidation {
  meta: { source: string; nCountries: number; droppedNoTemperature: number[] };
  comparisonTable: Array<Record<string, number | string>>;
  perCountry: LooPerCountry[];
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

// --- data/seasonality-subnational.json (baked by the pipeline package, see pipeline/build.py) ----
// Per-region continuous harmonic seasonal curves. `key` joins to Admin-1 `adm1_code` or the
// Buenos Aires partido centroid table according to `geo`.
export interface SubnationalSeasonalityRegion {
  country: string; // ISO3
  geo: "adm1" | "partido";
  key: string;
  name: string;
  isoRegion: string | null;
  interval: "week" | "month";
  curve: HarmonicCurve;
  nYears: number | null;
  annualDeaths: number | null;
  // "crvs": observed civil-registration deaths; "surveillance-estimate": modelled from a
  // population register rather than raw registration (e.g. South Africa); "rate": the
  // source series is already a population-standardised rate, not a death count (Russia);
  // "climate-modeled": no observed data — a population-weighted Köppen climate blend
  // (India/China regions), shown on the amplitude map but excluded from measured-region charts.
  measurement: "crvs" | "surveillance-estimate" | "rate" | "climate-modeled";
  imputed?: string;
  imputedFrom?: string[];
  kgFamily?: string | null; // Köppen–Geiger dominant family (A-E), centroid-sampled where available
}
export interface SubnationalSeasonality {
  meta: Record<string, unknown>;
  regions: SubnationalSeasonalityRegion[];
}

export type SmoothingDemoModeKey = "weekly" | "monthly" | "quarterly" | "circular3" | "harmonic";
export type SmoothingDemoHarmonicOrder = 1 | 2 | 3 | 4;
export type SmoothingDemoPoint = [phase: number, multiplier: number];
export interface SmoothingDemoModePayload {
  observations: SmoothingDemoPoint[];
  smoothed?: SmoothingDemoPoint[];
}
export interface SmoothingDemoCountry {
  name: string;
  iso3: string;
  years: number[];
  leapYears: number[];
  yDomain: [number, number];
  modes: Record<Exclude<SmoothingDemoModeKey, "harmonic">, SmoothingDemoModePayload>;
  harmonics: Record<`${SmoothingDemoHarmonicOrder}`, HarmonicCurve>;
}
export interface SmoothingDemoData {
  meta: {
    source: string;
    defaultCountry: string;
    countryCount: number;
    covidExcluded: number[];
    normalization: string;
    harmonicOrders: SmoothingDemoHarmonicOrder[];
    generatedBy: string;
  };
  countries: Record<string, SmoothingDemoCountry>;
}

// --- data/seasonality-subnational-loo.json (baked by notebooks/seasonality.ipynb) -----------
// Region-level leave-one-out vs the country-level LOO, for the "predictions vs measured (region)"
// chart. `comparison` is one row per proxy (country vs region median RMSE); `examples` carry a few
// regions' measured curve and the neighbour/latitude reconstructions.
export interface SubnationalLooExample {
  key: string;
  name: string;
  country: string;
  measured: number[];
  neighbour: number[];
  latitude: number[];
  nbRMSE: number;
}
export interface SubnationalLoo {
  meta: { source: string; metric: string; note: string; nRegions?: number };
  comparison: Array<{ proxy: string; country: number; region: number }>;
  examples: SubnationalLooExample[];
}

// Shared-border adjacency between Admin-1 regions (adm1_code -> adm1_code[]), for the
// region-level neighbour scatter. Built like NeighborsByM49 but over the Admin-1 topology.
export type RegionNeighborsByCode = Map<string, string[]>;
// --- /api/conflicts (ACLED conflict fatalities, runtime) ----------------------------
// Re-exported from the server producer so the route and the roadmap/globe consumers share
// one shape. `cells` are annualised fatalities snapped to the same 0.5° grid the globe
// samples; `byCountry` is the per-country roll-up the Step 6 chart reads. See lib/acled.ts.
export type {
  ConflictsPayload,
  ConflictCell,
  ConflictCountry,
  ConflictDay,
  ConflictDailyStack,
} from "@/lib/acled";

// region key (adm1_code or NUTS_ID) -> rate per 100k, for the choropleth join.
export type RatePer100kByKey = Map<string, number>;
// ISO3 country code -> national rate per 100k, drawn where a region has no subnational rate.
export type RatePer100kByCountry = Map<string, number>;
