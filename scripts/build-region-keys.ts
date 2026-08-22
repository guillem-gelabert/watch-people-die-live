// Give every populated mortality-grid cell the admin-1 / NUTS-2 identity that
// data/subnational-cdr.json already uses, so region-keyed sources can reach a persona.
//
// Ships as its own file rather than a fifth column on data/rate-grid.json, for two
// reasons found the hard way: pipeline/climate_fallback.py unpacks each cell as exactly
// four values, so a wider row is a crash; and app/globe/useGlobeData.ts snaps the baked
// ACLED conflict layer onto grid cells by a "lon,lat" string key, so rewriting the grid
// risks silently invalidating that join. The output is aligned to rate-grid cell order
// and asserts its own length, which is the same contract a fifth column would have had.
//
// Assignment is by area majority, not population. The plan asked for "whichever region
// holds the most population within the cell", but the only committed population raster
// (data/density-grid.json, GPWv4) is itself 0.5deg — the same resolution as the cells —
// so there is no sub-cell population to weight with. Sampling the cell on a 5x5 lattice
// and taking the region that wins the most sample points is the honest approximation,
// and it still fixes what centroid containment gets wrong on border and coastal cells.
//
// Output: data/region-keys.json
//   { source, cellsize, count, keys: [{ geo, key, country }...], cells: [keyIdx|-1 ...] }
//
// Usage: node --import tsx scripts/build-region-keys.ts [--force]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { geoContains } from "d3-geo";
import * as topojson from "topojson-client";
import isoCountries from "i18n-iso-countries";
import type { Feature, Geometry } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "data", "region-keys.json");

const force = process.argv.includes("--force");

// Sub-cell lattice for the area-majority vote. 5x5 keeps 59,954 cells inside a few
// seconds while still splitting a cell a border runs through.
const LATTICE = 5;
// Bucket width for the coarse spatial index, in degrees.
const BUCKET = 2;

interface RateGrid {
  cellsize: number;
  cells: [lon: number, lat: number, m49: number, w: number][];
}

interface Region {
  geo: "adm1" | "nuts2";
  key: string;
  country: string;
  feature: Feature<Geometry>;
  bbox: [number, number, number, number];
}

// Natural Earth's adm0_a3 is not always ISO 3166-1 alpha-3. Left unmapped, every cell in
// these countries goes unassigned — South Sudan alone is 0.19% of expected deaths.
// Somaliland is a separate NE code inside Somalia's ISO country.
const NE_ALIASES = new Map<string, string[]>([
  ["SSD", ["SDS"]],
  ["PSE", ["PSX"]],
  ["SOM", ["SOM", "SOL"]],
  ["XKX", ["KOS"]],
]);

function readJson<T>(rel: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8")) as T;
}

function bboxOf(geometry: Geometry): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const walk = (coords: unknown): void => {
    if (typeof (coords as number[])[0] === "number") {
      const [x, y] = coords as [number, number];
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      return;
    }
    for (const c of coords as unknown[]) walk(c);
  };
  if ("coordinates" in geometry) walk(geometry.coordinates);
  return [minX, minY, maxX, maxY];
}

function loadRegions(): Region[] {
  const regions: Region[] = [];

  const admin1 = readJson<Topology>("data/admin1-10m.json");
  const admin1Features = topojson.feature(
    admin1,
    admin1.objects.ne_10m_admin_1 as GeometryCollection,
  ).features as Feature<Geometry>[];
  for (const feature of admin1Features) {
    const props = (feature.properties ?? {}) as Record<string, unknown>;
    const key = String(props.adm1_code ?? "");
    const country = String(props.adm0_a3 ?? "");
    if (!key || !country || !feature.geometry) continue;
    regions.push({ geo: "adm1", key, country, feature, bbox: bboxOf(feature.geometry) });
  }

  const nuts2 = readJson<Topology>("data/nuts2-20m.json");
  const nuts2Features = topojson.feature(nuts2, nuts2.objects.nuts2_20m as GeometryCollection)
    .features as Feature<Geometry>[];
  for (const feature of nuts2Features) {
    const props = (feature.properties ?? {}) as Record<string, unknown>;
    const key = String(props.NUTS_ID ?? "");
    const alpha2 = String(props.CNTR_CODE ?? "");
    // GISCO uses EL for Greece and UK for the United Kingdom, which ISO does not.
    const fixed = alpha2 === "EL" ? "GR" : alpha2 === "UK" ? "GB" : alpha2;
    const country = isoCountries.alpha2ToAlpha3(fixed) ?? "";
    if (!key || !country || !feature.geometry) continue;
    regions.push({ geo: "nuts2", key, country, feature, bbox: bboxOf(feature.geometry) });
  }

  return regions;
}

function main(): void {
  if (fs.existsSync(OUT) && !force) {
    console.log(`${path.relative(ROOT, OUT)} already exists — pass --force to rebuild.`);
    return;
  }

  const grid = readJson<RateGrid>("data/rate-grid.json");
  const cdrMeta = readJson<{ meta: { nutsCountriesIso3: string[] } }>(
    "data/subnational-cdr.json",
  ).meta;
  // Mirror how subnational-cdr.json chooses a layer per country, so the two key spaces
  // stay the same key space rather than merely the same shape.
  const nutsCountries = new Set(cdrMeta.nutsCountriesIso3);

  const regions = loadRegions();
  console.log(
    `Loaded ${regions.filter((r) => r.geo === "adm1").length} admin-1 and ` +
      `${regions.filter((r) => r.geo === "nuts2").length} NUTS-2 polygons.`,
  );

  // Coarse spatial index: bucket -> region indexes whose bbox touches it.
  const buckets = new Map<string, number[]>();
  const bkey = (x: number, y: number): string =>
    `${Math.floor(x / BUCKET)},${Math.floor(y / BUCKET)}`;
  regions.forEach((region, i) => {
    const [minX, minY, maxX, maxY] = region.bbox;
    for (let x = Math.floor(minX / BUCKET) * BUCKET; x <= maxX; x += BUCKET) {
      for (let y = Math.floor(minY / BUCKET) * BUCKET; y <= maxY; y += BUCKET) {
        const k = bkey(x, y);
        const list = buckets.get(k);
        if (list) list.push(i);
        else buckets.set(k, [i]);
      }
    }
  });

  const iso3Of = (m49: number): string =>
    isoCountries.numericToAlpha3(String(m49).padStart(3, "0")) ?? "";

  const keyIndex = new Map<string, number>();
  const keys: { geo: string; key: string; country: string }[] = [];
  const internKey = (r: Region): number => {
    const id = `${r.geo}:${r.key}`;
    let i = keyIndex.get(id);
    if (i === undefined) {
      i = keys.length;
      keys.push({ geo: r.geo, key: r.key, country: r.country });
      keyIndex.set(id, i);
    }
    return i;
  };

  const cs = grid.cellsize;
  const assigned: number[] = [];
  let hits = 0;
  let byNearest = 0;
  let unassignedWeight = 0;
  let totalWeight = 0;
  let rollupMismatch = 0;
  // Ocean-fringe, disputed and boundary-disagreement cells get an explicit null rather than
  // a guess, enumerated here the way seasonality-applied-fallbacks.json names its
  // unassignedTargets. A cell lands here when the grid calls it country X but no polygon of
  // country X reaches it, which happens where the grid's own country layer and Natural
  // Earth's admin-1 boundaries disagree.
  const unassignedBy = new Map<number, { cells: number; weight: number }>();
  const noteUnassigned = (m49: number, w: number): void => {
    const cur = unassignedBy.get(m49) ?? { cells: 0, weight: 0 };
    cur.cells++;
    cur.weight += w;
    unassignedBy.set(m49, cur);
  };

  for (const [lon, lat, m49, w] of grid.cells) {
    totalWeight += w;
    const iso3 = iso3Of(m49);
    const countryCodes = new Set(NE_ALIASES.get(iso3) ?? [iso3]);
    const preferNuts = nutsCountries.has(iso3);

    // Candidates: same country only, so rolling the regions back up always reproduces the
    // grid's own country assignment. The preferred layer is tried first and the other is a
    // fallback, which is what rescues islands outside NUTS coverage — Spanish and Portuguese
    // Atlantic islands, the Greek islands, Danish territories.
    const seen = new Set<number>();
    const nearby: number[] = [];
    for (let x = lon; x <= lon + cs; x += cs) {
      for (let y = lat; y <= lat + cs; y += cs) {
        for (const i of buckets.get(bkey(x, y)) ?? []) {
          if (seen.has(i)) continue;
          seen.add(i);
          if (!countryCodes.has((regions[i] as Region).country)) continue;
          nearby.push(i);
        }
      }
    }
    const preferred = nearby.filter(
      (i) => (regions[i] as Region).geo === (preferNuts ? "nuts2" : "adm1"),
    );
    const candidates = preferred.length ? preferred : nearby;

    if (!candidates.length) {
      assigned.push(-1);
      unassignedWeight += w;
      noteUnassigned(m49, w);
      continue;
    }

    let winner = -1;
    if (candidates.length === 1) {
      // One candidate: accept it without a vote, but only if it really covers the cell.
      const only = candidates[0] as number;
      const r = regions[only] as Region;
      const centre: [number, number] = [lon + cs / 2, lat + cs / 2];
      if (geoContains(r.feature, centre)) winner = only;
      else {
        // Coastal cell whose centre falls in the sea: the region is still the only one
        // here, so take it rather than dropping a populated cell.
        winner = only;
        byNearest++;
      }
    } else {
      const votes = new Map<number, number>();
      for (let a = 0; a < LATTICE; a++) {
        for (let b = 0; b < LATTICE; b++) {
          const px = lon + ((a + 0.5) / LATTICE) * cs;
          const py = lat + ((b + 0.5) / LATTICE) * cs;
          for (const i of candidates) {
            if (geoContains((regions[i] as Region).feature, [px, py])) {
              votes.set(i, (votes.get(i) ?? 0) + 1);
              break;
            }
          }
        }
      }
      if (votes.size) {
        winner = [...votes].sort((x, y) => y[1] - x[1])[0]?.[0] ?? -1;
      } else {
        // No lattice point landed inside any candidate — a coastal cell whose land is a
        // sliver. Fall back to the nearest candidate centroid.
        let best = -1;
        let bestDistance = Infinity;
        const cx = lon + cs / 2;
        const cy = lat + cs / 2;
        for (const i of candidates) {
          const [minX, minY, maxX, maxY] = (regions[i] as Region).bbox;
          const dx = (minX + maxX) / 2 - cx;
          const dy = (minY + maxY) / 2 - cy;
          const d = dx * dx + dy * dy;
          if (d < bestDistance) {
            bestDistance = d;
            best = i;
          }
        }
        winner = best;
        byNearest++;
      }
    }

    if (winner < 0) {
      assigned.push(-1);
      unassignedWeight += w;
      noteUnassigned(m49, w);
      continue;
    }
    const region = regions[winner] as Region;
    if (!countryCodes.has(region.country)) rollupMismatch++;
    assigned.push(internKey(region));
    hits++;
  }

  if (assigned.length !== grid.cells.length) {
    throw new Error(`Alignment broken: ${assigned.length} keys for ${grid.cells.length} cells`);
  }

  const unassignedByCountry = [...unassignedBy]
    .map(([m49, v]) => ({
      m49,
      iso3: iso3Of(m49),
      cells: v.cells,
      deathShare: Number(((v.weight / totalWeight) * 100).toFixed(4)),
    }))
    .sort((a, b) => b.deathShare - a.deathShare);

  const out = {
    source:
      "Natural Earth 10m Admin-1 (adm1_code) and GISCO NUTS-2 (NUTS_ID), assigned by area " +
      "majority on a 5x5 sub-cell lattice; key space matches data/subnational-cdr.json",
    cellsize: cs,
    count: assigned.length,
    keys,
    cells: assigned,
    unassigned: {
      cells: assigned.filter((i) => i < 0).length,
      deathShare: Number(((unassignedWeight / totalWeight) * 100).toFixed(4)),
      byCountry: unassignedByCountry,
    },
  };
  fs.writeFileSync(OUT, JSON.stringify(out));

  const unassigned = assigned.filter((i) => i < 0).length;
  console.log(
    `Assigned ${hits.toLocaleString()} of ${assigned.length.toLocaleString()} cells to ` +
      `${keys.length.toLocaleString()} regions (${unassigned.toLocaleString()} unassigned).`,
  );
  console.log(
    `  nearest-region fallback: ${byNearest.toLocaleString()} cells · ` +
      `rollup mismatches: ${rollupMismatch}`,
  );
  console.log(
    `  unassigned share of expected deaths: ` +
      `${((unassignedWeight / totalWeight) * 100).toFixed(3)}%` +
      ` across ${unassignedByCountry.length} countries`,
  );
  for (const row of unassignedByCountry.slice(0, 5)) {
    console.log(`    ${row.iso3 || row.m49}: ${row.cells} cells, ${row.deathShare}% of deaths`);
  }
  console.log(`Wrote ${path.relative(ROOT, OUT)}: ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
}

try {
  main();
} catch (err: unknown) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
