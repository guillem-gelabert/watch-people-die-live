import * as d3 from "d3";
import isoCountries from "i18n-iso-countries";
import type { Feature, Geometry } from "geojson";

// Population-weighted Köppen climate donor-blends, baked by pipeline/climate_fallback.py
// (data/seasonality-climate-fallback.json). Curves are in a northern-canonical phase; the
// estimator re-phases them for southern-hemisphere targets.
export interface ClimateFallbackModel {
  classCurves: Record<string, number[]>; // Köppen class (e.g. "Cfa") -> blended curve
  familyCurves: Record<string, number[]>; // Köppen family (A–E) -> blended curve
  classByM49: Record<string, { class: string; family: string }>; // target labels
}

export interface SpatialSeasonalityData {
  countries: Record<string, number[]>;
  fallback?: {
    north: number[];
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
  name: string;
  curve: number[];
  annualDeaths: number | null;
}

export type SpatialSeasonalitySource =
  "observed" | "own-regions" | "bordering-countries" | "climate" | "latitude";

export interface SpatialSeasonalityEstimate {
  curve: number[];
  source: SpatialSeasonalitySource;
  donorNames: string[];
}

interface CurveDonor {
  curve: number[];
  weight?: number | null;
}

function meanCurve(donors: CurveDonor[], useAvailableWeights = false): number[] {
  const valid = donors.filter((d) => d.curve.length > 0);
  if (!valid.length) return [];
  const months = Math.min(...valid.map((d) => d.curve.length));
  const canWeight = useAvailableWeights && valid.every((d) => (d.weight ?? 0) > 0);
  const totalWeight = d3.sum(valid, (d) => (canWeight ? (d.weight as number) : 1));
  return d3.range(months).map((month) => {
    const total = d3.sum(
      valid,
      (d) => (d.curve[month] as number) * (canWeight ? (d.weight as number) : 1),
    );
    return total / totalWeight;
  });
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
): number[] {
  if (!fallback?.north.length) return [];
  const absLat = Math.abs(latitude);
  let scale = 0;
  if (fallback.amplitudeCoef && fallback.ampClamp) {
    const [a, b, c] = fallback.amplitudeCoef;
    const [lo, hi] = fallback.ampClamp;
    const targetRms = Math.max(lo, Math.min(hi, a * absLat * absLat + b * absLat + c)) / 100;
    const canonicalRms = Math.sqrt(d3.mean(fallback.north, (value) => (value - 1) ** 2) ?? 0);
    scale = canonicalRms > 0 ? targetRms / canonicalRms : 0;
  } else {
    const tropicMaxAbsLat = fallback.tropicMaxAbsLat ?? 0;
    const plateauAbsLat = fallback.plateauAbsLat ?? tropicMaxAbsLat;
    const span = plateauAbsLat - tropicMaxAbsLat;
    scale = span > 0 ? Math.max(0, Math.min(1, (absLat - tropicMaxAbsLat) / span)) : 0;
  }
  const shift = latitude < 0 ? 6 : 0;
  return fallback.north.map((_, month) => {
    const shape = fallback.north[(month + shift) % fallback.north.length] as number;
    return 1 + scale * (shape - 1);
  });
}

// Population-weighted climate fallback for a country with no measured bordering donor: the
// blended curve of measured countries sharing its Köppen class, else its family. The blends
// are northern-canonical, so re-phase by six months for a southern-hemisphere target.
function climateFallbackCurve(
  id: number,
  latitude: number,
  climate: ClimateFallbackModel | undefined,
): { curve: number[]; label: string } | null {
  const target = climate?.classByM49[String(id)];
  if (!target) return null;
  const byClass = climate.classCurves[target.class];
  const canonical = byClass ?? climate.familyCurves[target.family];
  if (!canonical?.length) return null;
  const curve =
    latitude < 0 ? canonical.map((_, m) => canonical[(m + 6) % 12] as number) : canonical;
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
): Map<number, SpatialSeasonalityEstimate> {
  const featureById = new Map<number, Feature<Geometry>>();
  for (const feature of features) featureById.set(Number(feature.id), feature);

  const regionsByCountry = new Map<number, SpatialSeasonalityRegion[]>();
  for (const region of regions) {
    if (region.geo !== "adm1" || !region.curve.length) continue;
    const m49 = m49ForIso3(region.country);
    if (m49 == null) continue;
    const rows = regionsByCountry.get(m49) ?? [];
    rows.push(region);
    regionsByCountry.set(m49, rows);
  }

  const estimates = new Map<number, SpatialSeasonalityEstimate>();
  for (const [id] of featureById) {
    const own = seasonality.countries[String(id)];
    if (own?.length) {
      estimates.set(id, { curve: own, source: "observed", donorNames: [] });
      continue;
    }
    const ownRegions = regionsByCountry.get(id) ?? [];
    if (ownRegions.length) {
      estimates.set(id, {
        curve: meanCurve(
          ownRegions.map((region) => ({ curve: region.curve, weight: region.annualDeaths })),
          true,
        ),
        source: "own-regions",
        donorNames: ownRegions.map((region) => region.name),
      });
    }
  }

  // Only measured country/region aggregates are donors. Calculated values never cascade
  // through multiple borders, which would make results depend on traversal order.
  const measured = new Map(estimates);
  for (const [id, feature] of featureById) {
    if (estimates.has(id)) continue;
    const bordering = (neighborsByM49.get(id) ?? []).flatMap((neighborId) => {
      const estimate = measured.get(neighborId);
      const neighborFeature = featureById.get(neighborId);
      return estimate && neighborFeature
        ? [{ curve: estimate.curve, name: featureName(neighborFeature) }]
        : [];
    });
    if (bordering.length) {
      estimates.set(id, {
        curve: meanCurve(bordering),
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
    if (curve.length) {
      estimates.set(id, {
        curve,
        source: "latitude",
        donorNames: [`${Math.abs(latitude).toFixed(1)}°${latitude < 0 ? "S" : "N"}`],
      });
    }
  }

  return estimates;
}
