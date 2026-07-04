"use client";

import { useEffect, useState } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import type { Topology, GeometryCollection, GeometryObject } from "topojson-specification";
import type {
  CountryFeature,
  DensityGrid,
  DeathsPerYearById,
  RateGrid,
  SeasonalityData,
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
}

interface CountriesTopology extends Topology {
  objects: {
    countries: GeometryCollection;
    land: GeometryObject;
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
  });

  useEffect(() => {
    let cancelled = false;

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
