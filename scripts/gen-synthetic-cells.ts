// Generate synthetic base-grid cells for countries that have a World Bank CDR + population
// but NO cells in data/density-grid.json (GPWv4's border-cell assignment gave every one of
// their raster bins to a neighboring country). Without these, combine.ipynb's bake would
// silently drop these countries' deaths entirely.
//
// Uses the same rejection-sampling-over-vector-polygon technique as the live app's
// randomLonLat fallback (app/globe/Earth.jsx), snapped onto the base grid's 0.5deg bins so
// the synthetic cells slot into the same coordinate system as data/density-grid.json.
// Population is split evenly across the resulting cells; total is a rough population
// estimate (not gridded data) — good enough since the goal is "the country keeps firing",
// not sub-national accuracy for these three small territories.
//
// Output: data/source/synthetic-cells.json
//   { cellsize: 0.5, cells: [ [lon, lat, pop, m49], ... ] }
//
// Usage: node scripts/gen-synthetic-cells.ts

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry } from "geojson";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "data", "source", "synthetic-cells.json");
const CELLSIZE = 0.5;
const SAMPLES_PER_COUNTRY = 40;

// m49 -> approximate total population (from data/source/cdr-snapshot.json's WB figures).
// Populated by main() from the CDR snapshot so this stays in sync automatically.
const MISSING_M49 = [499, 688, 728]; // Montenegro, Serbia, South Sudan

type SyntheticCell = [number, number, number, number]; // lon, lat, pop, m49

interface CountryTopology extends Topology {
  objects: {
    countries: GeometryCollection;
  };
}

interface CdrSnapshotValue {
  id: number;
  population: number | null;
}

interface CdrSnapshot {
  values: CdrSnapshotValue[];
}

function main(): void {
  const topo = JSON.parse(
    fs.readFileSync(path.join(ROOT, "node_modules", "world-atlas", "countries-110m.json"), "utf8"),
  ) as CountryTopology;
  const features = (
    topojson.feature(topo, topo.objects.countries) as unknown as FeatureCollection<Geometry>
  ).features;
  const featureById = new Map<number, Feature<Geometry>>(features.map((f) => [Number(f.id), f]));

  const cdrSnapshot = JSON.parse(
    fs.readFileSync(path.join(ROOT, "data", "source", "cdr-snapshot.json"), "utf8"),
  ) as CdrSnapshot;
  const popById = new Map<number, number | null>(
    cdrSnapshot.values.map((v) => [Number(v.id), v.population]),
  );

  const cells: SyntheticCell[] = [];
  for (const m49 of MISSING_M49) {
    const feature = featureById.get(m49);
    const pop = popById.get(m49);
    if (!feature || !(pop && pop > 0)) {
      console.warn(`Skipping m49=${m49}: missing TopoJSON feature or population.`);
      continue;
    }
    const bins = sampleBins(feature);
    if (!bins.length) {
      console.warn(`Skipping m49=${m49}: rejection sampling found no interior point.`);
      continue;
    }
    const popPerBin = Math.round(pop / bins.length);
    for (const [lon, lat] of bins) cells.push([lon, lat, popPerBin, m49]);
    console.log(`m49=${m49}: ${bins.length} synthetic cells, ${popPerBin} pop each.`);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ cellsize: CELLSIZE, cells }));
  console.log(`Wrote ${rel(OUT)}: ${cells.length} synthetic cells.`);
}

// Rejection-sample interior points, snap each to its 0.5deg SW-corner bin, dedupe.
function sampleBins(feature: Feature<Geometry>): [number, number][] {
  const bounds = d3.geoBounds(feature);
  const [[lon0, lat0], [lon1, lat1]] = bounds;
  const seen = new Set<string>();
  const bins: [number, number][] = [];
  for (let i = 0; i < SAMPLES_PER_COUNTRY * 6 && bins.length < SAMPLES_PER_COUNTRY; i++) {
    const lon = lon0 + Math.random() * (lon1 - lon0);
    const lat = lat0 + Math.random() * (lat1 - lat0);
    if (!d3.geoContains(feature, [lon, lat])) continue;
    const binLon = Math.round(Math.floor(lon / CELLSIZE) * CELLSIZE * 100) / 100;
    const binLat = Math.round(Math.floor(lat / CELLSIZE) * CELLSIZE * 100) / 100;
    const key = `${binLon},${binLat}`;
    if (seen.has(key)) continue;
    seen.add(key);
    bins.push([binLon, binLat]);
  }
  if (!bins.length) {
    const c = d3.geoCentroid(feature);
    const binLon = Math.round(Math.floor(c[0] / CELLSIZE) * CELLSIZE * 100) / 100;
    const binLat = Math.round(Math.floor(c[1] / CELLSIZE) * CELLSIZE * 100) / 100;
    bins.push([binLon, binLat]);
  }
  return bins;
}

function rel(p: string): string {
  return path.relative(ROOT, p);
}

try {
  main();
} catch (err: unknown) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
