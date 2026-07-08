"use client";

import { useEffect, useState } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import type { Topology, GeometryCollection, GeometryObject } from "topojson-specification";
import type {
  Admin1Feature,
  CountryFeature,
  DensityGrid,
  DeathsPerYearById,
  Nuts2Feature,
  RateGrid,
  RatePer100kByCountry,
  RatePer100kByKey,
  SeasonalityData,
  SubnationalCdr,
} from "./types";

type Status = "loading" | "ready" | "seasonality-error";
type GridStatus = "loading" | "ready" | "error";

interface RoadmapState {
  status: Status;
  features: CountryFeature[] | null;
  seasonality: SeasonalityData | null;
  unified: SeasonalityData | null;
  grid: DensityGrid | null;
  gridStatus: GridStatus;
  deathsPerYearById: DeathsPerYearById | null; // Map<m49, number>, for the step-2 centroid chart
  admin1Features: Admin1Feature[] | null; // Natural Earth Admin-1 regions (rest of world)
  nuts2Features: Nuts2Feature[] | null; // Eurostat NUTS-2 regions (Europe, finer layer)
  subnational: SubnationalCdr | null; // subnational rate table + meta (step-5 copy/callouts)
  ratePer100kByKey: RatePer100kByKey | null; // region key (adm1_code | NUTS_ID) -> rate per 100k
  ratePer100kByCountry: RatePer100kByCountry | null; // ISO3 -> national rate (fallback fill)
  nutsCountries: Set<string> | null; // ISO3 countries drawn as NUTS (suppress their NE features)
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
    seasonality: null,
    unified: null,
    grid: null,
    gridStatus: "loading", // "loading" | "ready" | "error"
    deathsPerYearById: null, // Map<m49, number>, for the step-2 centroid chart
    admin1Features: null,
    nuts2Features: null,
    subnational: null,
    ratePer100kByKey: null,
    ratePer100kByCountry: null,
    nutsCountries: null,
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
    ])
      .then(([adm1Topo, nutsTopo, subnational]) => {
        if (cancelled || !adm1Topo || !nutsTopo || !subnational) return;
        const admin1Features = topojson.feature(adm1Topo, adm1Topo.objects.ne_10m_admin_1)
          .features as Admin1Feature[];
        const nuts2Features = topojson.feature(nutsTopo, nutsTopo.objects.nuts2_20m)
          .features as Nuts2Feature[];
        const ratePer100kByKey: RatePer100kByKey = new Map();
        for (const r of subnational.regions) ratePer100kByKey.set(r.key, r.ratePer100k);
        const ratePer100kByCountry: RatePer100kByCountry = new Map(
          Object.entries(subnational.countryRates),
        );
        const nutsCountries = new Set(subnational.meta.nutsCountriesIso3);
        setState((s) => ({
          ...s,
          admin1Features,
          nuts2Features,
          subnational,
          ratePer100kByKey,
          ratePer100kByCountry,
          nutsCountries,
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

    Promise.all([
      d3.json<SeasonalityData>("/data/seasonality.json"),
      d3.json<CountriesTopology>("/data/countries-110m.json"),
      d3.json<SeasonalityData>("/data/seasonality-unified.json").catch(() => null),
    ])
      .then(([seasonality, topo, unified]) => {
        if (cancelled) return null;
        if (!seasonality || !topo) return null;
        const features = topojson.feature(topo, topo.objects.countries)
          .features as CountryFeature[];
        setState((s) => ({
          ...s,
          status: "ready",
          features,
          seasonality,
          unified: unified ?? null,
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
