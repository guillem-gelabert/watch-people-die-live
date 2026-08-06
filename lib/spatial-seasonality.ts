import * as d3 from "d3";
import isoCountries from "i18n-iso-countries";
import type { Feature, Geometry } from "geojson";
import {
  harmonicRms,
  isHarmonicCurve,
  meanHarmonicCurves,
  scaleHarmonicAmplitude,
  shiftHarmonicCurveHalfYear,
  type HarmonicCurve,
} from "./seasonal-curve";

// Population-weighted Köppen climate donor-blends, baked by pipeline/climate_fallback.py
// (data/seasonality-climate-fallback.json). Curves are in a northern-canonical phase; the
// estimator re-phases them for southern-hemisphere targets.
export interface ClimateFallbackModel {
  classCurves: Record<string, HarmonicCurve>; // Köppen class (e.g. "Cfa") -> blended curve
  familyCurves: Record<string, HarmonicCurve>; // Köppen family (A–E) -> blended curve
  classByM49: Record<string, { class: string; family: string }>; // target labels
}

export interface SpatialSeasonalityData {
  countries: Record<string, HarmonicCurve>;
  fallback?: {
    north: HarmonicCurve;
    tropicMaxAbsLat?: number;
    plateauAbsLat?: number;
    amplitudeCoef?: [number, number, number];
    ampClamp?: [number, number];
  };
  climate?: ClimateFallbackModel;
}

export interface SpatialSeasonalityRegion {
  country: string;
  geo: string;
  key?: string;
  name: string;
  curve: HarmonicCurve;
  annualDeaths: number | null;
  measurement?: string;
}

export type SpatialSeasonalitySource =
  "observed" | "own-regions" | "bordering-countries" | "climate" | "latitude";

export interface SpatialSeasonalityEstimate {
  curve: HarmonicCurve;
  source: SpatialSeasonalitySource;
  donorNames: string[];
}

export interface AppliedFallbackCurve {
  curve: HarmonicCurve;
  source: Extract<SpatialSeasonalitySource, "bordering-countries" | "climate" | "latitude">;
  proxy: "Regional / neighbour" | "Climate" | "Latitude";
  overridden?: boolean;
}

export interface AppliedSeasonalityFallbacks {
  meta: Record<string, unknown>;
  countries: Record<string, AppliedFallbackCurve>;
  regions: Record<string, AppliedFallbackCurve>;
}

interface CurveDonor {
  curve: HarmonicCurve;
  weight?: number | null;
}

function meanCurve(donors: CurveDonor[], useAvailableWeights = false): HarmonicCurve | null {
  return meanHarmonicCurves(donors, useAvailableWeights);
}

function featureName(feature: Feature<Geometry>): string {
  const properties = feature.properties as { name?: unknown } | null;
  return typeof properties?.name === "string" ? properties.name : String(feature.id ?? "Unknown");
}

function m49ForIso3(iso3: string): number | null {
  const numeric = isoCountries.alpha3ToNumeric(iso3);
  if (!numeric) return null;
  const m49 = Number(numeric);
  return Number.isFinite(m49) ? m49 : null;
}

function latitudeFallbackCurve(
  latitude: number,
  fallback: SpatialSeasonalityData["fallback"],
): HarmonicCurve | null {
  if (!fallback || !isHarmonicCurve(fallback.north)) return null;
  const absLat = Math.abs(latitude);
  let scale = 0;
  if (fallback.amplitudeCoef && fallback.ampClamp) {
    const [a, b, c] = fallback.amplitudeCoef;
    const [lo, hi] = fallback.ampClamp;
    const targetRms = Math.max(lo, Math.min(hi, a * absLat * absLat + b * absLat + c)) / 100;
    const canonicalRms = harmonicRms(fallback.north);
    scale = canonicalRms > 0 ? targetRms / canonicalRms : 0;
  } else {
    const tropicMaxAbsLat = fallback.tropicMaxAbsLat ?? 0;
    const plateauAbsLat = fallback.plateauAbsLat ?? tropicMaxAbsLat;
    const span = plateauAbsLat - tropicMaxAbsLat;
    scale = span > 0 ? Math.max(0, Math.min(1, (absLat - tropicMaxAbsLat) / span)) : 0;
  }
  const curve = scaleHarmonicAmplitude(fallback.north, scale);
  return latitude < 0 ? shiftHarmonicCurveHalfYear(curve) : curve;
}

// Population-weighted climate fallback for a country with no measured bordering donor: the
// blended curve of measured countries sharing its Köppen class, else its family. The blends
// are northern-canonical, so re-phase by six months for a southern-hemisphere target.
function climateFallbackCurve(
  id: number,
  latitude: number,
  climate: ClimateFallbackModel | undefined,
): { curve: HarmonicCurve; label: string } | null {
  const target = climate?.classByM49[String(id)];
  if (!target) return null;
  const byClass = climate.classCurves[target.class];
  const canonical = byClass ?? climate.familyCurves[target.family];
  if (!isHarmonicCurve(canonical)) return null;
  const curve = latitude < 0 ? shiftHarmonicCurveHalfYear(canonical) : canonical;
  return { curve, label: byClass ? `${target.class} climate` : `${target.family} climate` };
}

// Builds one curve per country. Direct observations win, followed by a death-weighted
// aggregate of the country's measured Admin-1 curves and the plain mean of directly
// bordering countries with either kind of measurement. A population-weighted climate blend
// then covers countries with no measured bordering donor, and latitude is the final fallback.
export function buildSpatialSeasonality(
  features: Feature<Geometry>[],
  neighborsByM49: ReadonlyMap<number, readonly number[]>,
  seasonality: SpatialSeasonalityData,
  regions: SpatialSeasonalityRegion[] = [],
  appliedFallbacks?: AppliedSeasonalityFallbacks | null,
): Map<number, SpatialSeasonalityEstimate> {
  const featureById = new Map<number, Feature<Geometry>>();
  for (const feature of features) featureById.set(Number(feature.id), feature);

  const regionsByCountry = new Map<number, SpatialSeasonalityRegion[]>();
  for (const region of regions) {
    if (region.geo !== "adm1" || !isHarmonicCurve(region.curve)) continue;
    const m49 = m49ForIso3(region.country);
    if (m49 == null) continue;
    const rows = regionsByCountry.get(m49) ?? [];
    const applied = region.key ? appliedFallbacks?.regions[region.key] : undefined;
    rows.push(applied ? { ...region, curve: applied.curve } : region);
    regionsByCountry.set(m49, rows);
  }

  const estimates = new Map<number, SpatialSeasonalityEstimate>();
  for (const [id] of featureById) {
    const own = seasonality.countries[String(id)];
    if (isHarmonicCurve(own)) {
      estimates.set(id, { curve: own, source: "observed", donorNames: [] });
      continue;
    }
    const ownRegions = regionsByCountry.get(id) ?? [];
    if (ownRegions.length) {
      const curve = meanCurve(
        ownRegions.map((region) => ({ curve: region.curve, weight: region.annualDeaths })),
        true,
      );
      if (!curve) continue;
      estimates.set(id, {
        curve,
        source: "own-regions",
        donorNames: ownRegions.map((region) => region.name),
      });
    }
  }

  // Only measured country/region aggregates are donors. Calculated values never cascade
  // through multiple borders, which would make results depend on traversal order.
  const measured = new Map(estimates);
  for (const [id, feature] of featureById) {
    if (isHarmonicCurve(seasonality.countries[String(id)])) continue;
    const applied = appliedFallbacks?.countries[String(id)];
    if (applied && isHarmonicCurve(applied.curve)) {
      estimates.set(id, {
        curve: applied.curve,
        source: applied.source,
        donorNames: [`applied ${applied.proxy.toLowerCase()} proxy`],
      });
      continue;
    }
    if (estimates.has(id)) continue;
    const bordering = (neighborsByM49.get(id) ?? []).flatMap((neighborId) => {
      const estimate = measured.get(neighborId);
      const neighborFeature = featureById.get(neighborId);
      return estimate && neighborFeature
        ? [{ curve: estimate.curve, name: featureName(neighborFeature) }]
        : [];
    });
    if (bordering.length) {
      const curve = meanCurve(bordering);
      if (!curve) continue;
      estimates.set(id, {
        curve,
        source: "bordering-countries",
        donorNames: bordering.map((donor) => donor.name),
      });
      continue;
    }

    const latitude = d3.geoCentroid(feature)[1];

    const climate = climateFallbackCurve(id, latitude, seasonality.climate);
    if (climate) {
      estimates.set(id, { curve: climate.curve, source: "climate", donorNames: [climate.label] });
      continue;
    }

    const curve = latitudeFallbackCurve(latitude, seasonality.fallback);
    if (curve) {
      estimates.set(id, {
        curve,
        source: "latitude",
        donorNames: [`${Math.abs(latitude).toFixed(1)}°${latitude < 0 ? "S" : "N"}`],
      });
    }
  }

  return estimates;
}
