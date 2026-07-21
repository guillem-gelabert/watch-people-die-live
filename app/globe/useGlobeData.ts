"use client";

import { useEffect, useState } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { Feature, Geometry } from "geojson";
import { initPersona } from "./persona";
import type { ConflictsPayload } from "@/lib/acled";
import {
  buildSpatialSeasonality,
  type AppliedSeasonalityFallbacks,
  type ClimateFallbackModel,
  type SpatialSeasonalityData,
  type SpatialSeasonalityRegion,
} from "@/lib/spatial-seasonality";

const FLAT_SEASON = new Array<number>(12).fill(1);

// Emphasis multiplier for the ACLED conflict layer. 1.0 folds annualised conflict fatalities
// in at face value (they already share the grid's deaths/year unit); raise it to make active
// conflict zones stand out more than their raw share of global mortality.
const CONFLICT_WEIGHT = 1.0;

// The combined grid baked offline by notebooks/combine.ipynb: one row per populated
// cell, `w` already folding in population x country death rate (see
// docs/DENSITY-MORTALITY-JOIN.md and the grid-layer architecture notes). Seasonality is
// the one remaining "browser" layer (see notebooks/lib/grid.py's module docstring for
// the precomputed/server/browser locus model) — it's applied here at sample time.
interface RateGrid {
  meta: {
    year: number;
    sources: string[];
    baseRatePerPersonYear: number;
    totalDeathsPerYear: number;
  };
  names: Record<string, string>;
  cellsize: number;
  cells: [lon: number, lat: number, m49: number, w: number][];
}

interface Seasonality extends SpatialSeasonalityData {
  source: string;
  method: string;
  months: number;
}

interface SubnationalSeasonality {
  regions: SpatialSeasonalityRegion[];
}

export interface GeoPayload {
  lat: number | null;
  lon: number | null;
  name: string | null;
  source: string;
}

export interface Sampler {
  sampleCell: () => [lon: number, lat: number, m49: number];
  total: number;
}

export interface GlobeData {
  error: boolean;
  nameById: Map<number, string>;
  buildSampler: (month: number) => Sampler;
}

type GlobeDataState = GlobeData | { error: true } | null;

// Fetches and derives everything the render loop needs: the combined rate grid, country
// adjacency for spatial seasonality estimates, and the persona tables. Replaces the old per-country
// blinkById/densityLonLat split with one global weighted sampler.
export function useGlobeData(): { data: GlobeDataState; geo: GeoPayload | null } {
  const [data, setData] = useState<GlobeDataState>(null); // null = loading
  const [geo, setGeo] = useState<GeoPayload | null>(null); // resolves independently, doesn't block the globe

  useEffect(() => {
    let cancelled = false;

    const geoReady = fetch("/api/geo")
      .then((r) => r.json() as Promise<GeoPayload>)
      .catch(() => null);
    geoReady.then((g) => !cancelled && setGeo(g));

    (async () => {
      let topo: Topology,
        grid: RateGrid,
        seasonality: Seasonality | null | undefined,
        subnationalSeasonality: SubnationalSeasonality | null | undefined,
        climate: ClimateFallbackModel | null | undefined,
        appliedFallbacks: AppliedSeasonalityFallbacks | null | undefined,
        conflicts: ConflictsPayload | null | undefined;
      try {
        [topo, grid, , seasonality, subnationalSeasonality, climate, appliedFallbacks, conflicts] =
          await Promise.all([
            d3.json<Topology>("/data/countries-110m.json") as Promise<Topology>,
            d3.json<RateGrid>("/data/rate-grid.json") as Promise<RateGrid>,
            initPersona(),
            d3.json<Seasonality>("/data/seasonality.json").catch(() => null),
            d3.json<SubnationalSeasonality>("/data/seasonality-subnational.json").catch(() => null),
            d3
              .json<ClimateFallbackModel>("/data/seasonality-climate-fallback.json")
              .catch(() => null),
            d3
              .json<AppliedSeasonalityFallbacks>("/data/seasonality-applied-fallbacks.json")
              .catch(() => null),
            d3.json<ConflictsPayload>("/api/conflicts").catch(() => null),
          ]);
      } catch (err) {
        console.error("Failed to load data:", err);
        if (!cancelled) setData({ error: true });
        return;
      }
      if (cancelled) return;

      // Country names are embedded in the baked grid (from the CDR snapshot), so the
      // runtime is fully self-contained — no live /api/mortality fetch. Only countries
      // with grid weight can fire, and every one of those has a name here.
      const nameById = new Map<number, string>();
      for (const [id, name] of Object.entries(grid.names)) nameById.set(Number(id), name);

      // world-atlas's TopoJSON always has a "countries" GeometryCollection.
      const countriesObject = topo.objects.countries as NonNullable<typeof topo.objects.countries>;
      const countryFeatures = topojson.feature(topo, countriesObject) as unknown as {
        features: Feature<Geometry>[];
      };
      const countryGeometries = (countriesObject as GeometryCollection).geometries;
      const neighborIndexes = topojson.neighbors(countryGeometries);
      const neighborsByM49 = new Map<number, number[]>(
        countryGeometries.map((geometry, index) => [
          Number(geometry.id),
          (neighborIndexes[index] ?? [])
            .map((neighborIndex) => countryGeometries[neighborIndex]?.id)
            .filter((id): id is string | number => id != null)
            .map(Number),
        ]),
      );
      if (seasonality && climate) seasonality.climate = climate;
      const spatialSeasonality = seasonality
        ? buildSpatialSeasonality(
            countryFeatures.features,
            neighborsByM49,
            seasonality,
            subnationalSeasonality?.regions ?? [],
            appliedFallbacks,
          )
        : new Map();

      // A country's own 12-month curve if it reported one; otherwise its spatial estimate
      // from measured regions or bordering countries, then latitude when neither exists.
      const seasonalCurveCache = new Map<number, number[]>();
      function seasonalCurve(m49: number): number[] {
        const cached = seasonalCurveCache.get(m49);
        if (cached) return cached;
        const curve = spatialSeasonality.get(m49)?.curve ?? FLAT_SEASON;
        seasonalCurveCache.set(m49, curve);
        return curve;
      }

      const cs = grid.cellsize;
      const n = grid.cells.length;
      const lonArr = new Float64Array(n);
      const latArr = new Float64Array(n);
      const m49Arr = new Int32Array(n);
      const baseW = new Float64Array(n);
      const conflictW = new Float64Array(n);

      // Annualised conflict fatalities (from /api/conflicts) keyed by the grid cell they fall
      // in. Re-snap with THIS grid's cellsize so the join stays correct even if the route's
      // aggregation resolution and the grid ever drift apart.
      const conflictByCell = new Map<string, number>();
      if (conflicts?.cells?.length) {
        for (const [lon, lat, f] of conflicts.cells) {
          const key = `${Math.floor(lon / cs) * cs},${Math.floor(lat / cs) * cs}`;
          conflictByCell.set(key, (conflictByCell.get(key) ?? 0) + f);
        }
      }

      let foldedConflict = 0;
      grid.cells.forEach(([lon, lat, m49, w], i) => {
        lonArr[i] = lon;
        latArr[i] = lat;
        m49Arr[i] = m49;
        baseW[i] = w;
        const f = conflictByCell.get(`${lon},${lat}`);
        if (f) {
          conflictW[i] = f;
          foldedConflict += f;
        }
      });

      // Conflict fatalities in cells with no population entry can't be placed (the sampler needs
      // a real country per cell), so they're dropped — report how much, never silently.
      if (conflicts?.cells?.length) {
        const totalConflict = conflicts.cells.reduce((s, [, , f]) => s + f, 0);
        const dropped = totalConflict - foldedConflict;
        if (dropped > 1) {
          console.info(
            `Conflict layer: folded ${Math.round(foldedConflict)} of ${Math.round(totalConflict)} annualised fatalities/yr into the grid (${Math.round(dropped)} in unpopulated cells dropped).`,
          );
        }
      }

      // Rebuilt on init and whenever the UTC month changes (~12x/year): the seasonal
      // multiplier shifts weight toward/away from each country, so both the per-cell
      // cumulative distribution AND the global total (hence the Poisson mean) change.
      function buildSampler(month: number): Sampler {
        const cum = new Float64Array(n);
        let sum = 0;
        for (let i = 0; i < n; i++) {
          const w = baseW[i] as number;
          if (w > 0) sum += w * (seasonalCurve(m49Arr[i] as number)[month] as number);
          // Conflict weight is added flat (unseasoned) — conflicts don't follow the winter
          // mortality curve — on top of the cell's seasonal baseline.
          const cw = conflictW[i] as number;
          if (cw > 0) sum += cw * CONFLICT_WEIGHT;
          cum[i] = sum;
        }
        const total = sum;

        function sampleCell(): [number, number, number] {
          const r = Math.random() * total;
          let lo = 0;
          let hi = n - 1;
          while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if ((cum[mid] as number) < r) lo = mid + 1;
            else hi = mid;
          }
          return [
            (lonArr[lo] as number) + Math.random() * cs,
            (latArr[lo] as number) + Math.random() * cs,
            m49Arr[lo] as number,
          ];
        }

        return { sampleCell, total };
      }

      setData({ error: false, nameById, buildSampler });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, geo };
}
