import * as d3 from "d3";
import type { CountryFeature, NeighborsByM49, SeasonalityData, SeasonalityProxies } from "../types";

export const LATITUDE_DONOR_TOLERANCE_DEGREES = 10;

export interface FallbackDonorCoverage {
  m49: number;
  country: string;
  latitudeDonors: number;
  climateDonors: number;
  climateLabel: string;
  neighborDonors: number;
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

// This table deliberately counts only direct national observations. The runtime map may use a
// country's own measured regions before it reaches these proxies, but those are a different
// evidence tier than a climate or neighbouring-country donor.
export function buildFallbackDonorCoverage(
  features: CountryFeature[],
  seasonality: SeasonalityData,
  proxies: SeasonalityProxies | null,
  neighborsByM49: NeighborsByM49,
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
        neighborDonors: (neighborsByM49.get(m49) ?? []).filter((id) => observedIds.has(id)).length,
      };
    })
    .sort((left, right) => left.country.localeCompare(right.country));
}
