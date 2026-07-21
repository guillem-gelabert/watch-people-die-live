"use client";

import { useEffect, useState } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import type { Topology, GeometryCollection, GeometryObject } from "topojson-specification";
import type { AppliedSeasonalityFallbacks, ClimateFallbackModel } from "@/lib/spatial-seasonality";
import type {
  Admin1Feature,
  Admin1Properties,
  ConflictsPayload,
  CountryFeature,
  DensityGrid,
  DeathsPerYearById,
  LooValidation,
  NeighborsByM49,
  Nuts2Feature,
  RateGrid,
  RatePer100kByCountry,
  RatePer100kByKey,
  RegionNeighborsByCode,
  SeasonalityData,
  SeasonalityProxies,
  SubnationalCdr,
  SubnationalLoo,
  SubnationalSeasonality,
} from "./types";

type Status = "loading" | "ready" | "seasonality-error";
type GridStatus = "loading" | "ready" | "error";

interface RoadmapState {
  status: Status;
  features: CountryFeature[] | null;
  neighborsByM49: NeighborsByM49 | null; // shared-border adjacency, for the step-5 neighbour scatter
  seasonality: SeasonalityData | null;
  unified: SeasonalityData | null;
  appliedFallbacks: AppliedSeasonalityFallbacks | null;
  grid: DensityGrid | null;
  gridStatus: GridStatus;
  deathsPerYearById: DeathsPerYearById | null; // Map<m49, number>, for the step-2 centroid chart
  admin1Features: Admin1Feature[] | null; // Natural Earth Admin-1 regions (rest of world)
  nuts2Features: Nuts2Feature[] | null; // Eurostat NUTS-2 regions (Europe, finer layer)
  subnational: SubnationalCdr | null; // subnational rate table + meta (step-5 copy/callouts)
  subnationalSeasonality: SubnationalSeasonality | null; // per-region monthly curves (step-5 region charts)
  subnationalLoo: SubnationalLoo | null; // region-vs-country leave-one-out (step-5 region prediction chart)
  regionNeighbors: RegionNeighborsByCode | null; // Admin-1 shared-border adjacency
  ratePer100kByKey: RatePer100kByKey | null; // region key (adm1_code | NUTS_ID) -> rate per 100k
  ratePer100kByCountry: RatePer100kByCountry | null; // ISO3 -> national rate (fallback fill)
  nutsCountries: Set<string> | null; // ISO3 countries drawn as NUTS (suppress their NE features)
  nutsIso2ToIso3: Map<string, string> | null; // NUTS CNTR_CODE (e.g. "EL","PT") -> ISO3, from data rows
  proxies: SeasonalityProxies | null; // per-country pop65 + Köppen–Geiger family for step-5 scatters
  looValidation: LooValidation | null; // leave-one-out predictions vs actual, for step-5 validation charts
  conflicts: ConflictsPayload | null; // ACLED conflict fatalities (step-6 map), optional
}

interface CountriesTopology extends Topology {
  objects: {
    countries: GeometryCollection;
    land: GeometryObject;
  };
}

interface Admin1Topology extends Topology {
  objects: {
    ne_10m_admin_1: GeometryCollection;
  };
}

interface Nuts2Topology extends Topology {
  objects: {
    nuts2_20m: GeometryCollection;
  };
}

// Mirrors the roadmap IIFE's two-stage Promise.all: seasonality + topojson (+ optional
// unified dataset) first, then density-grid separately (it can fail independently).
export function useRoadmapData(): RoadmapState {
  const [state, setState] = useState<RoadmapState>({
    status: "loading", // "loading" | "ready" | "seasonality-error"
    features: null,
    neighborsByM49: null,
    seasonality: null,
    unified: null,
    appliedFallbacks: null,
    grid: null,
    gridStatus: "loading", // "loading" | "ready" | "error"
    deathsPerYearById: null, // Map<m49, number>, for the step-2 centroid chart
    admin1Features: null,
    nuts2Features: null,
    subnational: null,
    subnationalSeasonality: null,
    subnationalLoo: null,
    regionNeighbors: null,
    ratePer100kByKey: null,
    ratePer100kByCountry: null,
    nutsCountries: null,
    nutsIso2ToIso3: null,
    proxies: null,
    looValidation: null,
    conflicts: null,
  });

  useEffect(() => {
    let cancelled = false;

    // Subnational choropleth (step 5): two geometry layers (Natural Earth Admin-1 worldwide +
    // Eurostat NUTS-2 for Europe) joined to GBD/Eurostat regional rates by region key.
    // Independent of the chains below — can fail/arrive on its own.
    Promise.all([
      d3.json<Admin1Topology>("/data/admin1-10m.json"),
      d3.json<Nuts2Topology>("/data/nuts2-20m.json"),
      d3.json<SubnationalCdr>("/data/subnational-cdr.json"),
      d3.json<SubnationalSeasonality>("/data/seasonality-subnational.json").catch(() => null),
      d3.json<SubnationalLoo>("/data/seasonality-subnational-loo.json").catch(() => null),
    ])
      .then(([adm1Topo, nutsTopo, subnational, subnationalSeasonality, subnationalLoo]) => {
        if (cancelled || !adm1Topo || !nutsTopo || !subnational) return;
        const admin1Features = topojson.feature(adm1Topo, adm1Topo.objects.ne_10m_admin_1)
          .features as Admin1Feature[];
        // Admin-1 shared-border adjacency (adm1_code -> adm1_code[]) straight from the topology's
        // arcs — same method as neighborsByM49, for the region-level neighbour scatter.
        const a1geoms = adm1Topo.objects.ne_10m_admin_1.geometries;
        const a1neighbors = topojson.neighbors(a1geoms);
        const regionNeighbors: RegionNeighborsByCode = new Map(
          a1geoms.map((g, i) => [
            (g.properties as Admin1Properties | undefined)?.adm1_code ?? String(i),
            (a1neighbors[i] ?? [])
              .map((j) => (a1geoms[j]?.properties as Admin1Properties | undefined)?.adm1_code)
              .filter((c): c is string => c != null),
          ]),
        );
        const nuts2Features = topojson.feature(nutsTopo, nutsTopo.objects.nuts2_20m)
          .features as Nuts2Feature[];
        const ratePer100kByKey: RatePer100kByKey = new Map();
        for (const r of subnational.regions) ratePer100kByKey.set(r.key, r.ratePer100k);
        const ratePer100kByCountry: RatePer100kByCountry = new Map(
          Object.entries(subnational.countryRates),
        );
        const nutsCountries = new Set(subnational.meta.nutsCountriesIso3);
        // CNTR_CODE (NUTS 2-letter, e.g. "EL","PT","UK") -> ISO3, learned from the data rows
        // themselves so the alpha-2/alpha-3 irregulars (EL→GRC) come for free. Countries with
        // no NUTS rows (e.g. UK post-Brexit) are absent — which is what lets us drop them.
        const nutsIso2ToIso3 = new Map<string, string>();
        for (const r of subnational.regions) {
          if (r.geo === "nuts2") nutsIso2ToIso3.set(r.key.slice(0, 2), r.country);
        }
        setState((s) => ({
          ...s,
          admin1Features,
          nuts2Features,
          subnational,
          subnationalSeasonality: subnationalSeasonality ?? null,
          subnationalLoo: subnationalLoo ?? null,
          regionNeighbors,
          ratePer100kByKey,
          ratePer100kByCountry,
          nutsCountries,
          nutsIso2ToIso3,
        }));
      })
      .catch((err) => console.error("Could not load subnational data", err));

    // Per-country deaths/year, summed from the SAME baked grid the globe samples
    // (data/rate-grid.json), so the step-2 chart's counts and country coverage match the
    // globe exactly — no live /api/mortality, no drift against the baked snapshot.
    // Independent of the seasonality/topo chain below (can fail/arrive separately).
    d3.json<RateGrid>("/data/rate-grid.json")
      .then((grid) => {
        if (cancelled || !grid?.cells) return;
        const deathsPerYearById: DeathsPerYearById = new Map();
        for (const [, , m49, w] of grid.cells) {
          if (!(w > 0)) continue;
          deathsPerYearById.set(m49, (deathsPerYearById.get(m49) ?? 0) + w);
        }
        setState((s) => ({ ...s, deathsPerYearById }));
      })
      .catch((err) => console.error("Could not load rate grid", err));

    // ACLED conflict fatalities (step 6). Served by the /api/conflicts route (not a static
    // file), refreshed ~daily. Optional — the step degrades to no map if it's empty/unavailable.
    d3.json<ConflictsPayload>("/api/conflicts")
      .then((conflicts) => {
        if (cancelled || !conflicts) return;
        setState((s) => ({ ...s, conflicts }));
      })
      .catch((err) => console.error("Could not load conflict data", err));

    Promise.all([
      d3.json<SeasonalityData>("/data/seasonality.json"),
      d3.json<CountriesTopology>("/data/countries-110m.json"),
      d3.json<SeasonalityData>("/data/seasonality-unified.json").catch(() => null),
      d3.json<SeasonalityProxies>("/data/seasonality-proxies.json").catch(() => null),
      d3.json<LooValidation>("/data/seasonality-loo-validation.json").catch(() => null),
      d3.json<ClimateFallbackModel>("/data/seasonality-climate-fallback.json").catch(() => null),
      d3
        .json<AppliedSeasonalityFallbacks>("/data/seasonality-applied-fallbacks.json")
        .catch(() => null),
    ])
      .then(([seasonality, topo, unified, proxies, looValidation, climate, appliedFallbacks]) => {
        if (cancelled) return null;
        if (!seasonality || !topo) return null;
        // Attach the climate model so the amplitude map's spatial estimator can use its
        // class→family blend for countries with no measured bordering donor.
        if (climate) {
          seasonality.climate = climate;
          if (unified) unified.climate = climate;
        }
        const features = topojson.feature(topo, topo.objects.countries)
          .features as CountryFeature[];
        // Shared-border adjacency, straight from the topology's arcs (not a geometric
        // touches-test on the converted GeoJSON) — exact and free of float-precision gaps.
        const geoms = topo.objects.countries.geometries;
        const neighborIndexes = topojson.neighbors(geoms);
        const neighborsByM49: NeighborsByM49 = new Map(
          geoms.map((g, i) => [
            Number(g.id),
            (neighborIndexes[i] ?? [])
              .map((j) => geoms[j]?.id)
              .filter((id): id is string | number => id != null)
              .map(Number),
          ]),
        );
        setState((s) => ({
          ...s,
          status: "ready",
          features,
          neighborsByM49,
          seasonality,
          unified: unified ?? null,
          appliedFallbacks: appliedFallbacks ?? null,
          proxies: proxies ?? null,
          looValidation: looValidation ?? null,
        }));
        return features;
      })
      .catch((err) => {
        console.error("Could not render seasonality charts", err);
        if (!cancelled) setState((s) => ({ ...s, status: "seasonality-error" }));
        return null;
      })
      .then((features) =>
        d3
          .json<DensityGrid>("/data/density-grid.json")
          .then((grid) => {
            if (!cancelled)
              setState((s) => ({
                ...s,
                grid: grid ?? null,
                gridStatus: "ready",
                features: s.features || features,
              }));
          })
          .catch((err) => {
            console.error("Could not render density map", err);
            if (!cancelled) setState((s) => ({ ...s, gridStatus: "error" }));
          }),
      );

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
