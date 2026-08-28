// Build a compact population-density grid for the front-end.
//
// Source: GPWv4 (Gridded Population of the World, v4), population count adjusted to
// 2015 UN WPP country totals, redistributed as CSV by the openaddresses/population
// project. Each source row is a grid square with its ISO country code and the number
// of people in it — so "population count" already equals density x area, which is
// exactly what we want: a country's deaths split in proportion to cell count both
// preserves the country total and concentrates deaths where people are dense.
//
// We take the high-resolution 0.1deg (6 arc-min) rows and aggregate them to 0.5deg
// (30 arc-min) bins to keep the shipped grid small and the canvas render at 60fps.
// ISO alpha-3 is mapped to the numeric M49 id used by /api/mortality and the map.
//
// Output: data/density-grid.json
//   { resolution, cellsize, year, source, count, cells: [[lon, lat, pop, m49], ...] }
//   lon/lat are the south-west corner of each cell; pop is people in the cell.
//
// Usage: node scripts/build-density.ts [--force]
// If the raw CSV is missing and cannot be downloaded, a coarse synthetic grid is
// generated from the bundled world-atlas geometry so the app still builds offline.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import isoCountries from "i18n-iso-countries";
import * as d3 from "d3";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { politeFetch } from "../lib/http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "data", "density-grid.json");
const SRC_GZ = path.join(ROOT, "data", "source", "gpwv4-2015.csv.gz");
const SRC_URL =
  "https://raw.githubusercontent.com/openaddresses/population/master/data/gpwv4-2015.csv.gz";
const ATLAS = path.join(ROOT, "node_modules", "world-atlas", "countries-110m.json");

const BIN = 0.5; // output cell size in degrees (30 arc-min)
const SRC_SIZE = 0.1; // source rows we use (ignore the duplicate 1.0deg rows)

const force = process.argv.includes("--force");

type DensityCell = [number, number, number, number]; // lon, lat, pop, m49

interface DensityGrid {
  resolution: string;
  cellsize: number;
  year: number;
  source: string;
  count: number;
  cells: DensityCell[];
}

interface WriteMeta {
  resolution: string;
  source: string;
}

interface CountryTopology extends Topology {
  objects: {
    land: GeometryCollection;
    countries: GeometryCollection;
  };
}

async function main(): Promise<void> {
  if (fs.existsSync(OUT) && !force) {
    console.log(`${path.relative(ROOT, OUT)} already exists — pass --force to rebuild.`);
    return;
  }

  let csv: string;
  try {
    csv = await loadCsv();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`Could not load population raster (${message}).`);
    console.warn("Falling back to a coarse synthetic grid from world-atlas geometry.");
    writeGrid(syntheticGrid(), { resolution: "synthetic", source: "synthetic" });
    return;
  }

  const cells = aggregate(csv);
  writeGrid(cells, {
    resolution: `${BIN}deg`,
    source: "GPWv4 2015 (population count, UN-adjusted) via openaddresses/population",
  });
}

// --- Load + gunzip the raw CSV (local copy preferred, else download) -------------
async function loadCsv(): Promise<string> {
  let gz: Buffer;
  if (fs.existsSync(SRC_GZ)) {
    gz = fs.readFileSync(SRC_GZ);
  } else {
    console.log(`Downloading population raster from ${SRC_URL} ...`);
    const res = await politeFetch(SRC_URL, {}, { timeoutMs: 180_000, label: "population raster" });
    gz = Buffer.from(await res.arrayBuffer());
    fs.mkdirSync(path.dirname(SRC_GZ), { recursive: true });
    fs.writeFileSync(SRC_GZ, gz);
  }
  return zlib.gunzipSync(gz).toString("utf8");
}

interface Bin {
  ilon: number;
  ilat: number;
  pop: number;
  byIso: Map<string, number>;
}

// --- Aggregate 0.1deg rows into 0.5deg bins, keyed by integer cell coords --------
// Each bin sums population and tracks how much population each ISO contributes, so a
// bin straddling a border is assigned to the country with the most people in it.
function aggregate(csv: string): DensityCell[] {
  const bins = new Map<number, Bin>(); // key -> { pop, byIso: Map<iso3, pop> }
  let line = 0;
  const start = csv.indexOf("\n") + 1; // skip header
  for (const row of csv.slice(start).split("\n")) {
    if (!row) continue;
    line++;
    // iso_a2,iso_a3,lon,lat,size,year,population,area
    const c = row.split(",");
    if (Number(c[4]) !== SRC_SIZE) continue; // use only the high-res rows
    const pop = Number(c[6]);
    if (!(pop > 0)) continue;
    const iso3 = c[1] ?? "";
    const lon = Number(c[2]);
    const lat = Number(c[3]);
    const ilon = Math.floor(lon / BIN);
    const ilat = Math.floor(lat / BIN);
    const key = (ilat + 360) * 100000 + (ilon + 360);
    let b = bins.get(key);
    if (!b) {
      b = { ilon, ilat, pop: 0, byIso: new Map() };
      bins.set(key, b);
    }
    b.pop += pop;
    b.byIso.set(iso3, (b.byIso.get(iso3) || 0) + pop);
  }
  console.log(`Read ${line.toLocaleString()} source rows, ${bins.size} bins.`);

  const cells: DensityCell[] = [];
  let dropped = 0;
  for (const b of bins.values()) {
    let iso3: string | null = null;
    let max = -1;
    for (const [iso, p] of b.byIso) {
      if (p > max) {
        max = p;
        iso3 = iso;
      }
    }
    const m49 = Number(isoCountries.alpha3ToNumeric(iso3 ?? ""));
    if (!m49) {
      dropped++;
      continue;
    }
    cells.push([round(b.ilon * BIN, 2), round(b.ilat * BIN, 2), Math.round(b.pop), m49]);
  }
  if (dropped) console.log(`Dropped ${dropped} bins with no M49 mapping.`);
  return cells;
}

// --- Coarse offline fallback: one cell per land grid square, uniform population ---
function syntheticGrid(): DensityCell[] {
  const topo = JSON.parse(fs.readFileSync(ATLAS, "utf8")) as CountryTopology;
  const land = feature(topo, topo.objects.land) as unknown as Feature<Geometry>;
  const step = 1.5;
  const cells: DensityCell[] = [];
  const countries = (
    feature(topo, topo.objects.countries) as unknown as FeatureCollection<Geometry>
  ).features;
  for (let lat = -56; lat < 84; lat += step) {
    for (let lon = -180; lon < 180; lon += step) {
      const c: [number, number] = [lon + step / 2, lat + step / 2];
      if (!d3.geoContains(land, c)) continue;
      const hit = countries.find((f) => d3.geoContains(f, c));
      if (!hit || !hit.id) continue;
      cells.push([round(lon, 2), round(lat, 2), 10000, Number(hit.id)]);
    }
  }
  return cells;
}

function writeGrid(cells: DensityCell[], meta: WriteMeta): void {
  const grid: DensityGrid = {
    resolution: meta.resolution,
    cellsize: meta.resolution === "synthetic" ? 1.5 : BIN,
    year: 2015,
    source: meta.source,
    count: cells.length,
    cells,
  };
  fs.writeFileSync(OUT, JSON.stringify(grid));
  const total = cells.reduce((s, c) => s + c[2], 0);
  console.log(
    `Wrote ${path.relative(ROOT, OUT)}: ${cells.length} cells, ` +
      `total population ${Math.round(total).toLocaleString()}.`,
  );
}

function round(n: number, d: number): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
