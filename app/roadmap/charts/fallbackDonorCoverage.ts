import * as d3 from "d3";
import isoCountries from "i18n-iso-countries";
import { buildSpatialSeasonality } from "../../../lib/spatial-seasonality";
import type {
  Admin1Feature,
  CountryFeature,
  NeighborsByM49,
  SeasonalityData,
  SeasonalityProxies,
  SubnationalSeasonalityRegion,
} from "../types";

export const LATITUDE_DONOR_TOLERANCE_DEGREES = 10;

export interface FallbackCurveSummary {
  countryDonors: number;
  regionDonors: number;
  amplitude: number | null;
}

export interface FallbackDonorCoverage {
  m49: number;
  country: string;
  latitude: FallbackCurveSummary;
  climate: FallbackCurveSummary & { label: string };
  neighbor: FallbackCurveSummary;
  amplitudeSpread: number | null;
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
    return latitude == null ? [] : [latitude];
  });
  const latitudeRegionDonors = measuredRegions.flatMap((region) => {
    const latitude = latitudeByRegionKey.get(region.key);
    return latitude == null ? [] : [latitude];
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
      const neighborCountryDonors = neighboring.filter((id) => observedIds.has(id)).length;
      const neighborRegionDonors = neighboring.flatMap((id) =>
        observedIds.has(id) ? [] : (measuredRegionsByM49.get(id) ?? []),
      ).length;
      const neighborEstimate = neighborEstimates.get(m49);
      const neighborCurve =
        neighborEstimate?.source === "own-regions" ||
        neighborEstimate?.source === "bordering-countries"
          ? neighborEstimate.curve
          : undefined;
      const latitudeSummary: FallbackCurveSummary = {
        countryDonors: latitudeCountryDonors.filter(
          (donorLatitude) =>
            Math.sign(donorLatitude) === Math.sign(latitude) &&
            Math.abs(Math.abs(donorLatitude) - Math.abs(latitude)) <=
              LATITUDE_DONOR_TOLERANCE_DEGREES,
        ).length,
        regionDonors: latitudeRegionDonors.filter(
          (donorLatitude) =>
            Math.sign(donorLatitude) === Math.sign(latitude) &&
            Math.abs(Math.abs(donorLatitude) - Math.abs(latitude)) <=
              LATITUDE_DONOR_TOLERANCE_DEGREES,
        ).length,
        amplitude: amplitude(latitudeEstimates.get(m49)?.curve),
      };
      const climateSummary = {
        countryDonors: [...observedIds].filter((id) => {
          const donor = proxies?.byM49[String(id)];
          return usesClass
            ? donor?.kgClass === targetClimate?.class
            : usesFamily
              ? donor?.kgFamily === targetClimate?.family
              : false;
        }).length,
        regionDonors: measuredRegions.filter((region) => region.kgFamily === targetClimate?.family)
          .length,
        amplitude:
          climateEstimates.get(m49)?.source === "climate"
            ? amplitude(climateEstimates.get(m49)?.curve)
            : null,
        label: usesClass
          ? `${targetClimate?.class} class`
          : usesFamily
            ? `${targetClimate?.family} family`
            : "No climate blend",
      };
      const neighborSummary: FallbackCurveSummary = {
        countryDonors: ownRegions.length ? 0 : neighborCountryDonors,
        regionDonors: ownRegions.length ? ownRegions.length : neighborRegionDonors,
        amplitude: amplitude(neighborCurve),
      };

      return {
        m49,
        country: feature.properties?.name ?? String(feature.id),
        latitude: latitudeSummary,
        climate: climateSummary,
        neighbor: neighborSummary,
        amplitudeSpread: amplitudeSpread([latitudeSummary, climateSummary, neighborSummary]),
      };
    })
    .sort((left, right) => left.country.localeCompare(right.country));
}
