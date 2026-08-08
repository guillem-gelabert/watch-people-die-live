// Bake high-resolution country outlines for the story's three regional close-ups.
//
// Why this exists: the whole story draws its coastlines from world-atlas countries-110m, which is
// the right tier for a world map and far too coarse for a zoom. Inside the West Africa crop that
// file has 163 vertices across eight countries; inside the Japan crop it has 132 for the entire
// archipelago. Two of those figures exist specifically to put a real border next to a 0.5° raster
// and ask the reader to see the difference, which does not survive the border being a cartoon.
//
// The 10m tier has the detail (5,065 and 9,711 vertices in the same two crops) and is 3.6 MB,
// which is not a thing to hand a reader for three figures. But the figures only ever draw what is
// inside their own panel, so this clips 10m geometry to the crops and keeps nothing else: the
// whole set lands around 170 KB gzipped — less than shipping the 50m tier, at several times its
// resolution.
//
// Source: node_modules/world-atlas (already a dependency, used for the 110m outlines).
// Output: data/closeup-outlines.json — a FeatureCollection whose features each carry the crop
// they belong to, the country's m49 id and its name.
//
// Deterministic: same input files, same output. Re-run it when a crop in lib/closeup-crops.ts
// moves, or when world-atlas is upgraded.
//
// Usage: node --import tsx scripts/build-closeup-outlines.ts

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as topojson from "topojson-client";
import type { Feature, MultiPolygon, Polygon, Position } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import { CLOSEUP_CROPS, clipBbox, type Bbox } from "../lib/closeup-crops";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "node_modules", "world-atlas", "countries-10m.json");
const OUT = path.join(ROOT, "data", "closeup-outlines.json");

// Four decimals is 0.0001°, about 11 m. The tightest crop shows 20° across roughly 800 px, so a
// pixel is 0.025° — this is a fortieth of one, and the 10m source quantises to 0.0036° anyway.
// Rounding is applied identically to every ring, so two countries sharing a border still share it.
const PRECISION = 4;

interface CountryProps {
  name?: string;
}

type CountriesTopology = Topology<{ countries: GeometryCollection<CountryProps> }>;

// Sutherland–Hodgman against a lon/lat rectangle, run once per edge. The crops are equirectangular
// windows, so clipping in lon/lat is the same operation the panel's own viewBox performs later —
// this just does it ahead of time, to the bytes rather than to the pixels.
//
// Polygons only. A clipped ring is still a ring: the algorithm walks the rectangle's corners where
// the shape leaves and re-enters, which is what keeps the result fillable — and geoContains, which
// the West Africa panel uses to name the country under the pointer, needs it to be.
function clipRing(ring: Position[], [[x0, y0], [x1, y1]]: Bbox): Position[] | null {
  const lerpX = (a: Position, b: Position, x: number): Position => {
    const t = (x - (a[0] as number)) / ((b[0] as number) - (a[0] as number));
    return [x, (a[1] as number) + t * ((b[1] as number) - (a[1] as number))];
  };
  const lerpY = (a: Position, b: Position, y: number): Position => {
    const t = (y - (a[1] as number)) / ((b[1] as number) - (a[1] as number));
    return [(a[0] as number) + t * ((b[0] as number) - (a[0] as number)), y];
  };

  const edges: [(p: Position) => boolean, (a: Position, b: Position) => Position][] = [
    [(p) => (p[0] as number) >= x0, (a, b) => lerpX(a, b, x0)],
    [(p) => (p[0] as number) <= x1, (a, b) => lerpX(a, b, x1)],
    [(p) => (p[1] as number) >= y0, (a, b) => lerpY(a, b, y0)],
    [(p) => (p[1] as number) <= y1, (a, b) => lerpY(a, b, y1)],
  ];

  let out = ring;
  for (const [inside, intersect] of edges) {
    const src = out;
    out = [];
    for (let i = 0; i < src.length; i++) {
      const cur = src[i] as Position;
      const prev = src[(i + src.length - 1) % src.length] as Position;
      if (inside(cur)) {
        if (!inside(prev)) out.push(intersect(prev, cur));
        out.push(cur);
      } else if (inside(prev)) {
        out.push(intersect(prev, cur));
      }
    }
    // Nothing of this ring is in the box. Islands well outside the crop leave here.
    if (out.length === 0) return null;
  }
  // Fewer than three distinct points is a degenerate sliver clipped off a corner, not a shape.
  if (out.length < 4) return null;
  const first = out[0] as Position;
  const last = out[out.length - 1] as Position;
  if (first[0] !== last[0] || first[1] !== last[1])
    out.push([first[0] as number, first[1] as number]);
  return out;
}

function clipGeometry(geometry: Polygon | MultiPolygon, bbox: Bbox): Polygon | MultiPolygon | null {
  const polygons: Position[][][] =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const kept: Position[][][] = [];
  for (const polygon of polygons) {
    const rings = polygon
      .map((ring) => clipRing(ring, bbox))
      .filter((ring): ring is Position[] => ring !== null);
    // A hole that survived while its outer ring did not is not a hole in anything.
    if (rings.length) kept.push(rings);
  }
  if (!kept.length) return null;
  return kept.length === 1
    ? { type: "Polygon", coordinates: kept[0] as Position[][] }
    : { type: "MultiPolygon", coordinates: kept };
}

function round(value: number): number {
  return Number(value.toFixed(PRECISION));
}

function roundGeometry(geometry: Polygon | MultiPolygon): Polygon | MultiPolygon {
  const ring = (r: Position[]): Position[] =>
    r.map((p) => [round(p[0] as number), round(p[1] as number)]);
  return geometry.type === "Polygon"
    ? { type: "Polygon", coordinates: geometry.coordinates.map(ring) }
    : { type: "MultiPolygon", coordinates: geometry.coordinates.map((p) => p.map(ring)) };
}

const topo = JSON.parse(fs.readFileSync(SRC, "utf8")) as CountriesTopology;
const countries = topojson.feature(topo, topo.objects.countries).features as Feature<
  Polygon | MultiPolygon,
  CountryProps
>[];

const features: Feature<Polygon | MultiPolygon>[] = [];
for (const crop of CLOSEUP_CROPS) {
  // Not crop.bbox — the square panel reaches past it. See clipBbox().
  const box = clipBbox(crop);
  let kept = 0;
  for (const country of countries) {
    if (!country.geometry) continue;
    const clipped = clipGeometry(country.geometry, box);
    if (!clipped) continue;
    kept++;
    features.push({
      type: "Feature",
      id: country.id,
      properties: { crop: crop.key, name: country.properties?.name ?? null },
      geometry: roundGeometry(clipped),
    });
  }
  console.log(`${crop.key}: ${kept} countries`);
}

const out = JSON.stringify({ type: "FeatureCollection", features });
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, out);
console.log(
  `Wrote data/closeup-outlines.json: ${features.length} features, ${(out.length / 1024).toFixed(0)} KB`,
);
