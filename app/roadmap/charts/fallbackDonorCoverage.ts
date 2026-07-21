import * as d3 from "d3";
import isoCountries from "i18n-iso-countries";
import { buildSpatialSeasonality } from "../../../lib/spatial-seasonality";
import { COUNTRY_DONOR_CADENCE_BY_ISO3, type DonorCadence } from "./countryDonorCadence";
import type {
  Admin1Feature,
  CountryFeature,
  NeighborsByM49,
  SeasonalityData,
  SeasonalityProxies,
  SubnationalSeasonalityRegion,
} from "../types";

export const LATITUDE_DONOR_TOLERANCE_DEGREES = 10;

type DonorGeography = "country" | "region";
type FallbackGroup = "Latitude" | "Climate" | "Regional / neighbour";

interface DonorQualityRecord {
  cadence: DonorCadence | null;
  nYears: number | null;
  geography: DonorGeography;
}

export interface DonorQuality {
  cadence: DonorCadence | null;
  medianYears: number | null;
  geography: DonorGeography | null;
}

export interface FallbackCurveSummary {
  countryDonors: number;
  regionDonors: number;
  amplitude: number | null;
  quality: DonorQuality | null;
}

export interface FallbackDonorCoverage {
  m49: number;
  country: string;
  latitude: FallbackCurveSummary;
  climate: FallbackCurveSummary & { label: string };
  neighbor: FallbackCurveSummary;
  amplitudeSpread: number | null;
  highestQualityDonorGroup: { groups: FallbackGroup[]; quality: DonorQuality } | null;
}

function m49ForIso3(iso3: string): number | null {
  const numeric = isoCountries.alpha3ToNumeric(iso3);
  if (!numeric) return null;
  const m49 = Number(numeric);
  return Number.isFinite(m49) ? m49 : null;
}

function amplitude(curve: number[] | undefined): number | null {
  if (!curve?.length) return null;
  return d3.max(curve, (value) => Math.abs(value - 1)) ?? null;
}

function amplitudeSpread(summaries: FallbackCurveSummary[]): number | null {
  const values = summaries.flatMap((summary) =>
    summary.amplitude == null ? [] : [summary.amplitude],
  );
  return values.length >= 2 ? (d3.max(values) as number) - (d3.min(values) as number) : null;
}

function iso3ForM49(m49: number): string | null {
  return isoCountries.numericToAlpha3(String(m49).padStart(3, "0")) ?? null;
}

function countryDonorQuality(m49: number, seasonality: SeasonalityData): DonorQualityRecord {
  const iso3 = iso3ForM49(m49);
  return {
    cadence: iso3 ? (COUNTRY_DONOR_CADENCE_BY_ISO3[iso3] ?? null) : null,
    nYears: seasonality.quality?.[String(m49)]?.nYears ?? null,
    geography: "country",
  };
}

function regionDonorQuality(region: SubnationalSeasonalityRegion): DonorQualityRecord {
  return { cadence: region.interval, nYears: region.nYears, geography: "region" };
}

function summariseDonorQuality(donors: DonorQualityRecord[]): DonorQuality | null {
  if (!donors.length) return null;
  const cadenceRank: Record<DonorCadence, number> = { week: 3, month: 2, quarter: 1 };
  const cadence =
    donors
      .map((donor) => donor.cadence)
      .filter((value): value is DonorCadence => value != null)
      .sort((left, right) => cadenceRank[right] - cadenceRank[left])[0] ?? null;
  const years = donors
    .map((donor) => donor.nYears)
    .filter((value): value is number => value != null && Number.isFinite(value));

  return {
    cadence,
    medianYears: years.length ? (d3.median(years) ?? null) : null,
    geography: donors.some((donor) => donor.geography === "region") ? "region" : "country",
  };
}

function compareDonorQuality(left: DonorQuality, right: DonorQuality): number {
  const cadenceRank: Record<DonorCadence, number> = { week: 3, month: 2, quarter: 1 };
  const cadenceScore = (cadence: DonorCadence | null) => (cadence ? cadenceRank[cadence] : 0);
  const cadenceDifference = cadenceScore(right.cadence) - cadenceScore(left.cadence);
  if (cadenceDifference) return cadenceDifference;
  const yearsDifference = (right.medianYears ?? -1) - (left.medianYears ?? -1);
  if (yearsDifference) return yearsDifference;
  return Number(right.geography === "region") - Number(left.geography === "region");
}

function highestQualityDonorGroup(
  summaries: Array<{ group: FallbackGroup; summary: FallbackCurveSummary }>,
): FallbackDonorCoverage["highestQualityDonorGroup"] {
  const candidates = summaries.filter(
    ({ summary }) => summary.amplitude != null && summary.quality != null,
  ) as Array<{ group: FallbackGroup; summary: FallbackCurveSummary & { quality: DonorQuality } }>;
  if (!candidates.length) return null;
  candidates.sort((left, right) =>
    compareDonorQuality(left.summary.quality, right.summary.quality),
  );
  const winner = candidates[0];
  if (!winner) return null;
  return {
    groups: candidates
      .filter(
        (candidate) => compareDonorQuality(candidate.summary.quality, winner.summary.quality) === 0,
      )
      .map((candidate) => candidate.group),
    quality: winner.summary.quality,
  };
}

// This mirrors the runtime source order for a country without a national curve: own measured
// Admin-1 regions, then directly bordering national or regional country evidence. Latitude and
// climate are also generated independently so their amplitudes can be compared side by side.
export function buildFallbackDonorCoverage(
  features: CountryFeature[],
  seasonality: SeasonalityData,
  proxies: SeasonalityProxies | null,
  neighborsByM49: NeighborsByM49,
  regions: SubnationalSeasonalityRegion[] = [],
  admin1Features: Admin1Feature[] = [],
): FallbackDonorCoverage[] {
  const observedIds = new Set(
    Object.entries(seasonality.countries)
      .filter(([, curve]) => curve.length > 0)
      .map(([m49]) => Number(m49)),
  );
  const latitudeByM49 = new Map(
    features.map((feature) => [Number(feature.id), d3.geoCentroid(feature)[1]]),
  );
  const latitudeByRegionKey = new Map(
    admin1Features.map((feature) => [feature.properties.adm1_code, d3.geoCentroid(feature)[1]]),
  );
  const measuredRegions = regions.filter(
    (region) =>
      region.geo === "adm1" && region.measurement !== "climate-modeled" && region.curve.length,
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
    return latitude == null ? [] : [{ latitude, quality: countryDonorQuality(m49, seasonality) }];
  });
  const latitudeRegionDonors = measuredRegions.flatMap((region) => {
    const latitude = latitudeByRegionKey.get(region.key);
    return latitude == null ? [] : [{ latitude, quality: regionDonorQuality(region) }];
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

  return features
    .filter((feature) => !observedIds.has(Number(feature.id)))
    .map((feature) => {
      const m49 = Number(feature.id);
      const latitude = latitudeByM49.get(m49) ?? Number.NaN;
      const targetClimate = seasonality.climate?.classByM49[String(m49)];
      const usesClass = Boolean(
        targetClimate && seasonality.climate?.classCurves[targetClimate.class]?.length,
      );
      const usesFamily = Boolean(
        targetClimate && seasonality.climate?.familyCurves[targetClimate.family]?.length,
      );
      const ownRegions = measuredRegionsByM49.get(m49) ?? [];
      const neighboring = neighborsByM49.get(m49) ?? [];
      const neighborCountryDonors = neighboring
        .filter((id) => observedIds.has(id))
        .map((id) => countryDonorQuality(id, seasonality));
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
      const climateCountryDonors = [...observedIds].filter((id) => {
        const donor = proxies?.byM49[String(id)];
        return usesClass
          ? donor?.kgClass === targetClimate?.class
          : usesFamily
            ? donor?.kgFamily === targetClimate?.family
            : false;
      });
      const climateRegionDonors = measuredRegions.filter(
        (region) => region.kgFamily === targetClimate?.family,
      );
      const latitudeSummary: FallbackCurveSummary = {
        countryDonors: matchingLatitudeCountries.length,
        regionDonors: matchingLatitudeRegions.length,
        amplitude: amplitude(latitudeEstimates.get(m49)?.curve),
        quality: summariseDonorQuality([
          ...matchingLatitudeCountries.map((donor) => donor.quality),
          ...matchingLatitudeRegions.map((donor) => donor.quality),
        ]),
      };
      const climateSummary = {
        countryDonors: climateCountryDonors.length,
        regionDonors: climateRegionDonors.length,
        amplitude:
          climateEstimates.get(m49)?.source === "climate"
            ? amplitude(climateEstimates.get(m49)?.curve)
            : null,
        quality: summariseDonorQuality([
          ...climateCountryDonors.map((id) => countryDonorQuality(id, seasonality)),
          ...climateRegionDonors.map(regionDonorQuality),
        ]),
        label: usesClass
          ? `${targetClimate?.class} class`
          : usesFamily
            ? `${targetClimate?.family} family`
            : "No climate blend",
      };
      const neighborSummary: FallbackCurveSummary = {
        countryDonors: ownRegions.length ? 0 : neighborCountryDonors.length,
        regionDonors: ownRegions.length ? ownRegions.length : neighborRegionDonors.length,
        amplitude: amplitude(neighborCurve),
        quality: summariseDonorQuality(
          ownRegions.length
            ? ownRegions.map(regionDonorQuality)
            : [...neighborCountryDonors, ...neighborRegionDonors.map(regionDonorQuality)],
        ),
      };

      return {
        m49,
        country: feature.properties?.name ?? String(feature.id),
        latitude: latitudeSummary,
        climate: climateSummary,
        neighbor: neighborSummary,
        amplitudeSpread: amplitudeSpread([latitudeSummary, climateSummary, neighborSummary]),
        highestQualityDonorGroup: highestQualityDonorGroup([
          { group: "Latitude", summary: latitudeSummary },
          { group: "Climate", summary: climateSummary },
          { group: "Regional / neighbour", summary: neighborSummary },
        ]),
      };
    })
    .sort((left, right) => left.country.localeCompare(right.country));
}
