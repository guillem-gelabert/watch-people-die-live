// Resolve an age x sex death pyramid for every populated mortality-grid cell, so a death in
// Chukotka stops drawing Moscow's national age structure. Three tiers, tried in order:
//
//   1. Regional  — data/subnational-age-sex.json's real (GBD-modelled) regional weights,
//                  looked up by the cell's region key from data/region-keys.json. 17 countries.
//   2. Derived   — a national pyramid shifted toward more/less elderly mass using the region's
//                  own crude death rate gap, from data/subnational-cdr.json. 72 countries.
//   3. National  — data/mortality-age-sex.json's country pyramid (or the global one).
//
// SOURCE DEVIATION FROM PLAN, recorded here because it changes what "derived" means:
//
// The plan named WorldPop 2020 gridded age/sex population as tier 2's input (a population
// raster x national age-specific rates). Verified infeasible for this build, not merely
// inconvenient:
//   - WorldPop's global 1km age/sex mosaics (data.worldpop.org/GIS/AgeSex_structures/...) are
//     ~3.28 GB PER age-sex band, 36 bands = ~118 GB for one year. The server also does not
//     honour HTTP range requests (`curl -r 0-1023 ...` returns 200 with the full body, and
//     GDAL's own vsicurl probe reports "Range downloading not supported"), so there is no
//     partial/overview-based read either — it is the full 118 GB or nothing.
//   - The coarse-resolution alternative this project already rejected once, GPWv4 Basic
//     Demographic Characteristics (SEDAC/CIESIN, ships a 30-arc-minute product that would have
//     matched this grid's 0.5deg cells exactly), is unreachable from this environment —
//     `sedac.ciesin.columbia.edu` times out at the TCP layer, independent of any login wall.
//
// Tier 2 instead inverts data/subnational-cdr.json's own regional crude death rate against the
// national one. That file's own meta.note says "most of the between-region gap reflects age
// structure, then real health differences" — so a region's CDR gap is used as a proxy for its
// age-structure deviation from the national pyramid, calibrated (a single scalar coefficient k)
// against the 519 regions where data/subnational-age-sex.json gives a REAL age/sex pyramid to
// check against. This is honestly a coarser signal than a population raster would have given —
// one scalar (the CDR ratio) supports shifting exactly one degree of freedom (the young/old mass
// split), not an independently resolved 18-number pyramid — and it also does not cleanly separate
// "who lives there" from "real regional health outcomes" the way a population-only derivation
// would, because the CDR gap itself is the sum of both. Both limitations are recorded in the
// output's meta and in 04-04-SUMMARY.md. It uses zero new external data: subnational-cdr.json,
// subnational-age-sex.json, mortality-age-sex.json and region-keys.json are all already
// committed, so this tier is fully reproducible offline.
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
// half. This is the only operation tier 2 performs — one degree of freedom, matching the one
// scalar signal (a region's CDR gap) that feeds it.
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

// --- Calibrate k: elderlyShareDeviation ~= k * ln(regionalCDR / nationalCDR) -------------
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
const n = calibration.length || 1;
const r2 = sseBaseline > 0 ? 1 - sse / sseBaseline : 0;
maeFit /= n;
maeBaseline /= n;

// Regions the fit disagrees with sharply (task 4: "list for inspection").
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
  `Tier-2 calibration: k=${K_COEF.toFixed(3)} over ${calibration.length} regions with both a ` +
    `real pyramid and a CDR entry. R2=${r2.toFixed(3)}, MAE ${(maeFit * 100).toFixed(2)}pp vs ` +
    `${(maeBaseline * 100).toFixed(2)}pp assuming no regional variation.`,
);

// --- Tier 2: shift the national pyramid for every CDR region with no tier-1 truth -------

const tier2ByKey = new Map<string, Pyramid>();
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
  tier2ByKey.set(key, shiftPyramid(nat, target));
}

// --- Resolve one pyramid per DISTINCT region key (2,755 of them), then map cells to it --

interface Resolved {
  tier: Tier;
  p: Pyramid;
}
const resolvedByRegionIdx: Resolved[] = regionKeys.keys.map((k) => {
  const key = `${k.geo}:${k.key}`;
  const t1 = tier1ByKey.get(key);
  if (t1) return { tier: 0, p: t1 };
  const t2 = tier2ByKey.get(key);
  if (t2) return { tier: 1, p: t2 };
  return { tier: 2, p: nationalPyramid(m49Of(k.country)) };
});

const cellTier = new Uint8Array(grid.cells.length);
const cellPyramid: Pyramid[] = new Array(grid.cells.length);
grid.cells.forEach(([, , m49], i) => {
  const ridx = regionKeys.cells[i] as number;
  const resolved = ridx >= 0 ? resolvedByRegionIdx[ridx] : undefined;
  if (resolved) {
    cellTier[i] = resolved.tier;
    cellPyramid[i] = resolved.p;
  } else {
    // No region key at all (04-05's 626 unassigned cells) — national pyramid straight from the
    // cell's own country, same fallback persona.ts already uses.
    cellTier[i] = 2;
    cellPyramid[i] = nationalPyramid(m49);
  }
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

// --- Task 4: validate against 04-08's observed regional counts (CAN, AUS, MEX, BRA) -----

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

let observedValidation: unknown = { note: "data/observed-regional-age-sex.json not found" };
const observedPath = path.join(ROOT, "data", "observed-regional-age-sex.json");
if (fs.existsSync(observedPath)) {
  const observed = readJson<ObservedData>("data/observed-regional-age-sex.json");

  const admin1 = readJson<Topology>("data/admin1-10m.json");
  const admin1Features = topojson.feature(
    admin1,
    admin1.objects.ne_10m_admin_1 as GeometryCollection,
  ).features as Feature<Geometry>[];
  const isoToAdm1 = new Map<string, string>();
  for (const f of admin1Features) {
    const props = (f.properties ?? {}) as Record<string, unknown>;
    const iso = props.iso_3166_2 as string | undefined;
    const adm1 = props.adm1_code as string | undefined;
    if (iso && adm1 && !isoToAdm1.has(iso)) isoToAdm1.set(iso, adm1);
  }
  const regionKeyIndex = new Map<string, number>(
    regionKeys.keys.map((k, i) => [`${k.geo}:${k.key}`, i]),
  );

  const bySource: Record<
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
  > = {};
  const TIER_NAME = ["regional", "derived", "national"];

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
      // Observed rows carry sex too; fold resolved the same way per sex and compare band totals
      // (sex-summed), since that is what the "age structure" claim is actually about.
      const resolvedBandTotals = foldedBandTotalsOf(resolved.p);
      const tvd = sum(observedShares.map((v, i) => Math.abs(v - (resolvedBandTotals[i] ?? 0)))) / 2;
      errors.push({
        region: isoRegion,
        tier: TIER_NAME[resolved.tier] as string,
        errorPct: tvd * 100,
      });

      // Same comparison using the flat national pyramid instead of whatever tier resolved —
      // shows whether a tier actually beats doing nothing regionally.
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
    console.log(
      `Validation vs observed ${source.key}: ${errors.length} regions compared ` +
        `(tiers used: ${JSON.stringify(tierUsed)}), mean error ${meanAbsErrorPct.toFixed(2)}pp ` +
        `vs ${nationalBaselineMeanAbsErrorPct.toFixed(2)}pp using the flat national pyramid.`,
    );
  }
  observedValidation = bySource;
}

// --- Write output -------------------------------------------------------------------------

const payload = {
  meta: {
    note:
      "Per-cell age x sex death pyramid, resolved in three tiers (see script header for the " +
      "WorldPop-infeasibility deviation): 0=regional (real GBD regional weights), " +
      "1=derived (national pyramid shifted by the region's own CDR gap against the national " +
      "rate — captures age structure ENTANGLED WITH real regional health differences, since " +
      "the crude rate does not separate them), 2=national (country or global pyramid). " +
      "Cells ship a classId into `archetypes`, clustered from every resolved pyramid so the " +
      "payload stays small; `tier` records which tier answered per cell.",
    bands: BANDS,
    tiers: ["regional", "derived", "national"],
    cellCount: grid.cells.length,
    archetypeCount: archetypes.length,
    tierMixByExpectedDeaths: {
      regional: Number((tierShare[0]! * 100).toFixed(2)),
      derived: Number((tierShare[1]! * 100).toFixed(2)),
      national: Number((tierShare[2]! * 100).toFixed(2)),
    },
    tier2Calibration: {
      method:
        "elderlyShareDeviation = k * ln(regionalCDR / nationalCDR), fit through the origin " +
        "against every region with both a real (tier-1) pyramid and a subnational-cdr.json entry.",
      k: Number(K_COEF.toFixed(4)),
      regionsUsedForFit: calibration.length,
      r2: Number(r2.toFixed(4)),
      meanAbsErrorPct: Number((maeFit * 100).toFixed(2)),
      baselineMeanAbsErrorPct: Number((maeBaseline * 100).toFixed(2)),
      worstFitRegions: worstFit,
    },
    validationAgainstObserved: observedValidation,
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
