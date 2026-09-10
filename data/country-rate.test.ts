import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// data/country-rate.json exists so the island can show a death's placement as a multiplication —
// "12,400 people x 9.53 per 1,000/yr" — rather than as the single baked number the grid ships.
// That claim is only honest if the two factors really do reproduce the grid's own weight, so this
// checks the identity against every populated cell rather than trusting the build script that
// wrote the file. If the grid is ever rebaked with a subnational rate, these fail loudly and the
// card's copy has to change with it.
//
// See scripts/build-country-rate.ts for the derivation and the two error terms below.

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = <T,>(f: string): T =>
  JSON.parse(fs.readFileSync(path.join(ROOT, "data", f), "utf8")) as T;

interface RateGrid {
  cells: [lon: number, lat: number, m49: number, w: number][];
}
interface DensityGrid {
  cells: [lon: number, lat: number, pop: number, m49: number][];
}
interface CountryRate {
  meta: { countries: number };
  rates: Record<string, number>;
}

const grid = read<RateGrid>("rate-grid.json");
const density = read<DensityGrid>("density-grid.json");
const { rates } = read<CountryRate>("country-rate.json");

// The country has to be part of the key: the synthetic cells invented for South Sudan land in
// bins GPWv4 had already given to Sudan.
const popByCell = new Map<string, number>();
for (const [lon, lat, pop, m49] of density.cells) popByCell.set(`${lon},${lat},${m49}`, pop);

describe("data/country-rate.json", () => {
  it("covers every country the grid can fire a death in", () => {
    const firing = new Set<number>();
    for (const [, , m49, w] of grid.cells) if (w > 0) firing.add(m49);
    const missing = [...firing].filter((m49) => !(String(m49) in rates));
    expect(missing).toEqual([]);
    expect(firing.size).toBeGreaterThan(150);
  });

  it("reproduces each cell's baked weight as population x rate", () => {
    // `w` ships rounded to six decimals (QUANTUM), and the recovered rate carries a relative
    // uncertainty from summing those rounded values that grows with the cell it multiplies
    // (DRIFT). Both are precision, not model: a subnational rate would miss by percent.
    const QUANTUM = 1e-6;
    const DRIFT = 1e-8;
    let checked = 0;
    let worst = 0;
    for (const [lon, lat, m49, w] of grid.cells) {
      const rate = rates[String(m49)];
      const pop = popByCell.get(`${lon},${lat},${m49}`);
      if (!rate || pop === undefined) continue;
      const residual = Math.abs(pop * rate - w);
      worst = Math.max(worst, residual - (QUANTUM + DRIFT * w));
      checked++;
    }
    expect(checked).toBeGreaterThan(59_000);
    expect(worst).toBeLessThanOrEqual(0);
  });

  it("recovers a population from every weight the island can be asked to explain", () => {
    // The runtime never joins the density grid — it divides. Every firing cell must therefore
    // yield a positive, finite population that rounds to the gridded count.
    let worstRounding = 0;
    for (const [lon, lat, m49, w] of grid.cells) {
      if (!(w > 0)) continue;
      const rate = rates[String(m49)] as number;
      const derived = w / rate;
      expect(Number.isFinite(derived)).toBe(true);
      expect(derived).toBeGreaterThan(0);
      const pop = popByCell.get(`${lon},${lat},${m49}`);
      if (pop !== undefined && pop > 0) {
        worstRounding = Math.max(worstRounding, Math.abs(derived - pop) / pop);
      }
    }
    // A tenth of a person on the smallest inhabited cell — well inside "12,400 people".
    expect(worstRounding).toBeLessThan(1e-4);
  });
});
