import * as d3 from "d3";
import isoCountries from "i18n-iso-countries";
import { buildSpatialSeasonality } from "./spatial-seasonality";
import { COUNTRY_DONOR_CADENCE_BY_ISO3, type DonorCadence } from "./seasonality-donor-cadence";
import type {
  Admin1Feature,
  CountryFeature,
  NeighborsByM49,
  RegionNeighborsByCode,
  SeasonalityData,
  SeasonalityProxies,
  SubnationalSeasonalityRegion,
} from "../app/roadmap/types";
import {
  isHarmonicCurve,
  meanHarmonicCurves,
  sampleHarmonicCurve,
  shiftHarmonicCurveHalfYear,
  type HarmonicCurve,
} from "./seasonal-curve";

export const LATITUDE_DONOR_TOLERANCE_DEGREES = 10;
export const DONOR_DISTANCE_DECAY_KM = 2_000;
export const CLIMATE_GROUP_DONOR_WEIGHT = 0.75;
export const CLIMATE_METHOD_QUALITY_WEIGHT = 0.0248 / 0.0237;
export const LATITUDE_DONOR_CAP = 5;

const EARTH_RADIUS_KM = 6_371.0088;

const DONOR_CADENCE_WEIGHT: Record<DonorCadence, number> = {
  week: 1,
  month: 0.75,
  quarter: 0.4,
};

export type FallbackGroup = "Latitude" | "Climate" | "Regional / neighbour";
type Centroid = [longitude: number, latitude: number];

export const FALLBACK_PROXY_OVERRIDES: Readonly<Record<string, FallbackGroup>> = {
  "region-CHN-1151": "Climate", // Qinghai
  "region-CHN-1662": "Climate", // Xizang
  "region-CHN-1804": "Climate", // Shaanxi
  "region-CHN-1814": "Climate", // Shandong
  "region-CHN-1828": "Climate", // Jilin
};

// Qinghai and Xizang have dominant Köppen family E, but the measured donor set has no E-family
// curve. Dfb is the closest available cold-climate subgroup and preserves their Climate assignment.
export const FALLBACK_CLIMATE_CLASS_OVERRIDES: Readonly<Record<string, string>> = {
  "region-CHN-1151": "Dfb", // Qinghai
  "region-CHN-1662": "Dfb",
};

interface DonorQualityRecord {
  cadence: DonorCadence | null;
  nYears: number | null;
  centroid: Centroid | null;
  relevanceWeight: number;
}

export interface FallbackCurveSummary {
  qualityAdjustedDonors: number;
  distanceAdjustedDonors: number;
  amplitude: number | null;
  curve: HarmonicCurve | null;
}

export interface FallbackProxyAssignment {
  id: string;
  m49: number;
  country: string;
  isRegional: boolean;
  latitude: FallbackCurveSummary;
  climate: FallbackCurveSummary & { label: string };
  neighbor: FallbackCurveSummary & { donorCoverage: number | null };
  amplitudeSpread: number | null;
  highestQualityDonorGroup: { groups: FallbackGroup[]; score: number } | null;
  appliedProxy: { group: FallbackGroup; score: number; overridden: boolean } | null;
}

function m49ForIso3(iso3: string): number | null {
  const numeric = isoCountries.alpha3ToNumeric(iso3);
  if (!numeric) return null;
  const m49 = Number(numeric);
  return Number.isFinite(m49) ? m49 : null;
}

function amplitude(curve: HarmonicCurve | undefined): number | null {
  return curve
    ? (d3.max(
        sampleHarmonicCurve(
          curve,
          d3.range(720).map((index) => index / 720),
        ),
        (value) => Math.abs(value - 1),
      ) ?? null)
    : null;
}

function amplitudeSpread(summaries: FallbackCurveSummary[]): number | null {
  const values = summaries.flatMap((summary) =>
    summary.amplitude == null ? [] : [summary.amplitude],
  );
  return values.length >= 2 ? (d3.max(values) as number) - (d3.min(values) as number) : null;
}

function meanCurve(curves: HarmonicCurve[]): HarmonicCurve | undefined {
  return meanHarmonicCurves(curves.map((curve) => ({ curve }))) ?? undefined;
}

function inferredClimateClass(
  curve: HarmonicCurve,
  latitude: number,
  family: string | null | undefined,
  climate: SeasonalityData["climate"],
): string | null {
  if (!family || !climate || !isHarmonicCurve(curve)) return null;
  const phases = d3.range(48).map((index) => (index + 0.5) / 48);
  const sampled = sampleHarmonicCurve(curve, phases);
  const candidates = Object.entries(climate.classCurves).filter(([key]) => key.startsWith(family));
  const best = candidates
    .map(([key, canonical]) => {
      const phased = latitude < 0 ? shiftHarmonicCurveHalfYear(canonical) : canonical;
      const prediction = sampleHarmonicCurve(phased, phases);
      const error = Math.sqrt(
        d3.mean(sampled, (value, index) => (value - (prediction[index] ?? 0)) ** 2) ?? 0,
      );
      return { key, error };
    })
    .sort((left, right) => left.error - right.error)[0];
  return best && best.error < 0.0005 ? best.key : null;
}

function iso3ForM49(m49: number): string | null {
  return isoCountries.numericToAlpha3(String(m49).padStart(3, "0")) ?? null;
}

function countryDonorQuality(
  m49: number,
  seasonality: SeasonalityData,
  centroid: Centroid | null,
): DonorQualityRecord {
  const iso3 = iso3ForM49(m49);
  return {
    cadence: iso3 ? (COUNTRY_DONOR_CADENCE_BY_ISO3[iso3] ?? null) : null,
    nYears: seasonality.quality?.[String(m49)]?.nYears ?? null,
    centroid,
    relevanceWeight: 1,
  };
}

function regionDonorQuality(
  region: SubnationalSeasonalityRegion,
  centroid: Centroid | null,
): DonorQualityRecord {
  return { cadence: region.interval, nYears: region.nYears, centroid, relevanceWeight: 1 };
}

function donorQualityScore(donor: DonorQualityRecord): number {
  if (donor.cadence == null || donor.nYears == null || !Number.isFinite(donor.nYears)) return 0;
  return donor.nYears * DONOR_CADENCE_WEIGHT[donor.cadence] * donor.relevanceWeight;
}

function qualityAdjustedDonorCount(donors: DonorQualityRecord[]): number {
  return d3.sum(donors, donorQualityScore);
}

function distanceAdjustedDonorScore(donor: DonorQualityRecord, targetCentroid: Centroid): number {
  if (!donor.centroid) return 0;
  const distanceKm = d3.geoDistance(targetCentroid, donor.centroid) * EARTH_RADIUS_KM;
  return donorQualityScore(donor) * Math.exp(-distanceKm / DONOR_DISTANCE_DECAY_KM);
}

function distanceAdjustedDonorCount(
  donors: DonorQualityRecord[],
  targetCentroid: Centroid,
): number {
  return d3.sum(donors, (donor) => distanceAdjustedDonorScore(donor, targetCentroid));
}

function capDonorPool(
  donors: DonorQualityRecord[],
  targetCentroid: Centroid,
  cap: number,
): DonorQualityRecord[] {
  if (donors.length <= cap) return donors;
  return [...donors]
    .sort(
      (left, right) =>
        distanceAdjustedDonorScore(right, targetCentroid) -
        distanceAdjustedDonorScore(left, targetCentroid),
    )
    .slice(0, cap);
}

function neighborCoverageScore(
  donors: DonorQualityRecord[],
  targetCentroid: Centroid,
  coverage: number | null,
): number {
  if (coverage == null) return 0;
  const usableScores = donors
    .map((donor) => distanceAdjustedDonorScore(donor, targetCentroid))
    .filter((score) => score > 0);
  return coverage * 100 * (d3.mean(usableScores) ?? 0);
}

function highestQualityDonorGroup(
  summaries: Array<{ group: FallbackGroup; summary: FallbackCurveSummary }>,
  climateOutranksLatitude: boolean,
): FallbackProxyAssignment["highestQualityDonorGroup"] {
  const candidates = summaries.filter(
    ({ summary }) => summary.amplitude != null && summary.distanceAdjustedDonors > 0,
  );
  if (!candidates.length) return null;
  const rankedCandidates =
    climateOutranksLatitude && candidates.some((candidate) => candidate.group === "Climate")
      ? candidates.filter((candidate) => candidate.group !== "Latitude")
      : candidates;
  rankedCandidates.sort(
    (left, right) => right.summary.distanceAdjustedDonors - left.summary.distanceAdjustedDonors,
  );
  const winner = rankedCandidates[0];
  if (!winner) return null;
  return {
    groups: rankedCandidates
      .filter(
        (candidate) =>
          Math.abs(
            candidate.summary.distanceAdjustedDonors - winner.summary.distanceAdjustedDonors,
          ) < 1e-9,
      )
      .map((candidate) => candidate.group),
    score: winner.summary.distanceAdjustedDonors,
  };
}

function appliedProxy(
  targetId: string,
  summaries: Array<{ group: FallbackGroup; summary: FallbackCurveSummary }>,
  highestQuality: FallbackProxyAssignment["highestQualityDonorGroup"],
): FallbackProxyAssignment["appliedProxy"] {
  const override = FALLBACK_PROXY_OVERRIDES[targetId];
  if (override) {
    const summary = summaries.find((candidate) => candidate.group === override)?.summary;
    if (summary?.amplitude != null) {
      return { group: override, score: summary.distanceAdjustedDonors, overridden: true };
    }
  }
  const group = highestQuality?.groups[0];
  return group && highestQuality ? { group, score: highestQuality.score, overridden: false } : null;
}

// This mirrors the runtime source order for a country without a national curve: own measured
// Admin-1 regions, then directly bordering national or regional country evidence. Latitude and
// climate are also generated independently so their amplitudes can be compared side by side.
export function buildFallbackProxyAssignments(
  features: CountryFeature[],
  seasonality: SeasonalityData,
  proxies: SeasonalityProxies | null,
  neighborsByM49: NeighborsByM49,
  regions: SubnationalSeasonalityRegion[] = [],
  admin1Features: Admin1Feature[] = [],
  regionNeighbors: RegionNeighborsByCode = new Map(),
): FallbackProxyAssignment[] {
  const observedIds = new Set(
    Object.entries(seasonality.countries)
      .filter(([, curve]) => isHarmonicCurve(curve))
      .map(([m49]) => Number(m49)),
  );
  const centroidByM49 = new Map<number, Centroid>(
    features.map((feature) => [Number(feature.id), d3.geoCentroid(feature) as Centroid]),
  );
  const centroidByRegionKey = new Map<string, Centroid>(
    admin1Features.map((feature) => [
      feature.properties.adm1_code,
      d3.geoCentroid(feature) as Centroid,
    ]),
  );
  const admin1FeatureByKey = new Map(
    admin1Features.map((feature) => [feature.properties.adm1_code, feature]),
  );
  const latitudeByM49 = new Map([...centroidByM49].map(([m49, centroid]) => [m49, centroid[1]]));
  const latitudeByRegionKey = new Map(
    [...centroidByRegionKey].map(([key, centroid]) => [key, centroid[1]]),
  );
  const countryQuality = (m49: number) =>
    countryDonorQuality(m49, seasonality, centroidByM49.get(m49) ?? null);
  const regionQuality = (region: SubnationalSeasonalityRegion) =>
    regionDonorQuality(region, centroidByRegionKey.get(region.key) ?? null);
  const measuredRegions = regions.filter(
    (region) =>
      region.geo === "adm1" &&
      region.measurement !== "climate-modeled" &&
      isHarmonicCurve(region.curve),
  );
  const modeledRegionCountryIds = new Set(
    regions
      .filter((region) => region.geo === "adm1" && region.measurement === "climate-modeled")
      .flatMap((region) => {
        const m49 = m49ForIso3(region.country);
        return m49 == null ? [] : [m49];
      }),
  );
  const measuredRegionsByM49 = new Map<number, SubnationalSeasonalityRegion[]>();
  for (const region of measuredRegions) {
    const m49 = m49ForIso3(region.country);
    if (m49 == null) continue;
    const members = measuredRegionsByM49.get(m49) ?? [];
    members.push(region);
    measuredRegionsByM49.set(m49, members);
  }

  const latitudeCountryDonors = [...observedIds].flatMap((m49) => {
    const latitude = latitudeByM49.get(m49);
    return latitude == null ? [] : [{ latitude, quality: countryQuality(m49) }];
  });
  const latitudeRegionDonors = measuredRegions.flatMap((region) => {
    const latitude = latitudeByRegionKey.get(region.key);
    return latitude == null ? [] : [{ latitude, quality: regionQuality(region) }];
  });
  const spatialRegions = measuredRegions.map((region) => ({
    country: region.country,
    geo: region.geo,
    name: region.name,
    curve: region.curve,
    annualDeaths: region.annualDeaths,
  }));
  const latitudeEstimates = buildSpatialSeasonality(features, new Map(), {
    countries: {},
    fallback: seasonality.fallback,
  });
  const climateEstimates = buildSpatialSeasonality(features, new Map(), {
    countries: {},
    climate: seasonality.climate,
  });
  const neighborEstimates = buildSpatialSeasonality(
    features,
    neighborsByM49,
    { countries: seasonality.countries },
    spatialRegions,
  );

  const countryRows = features
    .filter(
      (feature) =>
        !observedIds.has(Number(feature.id)) && !modeledRegionCountryIds.has(Number(feature.id)),
    )
    .map((feature) => {
      const m49 = Number(feature.id);
      const targetCentroid = centroidByM49.get(m49) as Centroid;
      const latitude = latitudeByM49.get(m49) ?? Number.NaN;
      const targetClimate = seasonality.climate?.classByM49[String(m49)];
      const usesClass = Boolean(
        targetClimate && isHarmonicCurve(seasonality.climate?.classCurves[targetClimate.class]),
      );
      const usesFamily = Boolean(
        targetClimate && isHarmonicCurve(seasonality.climate?.familyCurves[targetClimate.family]),
      );
      const ownRegions = measuredRegionsByM49.get(m49) ?? [];
      const neighboring = neighborsByM49.get(m49) ?? [];
      const neighboringWithData = neighboring.filter(
        (id) => observedIds.has(id) || (measuredRegionsByM49.get(id)?.length ?? 0) > 0,
      ).length;
      const neighborCoverage = ownRegions.length
        ? 1
        : neighboring.length
          ? neighboringWithData / neighboring.length
          : null;
      const neighborCountryDonors = neighboring
        .filter((id) => observedIds.has(id))
        .map(countryQuality);
      const neighborRegionDonors = neighboring.flatMap((id) =>
        observedIds.has(id) ? [] : (measuredRegionsByM49.get(id) ?? []),
      );
      const neighborEstimate = neighborEstimates.get(m49);
      const neighborCurve =
        neighborEstimate?.source === "own-regions" ||
        neighborEstimate?.source === "bordering-countries"
          ? neighborEstimate.curve
          : undefined;
      const matchingLatitudeCountries = latitudeCountryDonors.filter(
        (donorLatitude) =>
          Math.sign(donorLatitude.latitude) === Math.sign(latitude) &&
          Math.abs(Math.abs(donorLatitude.latitude) - Math.abs(latitude)) <=
            LATITUDE_DONOR_TOLERANCE_DEGREES,
      );
      const matchingLatitudeRegions = latitudeRegionDonors.filter(
        (donorLatitude) =>
          Math.sign(donorLatitude.latitude) === Math.sign(latitude) &&
          Math.abs(Math.abs(donorLatitude.latitude) - Math.abs(latitude)) <=
            LATITUDE_DONOR_TOLERANCE_DEGREES,
      );
      const hasClimateBlend = usesClass || usesFamily;
      const climateCountryDonors = [...observedIds].flatMap((id) => {
        const donor = proxies?.byM49[String(id)];
        if (!hasClimateBlend || !targetClimate || donor?.kgFamily !== targetClimate.family)
          return [];
        const relevanceWeight =
          donor.kgClass === targetClimate.class ? 1 : CLIMATE_GROUP_DONOR_WEIGHT;
        return [{ ...countryQuality(id), relevanceWeight }];
      });
      const climateRegionDonors = measuredRegions.flatMap((region) =>
        hasClimateBlend && region.kgFamily === targetClimate?.family
          ? [{ ...regionQuality(region), relevanceWeight: CLIMATE_GROUP_DONOR_WEIGHT }]
          : [],
      );
      const latitudeDonors = capDonorPool(
        [
          ...matchingLatitudeCountries.map((donor) => donor.quality),
          ...matchingLatitudeRegions.map((donor) => donor.quality),
        ],
        targetCentroid,
        LATITUDE_DONOR_CAP,
      );
      const climateDonors = [...climateCountryDonors, ...climateRegionDonors];
      const neighborDonors = ownRegions.length
        ? ownRegions.map(regionQuality)
        : [...neighborCountryDonors, ...neighborRegionDonors.map(regionQuality)];
      const latitudeSummary: FallbackCurveSummary = {
        qualityAdjustedDonors: qualityAdjustedDonorCount(latitudeDonors),
        distanceAdjustedDonors: distanceAdjustedDonorCount(latitudeDonors, targetCentroid),
        amplitude: amplitude(latitudeEstimates.get(m49)?.curve),
        curve: latitudeEstimates.get(m49)?.curve ?? null,
      };
      const climateEstimate = climateEstimates.get(m49);
      const climateSummary = {
        qualityAdjustedDonors: qualityAdjustedDonorCount(climateDonors),
        distanceAdjustedDonors:
          distanceAdjustedDonorCount(climateDonors, targetCentroid) * CLIMATE_METHOD_QUALITY_WEIGHT,
        amplitude: climateEstimate?.source === "climate" ? amplitude(climateEstimate.curve) : null,
        curve: climateEstimate?.source === "climate" ? climateEstimate.curve : null,
        label: usesClass
          ? `${targetClimate?.class} class`
          : usesFamily
            ? `${targetClimate?.family} family`
            : "No climate blend",
      };
      const neighborSummary: FallbackProxyAssignment["neighbor"] = {
        qualityAdjustedDonors: qualityAdjustedDonorCount(neighborDonors),
        distanceAdjustedDonors: neighborCoverageScore(
          neighborDonors,
          targetCentroid,
          neighborCoverage,
        ),
        amplitude: amplitude(neighborCurve),
        curve: neighborCurve ?? null,
        donorCoverage: neighborCoverage,
      };

      const id = `country-${m49}`;
      const candidateGroups = [
        { group: "Latitude" as const, summary: latitudeSummary },
        { group: "Climate" as const, summary: climateSummary },
        { group: "Regional / neighbour" as const, summary: neighborSummary },
      ];
      const highestQuality = highestQualityDonorGroup(candidateGroups, hasClimateBlend);

      return {
        id,
        m49,
        country: feature.properties?.name ?? String(feature.id),
        isRegional: false,
        latitude: latitudeSummary,
        climate: climateSummary,
        neighbor: neighborSummary,
        amplitudeSpread: amplitudeSpread([latitudeSummary, climateSummary, neighborSummary]),
        highestQualityDonorGroup: highestQuality,
        appliedProxy: appliedProxy(id, candidateGroups, highestQuality),
      };
    })
    .sort((left, right) => left.country.localeCompare(right.country));

  const regionalRows = regions
    .filter(
      (region) =>
        region.geo === "adm1" &&
        region.measurement === "climate-modeled" &&
        isHarmonicCurve(region.curve),
    )
    .flatMap((region) => {
      const targetCentroid = centroidByRegionKey.get(region.key);
      const targetFeature = admin1FeatureByKey.get(region.key);
      if (!targetCentroid || !targetFeature) return [];
      const latitude = targetCentroid[1];
      const id = `region-${region.key}`;
      const targetClass =
        FALLBACK_CLIMATE_CLASS_OVERRIDES[id] ??
        inferredClimateClass(region.curve, latitude, region.kgFamily, seasonality.climate);
      const targetFamily = targetClass?.[0] ?? region.kgFamily ?? null;
      const usesClass = Boolean(
        targetClass && isHarmonicCurve(seasonality.climate?.classCurves[targetClass]),
      );
      const usesFamily = Boolean(
        targetFamily && isHarmonicCurve(seasonality.climate?.familyCurves[targetFamily]),
      );
      const hasClimateBlend = usesClass || usesFamily;
      const canonicalClimateCurve = usesClass
        ? seasonality.climate?.classCurves[targetClass as string]
        : usesFamily
          ? seasonality.climate?.familyCurves[targetFamily as string]
          : undefined;
      const climateCurve = canonicalClimateCurve
        ? latitude < 0
          ? shiftHarmonicCurveHalfYear(canonicalClimateCurve)
          : canonicalClimateCurve
        : undefined;
      const latitudeDonors = capDonorPool(
        [
          ...latitudeCountryDonors
            .filter(
              (donor) =>
                Math.sign(donor.latitude) === Math.sign(latitude) &&
                Math.abs(Math.abs(donor.latitude) - Math.abs(latitude)) <=
                  LATITUDE_DONOR_TOLERANCE_DEGREES,
            )
            .map((donor) => donor.quality),
          ...latitudeRegionDonors
            .filter(
              (donor) =>
                Math.sign(donor.latitude) === Math.sign(latitude) &&
                Math.abs(Math.abs(donor.latitude) - Math.abs(latitude)) <=
                  LATITUDE_DONOR_TOLERANCE_DEGREES,
            )
            .map((donor) => donor.quality),
        ],
        targetCentroid,
        LATITUDE_DONOR_CAP,
      );
      const climateDonors = [
        ...[...observedIds].flatMap((id) => {
          const donor = proxies?.byM49[String(id)];
          if (!hasClimateBlend || donor?.kgFamily !== targetFamily) return [];
          return [
            {
              ...countryQuality(id),
              relevanceWeight:
                targetClass && donor.kgClass === targetClass ? 1 : CLIMATE_GROUP_DONOR_WEIGHT,
            },
          ];
        }),
        ...measuredRegions.flatMap((donor) =>
          hasClimateBlend && donor.kgFamily === targetFamily
            ? [{ ...regionQuality(donor), relevanceWeight: CLIMATE_GROUP_DONOR_WEIGHT }]
            : [],
        ),
      ];
      const latitudeCurve = buildSpatialSeasonality([{ ...targetFeature, id: 0 }], new Map(), {
        countries: {},
        fallback: seasonality.fallback,
      }).get(0)?.curve;
      const latitudeSummary: FallbackCurveSummary = {
        qualityAdjustedDonors: qualityAdjustedDonorCount(latitudeDonors),
        distanceAdjustedDonors: distanceAdjustedDonorCount(latitudeDonors, targetCentroid),
        amplitude: amplitude(latitudeCurve),
        curve: latitudeCurve ?? null,
      };
      const climateSummary = {
        qualityAdjustedDonors: qualityAdjustedDonorCount(climateDonors),
        distanceAdjustedDonors:
          distanceAdjustedDonorCount(climateDonors, targetCentroid) * CLIMATE_METHOD_QUALITY_WEIGHT,
        amplitude: amplitude(climateCurve),
        curve: climateCurve ?? null,
        label: usesClass
          ? `${targetClass} class`
          : usesFamily
            ? `${targetFamily} family`
            : "No climate blend",
      };
      const neighboringRegionFeatures = (regionNeighbors.get(region.key) ?? [])
        .map((key) => admin1FeatureByKey.get(key))
        .filter((feature): feature is Admin1Feature =>
          Boolean(feature && feature.properties.adm0_a3 !== region.country),
        );
      const regionsByNeighborCountry = new Map<string, SubnationalSeasonalityRegion[]>();
      for (const feature of neighboringRegionFeatures) {
        const donor = measuredRegions.find(
          (candidate) => candidate.key === feature.properties.adm1_code,
        );
        if (!donor) continue;
        const rows = regionsByNeighborCountry.get(donor.country) ?? [];
        rows.push(donor);
        regionsByNeighborCountry.set(donor.country, rows);
      }
      const neighboringCountries = new Set(
        neighboringRegionFeatures
          .map((feature) => feature.properties.adm0_a3)
          .filter((iso3) => m49ForIso3(iso3) != null),
      );
      const coveredNeighborCountries = [...neighboringCountries].filter((iso3) => {
        const m49 = m49ForIso3(iso3);
        return regionsByNeighborCountry.has(iso3) || (m49 != null && observedIds.has(m49));
      });
      const neighborDonors = coveredNeighborCountries.flatMap((iso3) => {
        const directRegions = regionsByNeighborCountry.get(iso3) ?? [];
        if (directRegions.length) return directRegions.map(regionQuality);
        const m49 = m49ForIso3(iso3);
        return m49 != null && observedIds.has(m49) ? [countryQuality(m49)] : [];
      });
      const neighborCurves = coveredNeighborCountries.flatMap((iso3) => {
        const directRegions = regionsByNeighborCountry.get(iso3) ?? [];
        if (directRegions.length) return directRegions.map((donor) => donor.curve);
        const m49 = m49ForIso3(iso3);
        const curve = m49 == null ? undefined : seasonality.countries[String(m49)];
        return isHarmonicCurve(curve) ? [curve] : [];
      });
      const neighborCurve = meanCurve(neighborCurves);
      const neighborSummary: FallbackProxyAssignment["neighbor"] = {
        qualityAdjustedDonors: qualityAdjustedDonorCount(neighborDonors),
        distanceAdjustedDonors: neighborCoverageScore(
          neighborDonors,
          targetCentroid,
          neighboringCountries.size
            ? coveredNeighborCountries.length / neighboringCountries.size
            : null,
        ),
        amplitude: amplitude(neighborCurve),
        curve: neighborCurve ?? null,
        donorCoverage: neighboringCountries.size
          ? coveredNeighborCountries.length / neighboringCountries.size
          : null,
      };
      const candidateGroups = [
        { group: "Latitude" as const, summary: latitudeSummary },
        { group: "Climate" as const, summary: climateSummary },
        { group: "Regional / neighbour" as const, summary: neighborSummary },
      ];
      const highestQuality = highestQualityDonorGroup(candidateGroups, hasClimateBlend);

      return [
        {
          id,
          m49: m49ForIso3(region.country) ?? -1,
          country: `${{ CHN: "China", IND: "India" }[region.country] ?? region.country} — ${region.name}`,
          isRegional: true,
          latitude: latitudeSummary,
          climate: climateSummary,
          neighbor: neighborSummary,
          amplitudeSpread: amplitudeSpread([latitudeSummary, climateSummary, neighborSummary]),
          highestQualityDonorGroup: highestQuality,
          appliedProxy: appliedProxy(id, candidateGroups, highestQuality),
        },
      ];
    });

  return [...countryRows, ...regionalRows].sort((left, right) =>
    left.country.localeCompare(right.country),
  );
}
