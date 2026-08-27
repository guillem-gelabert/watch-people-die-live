// Leave-one-out validation for 04-07's seasonal-composition transfer (lib/seasonal-composition.ts,
// task 2): for every measured country in every age band / cause dimension, exclude it from the
// donor pool (curves AND the climate blend, so the fold cannot see its own answer), rebuild the
// transfer with what remains, and compare the transferred estimate against the country's real
// measured curve. Mirrors build-seasonality-validation.ts's leave-one-country-out pattern for the
// timing curve, applied per band/cause instead of once for the whole country.
//
// Not wired into any build step -- this is a report, run on demand, like the existing
// seasonality LOO script's sibling. Prints to stdout; nothing is written to data/.

import * as d3 from "d3";
import * as topojson from "topojson-client";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Feature, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import { sampleHarmonicCurve, type HarmonicCurve } from "../lib/seasonal-curve";
import type { ClimateFallbackModel } from "../lib/spatial-seasonality";
import {
  buildSeasonalComposition,
  measuredM49Curves,
  transferDimension,
  type SeasonalCompositionData,
} from "../lib/seasonal-composition";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function readJson<T>(relative: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8")) as T;
}

const FLAT: HarmonicCurve = { order: 4, coefficients: [1, 0, 0, 0, 0, 0, 0, 0, 0] };

function rmse(a: HarmonicCurve, b: HarmonicCurve): number {
  const av = sampleHarmonicCurve(a);
  const bv = sampleHarmonicCurve(b);
  return Math.sqrt(d3.mean(av, (v, i) => (v - (bv[i] ?? 0)) ** 2) ?? 0);
}

const data = readJson<SeasonalCompositionData>("data/seasonal-composition.json");
const climate = readJson<ClimateFallbackModel>("data/seasonality-climate-fallback.json");
const world = readJson<Topology>("node_modules/world-atlas/countries-110m.json");
const worldObject = world.objects.countries as GeometryCollection;
const features = topojson.feature(world, worldObject).features as unknown as Feature<Geometry>[];
const neighborIndexes = topojson.neighbors(worldObject.geometries);
const neighbors = new Map<number, number[]>(
  worldObject.geometries.map((geometry, index) => [
    Number(geometry.id),
    (neighborIndexes[index] ?? []).map((n) => Number(worldObject.geometries[n]?.id)),
  ]),
);

interface FoldResult {
  dimension: string;
  m49: number;
  transferredRmse: number;
  flatRmse: number;
  won: boolean;
}

function looForDimension(dimension: string, measured: Map<number, HarmonicCurve>): FoldResult[] {
  const results: FoldResult[] = [];
  for (const [targetM49, actual] of measured) {
    const reduced = new Map(measured);
    reduced.delete(targetM49);
    if (reduced.size === 0) continue;
    const transferred = transferDimension(reduced, features, neighbors, climate.classByM49).get(
      targetM49,
    );
    if (!transferred) continue; // no donor reached this target even without itself
    results.push({
      dimension,
      m49: targetM49,
      transferredRmse: rmse(transferred, actual),
      flatRmse: rmse(FLAT, actual),
      won: rmse(transferred, actual) < rmse(FLAT, actual),
    });
  }
  return results;
}

const ageResults: FoldResult[] = [];
data.meta.ageBands.forEach((_band, index) => {
  const measured = measuredM49Curves(
    Object.fromEntries(
      Object.entries(data.age.countries).map(([iso3, curves]) => [iso3, curves[index] ?? null]),
    ),
  );
  ageResults.push(...looForDimension(`age band ${index}`, measured));
});

const causeResults: FoldResult[] = [];
for (const chapter of data.meta.causeChapters) {
  const measured = measuredM49Curves(
    Object.fromEntries(
      Object.entries(data.cause.countries).map(([iso3, c]) => [iso3, c.chapters[chapter]]),
    ),
  );
  causeResults.push(...looForDimension(`chapter ${chapter}`, measured));
}
for (const leaf of data.meta.causeLeafGroups) {
  const measured = measuredM49Curves(
    Object.fromEntries(
      Object.entries(data.cause.countries).map(([iso3, c]) => [iso3, c.leaf[leaf]]),
    ),
  );
  causeResults.push(...looForDimension(`leaf ${leaf}`, measured));
}

function summarize(label: string, results: FoldResult[]): void {
  if (!results.length) {
    console.log(`${label}: 0 folds (fewer than 2 measured donors in every dimension)`);
    return;
  }
  const meanTransferred = d3.mean(results, (r) => r.transferredRmse) ?? 0;
  const meanFlat = d3.mean(results, (r) => r.flatRmse) ?? 0;
  const won = results.filter((r) => r.won).length;
  console.log(
    `${label}: ${results.length} folds, mean RMSE transferred=${meanTransferred.toFixed(4)} ` +
      `flat=${meanFlat.toFixed(4)} (${won}/${results.length} folds beat flat, ` +
      `${meanTransferred < meanFlat ? "TRANSFER WINS ON AVERAGE" : "flat wins on average"})`,
  );
}

console.log("=== 04-07 seasonal-composition LOO validation ===\n");
summarize("Age (all bands pooled)", ageResults);
summarize("Cause (all chapters + leaf groups pooled)", causeResults);
console.log();
for (let band = 0; band < data.meta.ageBands.length; band++) {
  summarize(
    `  age band ${band}`,
    ageResults.filter((r) => r.dimension === `age band ${band}`),
  );
}
console.log();
for (const chapter of data.meta.causeChapters) {
  const rows = causeResults.filter((r) => r.dimension === `chapter ${chapter}`);
  if (rows.length) summarize(`  chapter ${chapter}`, rows);
}
for (const leaf of data.meta.causeLeafGroups) {
  const rows = causeResults.filter((r) => r.dimension === `leaf ${leaf}`);
  if (rows.length) summarize(`  leaf ${leaf}`, rows);
}

// Real (non-LOO) coverage: how many of the world's 177 rendered countries the donor cascade
// actually reaches with the full measured set, not the reduced LOO one -- separate from LOO
// skill, and the number that matters for "does this change most persona draws".
console.log("\n=== Real transfer coverage (all measured donors present) ===\n");
const runtime = buildSeasonalComposition(data, features, neighbors, climate.classByM49);
const worldCount = features.length;
console.log(`World features in this topology: ${worldCount}`);
for (const band of [0, 2, 4, 6, 8]) {
  console.log(
    `  age band ${band}: ${runtime.ageCoverage.get(band)?.size ?? 0}/${worldCount} countries covered`,
  );
}
for (const chapter of ["IX", "X"]) {
  console.log(
    `  chapter ${chapter}: ${runtime.causeCoverage.get(`chapter:${chapter}`)?.size ?? 0}/${worldCount} countries covered`,
  );
}
for (const leaf of data.meta.causeLeafGroups) {
  console.log(
    `  leaf ${leaf}: ${runtime.causeCoverage.get(`leaf:${leaf}`)?.size ?? 0}/${worldCount} countries covered`,
  );
}
