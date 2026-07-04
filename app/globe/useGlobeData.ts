"use client";

import { useEffect, useState } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import type { Topology } from "topojson-specification";
import type { Feature, Geometry } from "geojson";
import { initPersona } from "./persona";

const FLAT_SEASON = new Array<number>(12).fill(1);

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

interface Seasonality {
  source: string;
  method: string;
  months: number;
  countries: Record<string, number[]>;
  fallback: { north: number[]; tropicMaxAbsLat: number; plateauAbsLat: number };
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
// centroids (for the seasonal latitude fallback only — no per-country simulation state
// lives here anymore), and the persona tables. Replaces the old per-country
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
      let topo: Topology, grid: RateGrid, seasonality: Seasonality | null | undefined;
      try {
        [topo, grid, , seasonality] = await Promise.all([
          d3.json<Topology>("/data/countries-110m.json") as Promise<Topology>,
          d3.json<RateGrid>("/data/rate-grid.json") as Promise<RateGrid>,
          initPersona(),
          d3.json<Seasonality>("/data/seasonality.json").catch(() => null),
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
      const featureById = new Map<number, Feature<Geometry>>();
      for (const f of countryFeatures.features) featureById.set(Number(f.id), f);

      // A country's own 12-month curve if it reported one, otherwise a latitude-scaled
      // version of the canonical northern-winter curve. Computed once per country (the
      // curve itself doesn't change through a session, only which month indexes into it).
      const seasonalCurveCache = new Map<number, number[]>();
      function seasonalCurve(m49: number): number[] {
        const cached = seasonalCurveCache.get(m49);
        if (cached) return cached;
        let curve = FLAT_SEASON;
        if (seasonality) {
          const own = seasonality.countries[m49];
          if (own) {
            curve = own;
          } else {
            const feature = featureById.get(m49);
            const lat = feature ? d3.geoCentroid(feature)[1] : 0;
            const { north, tropicMaxAbsLat, plateauAbsLat } = seasonality.fallback;
            const t = Math.min(
              1,
              Math.max(0, (Math.abs(lat) - tropicMaxAbsLat) / (plateauAbsLat - tropicMaxAbsLat)),
            );
            const shift = lat < 0 ? 6 : 0;
            curve = north.map((_, m) => {
              const shape = north[(m + shift) % 12] as number;
              return 1 + t * (shape - 1);
            });
          }
        }
        seasonalCurveCache.set(m49, curve);
        return curve;
      }

      const cs = grid.cellsize;
      const n = grid.cells.length;
      const lonArr = new Float64Array(n);
      const latArr = new Float64Array(n);
      const m49Arr = new Int32Array(n);
      const baseW = new Float64Array(n);
      grid.cells.forEach(([lon, lat, m49, w], i) => {
        lonArr[i] = lon;
        latArr[i] = lat;
        m49Arr[i] = m49;
        baseW[i] = w;
      });

      // Rebuilt on init and whenever the UTC month changes (~12x/year): the seasonal
      // multiplier shifts weight toward/away from each country, so both the per-cell
      // cumulative distribution AND the global total (hence the Poisson mean) change.
      function buildSampler(month: number): Sampler {
        const cum = new Float64Array(n);
        let sum = 0;
        for (let i = 0; i < n; i++) {
          const w = baseW[i] as number;
          if (w > 0) sum += w * (seasonalCurve(m49Arr[i] as number)[month] as number);
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
