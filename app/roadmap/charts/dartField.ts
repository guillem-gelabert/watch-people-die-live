// Where a randomly-placed death lands: ocean, land nobody lives on, or land somebody lives on.
// The design classifies against 55 hand-placed city centres; this classifies against the two real
// datasets the model itself is built on — Natural Earth land for the coastline and the 0.5° GPWv4
// density grid for settlement — so the shares the tally converges to are the model's own rather
// than a stand-in's.
import * as d3 from "d3";
import type { CountryFeature, DensityGrid } from "../types";

// The rate grid's own resolution. Both masks live on this lattice so one index serves both.
export const CELL_SIZE = 0.5;
export const GRID_W = 360 / CELL_SIZE; // 720
export const GRID_H = 180 / CELL_SIZE; // 360

export type Bucket = "ocean" | "uninhabited" | "inhabited";
export const BUCKETS: Bucket[] = ["ocean", "uninhabited", "inhabited"];

// Cells are keyed by their south-west corner (lon -180…179.5, lat -90…89.5), y increasing
// north, which is the convention data/rate-grid.json is baked in.
export function cellIndex(lon: number, lat: number): number {
  const x = Math.floor((lon + 180) / CELL_SIZE);
  const y = Math.floor((lat + 90) / CELL_SIZE);
  if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H) return -1;
  return y * GRID_W + x;
}

export type Mask = Uint8Array;

export function buildPopulatedMask(grid: DensityGrid): Mask {
  const mask = new Uint8Array(GRID_W * GRID_H);
  for (const [lon, lat, population] of grid.cells) {
    if (population <= 0) continue;
    const i = cellIndex(lon, lat);
    if (i >= 0) mask[i] = 1;
  }
  return mask;
}

// Rasterises the country polygons once into the same lattice. Filling them into a canvas and
// reading back the alpha channel is far cheaper than a geoContains sweep — a point-in-polygon
// test against 177 features, 20 000 times, is seconds of main thread.
export function buildLandMask(features: CountryFeature[]): Mask | null {
  const canvas = document.createElement("canvas");
  canvas.width = GRID_W;
  canvas.height = GRID_H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  const projection = d3.geoEquirectangular().fitExtent(
    [
      [0, 0],
      [GRID_W, GRID_H],
    ],
    { type: "Sphere" },
  );
  const path = d3.geoPath(projection, ctx);
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  for (const f of features) path(f);
  ctx.fill();

  const { data } = ctx.getImageData(0, 0, GRID_W, GRID_H);
  const mask = new Uint8Array(GRID_W * GRID_H);
  for (let py = 0; py < GRID_H; py += 1) {
    // The raster runs north-to-south; the lattice runs south-to-north.
    const y = GRID_H - 1 - py;
    for (let px = 0; px < GRID_W; px += 1) {
      // Half-covered coastal pixels count as land, the same threshold the design uses.
      if ((data[(py * GRID_W + px) * 4 + 3] ?? 0) > 120) mask[y * GRID_W + px] = 1;
    }
  }
  return mask;
}

export function classify(lon: number, lat: number, land: Mask, populated: Mask): Bucket {
  const i = cellIndex(lon, lat);
  if (i < 0 || !land[i]) return "ocean";
  return populated[i] ? "inhabited" : "uninhabited";
}

// Area-correct sphere sampling (`asin(2U − 1)`, not a uniform latitude, which would crowd the
// poles) to find the share each bucket converges to. One pass, memoised by the caller.
export function convergenceShares(
  land: Mask,
  populated: Mask,
  samples = 20000,
  random: () => number = Math.random,
): Record<Bucket, number> {
  const counts: Record<Bucket, number> = { ocean: 0, uninhabited: 0, inhabited: 0 };
  for (let i = 0; i < samples; i += 1) {
    const lon = -180 + random() * 360;
    const lat = (Math.asin(2 * random() - 1) * 180) / Math.PI;
    counts[classify(lon, lat, land, populated)] += 1;
  }
  return {
    ocean: Math.round((counts.ocean / samples) * 100),
    uninhabited: Math.round((counts.uninhabited / samples) * 100),
    inhabited: Math.round((counts.inhabited / samples) * 100),
  };
}
