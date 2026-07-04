// Build a per-country seasonal (by-month) multiplier for the death rate.
//
// The globe's base rate is annual (World Bank CDR x population). Real mortality is
// seasonal — temperate countries die markedly more in winter — so this script turns
// UN monthly death counts into a 12-value curve per country, normalised to mean 1.
// The front-end multiplies a country's mean death interval by 1/factor[month], which
// speeds the pulse up in winter and slows it in summer WITHOUT changing the annual
// total (the factors average to 1).
//
// Source: UN Demographic Yearbook — deaths by month, exported from UNdata
//   (https://data.un.org, "Deaths by month"). A CSV of ~49 reporting countries lives
//   in the repo root as UNdata_Export_*.csv, consumed offline here exactly like
//   build-causes.mjs consumes a committed GBD export.
//
// Only ~49 countries report monthly; the other ~130 rendered on the globe get a
// latitude-scaled fallback curve (computed at runtime in app/globe/useGlobeData.js from the
// `fallback` block written here). Countries with too few deaths to carry a stable
// signal are dropped (their monthly counts are noise) and fall back too.
//
// Output: data/seasonality.json
//   { source, method, months: 12,
//     countries: { <m49>: [12 factors, mean 1] },
//     fallback: { north: [12 factors, mean 1], tropicMaxAbsLat, plateauAbsLat } }
//
// Usage: node scripts/build-seasonality.ts [--src=path] [--force]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "data", "seasonality.json");

const force = process.argv.includes("--force");
const srcArg = process.argv.find((a) => a.startsWith("--src="));

// Drop a country's own curve below this many annual deaths: monthly counts get too
// small to separate seasonality from Poisson noise (e.g. Niue ~17/yr). These fall
// back to the latitude curve like any country without monthly data.
const MIN_ANNUAL_DEATHS = 10000;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTH_IDX = new Map(MONTHS.map((m, i) => [m.toLowerCase(), i]));

// Quarter labels as they appear in the UN export -> the three month indexes they cover.
const QUARTERS = new Map<string, [number, number, number]>([
  ["january - march", [0, 1, 2]],
  ["april - june", [3, 4, 5]],
  ["july - september", [6, 7, 8]],
  ["october - december", [9, 10, 11]],
]);

// UN Demographic Yearbook country/area names -> M49 numeric code, matching the ids on
// world-atlas geometries and the /api/mortality feed. Only these ~49 names occur in
// the export, so a curated table is simpler and more reliable than a fuzzy lookup.
const NAME2M49 = new Map<string, number>([
  ["Anguilla", 660],
  ["Aruba", 533],
  ["Austria", 40],
  ["Bulgaria", 100],
  ["China, Macao SAR", 446],
  ["Costa Rica", 188],
  ["Czechia", 203],
  ["Egypt", 818],
  ["Estonia", 233],
  ["Faroe Islands", 234],
  ["Finland", 246],
  ["French Polynesia", 258],
  ["Germany", 276],
  ["Greenland", 304],
  ["Guam", 316],
  ["Hungary", 348],
  ["Iran (Islamic Republic of)", 364],
  ["Ireland", 372],
  ["Isle of Man", 833],
  ["Israel", 376],
  ["Japan", 392],
  ["Jersey", 832],
  ["Kyrgyzstan", 417],
  ["Latvia", 428],
  ["Lithuania", 440],
  ["Mauritius", 480],
  ["Mongolia", 496],
  ["Netherlands (Kingdom of the)", 528],
  ["New Zealand", 554],
  ["Niue", 570],
  ["North Macedonia", 807],
  ["Norway", 578],
  ["Portugal", 620],
  ["Puerto Rico", 630],
  ["Qatar", 634],
  ["Republic of Moldova", 498],
  ["Romania", 642],
  ["Russian Federation", 643],
  ["Serbia", 688],
  ["Seychelles", 690],
  ["Singapore", 702],
  ["Slovakia", 703],
  ["Slovenia", 705],
  ["Spain", 724],
  ["Sweden", 752],
  ["Turks and Caicos Islands", 796],
  ["United Kingdom of Great Britain and Northern Ireland", 826],
  ["Uzbekistan", 860],
  ["Åland Islands", 248],
]);

// M49 codes whose curves are averaged into the canonical northern winter fallback:
// well-sampled northern-temperate countries in |lat| 35-60, excluding continental
// outliers (Uzbekistan's summer peak) that would cancel the winter signal.
const FALLBACK_SOURCE_M49 = [276, 528, 724, 392, 620, 348]; // DE, NL, ES, JP, PT, HU

interface YearRecord {
  months: Map<number, number>;
  quarters: Map<number, number>;
}

interface Curve {
  curve: number[];
  annual: number;
}

interface SeasonalityOutput {
  source: string;
  method: string;
  months: number;
  countries: Record<number, number[]>;
  fallback: {
    north: number[];
    tropicMaxAbsLat: number;
    plateauAbsLat: number;
  };
}

interface CsvRow {
  country: string | undefined;
  year: string | undefined;
  area: string | undefined;
  month: string | undefined;
  value: string | undefined;
}

function main(): void {
  if (fs.existsSync(OUT) && !force) {
    console.log(`${rel(OUT)} already exists — pass --force to rebuild.`);
    return;
  }
  const src = resolveSource();
  console.log(`Reading UN monthly deaths from ${rel(src)} ...`);

  // name -> year -> { months: Map<idx,val>, quarters: Map<idx,val> }
  const byCountry = new Map<string, Map<number, YearRecord>>();
  for (const r of readCsv(src)) {
    if (low(r.area) !== "total") continue; // ignore any urban/rural splits
    const year = Number(r.year);
    const value = Number(r.value);
    if (!Number.isFinite(year) || !(value >= 0)) continue;
    const label = low(r.month);
    const mi = MONTH_IDX.get(label);
    const q = QUARTERS.get(label);
    if (mi === undefined && !q) continue; // skip "Total", "Unknown", blank

    const country = r.country ?? "";
    let c = byCountry.get(country);
    if (!c) byCountry.set(country, (c = new Map()));
    let y = c.get(year);
    if (!y) c.set(year, (y = { months: new Map(), quarters: new Map() }));
    if (mi !== undefined) y.months.set(mi, value);
    else if (q) y.quarters.set(q[0], value); // key quarter by its first month
  }

  const curves = new Map<number, Curve>(); // m49 -> { curve:[12], annual }
  const skipped: string[] = [];
  for (const [name, years] of byCountry) {
    const m49 = NAME2M49.get(name);
    if (!m49) {
      skipped.push(`${name} (no M49 mapping)`);
      continue;
    }
    const built = buildCurve(years);
    if (!built) {
      skipped.push(`${name} (no complete year)`);
      continue;
    }
    if (built.annual < MIN_ANNUAL_DEATHS) {
      skipped.push(`${name} (${Math.round(built.annual)} deaths/yr < ${MIN_ANNUAL_DEATHS})`);
      continue;
    }
    curves.set(m49, built);
  }

  if (!curves.size) throw new Error("No country produced a usable seasonal curve.");

  const countries: Record<number, number[]> = {};
  for (const [m49, { curve }] of curves) countries[m49] = round3(curve);

  const north = buildFallbackNorth(curves);

  const out: SeasonalityOutput = {
    source: "UN Demographic Yearbook — deaths by month (UNdata export)",
    method:
      "Per calendar-year monthly counts normalised to mean 1, averaged across " +
      "complete years, lightly smoothed. Quarterly-only reporters expanded flat " +
      "across each quarter. Countries below " +
      MIN_ANNUAL_DEATHS +
      " deaths/yr and " +
      "those without monthly data use the latitude-scaled `fallback` curve.",
    months: 12,
    countries,
    fallback: { north: round3(north), tropicMaxAbsLat: 10, plateauAbsLat: 40 },
  };
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log(`Wrote ${rel(OUT)}: ${curves.size} country curves + latitude fallback.`);
  console.log(`Skipped ${skipped.length}: ${skipped.join(", ")}`);
}

// Build a 12-factor curve (mean 1) for one country from its per-year records. Prefer
// full monthly years; fall back to full quarterly years (each quarter flat across its
// 3 months). Returns { curve, annual } or null if no complete year exists.
function buildCurve(years: Map<number, YearRecord>): Curve | null {
  const monthlyVecs: number[][] = [];
  const quarterlyVecs: number[][] = [];
  const totals: number[] = [];
  for (const y of years.values()) {
    if (y.months.size === 12) {
      const vals = Array.from({ length: 12 }, (_, i) => y.months.get(i) ?? 0);
      const total = vals.reduce((a, b) => a + b, 0);
      if (total <= 0) continue;
      monthlyVecs.push(vals.map((v) => (v / total) * 12)); // normalise to mean 1
      totals.push(total);
    } else if (y.quarters.size === 4) {
      const qv = [0, 3, 6, 9].map((k) => y.quarters.get(k) ?? 0);
      const total = qv.reduce((a, b) => a + b, 0);
      if (total <= 0) continue;
      const vals: number[] = [];
      for (const q of qv) for (let k = 0; k < 3; k++) vals.push(q / 3); // flat per quarter
      quarterlyVecs.push(vals.map((v) => (v / total) * 12));
      totals.push(total);
    }
  }
  const vecs = monthlyVecs.length ? monthlyVecs : quarterlyVecs;
  if (!vecs.length) return null;
  const avg = meanVec(vecs);
  const curve = renorm(smooth(avg));
  const annual = totals.reduce((a, b) => a + b, 0) / totals.length;
  return { curve, annual };
}

// The canonical northern-hemisphere winter curve: the mean of a few well-sampled
// temperate countries' curves (already mean 1), renormalised back to mean 1.
function buildFallbackNorth(curves: Map<number, Curve>): number[] {
  const vecs = FALLBACK_SOURCE_M49.map((m49) => curves.get(m49)?.curve).filter((v): v is number[] =>
    Boolean(v),
  );
  if (!vecs.length) throw new Error("No fallback-source countries survived the gate.");
  return renorm(meanVec(vecs));
}

// --- vector helpers --------------------------------------------------------------

function meanVec(vecs: number[][]): number[] {
  const out = new Array(12).fill(0) as number[];
  for (const v of vecs) for (let i = 0; i < 12; i++) out[i] = (out[i] ?? 0) + (v[i] ?? 0);
  return out.map((x) => x / vecs.length);
}

// Circular 3-tap smoothing (seasons wrap Dec->Jan) to damp month-to-month noise.
function smooth(v: number[]): number[] {
  return v.map((_, i) => {
    const prev = v[(i + 11) % 12] ?? 0;
    const cur = v[i] ?? 0;
    const next = v[(i + 1) % 12] ?? 0;
    return 0.25 * prev + 0.5 * cur + 0.25 * next;
  });
}

// Rescale so the 12 factors average exactly 1.
function renorm(v: number[]): number[] {
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  return v.map((x) => x / mean);
}

function round3(v: number[]): number[] {
  return v.map((x) => Math.round(x * 1000) / 1000);
}

// --- CSV parsing -----------------------------------------------------------------

// Yield one object per data row. The UN export is fully quoted and ends with a
// footnotes block ("footnoteSeqID","Footnote") after a blank line — stop there.
function* readCsv(file: string): Generator<CsvRow> {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  const headerLine = lines[0] ?? "";
  const header = splitCsvLine(headerLine).map((h) => h.trim().toLowerCase());
  const col = {
    country: header.indexOf("country or area"),
    year: header.indexOf("year"),
    area: header.indexOf("area"),
    month: header.indexOf("month"),
    value: header.indexOf("value"),
  };
  for (const [k, i] of Object.entries(col)) {
    if (i < 0) throw new Error(`CSV missing a "${k}" column. Got: ${header.join(", ")}`);
  }
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) break; // blank line separates the trailing footnotes block
    const r = splitCsvLine(line);
    yield {
      country: r[col.country],
      year: r[col.year],
      area: r[col.area],
      month: r[col.month],
      value: r[col.value],
    };
  }
}

// Minimal CSV splitter honouring double-quoted fields (country names contain commas).
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

// --- misc ------------------------------------------------------------------------

function low(s: string | undefined): string {
  return String(s || "")
    .trim()
    .toLowerCase();
}

function resolveSource(): string {
  if (srcArg) {
    const p = path.resolve(ROOT, srcArg.split("=")[1] ?? "");
    if (!fs.existsSync(p)) throw new Error(`--src file not found: ${p}`);
    return p;
  }
  const dirs = [path.join(ROOT, "data", "source"), ROOT];
  const cands: string[] = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (/^UNdata_Export.*\.csv$/i.test(f)) cands.push(path.join(dir, f));
    }
  }
  cands.sort();
  if (!cands.length) {
    throw new Error(
      "No UNdata_Export_*.csv found in data/source/ or the repo root. Export " +
        "'Deaths by month' from https://data.un.org into data/source/, or pass --src=<path>.",
    );
  }
  const last = cands[cands.length - 1];
  if (!last) throw new Error("Unreachable: cands is non-empty");
  return last; // newest export by name
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
