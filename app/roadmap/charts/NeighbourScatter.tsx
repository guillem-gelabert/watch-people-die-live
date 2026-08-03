"use client";

import { useMemo } from "react";
import * as d3 from "d3";
import { strength } from "../chartHelpers";
import AmplitudeScatter, { type AmplitudePoint } from "./AmplitudeScatter";
import { PROXY } from "./chartFrame";
import type {
  CountryFeature,
  NeighborsByM49,
  RegionNeighborsByCode,
  SeasonalityData,
  SubnationalSeasonalityRegion,
} from "../types";

interface NeighbourScatterProps {
  unified: SeasonalityData | null;
  features: CountryFeature[] | null;
  neighborsByM49: NeighborsByM49 | null;
  regions: SubnationalSeasonalityRegion[] | null;
  regionNeighbors: RegionNeighborsByCode | null;
}

// Amplitude against the mean amplitude of the units that actually share a border with it — real
// shared-border adjacency from the topology, not a distance threshold. A country with no bordering
// donor cannot appear at all, which is the proxy's own limitation and worth stating under the
// figure rather than hiding by dropping the rows silently.
export default function NeighbourScatter({
  unified,
  features,
  neighborsByM49,
  regions,
  regionNeighbors,
}: NeighbourScatterProps) {
  const { points, rings, excluded } = useMemo(() => {
    if (!unified || !features || !neighborsByM49) {
      return { points: [] as AmplitudePoint[], rings: [] as AmplitudePoint[], excluded: 0 };
    }
    const nameById = new Map(features.map((f) => [Number(f.id), f.properties?.name ?? ""]));
    const amplitudeById = new Map(
      Object.entries(unified.countries).map(([id, curve]) => [Number(id), strength(curve)]),
    );

    let skipped = 0;
    const countryPoints: AmplitudePoint[] = [...amplitudeById.entries()].flatMap(
      ([id, amplitude]) => {
        const neighbourAmplitudes = (neighborsByM49.get(id) ?? [])
          .map((n) => amplitudeById.get(n))
          .filter((v): v is number => v != null);
        if (!neighbourAmplitudes.length) {
          skipped += 1;
          return [];
        }
        return [
          {
            name: nameById.get(id) || String(id),
            value: (d3.mean(neighbourAmplitudes) ?? 0) * 100,
            amplitude,
          },
        ];
      },
    );

    // The region-level analog. Partido rows carry no boundary topology, so only Admin-1 regions
    // with a measured bordering donor can enter.
    const bordered = (regions ?? []).filter(
      (r) => r.geo === "adm1" && r.measurement !== "climate-modeled",
    );
    const ampByKey = new Map(bordered.map((r) => [r.key, strength(r.curve)]));
    const regionPoints: AmplitudePoint[] = bordered.flatMap((r) => {
      const nb = (regionNeighbors?.get(r.key) ?? [])
        .map((k) => ampByKey.get(k))
        .filter((v): v is number => v != null);
      if (!nb.length) return [];
      return [
        {
          name: `${r.name} (${r.country})`,
          value: (d3.mean(nb) ?? 0) * 100,
          amplitude: strength(r.curve),
        },
      ];
    });

    return { points: countryPoints, rings: regionPoints, excluded: skipped };
  }, [unified, features, neighborsByM49, regions, regionNeighbors]);

  return (
    <AmplitudeScatter
      id="neighbour-scatter-chart"
      proxyIndex={PROXY.neighbour}
      points={points}
      rings={rings}
      xLabel="mean amplitude of neighbours (%)"
      formatValue={(v) => `neighbours ${v.toFixed(1)}%`}
      formatTick={(v) => `${v}%`}
      ariaLabel="Scatter plot of a unit's seasonal mortality amplitude against the mean amplitude of its bordering neighbours"
      footnote={
        excluded
          ? `${excluded} countries are missing from this chart entirely: no country they border reports a monthly curve, so the proxy has nothing to borrow from.`
          : undefined
      }
      ringLabel="Rings are measured Admin-1 regions against their own bordering regions."
    />
  );
}
