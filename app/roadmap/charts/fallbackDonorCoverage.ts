import * as d3 from "d3";
import isoCountries from "i18n-iso-countries";
import type {
  CountryFeature,
  NeighborsByM49,
  SeasonalityData,
  SeasonalityProxies,
  SubnationalSeasonalityRegion,
} from "../types";

export const LATITUDE_DONOR_TOLERANCE_DEGREES = 10;

export interface FallbackDonorCoverage {
  m49: number;
  country: string;
  latitudeDonors: number;
  climateDonors: number;
  climateLabel: string;
  localDonors: number;
  localDonorUnit: "regions" | "countries";
}

function m49ForIso3(iso3: string): number | null {
  const numeric = isoCountries.alpha3ToNumeric(iso3);
  if (!numeric) return null;
  const m49 = Number(numeric);
  return Number.isFinite(m49) ? m49 : null;
}

function countBy<T>(
  values: Iterable<T>,
  keyFor: (value: T) => string | undefined,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = keyFor(value);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

// The runtime map uses a country's own measured Admin-1 curves before it reaches neighbouring
// country curves, so this table reports that same region-first evidence order.
export function buildFallbackDonorCoverage(
  features: CountryFeature[],
  seasonality: SeasonalityData,
  proxies: SeasonalityProxies | null,
  neighborsByM49: NeighborsByM49,
  regions: SubnationalSeasonalityRegion[] = [],
): FallbackDonorCoverage[] {
  const observedIds = new Set(
    Object.entries(seasonality.countries)
      .filter(([, curve]) => curve.length > 0)
      .map(([m49]) => Number(m49)),
  );
  const observedProxyRows = [...observedIds]
    .map((m49) => proxies?.byM49[String(m49)])
    .filter((row): row is NonNullable<typeof row> => row != null);
  const classDonorCounts = countBy(observedProxyRows, (row) => row.kgClass);
  const familyDonorCounts = countBy(observedProxyRows, (row) => row.kgFamily);
  const climate = seasonality.climate;
  const latitudeByM49 = new Map(
    features.map((feature) => [Number(feature.id), d3.geoCentroid(feature)[1]]),
  );
  const latitudeDonors = [...observedIds].flatMap((m49) => {
    const latitude = latitudeByM49.get(m49);
    return latitude == null ? [] : [{ m49, latitude }];
  });
  const measuredRegionsByM49 = new Map<number, SubnationalSeasonalityRegion[]>();
  for (const region of regions) {
    if (region.geo !== "adm1" || region.measurement === "climate-modeled" || !region.curve.length)
      continue;
    const m49 = m49ForIso3(region.country);
    if (m49 == null) continue;
    const members = measuredRegionsByM49.get(m49) ?? [];
    members.push(region);
    measuredRegionsByM49.set(m49, members);
  }

  return features
    .filter((feature) => !observedIds.has(Number(feature.id)))
    .map((feature) => {
      const m49 = Number(feature.id);
      const latitude = latitudeByM49.get(m49) ?? Number.NaN;
      const target = climate?.classByM49[String(m49)];
      const hasClassBlend = Boolean(target && climate?.classCurves[target.class]?.length);
      const hasFamilyBlend = Boolean(target && climate?.familyCurves[target.family]?.length);
      const climateDonors = hasClassBlend
        ? (classDonorCounts.get(target?.class ?? "") ?? 0)
        : hasFamilyBlend
          ? (familyDonorCounts.get(target?.family ?? "") ?? 0)
          : 0;
      const climateLabel = hasClassBlend
        ? `${target?.class} class`
        : hasFamilyBlend
          ? `${target?.family} family`
          : "No climate blend";
      const regionalDonors = measuredRegionsByM49.get(m49)?.length ?? 0;
      const neighboringCountryDonors = (neighborsByM49.get(m49) ?? []).filter((id) =>
        observedIds.has(id),
      ).length;

      return {
        m49,
        country: feature.properties?.name ?? String(feature.id),
        latitudeDonors: latitudeDonors.filter(
          (donor) =>
            Math.sign(donor.latitude) === Math.sign(latitude) &&
            Math.abs(Math.abs(donor.latitude) - Math.abs(latitude)) <=
              LATITUDE_DONOR_TOLERANCE_DEGREES,
        ).length,
        climateDonors,
        climateLabel,
        localDonors: regionalDonors || neighboringCountryDonors,
        localDonorUnit: regionalDonors ? ("regions" as const) : ("countries" as const),
      };
    })
    .sort((left, right) => left.country.localeCompare(right.country));
}
