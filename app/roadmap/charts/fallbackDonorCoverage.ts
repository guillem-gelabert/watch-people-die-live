import type { CountryFeature, NeighborsByM49, SeasonalityData, SeasonalityProxies } from "../types";

export interface FallbackDonorCoverage {
  m49: number;
  country: string;
  latitudeDonors: 0;
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

  return features
    .filter((feature) => !observedIds.has(Number(feature.id)))
    .map((feature) => {
      const m49 = Number(feature.id);
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
        latitudeDonors: 0 as const,
        climateDonors,
        climateLabel,
        neighborDonors: (neighborsByM49.get(m49) ?? []).filter((id) => observedIds.has(id)).length,
      };
    })
    .sort((left, right) => left.country.localeCompare(right.country));
}
