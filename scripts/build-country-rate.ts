// Recover the two factors that data/rate-grid.json's `w` folds together.
//
// The bake (notebooks/combine.ipynb) computes, per country,
//
//   r(m49) = CDR(m49) * WBpop(m49) / 1000 / gridPop(m49)     deaths per gridded person per year
//   w(cell) = cellPop * r(m49)                                deaths per year
//
// and then throws r and cellPop away — the grid ships only the product. The island wants to
// show the multiplication rather than its result ("12,400 people x 9.53 per 1,000/yr"), so it
// needs r back. Dividing is enough to recover it, and because r is uniform within a country
// (only cellPop varies) one division per country over the whole grid is exact rather than a fit:
//
//   r(m49) = SUM w(cell) / SUM cellPop(cell)   over that country's cells
//
// Deriving it from the two committed grids rather than re-reading the World Bank keeps this
// consistent with the bake *by construction* — cellPop = w / r reproduces GPWv4 to the digit,
// including for countries whose gridded population differs from the World Bank's headline
// figure, which is exactly the discrepancy r absorbs.
//
// Output: data/country-rate.json (committed, ~6 KB)
//   { meta, rates: { "<m49>": <deaths per person-year>, ... } }
//
// Usage: pnpm run build:country-rate

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DATA = path.join(ROOT, "data");
const OUT = path.join(DATA, "country-rate.json");

// GPWv4 assigns every raster bin of these three to a neighbour, so they have a CDR but no
// density-grid cells; gen-synthetic-cells.ts invents cells for them and the bake reads both.
// It is the one file under data/source/ that is committed (see .gitignore), because it is not a
// fetched source but a pinned draw: the generator places cells by rejection sampling, so a fresh
// run lands them elsewhere and they stop joining to the baked grid. Required, not optional —
// without it 499, 688 and 728 have grid weight and no recoverable rate, and the coverage check
// below would fail anyway, several seconds later and without naming the cause.
const SYNTHETIC = path.join(DATA, "source", "synthetic-cells.json");

interface RateGrid {
  meta: { year: number; sources: string[]; totalDeathsPerYear: number };
  cells: [lon: number, lat: number, m49: number, w: number][];
}

interface DensityGrid {
  year: number;
  source: string;
  cells: [lon: number, lat: number, pop: number, m49: number][];
}

interface SyntheticCells {
  cells: [lon: number, lat: number, pop: number, m49: number][];
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function main(): void {
  if (!fs.existsSync(SYNTHETIC)) {
    throw new Error(
      `Missing ${rel(SYNTHETIC)}, which the bake folded into the grid for m49 499, 688 and 728. ` +
        `Restore it from git — re-running scripts/gen-synthetic-cells.ts draws different cells, ` +
        `which would not join to the committed data/rate-grid.json.`,
    );
  }

  const grid = readJson<RateGrid>(path.join(DATA, "rate-grid.json"));
  const density = readJson<DensityGrid>(path.join(DATA, "density-grid.json"));

  // Keyed on the SW corner both grids are binned to *and* the country, so the join is exact
  // integer-ish arithmetic on values that came out of the same 0.5deg snapping. The country
  // has to be part of the key: gen-synthetic-cells.ts rejection-samples South Sudan into bins
  // GPWv4 had already assigned to Sudan, so a corner-only key silently adds one country's
  // invented population to another's real cell.
  const popByCell = new Map<string, number>();
  for (const [lon, lat, pop, m49] of density.cells) popByCell.set(`${lon},${lat},${m49}`, pop);

  let synthetic = 0;
  for (const [lon, lat, pop, m49] of readJson<SyntheticCells>(SYNTHETIC).cells) {
    const key = `${lon},${lat},${m49}`;
    popByCell.set(key, (popByCell.get(key) ?? 0) + pop);
    synthetic++;
  }

  // Summed over every cell the country has, including the ones whose `w` rounded to zero:
  // their population is still part of the gridPop the bake divided by, so dropping them here
  // would bias r upward. Countries with no CDR contribute nothing and fall out below.
  const deaths = new Map<number, number>();
  const population = new Map<number, number>();
  const unmatched = new Map<number, number>();
  for (const [lon, lat, m49, w] of grid.cells) {
    const pop = popByCell.get(`${lon},${lat},${m49}`);
    if (pop === undefined) {
      if (w > 0) unmatched.set(m49, (unmatched.get(m49) ?? 0) + 1);
      continue;
    }
    deaths.set(m49, (deaths.get(m49) ?? 0) + w);
    population.set(m49, (population.get(m49) ?? 0) + pop);
  }

  const rates: Record<string, number> = {};
  for (const [m49, d] of deaths) {
    const pop = population.get(m49) as number;
    if (d > 0 && pop > 0) rates[String(m49)] = d / pop;
  }

  // r is only meaningful if it really is uniform within the country — the whole premise of
  // showing it as "the country's rate". Assert it rather than trusting the bake's docstring.
  //
  // Two error terms, both from the grid's own precision rather than from the model:
  //   QUANTUM  `w` ships rounded to six decimals, so pop * r can miss it by half a unit in that
  //            last place however exact the model is. A purely relative test would read that
  //            5e-7 as a 7e-5 error on a cell of 0.007 deaths/yr and fail on perfect arithmetic.
  //   DRIFT    r is recovered as SUM w / SUM pop, and those w were each rounded before summing,
  //            so r carries a relative uncertainty that grows with the cell it multiplies —
  //            Toronto's 3.2M people turn r's ~2e-10 into a 5e-6 residual. The worst case across
  //            the whole grid today is Iceland at 1.6e-9; 1e-8 leaves that room to breathe.
  // A real change of model (a subnational rate replacing the country one) would show up percent-
  // scale, six orders of magnitude above this, so the check still catches what it is for.
  const QUANTUM = 1e-6;
  const DRIFT = 1e-8;
  let worst = { m49: 0, err: 0, tol: 0 };
  for (const [lon, lat, m49, w] of grid.cells) {
    const r = rates[String(m49)];
    const pop = popByCell.get(`${lon},${lat},${m49}`);
    if (!r || pop === undefined) continue;
    const err = Math.abs(pop * r - w);
    const tol = QUANTUM + DRIFT * w;
    if (err - tol > worst.err - worst.tol) worst = { m49, err, tol };
  }
  if (worst.err > worst.tol) {
    throw new Error(
      `Per-cell rate is not uniform within a country (worst m49=${worst.m49}, residual ` +
        `${worst.err.toExponential(2)} deaths/yr against a ${worst.tol.toExponential(2)} ` +
        `tolerance). The grid's rate model has changed; the island cannot show ` +
        `"population x rate" as a country-level product.`,
    );
  }

  // Every country the grid can fire in must come out with a rate, or the island silently drops
  // the population line for whoever is missing.
  const firing = new Set<number>();
  for (const [, , m49, w] of grid.cells) if (w > 0) firing.add(m49);
  const uncovered = [...firing].filter((m49) => !(String(m49) in rates));
  if (uncovered.length) {
    throw new Error(
      `${uncovered.length} countries have grid weight but no recoverable rate: ` +
        `${uncovered.join(", ")}. They would fire deaths the island cannot decompose.`,
    );
  }

  fs.writeFileSync(
    OUT,
    JSON.stringify({
      meta: {
        note:
          "Deaths per gridded person per year, per country, recovered from data/rate-grid.json " +
          "divided by data/density-grid.json. Uniform within a country by construction: " +
          "cellPop = w / rate. Derived, not fetched — see scripts/build-country-rate.ts.",
        year: grid.meta.year,
        derivedFrom: [
          "data/rate-grid.json",
          "data/density-grid.json",
          "data/source/synthetic-cells.json",
        ],
        sources: grid.meta.sources,
        countries: Object.keys(rates).length,
      },
      rates,
    }),
  );

  console.log(
    `Wrote ${rel(OUT)}: ${Object.keys(rates).length} countries, every one the grid can fire in, ` +
      `${synthetic} synthetic cells folded in.`,
  );
  if (unmatched.size) {
    const worstFirst = [...unmatched].sort((a, b) => b[1] - a[1]).slice(0, 5);
    // Expected, and harmless: gen-synthetic-cells.ts places its cells by rejection sampling, so
    // re-running it moves them. A country baked from an older draw keeps its rate anyway — every
    // synthetic cell of a country carries the same population and the same w, so whichever subset
    // still lines up yields the identical ratio. Reported because a large count for a *real*
    // country would mean the two grids had genuinely drifted apart.
    console.warn(
      `build-country-rate: ${[...unmatched.values()].reduce((a, b) => a + b, 0)} weighted cells had ` +
        `no population row (m49 x cells: ${worstFirst.map(([m, n]) => `${m}x${n}`).join(", ")}) — ` +
        `expected for the synthetic three (499, 688, 728).`,
    );
  }
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
