// Resolve an age x sex death pyramid for every populated mortality-grid cell, so a death in
// Chukotka stops drawing Moscow's national age structure. Three tiers, tried in order:
//
//   1. Regional  — data/subnational-age-sex.json's real (GBD-modelled) regional weights,
//                  looked up by the cell's region key from data/region-keys.json. 17 countries.
//   2. Derived   — a per-cell pyramid from WorldPop 2020 population x this country's own
//                  age-specific death rate, from data/worldpop-cell-age-sex.json (04-09). Falls
//                  back, per region, to a national pyramid shifted by the region's own crude
//                  death rate gap (data/subnational-cdr.json, 04-04's original estimator) where
//                  WorldPop was not fetched for that country, or where the WorldPop estimator is
//                  measurably worse for that specific country (04-09 task 3 — see
//                  TIER2_PREFER_CDR_GAP below).
//   3. National  — data/mortality-age-sex.json's country pyramid (or the global one).
//
// 04-09 CORRECTS 04-04's SOURCE DEVIATION.
//
// 04-04 concluded WorldPop 2020 gridded age/sex population (the plan's original tier-2 source)
// was infeasible: it tested only the global 1km mosaic (~3.28 GB PER age-sex band, 36 bands =
// ~118 GB) and confirmed the host does not honour HTTP range requests. Both of those findings
// hold. What 04-04 missed: WorldPop also publishes a 1km PER-COUNTRY tree at the same
// resolution — one Nigerian band is 5.1 MB, not 3.28 GB — verified by HTTP probe and used here.
// See pipeline/sources/worldpop.py's module docstring for the full account, and
// 04-04-SUMMARY.md's correction block for the record.
//
// Tier 2 is now a real population x rate model, not a single-scalar shift: national
// age-specific death rate (data/mortality-age-sex.json deaths ÷ WorldPop-summed national
// population, per band x sex) times this cell's own WorldPop population, independently
// resolving 18 numbers per cell instead of shifting one degree of freedom (young/old mass) the
// way the 04-04 CDR-gap proxy did. The CDR-gap proxy is KEPT — not deleted — as the fallback for
// countries WorldPop was not fetched for (budget- or time-bounded, see
// data/worldpop-cell-age-sex.json's meta.skippedCountries), and 04-09 task 3 measures both
// estimators against 04-08's observed regional data before deciding, per country, which ships.
//
// Payload: naive per-cell pyramids would be ~1.08M numbers across 59,954 cells. Instead every
// resolved pyramid (tier 1, 2 or 3) is clustered into a small set of age-structure archetypes,
// and each cell ships only a class id (+ which tier answered) into a separate file aligned to
// rate-grid.json's cell order — never a wider rate-grid row, so the ACLED conflict layer's
// "lon,lat" cell snap and pipeline/climate_fallback.py's fixed 4-value cell unpack stay intact.
//
// Output: data/age-sex-cells.json
//   { meta: {...}, archetypes: [{m:[9],f:[9]}...], classId: [59954 ints], tier: [59954 ints] }
//   tier: 0 = regional, 1 = derived, 2 = national.
//
// Usage: node --import tsx scripts/build-age-sex-cells.ts [--force]

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import isoCountries from "i18n-iso-countries";
import * as topojson from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, Geometry } from "geojson";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "data", "age-sex-cells.json");

const force = process.argv.includes("--force");
if (fs.existsSync(OUT) && !force) {
  console.log(`${path.relative(ROOT, OUT)} already exists — pass --force to rebuild.`);
  process.exit(0);
}

// MUST match BANDS in build-causes.ts, build-mortality.ts, build-subnational-age-sex.ts,
// AGE_BANDS in app/globe/persona.ts, and BANDS in pipeline/age_bands.py.
const BANDS: [number, number][] = [
  [0, 0],
  [1, 4],
  [5, 14],
  [15, 29],
  [30, 49],
  [50, 64],
  [65, 74],
  [75, 84],
  [85, 200],
];
const OLD_IDX = [6, 7, 8]; // 65+ — every other band index (0-5) is "young"
const ARCHETYPE_COUNT = 20; // plan target: 12-24

type Sex = "m" | "f";
interface Pyramid {
  m: number[];
  f: number[];
}
// Raw (unnormalised) population by band — WorldPop's own unit, before a Pyramid's m[]+f[]==1
// normalisation is applied.
interface Population {
  m: number[];
  f: number[];
}
type Tier = 0 | 1 | 2; // regional | derived | national

function readJson<T>(rel: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8")) as T;
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function normalisePyramid(p: Population): Pyramid | undefined {
  const total = sum(p.m) + sum(p.f);
  if (!(total > 0)) return undefined;
  return { m: p.m.map((v) => v / total), f: p.f.map((v) => v / total) };
}

// Share of deaths at 65+, over BOTH sexes combined (m[]+f[] together sum to 1 for a Pyramid).
function elderlyShare(p: Pyramid): number {
  return sum(OLD_IDX.map((i) => (p.m[i] ?? 0) + (p.f[i] ?? 0)));
}

function m49Of(iso3: string): number {
  return Number(isoCountries.alpha3ToNumeric(iso3) ?? "");
}

// --- Load everything up front -----------------------------------------------------------

interface RateGrid {
  cells: [lon: number, lat: number, m49: number, w: number][];
}
interface RegionKeys {
  keys: { geo: string; key: string; country: string }[];
  cells: number[];
  count: number;
}
interface MortalityData {
  global: Pyramid;
  countries: Record<string, Pyramid>;
}
interface SubnationalRegion {
  geo: string;
  key: string;
  country: string;
  measurement: string;
  m: number[];
  f: number[];
}
interface SubnationalAgeSex {
  meta: { matchedDeathShare: number; byCountry: Record<string, unknown> };
  regions: SubnationalRegion[];
}
interface CdrRegion {
  geo: string;
  key: string;
  name: string;
  country: string;
  cdrPer1000: number;
  ratePer100k: number;
}
interface SubnationalCdr {
  countryRates: Record<string, number>;
  regions: CdrRegion[];
}
interface WorldpopCellAgeSex {
  meta: {
    coveredCountries: string[];
    skippedCountries: { iso3: string; m49: number; notTier1DeathShare: number; reason: string }[];
    coveredDeathShareOfWorld: number;
  };
  // Dense, aligned to rate-grid.json's own cell order (length === grid.cells.length, same
  // convention as data/region-keys.json's `cells`): -1 where WorldPop was not fetched, else the
  // row index into `m`/`f` below.
  cells: number[];
  m: number[][];
  f: number[][];
}

const grid = readJson<RateGrid>("data/rate-grid.json");
const regionKeys = readJson<RegionKeys>("data/region-keys.json");
if (regionKeys.cells.length !== grid.cells.length) {
  throw new Error(
    `data/region-keys.json (${regionKeys.cells.length} cells) is not aligned to ` +
      `data/rate-grid.json (${grid.cells.length} cells)`,
  );
}
const mort = readJson<MortalityData>("data/mortality-age-sex.json");
const subAgeSex = readJson<SubnationalAgeSex>("data/subnational-age-sex.json");
const cdr = readJson<SubnationalCdr>("data/subnational-cdr.json");

const worldpopPath = path.join(ROOT, "data", "worldpop-cell-age-sex.json");
const worldpop: WorldpopCellAgeSex | undefined = fs.existsSync(worldpopPath)
  ? readJson<WorldpopCellAgeSex>("data/worldpop-cell-age-sex.json")
  : undefined;
if (!worldpop) {
  console.log(
    "data/worldpop-cell-age-sex.json not found — tier 2 falls back to the CDR-gap proxy " +
      "everywhere. Run `python -m pipeline fetch-worldpop && python -m pipeline worldpop` first.",
  );
} else if (worldpop.cells.length !== grid.cells.length) {
  throw new Error(
    `data/worldpop-cell-age-sex.json (${worldpop.cells.length} cells) is not aligned to ` +
      `data/rate-grid.json (${grid.cells.length} cells)`,
  );
}

// National pyramid (normalised weights, m[]+f[] sum to 1), country falling back to global —
// mirrors app/globe/persona.ts's mortFor() so tier 3 here is exactly what the client would have
// used anyway.
function nationalPyramid(m49: number): Pyramid {
  const row = mort.countries[String(m49)] ?? mort.global;
  const total = sum(row.m) + sum(row.f);
  if (!(total > 0)) return { m: new Array(9).fill(0), f: new Array(9).fill(0) };
  return { m: row.m.map((v) => v / total), f: row.f.map((v) => v / total) };
}

// Redistribute a national pyramid's mass between the 65+ bands and everything younger to hit a
// target elderly share, preserving relative shape (including the male/female split) within each
// half. This is the CDR-gap proxy's only operation — one degree of freedom, matching the one
// scalar signal (a region's CDR gap) that feeds it. Kept as tier 2's fallback estimator; see
// TIER2_PREFER_CDR_GAP below for when it ships instead of the WorldPop population model.
function shiftPyramid(nat: Pyramid, targetOld: number): Pyramid {
  const natOld = elderlyShare(nat);
  const natYoung = 1 - natOld;
  const scaleOld = natOld > 0 ? targetOld / natOld : 0;
  const scaleYoung = natYoung > 0 ? (1 - targetOld) / natYoung : 0;
  const scaleAt = (i: number) => (OLD_IDX.includes(i) ? scaleOld : scaleYoung);
  return {
    m: nat.m.map((v, i) => v * scaleAt(i)),
    f: nat.f.map((v, i) => v * scaleAt(i)),
  };
}

// --- Tier 1: index the real regional weights by "geo:key" -------------------------------

const tier1ByKey = new Map<string, Pyramid>();
for (const r of subAgeSex.regions) tier1ByKey.set(`${r.geo}:${r.key}`, { m: r.m, f: r.f });

// --- Tier-1 join diagnostic --------------------------------------------------------------------
// The bug this exists to catch: GBD publishes UK subnational units as NUTS-2, so
// subnational-age-sex.json emits nuts2:UKC1..., while build-region-keys.ts used to key every UK
// cell adm1:GBR-nnnn. Nought of 41 keys joined, 226 UK cells silently took a derived pyramid
// instead of the measured one, and no output anywhere said so. An individual key winning no cell is
// normal at 0.5 degrees — inner-London NUTS-2 regions are smaller than a single grid cell — so that
// only warns. An ENTIRE country joining nothing is never a data quirk; it is always a key-space
// bug, so that throws.
const tier1KeysWithCells = new Set<string>();
for (const ridx of regionKeys.cells) {
  if (ridx < 0) continue;
  const k = regionKeys.keys[ridx] as { geo: string; key: string };
  const id = `${k.geo}:${k.key}`;
  if (tier1ByKey.has(id)) tier1KeysWithCells.add(id);
}
const tier1JoinByCountry: Record<string, { keys: number; joined: number; unmatched: string[] }> =
  {};
for (const r of subAgeSex.regions) {
  const row = (tier1JoinByCountry[r.country] ??= { keys: 0, joined: 0, unmatched: [] });
  row.keys++;
  if (tier1KeysWithCells.has(`${r.geo}:${r.key}`)) row.joined++;
  else row.unmatched.push(r.key);
}
const orphanedCountries = Object.entries(tier1JoinByCountry)
  .filter(([, v]) => v.joined === 0)
  .map(([country, v]) => `${country} (${v.keys} keys)`);
if (orphanedCountries.length) {
  throw new Error(
    `Tier-1 key space is broken: not one region key joins any grid cell for ` +
      `${orphanedCountries.join(", ")}. data/subnational-age-sex.json and data/region-keys.json ` +
      `disagree on the geo layer for these countries — rebuild region-keys.json rather than ` +
      `letting these regions fall through to a derived pyramid.`,
  );
}
for (const [country, v] of Object.entries(tier1JoinByCountry)) {
  if (v.joined === v.keys) continue;
  console.log(
    `  tier-1 join: ${country} ${v.joined}/${v.keys} keys win a cell ` +
      `(no cell for ${v.unmatched.join(", ")})`,
  );
}

// --- CDR-gap proxy calibration (04-04's original tier 2; kept as a fallback estimator) --------
// k: elderlyShareDeviation ~= k * ln(regionalCDR / nationalCDR)
// Fit only where BOTH a real tier-1 pyramid and a subnational-cdr.json entry exist for the same
// region — 519 regions across 17 countries, all already committed. Through-origin OLS: a region
// exactly at the national CDR should have exactly the national pyramid.

interface CalPoint {
  key: string;
  country: string;
  gap: number;
  trueDeviation: number;
}
const calibration: CalPoint[] = [];
for (const r of cdr.regions) {
  const nationalRate = cdr.countryRates[r.country];
  if (nationalRate === undefined || !(nationalRate > 0) || !(r.ratePer100k > 0)) continue;
  const t1 = tier1ByKey.get(`${r.geo}:${r.key}`);
  if (!t1) continue;
  const m49 = m49Of(r.country);
  if (!m49) continue;
  const nat = nationalPyramid(m49);
  calibration.push({
    key: `${r.geo}:${r.key}`,
    country: r.country,
    gap: Math.log(r.ratePer100k / nationalRate),
    trueDeviation: elderlyShare(t1) - elderlyShare(nat),
  });
}
let sumGD = 0;
let sumGG = 0;
for (const c of calibration) {
  sumGD += c.gap * c.trueDeviation;
  sumGG += c.gap * c.gap;
}
const K_COEF = sumGG > 0 ? sumGD / sumGG : 0;

let sse = 0;
let sseBaseline = 0;
let maeFit = 0;
let maeBaseline = 0;
for (const c of calibration) {
  const pred = K_COEF * c.gap;
  sse += (c.trueDeviation - pred) ** 2;
  sseBaseline += c.trueDeviation ** 2;
  maeFit += Math.abs(c.trueDeviation - pred);
  maeBaseline += Math.abs(c.trueDeviation);
}
const nCal = calibration.length || 1;
const r2 = sseBaseline > 0 ? 1 - sse / sseBaseline : 0;
maeFit /= nCal;
maeBaseline /= nCal;

const worstFit = [...calibration]
  .map((c) => ({ ...c, residual: Math.abs(c.trueDeviation - K_COEF * c.gap) }))
  .sort((a, b) => b.residual - a.residual)
  .slice(0, 10)
  .map((c) => ({
    key: c.key,
    country: c.country,
    trueDeviationPct: Number((c.trueDeviation * 100).toFixed(1)),
    predictedDeviationPct: Number((K_COEF * c.gap * 100).toFixed(1)),
  }));

console.log(
  `CDR-gap proxy calibration: k=${K_COEF.toFixed(3)} over ${calibration.length} regions with ` +
    `both a real pyramid and a CDR entry. R2=${r2.toFixed(3)}, MAE ${(maeFit * 100).toFixed(2)}pp ` +
    `vs ${(maeBaseline * 100).toFixed(2)}pp assuming no regional variation.`,
);

// --- CDR-gap proxy tier: shift the national pyramid for every CDR region with no tier-1 truth --

const cdrGapByKey = new Map<string, Pyramid>();
for (const r of cdr.regions) {
  const key = `${r.geo}:${r.key}`;
  if (tier1ByKey.has(key)) continue; // tier 1 wins; no need to compute a shift for it
  const nationalRate = cdr.countryRates[r.country];
  if (nationalRate === undefined || !(nationalRate > 0) || !(r.ratePer100k > 0)) continue;
  const m49 = m49Of(r.country);
  if (!m49) continue;
  const nat = nationalPyramid(m49);
  const gap = Math.log(r.ratePer100k / nationalRate);
  const target = clamp(elderlyShare(nat) + K_COEF * gap, 0.01, 0.95);
  cdrGapByKey.set(key, shiftPyramid(nat, target));
}

// --- 04-09: WorldPop population x national-rate tier ------------------------------------
// Cell pyramid = this cell's own WorldPop population by band x sex, times the country's own
// age-specific death RATE by band x sex (national deaths ÷ national population, both summed
// from the same WorldPop cells) — 18 independently resolved numbers, not one scalar shift.

const wpPopByCell = new Map<number, Population>();
if (worldpop) {
  worldpop.cells.forEach((row, cellIdx) => {
    if (row < 0) return;
    wpPopByCell.set(cellIdx, { m: worldpop.m[row] as number[], f: worldpop.f[row] as number[] });
  });
}

// National population by band x sex, summed from every WorldPop cell belonging to that m49 —
// "sum the WorldPop cells for that country", per the plan, using rate-grid's own m49 (not an
// ISO3 re-derivation) so this is exact for every cell WorldPop was fetched for.
const nationalPopByM49 = new Map<number, Population>();
grid.cells.forEach(([, , m49], i) => {
  const pop = wpPopByCell.get(i);
  if (!pop) return;
  const acc = nationalPopByM49.get(m49) ?? { m: new Array(9).fill(0), f: new Array(9).fill(0) };
  acc.m = acc.m.map((v, b) => v + (pop.m[b] ?? 0));
  acc.f = acc.f.map((v, b) => v + (pop.f[b] ?? 0));
  nationalPopByM49.set(m49, acc);
});

// rate[band][sex] = national deaths / national WorldPop population, per country. 0 where
// population is 0 (band has WorldPop coverage but literally nobody in it) or the country has no
// WorldPop coverage at all.
const nationalRateByM49 = new Map<number, Population>();
for (const [m49, pop] of nationalPopByM49) {
  const deaths = mort.countries[String(m49)] ?? mort.global;
  nationalRateByM49.set(m49, {
    m: pop.m.map((p, b) => (p > 0 ? (deaths.m[b] ?? 0) / p : 0)),
    f: pop.f.map((p, b) => (p > 0 ? (deaths.f[b] ?? 0) / p : 0)),
  });
}

// Per-CELL WorldPop-derived pyramid — the fine-grained result the plan asks for ("Tier 2 answers
// for any cell with WorldPop coverage"), independent of region boundaries.
function worldpopCellPyramid(cellIdx: number, m49: number): Pyramid | undefined {
  const pop = wpPopByCell.get(cellIdx);
  const rate = nationalRateByM49.get(m49);
  if (!pop || !rate) return undefined;
  return normalisePyramid({
    m: pop.m.map((p, b) => p * (rate.m[b] ?? 0)),
    f: pop.f.map((p, b) => p * (rate.f[b] ?? 0)),
  });
}

// Per-REGION WorldPop-derived pyramid — sums this region's cells' raw population first, then
// applies the same national rate once. Mathematically identical to population-weighting the
// per-cell pyramids (the rate is constant within a country), and this is the resolution the
// observed-regional validation and the "which estimator wins per country" decision compare at,
// since data/observed-regional-age-sex.json's ground truth is itself regional.
const cellsByRegionIdx = new Map<number, number[]>();
regionKeys.cells.forEach((ridx, i) => {
  if (ridx < 0) return;
  const arr = cellsByRegionIdx.get(ridx) ?? [];
  arr.push(i);
  cellsByRegionIdx.set(ridx, arr);
});

function worldpopRegionPyramid(ridx: number): Pyramid | undefined {
  const cells = cellsByRegionIdx.get(ridx);
  if (!cells || !cells.length) return undefined;
  const country = (regionKeys.keys[ridx] as { country: string }).country;
  const m49 = m49Of(country);
  const rate = nationalRateByM49.get(m49);
  if (!rate) return undefined;
  const pop: Population = { m: new Array(9).fill(0), f: new Array(9).fill(0) };
  let any = false;
  for (const cellIdx of cells) {
    const cellPop = wpPopByCell.get(cellIdx);
    if (!cellPop) continue;
    any = true;
    pop.m = pop.m.map((v, b) => v + (cellPop.m[b] ?? 0));
    pop.f = pop.f.map((v, b) => v + (cellPop.f[b] ?? 0));
  }
  if (!any) return undefined;
  return normalisePyramid({
    m: pop.m.map((p, b) => p * (rate.m[b] ?? 0)),
    f: pop.f.map((p, b) => p * (rate.f[b] ?? 0)),
  });
}

// --- Resolve one pyramid per DISTINCT region key, for two candidate tier-2 estimators --------
// (needed to score both against 04-08's observed data before deciding which ships per country)

interface Resolved {
  tier: Tier;
  p: Pyramid;
}

function resolveRegions(
  tier2For: (ridx: number, country: string) => Pyramid | undefined,
): Resolved[] {
  return regionKeys.keys.map((k, ridx) => {
    const key = `${k.geo}:${k.key}`;
    const t1 = tier1ByKey.get(key);
    if (t1) return { tier: 0, p: t1 };
    const t2 = tier2For(ridx, k.country);
    if (t2) return { tier: 1, p: t2 };
    return { tier: 2, p: nationalPyramid(m49Of(k.country)) };
  });
}

const resolvedPopulationTier2 = resolveRegions((ridx) => worldpopRegionPyramid(ridx));
const resolvedCdrGapTier2 = resolveRegions((ridx) => {
  const k = regionKeys.keys[ridx] as { geo: string; key: string };
  return cdrGapByKey.get(`${k.geo}:${k.key}`);
});

// --- Observed-validation harness (04-04 task 4), factored so it can score any resolver -------

interface ObservedSource {
  key: string;
  country: string;
  geo: string;
  bands: [number, number][];
  deaths: number;
}
interface ObservedRow {
  country: string;
  geo: string;
  iso_region: string;
  band: number;
  sex: Sex;
  deaths: number;
}
interface ObservedData {
  meta: { sources: ObservedSource[] };
  rows: ObservedRow[];
}

function foldToBands(nineBand: number[], targets: [number, number][]): number[] {
  return targets.map(([tlo, thi]) => {
    let out = 0;
    BANDS.forEach(([lo, hi], i) => {
      const width = hi - lo + 1;
      const overlap = Math.max(0, Math.min(hi, thi) - Math.max(lo, tlo) + 1);
      if (overlap > 0) out += (nineBand[i] ?? 0) * (overlap / width);
    });
    return out;
  });
}

type BySource = Record<
  string,
  {
    country: string;
    regionsCompared: number;
    regionsMissingKey: number;
    tierUsed: Record<string, number>;
    meanAbsErrorPct: number;
    nationalBaselineMeanAbsErrorPct: number;
    worstRegions: { region: string; tier: string; errorPct: number }[];
  }
>;

const TIER_NAME = ["regional", "derived", "national"];

function scoreAgainstObserved(
  resolvedByRegionIdx: Resolved[],
  observed: ObservedData,
  isoToAdm1: Map<string, string>,
  regionKeyIndex: Map<string, number>,
): BySource {
  const bySource: BySource = {};

  for (const source of observed.meta.sources) {
    const rows = observed.rows.filter((r) => r.country === source.country);
    const byRegion = new Map<string, ObservedRow[]>();
    for (const r of rows) {
      if (!byRegion.has(r.iso_region)) byRegion.set(r.iso_region, []);
      byRegion.get(r.iso_region)!.push(r);
    }

    let missingKey = 0;
    const tierUsed: Record<string, number> = { regional: 0, derived: 0, national: 0 };
    const errors: { region: string; tier: string; errorPct: number }[] = [];
    const baselineErrors: number[] = []; // same regions, using the plain national pyramid

    const countryM49 = m49Of(source.country);
    const baselinePyramid = nationalPyramid(countryM49);

    for (const [isoRegion, regionRows] of byRegion) {
      const adm1 = isoToAdm1.get(isoRegion);
      const ridx = adm1 ? regionKeyIndex.get(`adm1:${adm1}`) : undefined;
      if (ridx === undefined) {
        missingKey++;
        continue;
      }
      const resolved = resolvedByRegionIdx[ridx] as Resolved;
      const tierName = TIER_NAME[resolved.tier] as string;
      tierUsed[tierName] = (tierUsed[tierName] ?? 0) + 1;

      const total = regionRows.reduce((a, r) => a + r.deaths, 0);
      if (!(total > 0)) continue;

      if (source.bands.length === 1) {
        // Australia: only a sex ratio is comparable, no age detail in this source.
        const m = regionRows.filter((r) => r.sex === "m").reduce((a, r) => a + r.deaths, 0);
        const observedMaleShare = m / total;
        const resolvedMaleShare = sum(resolved.p.m);
        errors.push({
          region: isoRegion,
          tier: TIER_NAME[resolved.tier] as string,
          errorPct: Math.abs(observedMaleShare - resolvedMaleShare) * 100,
        });
        baselineErrors.push(Math.abs(observedMaleShare - sum(baselinePyramid.m)) * 100);
        continue;
      }

      const observedShares: number[] = source.bands.map(() => 0);
      for (const r of regionRows)
        observedShares[r.band] = (observedShares[r.band] ?? 0) + r.deaths / total;

      const foldedBandTotalsOf = (p: Pyramid) => {
        const folded = [...foldToBands(p.m, source.bands), ...foldToBands(p.f, source.bands)];
        return source.bands.map(
          (_, i) => (folded[i] ?? 0) + (folded[i + source.bands.length] ?? 0),
        );
      };
      const resolvedBandTotals = foldedBandTotalsOf(resolved.p);
      const tvd = sum(observedShares.map((v, i) => Math.abs(v - (resolvedBandTotals[i] ?? 0)))) / 2;
      errors.push({
        region: isoRegion,
        tier: TIER_NAME[resolved.tier] as string,
        errorPct: tvd * 100,
      });

      const baselineBandTotals = foldedBandTotalsOf(baselinePyramid);
      const baselineTvd =
        sum(observedShares.map((v, i) => Math.abs(v - (baselineBandTotals[i] ?? 0)))) / 2;
      baselineErrors.push(baselineTvd * 100);
    }

    const meanAbsErrorPct = errors.length
      ? sum(errors.map((e) => e.errorPct)) / errors.length
      : NaN;
    const nationalBaselineMeanAbsErrorPct = baselineErrors.length
      ? sum(baselineErrors) / baselineErrors.length
      : NaN;
    bySource[source.key] = {
      country: source.country,
      regionsCompared: errors.length,
      regionsMissingKey: missingKey,
      tierUsed,
      meanAbsErrorPct: Number(meanAbsErrorPct.toFixed(2)),
      nationalBaselineMeanAbsErrorPct: Number(nationalBaselineMeanAbsErrorPct.toFixed(2)),
      worstRegions: [...errors]
        .sort((a, b) => b.errorPct - a.errorPct)
        .slice(0, 5)
        .map((e) => ({
          region: e.region,
          tier: e.tier,
          errorPct: Number(e.errorPct.toFixed(2)),
        })),
    };
  }
  return bySource;
}

const observedPath = path.join(ROOT, "data", "observed-regional-age-sex.json");
let observed: ObservedData | undefined;
const isoToAdm1 = new Map<string, string>();
let regionKeyIndex = new Map<string, number>();
if (fs.existsSync(observedPath)) {
  observed = readJson<ObservedData>("data/observed-regional-age-sex.json");
  const admin1 = readJson<Topology>("data/admin1-10m.json");
  const admin1Features = topojson.feature(
    admin1,
    admin1.objects.ne_10m_admin_1 as GeometryCollection,
  ).features as Feature<Geometry>[];
  for (const f of admin1Features) {
    const props = (f.properties ?? {}) as Record<string, unknown>;
    const iso = props.iso_3166_2 as string | undefined;
    const adm1 = props.adm1_code as string | undefined;
    if (iso && adm1 && !isoToAdm1.has(iso)) isoToAdm1.set(iso, adm1);
  }
  regionKeyIndex = new Map<string, number>(regionKeys.keys.map((k, i) => [`${k.geo}:${k.key}`, i]));
}

const populationScore = observed
  ? scoreAgainstObserved(resolvedPopulationTier2, observed, isoToAdm1, regionKeyIndex)
  : undefined;
const cdrGapScore = observed
  ? scoreAgainstObserved(resolvedCdrGapTier2, observed, isoToAdm1, regionKeyIndex)
  : undefined;

// --- Decide, per country, which tier-2 estimator ships ---------------------------------------
// Only Canada and Australia actually resolve via tier 2 among the four validated countries
// (Brazil and Mexico are tier 1 throughout) — so those are the only two the decision applies to.
// Default is the WorldPop population model (18 independently resolved numbers beat one scalar
// shift, and it is available for every cell WorldPop was fetched for, not just CDR-carrying
// regions) UNLESS the measured mean error is worse than the CDR-gap proxy's, per the plan's
// explicit "if the WorldPop tier loses on a country, the proxy stays as that country's
// estimator" — decided here from real numbers, never asserted.
const TIER2_PREFER_CDR_GAP = new Set<number>();
const decisionLog: Record<string, string> = {};
if (populationScore && cdrGapScore) {
  for (const key of Object.keys(populationScore)) {
    const pop = populationScore[key];
    const cdrGap = cdrGapScore[key];
    if (!pop || !cdrGap) continue;
    const m49 = m49Of(pop.country);
    if (pop.tierUsed.derived === 0 && cdrGap.tierUsed.derived === 0) {
      decisionLog[pop.country] = "tier 1 answers throughout — estimator choice does not apply";
      continue;
    }
    if (cdrGap.meanAbsErrorPct < pop.meanAbsErrorPct) {
      TIER2_PREFER_CDR_GAP.add(m49);
      decisionLog[pop.country] =
        `CDR-gap proxy wins (${cdrGap.meanAbsErrorPct}pp vs population ${pop.meanAbsErrorPct}pp) — ships instead of WorldPop for this country`;
    } else {
      decisionLog[pop.country] =
        `WorldPop population model wins or ties (${pop.meanAbsErrorPct}pp vs CDR-gap ${cdrGap.meanAbsErrorPct}pp) — ships`;
    }
  }
}
console.log("Tier-2 estimator decision:", JSON.stringify(decisionLog, null, 2));

// --- Resolve one pyramid per DISTINCT region key for the FINAL, shipped resolver -------------
// (used by the observed-validation report below and as the fallback for cells whose own
// WorldPop cell-level data is unavailable but their region's aggregate/CDR-gap is)

const resolvedByRegionIdx: Resolved[] = regionKeys.keys.map((k, ridx) => {
  const key = `${k.geo}:${k.key}`;
  const t1 = tier1ByKey.get(key);
  if (t1) return { tier: 0, p: t1 };
  const m49 = m49Of(k.country);
  const preferCdrGap = TIER2_PREFER_CDR_GAP.has(m49);
  const wp = preferCdrGap ? undefined : worldpopRegionPyramid(ridx);
  if (wp) return { tier: 1, p: wp };
  const cdrGap = cdrGapByKey.get(key);
  if (cdrGap) return { tier: 1, p: cdrGap };
  const wpFallback = worldpopRegionPyramid(ridx); // WorldPop even where CDR-gap lost, if that's all there is
  if (wpFallback) return { tier: 1, p: wpFallback };
  return { tier: 2, p: nationalPyramid(m49) };
});

const cellTier = new Uint8Array(grid.cells.length);
const cellPyramid: Pyramid[] = new Array(grid.cells.length);
grid.cells.forEach(([, , m49], i) => {
  const ridx = regionKeys.cells[i] as number;
  const key =
    ridx >= 0
      ? `${(regionKeys.keys[ridx] as { geo: string }).geo}:${(regionKeys.keys[ridx] as { key: string }).key}`
      : undefined;

  // Tier 0: real regional pyramid wins outright.
  const t1 = key ? tier1ByKey.get(key) : undefined;
  if (t1) {
    cellTier[i] = 0;
    cellPyramid[i] = t1;
    return;
  }

  // Tier 1 ("derived"): per-cell WorldPop population x national rate, unless this country's
  // CDR-gap proxy measurably wins (04-09 task 3's decision) or this cell has no WorldPop
  // coverage at all — falls back to the region's CDR-gap shift, then to WorldPop's own
  // region-level aggregate (covers a cell with no direct WorldPop row but whose region has
  // some), before finally falling through to national.
  const preferCdrGap = TIER2_PREFER_CDR_GAP.has(m49);
  const wpCell = preferCdrGap ? undefined : worldpopCellPyramid(i, m49);
  if (wpCell) {
    cellTier[i] = 1;
    cellPyramid[i] = wpCell;
    return;
  }
  const cdrGap = key ? cdrGapByKey.get(key) : undefined;
  if (cdrGap) {
    cellTier[i] = 1;
    cellPyramid[i] = cdrGap;
    return;
  }
  const wpFallback = ridx >= 0 ? worldpopRegionPyramid(ridx) : undefined;
  if (wpFallback) {
    cellTier[i] = 1;
    cellPyramid[i] = wpFallback;
    return;
  }

  // Tier 2 ("national"): fallback.
  cellTier[i] = 2;
  cellPyramid[i] = nationalPyramid(m49);
});

// --- Tier-mix report, weighted by expected deaths (the grid's own weight column) --------

const tierWeight = [0, 0, 0];
let totalWeight = 0;
grid.cells.forEach(([, , , w], i) => {
  const t = cellTier[i] as number;
  tierWeight[t] = (tierWeight[t] ?? 0) + w;
  totalWeight += w;
});
const tierShare = tierWeight.map((w) => (totalWeight > 0 ? w / totalWeight : 0));
console.log(
  `Tier mix by expected deaths: regional ${(tierShare[0]! * 100).toFixed(2)}%, ` +
    `derived ${(tierShare[1]! * 100).toFixed(2)}%, national ${(tierShare[2]! * 100).toFixed(2)}%.`,
);

// --- Cluster resolved pyramids into a small set of archetypes ---------------------------
// Weighted k-means over DISTINCT pyramids (not all 59,954 cells) keyed by their rounded vector,
// weighted by how many expected deaths use that exact vector. Deterministic seeding (no RNG):
// centers are picked at evenly spaced cumulative-weight quantiles after sorting by elderly
// share, so a rerun of this script is reproducible.

interface Distinct {
  vec: number[];
  weight: number;
}
const distinctMap = new Map<string, Distinct>();
grid.cells.forEach(([, , , w], i) => {
  const p = cellPyramid[i] as Pyramid;
  const vec = [...p.m, ...p.f];
  const keyStr = vec.map((v) => v.toFixed(6)).join(",");
  const d = distinctMap.get(keyStr);
  if (d) d.weight += w;
  else distinctMap.set(keyStr, { vec, weight: w });
});
const keyStrs = [...distinctMap.keys()];
const distinct = keyStrs.map((k) => distinctMap.get(k) as Distinct);

function dist2(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = (a[i] as number) - (b[i] as number);
    s += d * d;
  }
  return s;
}

const K = Math.min(ARCHETYPE_COUNT, distinct.length) || 1;
function elderlySharesOf(vec: number[]): number {
  let s = 0;
  for (const i of OLD_IDX) s += (vec[i] ?? 0) + (vec[i + 9] ?? 0);
  return s;
}
const sorted = [...distinct].sort((a, b) => elderlySharesOf(a.vec) - elderlySharesOf(b.vec));

const totalDistinctWeight = sorted.reduce((s, d) => s + d.weight, 0) || 1;
let centers: number[][] = [];
{
  let acc = 0;
  let target = totalDistinctWeight / (K * 2);
  for (const d of sorted) {
    acc += d.weight;
    if (acc >= target && centers.length < K) {
      centers.push([...d.vec]);
      target += totalDistinctWeight / K;
    }
  }
  while (centers.length < K) {
    centers.push([
      ...((sorted[sorted.length - 1] as Distinct | undefined)?.vec ?? Array(18).fill(0)),
    ]);
  }
}

const assignment = new Array<number>(distinct.length).fill(0);
for (let iter = 0; iter < 50; iter++) {
  let changed = false;
  for (let i = 0; i < distinct.length; i++) {
    const vec = (distinct[i] as Distinct).vec;
    let best = 0;
    let bd = Infinity;
    for (let ci = 0; ci < centers.length; ci++) {
      const dd = dist2(vec, centers[ci] as number[]);
      if (dd < bd) {
        bd = dd;
        best = ci;
      }
    }
    if (assignment[i] !== best) {
      assignment[i] = best;
      changed = true;
    }
  }
  const sums = centers.map(() => new Array(18).fill(0) as number[]);
  const wsum = new Array<number>(K).fill(0);
  for (let i = 0; i < distinct.length; i++) {
    const d = distinct[i] as Distinct;
    const ci = assignment[i] as number;
    wsum[ci] = (wsum[ci] as number) + d.weight;
    for (let j = 0; j < 18; j++) {
      sums[ci]![j] = (sums[ci]![j] as number) + (d.vec[j] as number) * d.weight;
    }
  }
  centers = centers.map((c, ci) =>
    (wsum[ci] as number) > 0 ? sums[ci]!.map((v) => v / (wsum[ci] as number)) : c,
  );
  if (!changed) break;
}

// Renormalise each archetype defensively (weighted means of vectors that each sum to 1 already
// sum to ~1, this only guards against float drift) and round for a compact payload.
const archetypes = centers.map((c) => {
  const total = sum(c) || 1;
  const norm = c.map((v) => v / total);
  return {
    m: norm.slice(0, 9).map((v) => Number(v.toFixed(6))),
    f: norm.slice(9, 18).map((v) => Number(v.toFixed(6))),
  };
});

const keyStrToClassId = new Map<string, number>(
  keyStrs.map((k, i) => [k, assignment[i] as number]),
);
const classId = new Array<number>(grid.cells.length);
grid.cells.forEach((_cell, i) => {
  const p = cellPyramid[i] as Pyramid;
  const vec = [...p.m, ...p.f];
  const ks = vec.map((v) => v.toFixed(6)).join(",");
  classId[i] = keyStrToClassId.get(ks) ?? 0;
});

// --- Final observed-validation report, against the resolver actually shipped -----------------

const finalValidation = observed
  ? scoreAgainstObserved(resolvedByRegionIdx, observed, isoToAdm1, regionKeyIndex)
  : { note: "data/observed-regional-age-sex.json not found" };

if (observed) {
  for (const [key, s] of Object.entries(finalValidation as BySource)) {
    console.log(
      `Validation vs observed ${key}: ${s.regionsCompared} regions compared ` +
        `(tiers used: ${JSON.stringify(s.tierUsed)}), mean error ${s.meanAbsErrorPct}pp ` +
        `vs ${s.nationalBaselineMeanAbsErrorPct}pp using the flat national pyramid.`,
    );
  }
}

// --- Write output -------------------------------------------------------------------------

const payload = {
  meta: {
    note:
      "Per-cell age x sex death pyramid, resolved in three tiers: 0=regional (real GBD regional " +
      "weights), 1=derived (WorldPop 2020 population x this country's own age-specific death " +
      "rate, per cell — 04-09; falls back to the 04-04 CDR-gap proxy per region where WorldPop " +
      "was not fetched, or where 04-09's own measurement found the proxy scores better for that " +
      "country — see tier2Comparison.decision), 2=national (country or global pyramid). Cells " +
      "ship a classId into `archetypes`, clustered from every resolved pyramid so the payload " +
      "stays small; `tier` records which tier answered per cell.",
    bands: BANDS,
    tiers: ["regional", "derived", "national"],
    cellCount: grid.cells.length,
    archetypeCount: archetypes.length,
    tier1Join: {
      note:
        "Per-country: how many of data/subnational-age-sex.json's region keys win at least one " +
        "grid cell. A key winning none is normal at 0.5 degrees (inner-London NUTS-2 regions are " +
        "smaller than one cell); a country at 0/n is a key-space bug and throws the build.",
      byCountry: tier1JoinByCountry,
    },
    tierMixByExpectedDeaths: {
      regional: Number((tierShare[0]! * 100).toFixed(2)),
      derived: Number((tierShare[1]! * 100).toFixed(2)),
      national: Number((tierShare[2]! * 100).toFixed(2)),
    },
    worldpop: worldpop
      ? {
          coveredCountries: worldpop.meta.coveredCountries,
          coveredCountryCount: worldpop.meta.coveredCountries.length,
          coveredDeathShareOfWorld: worldpop.meta.coveredDeathShareOfWorld,
          skippedCountries: worldpop.meta.skippedCountries,
        }
      : { note: "data/worldpop-cell-age-sex.json not found — tier 2 is CDR-gap-proxy-only" },
    cdrGapProxyCalibration: {
      method:
        "elderlyShareDeviation = k * ln(regionalCDR / nationalCDR), fit through the origin " +
        "against every region with both a real (tier-1) pyramid and a subnational-cdr.json entry. " +
        "04-04's original tier-2 estimator, kept as a fallback where WorldPop has no coverage.",
      k: Number(K_COEF.toFixed(4)),
      regionsUsedForFit: calibration.length,
      r2: Number(r2.toFixed(4)),
      meanAbsErrorPct: Number((maeFit * 100).toFixed(2)),
      baselineMeanAbsErrorPct: Number((maeBaseline * 100).toFixed(2)),
      worstFitRegions: worstFit,
    },
    tier2Comparison: {
      note:
        "Both tier-2 candidate estimators scored against data/observed-regional-age-sex.json " +
        "BEFORE deciding which ships per country (04-09 task 3). Brazil and Mexico resolve via " +
        "tier 1 throughout, so both estimators show identical (tier-1) numbers for them.",
      populationBased: populationScore ?? { note: "data/observed-regional-age-sex.json not found" },
      cdrGapProxy: cdrGapScore ?? { note: "data/observed-regional-age-sex.json not found" },
      decision: decisionLog,
    },
    validationAgainstObserved: finalValidation,
  },
  archetypes,
  classId,
  tier: Array.from(cellTier),
};

fs.writeFileSync(OUT, JSON.stringify(payload));
const rawBytes = fs.statSync(OUT).size;
const gzBytes = zlib.gzipSync(fs.readFileSync(OUT)).length;
console.log(
  `Wrote ${path.relative(ROOT, OUT)}: ${archetypes.length} archetypes, ${grid.cells.length} cells — ` +
    `${rawBytes.toLocaleString()} bytes raw, ${gzBytes.toLocaleString()} bytes gzip.`,
);
