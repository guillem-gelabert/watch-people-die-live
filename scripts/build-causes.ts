// Build a compact cause-of-death distribution by sex and, when the source has it,
// country and age band.
//
// Source: IHME Global Burden of Disease (GBD). The UN portal has no cause-of-death
// data, so causes come from GBD. There is no tokened GBD API — you export a CSV from
// the GBD Results Tool (free account) and this script aggregates it offline, mirroring
// how build-density.mjs consumes a committed-source raster.
//
// How to get the CSV (https://vizhub.healthdata.org/gbd-results/), max 100k rows/req:
//   Measure  = Deaths
//   Metric   = Number
//   Cause    = "All causes" expanded to Level 3 (recognisable causes, ~150)
//   Location = all countries/territories, or Global for a global fallback table
//   Age      = <1, 1-4, 5-9, ... in 5-year groups, or All ages for a global fallback
//   Sex      = Male, Female
//   Year     = most recent (e.g. 2021)
// Save it (optionally gzipped) under data/source/, e.g. data/source/gbd-deaths.csv[.gz].
//
// Output: data/causes.json
//   { source, year, coverage, bands, causes: [<label>...],
//     global: { m:[ {causeIdx:weight,...} per band ], f:[...] },
//     countries: { <m49>: { m:[ {causeIdx:weight} per band ], f:[...] }, ... } }
//
// Usage: node scripts/build-causes.ts [--src=path] [--top=8] [--force]

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import isoCountries from "i18n-iso-countries";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "data", "causes.json");
const SRC_DIR = path.join(ROOT, "data", "source");

// MUST match BANDS in build-mortality.mjs and AGE_BANDS in app/globe/persona.js.
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

type Sex = "m" | "f";

// Keep only the strongest causes per (country, sex, band); the rest fold into "other".
const topArg = process.argv.find((a) => a.startsWith("--top="));
const TOP = topArg ? Number(topArg.split("=")[1]) : 8;
const force = process.argv.includes("--force");
const srcArg = process.argv.find((a) => a.startsWith("--src="));

// GBD cause names -> short, readable persona labels (with articles where it reads
// better). Anything not listed keeps its GBD name, lower-cased. Edit here to taste.
const LABELS = new Map<string, string>([
  ["ischemic heart disease", "ischaemic heart disease"],
  ["stroke", "a stroke"],
  ["road injuries", "a road injury"],
  ["self-harm", "suicide"],
  ["interpersonal violence", "interpersonal violence"],
  ["alzheimer's disease and other dementias", "Alzheimer's & dementia"],
  ["chronic obstructive pulmonary disease", "COPD"],
  ["lower respiratory infections", "lower respiratory infection"],
  ["diarrheal diseases", "a diarrhoeal disease"],
  ["neonatal disorders", "neonatal complications"],
  ["congenital birth defects", "a congenital condition"],
  ["tracheal, bronchus, and lung cancer", "lung cancer"],
  ["colon and rectum cancer", "colorectal cancer"],
  ["stomach cancer", "stomach cancer"],
  ["liver cancer", "liver cancer"],
  ["breast cancer", "breast cancer"],
  ["prostate cancer", "prostate cancer"],
  ["cervical cancer", "cervical cancer"],
  ["diabetes mellitus", "diabetes"],
  ["chronic kidney disease", "kidney disease"],
  ["hiv/aids", "HIV/AIDS"],
  ["tuberculosis", "tuberculosis"],
  ["malaria", "malaria"],
  ["drowning", "drowning"],
  ["maternal disorders", "maternal complications"],
  ["leukemia", "leukaemia"],
]);

// --- aggregation containers ------------------------------------------------------

interface CountryAgg {
  m: Map<number, number>[];
  f: Map<number, number>[];
}

interface CountryOut {
  m: Record<number, number>[];
  f: Record<number, number>[];
}

interface Coverage {
  location: "country" | "global";
  age: "all_ages_repeated_across_bands" | "age_bands";
  sex: "male_female";
}

interface CausesOutput {
  source: string;
  year: number;
  coverage: Coverage;
  bands: [number, number][];
  causes: string[];
  global: CountryOut;
  countries: Record<number, CountryOut>;
}

interface CsvColumns {
  measure: number;
  metric: number | null;
  sex: number;
  age: number;
  location: number;
  cause: number;
  val: number;
  year: number;
}

interface ParsedCsv {
  rows: string[][];
  col: CsvColumns;
}

function main(): void {
  if (fs.existsSync(OUT) && !force) {
    console.log(`${rel(OUT)} already exists — pass --force to rebuild.`);
    return;
  }
  const src = resolveSource();
  console.log(`Reading GBD CSV from ${rel(src)} ...`);
  const csv = readCsv(src);

  // m49 -> { m: [Map<causeIdx,weight> per band], f: [...] }
  const byCountry = new Map<number, CountryAgg>();
  const global = freshCountry();
  const globalAllAges = freshCountry();
  const causeIdx = new Map<string, number>(); // label -> index
  const causes: string[] = [];
  const idxOf = (label: string): number => {
    let i = causeIdx.get(label);
    if (i === undefined) {
      i = causes.length;
      causes.push(label);
      causeIdx.set(label, i);
    }
    return i;
  };

  const { rows, col } = csv;
  let used = 0;
  let allAgesRows = 0;
  let countryRows = 0;
  let year = 0;
  for (const r of rows) {
    if (low(r[col.measure]) !== "deaths") continue;
    if (col.metric != null && low(r[col.metric]) !== "number") continue;
    const sex = sexKey(r[col.sex]);
    if (!sex) continue;
    const bands = bandsOf(r[col.age]);
    if (!bands.length) continue;
    const value = Number(r[col.val]);
    if (!(value > 0)) continue;
    const label = labelOf(r[col.cause]);
    const ci = idxOf(label);
    year = Math.max(year, Number(r[col.year]) || 0);

    const isAllAges = bands.length === BANDS.length && isAllAgesLabel(r[col.age]);
    const loc = low(r[col.location]);
    const isGlobal = loc === "global";
    const m49 = isGlobal
      ? 0
      : Number(isoCountries.alpha3ToNumeric(isoOf(r[col.location]) ?? "") || 0);

    const target = isAllAges ? globalAllAges : global;
    for (const band of bands) bump(target, sex, band, ci, value);

    if (isAllAges) allAgesRows++;
    if (m49) {
      let c = byCountry.get(m49);
      if (!c) byCountry.set(m49, (c = freshCountry()));
      for (const band of bands) bump(c, sex, band, ci, value);
      countryRows++;
    }
    used++;
  }
  if (!used) throw new Error("No usable Deaths/Number rows — check the CSV selection.");
  console.log(
    `Aggregated ${used.toLocaleString()} rows, ${byCountry.size} countries, ` +
      `${allAgesRows.toLocaleString()} all-ages rows.`,
  );

  const otherIdx = idxOf("other causes");
  const countries: Record<number, CountryOut> = {};
  for (const [m49, c] of byCountry) countries[m49] = trim(c, otherIdx);

  const outGlobal = hasAnyWeight(global) ? global : globalAllAges;
  const coverage: Coverage = {
    location: countryRows > 0 ? "country" : "global",
    age: allAgesRows === used ? "all_ages_repeated_across_bands" : "age_bands",
    sex: "male_female",
  };
  const out: CausesOutput = {
    source: "IHME Global Burden of Disease — Deaths by cause",
    year,
    coverage,
    bands: BANDS,
    causes,
    global: trim(outGlobal, otherIdx),
    countries,
  };
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log(
    `Wrote ${rel(OUT)}: ${causes.length} causes, ${Object.keys(countries).length} countries.`,
  );
}

function freshCountry(): CountryAgg {
  return {
    m: Array.from({ length: BANDS.length }, () => new Map<number, number>()),
    f: Array.from({ length: BANDS.length }, () => new Map<number, number>()),
  };
}

function bump(c: CountryAgg, sex: Sex, band: number, ci: number, value: number): void {
  const bandMap = c[sex][band];
  if (!bandMap) return;
  bandMap.set(ci, (bandMap.get(ci) || 0) + value);
}

// Keep the TOP causes per band, fold the remainder into "other causes", round weights.
function trim(c: CountryAgg, otherIdx: number): CountryOut {
  const out: CountryOut = { m: [], f: [] };
  for (const sex of ["m", "f"] as const) {
    for (let b = 0; b < BANDS.length; b++) {
      const bandMap = c[sex][b] ?? new Map<number, number>();
      const entries = [...bandMap].sort((a, z) => z[1] - a[1]);
      const obj: Record<number, number> = {};
      let other = 0;
      entries.forEach(([ci, w], i) => {
        if (i < TOP) obj[ci] = Math.round(w);
        else other += w;
      });
      if (other > 0) obj[otherIdx] = (obj[otherIdx] || 0) + Math.round(other);
      out[sex].push(obj);
    }
  }
  return out;
}

function hasAnyWeight(c: CountryAgg): boolean {
  for (const sex of ["m", "f"] as const) {
    for (const band of c[sex]) {
      for (const value of band.values()) {
        if (value > 0) return true;
      }
    }
  }
  return false;
}

// --- CSV parsing -----------------------------------------------------------------

function readCsv(file: string): ParsedCsv {
  let text: string;
  if (file.endsWith(".gz")) text = zlib.gunzipSync(fs.readFileSync(file)).toString("utf8");
  else text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  const headerLine = lines[0] ?? "";
  const header = splitCsvLine(headerLine).map((h) => h.trim().toLowerCase());
  const find = (...names: string[]): number | null => {
    for (const n of names) {
      const i = header.indexOf(n);
      if (i >= 0) return i;
    }
    return null;
  };
  const col = {
    measure: find("measure_name", "measure"),
    metric: find("metric_name", "metric"),
    sex: find("sex_name", "sex"),
    age: find("age_name", "age", "age_group_name"),
    location: find("location_name", "location"),
    cause: find("cause_name", "cause"),
    val: find("val", "value"),
    year: find("year", "year_id"),
  };
  for (const [k, v] of Object.entries(col)) {
    if (v == null && k !== "metric") {
      throw new Error(`CSV is missing a "${k}" column. Got: ${header.join(", ")}`);
    }
  }
  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line) rows.push(splitCsvLine(line));
  }
  return { rows, col: col as CsvColumns };
}

// Minimal CSV splitter that respects double-quoted fields (cause names contain commas).
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

// --- field mappers ---------------------------------------------------------------

function low(s: string | undefined): string {
  return String(s || "")
    .trim()
    .toLowerCase();
}

function sexKey(s: string | undefined): Sex | null {
  const v = low(s);
  if (v === "male") return "m";
  if (v === "female") return "f";
  return null;
}

function labelOf(cause: string | undefined): string {
  const v = low(cause);
  return LABELS.get(v) || v;
}

// GBD location_name -> ISO3. Most names resolve directly; a few common GBD spellings
// differ from the i18n-iso-countries table, so patch those explicitly.
const NAME_FIX = new Map<string, string>([
  ["united states of america", "USA"],
  ["russian federation", "RUS"],
  ["republic of korea", "KOR"],
  ["democratic people's republic of korea", "PRK"],
  ["iran (islamic republic of)", "IRN"],
  ["bolivia (plurinational state of)", "BOL"],
  ["venezuela (bolivarian republic of)", "VEN"],
  ["united republic of tanzania", "TZA"],
  ["syrian arab republic", "SYR"],
  ["viet nam", "VNM"],
  ["lao people's democratic republic", "LAO"],
  ["republic of moldova", "MDA"],
  ["czechia", "CZE"],
  ["türkiye", "TUR"],
  ["turkiye", "TUR"],
  ["taiwan (province of china)", "TWN"],
  ["côte d'ivoire", "CIV"],
  ["cote d'ivoire", "CIV"],
  ["democratic republic of the congo", "COD"],
  ["congo", "COG"],
]);

function isoOf(location: string | undefined): string | null {
  const v = low(location);
  if (NAME_FIX.has(v)) return NAME_FIX.get(v) ?? null;
  return isoCountries.getAlpha3Code(location ?? "", "en") || null;
}

// Parse a GBD age label to one or more band indexes. Handles "<1 year", "1 to 4",
// "5-9 years", "80 plus", "95+ years", and "All ages".
function bandsOf(age: string | undefined): number[] {
  const v = low(age);
  if (!v || v.includes("age-standardized")) return [];
  if (isAllAgesLabel(age)) return BANDS.map((_, i) => i);
  let start: number;
  if (/^<\s*1/.test(v) || v.includes("neonatal") || v.includes("post neonatal")) start = 0;
  else if (/^<\s*5/.test(v)) start = 0;
  else {
    const m = v.match(/(\d+)/);
    if (!m || !m[1]) return [];
    start = Number(m[1]);
  }
  for (let b = 0; b < BANDS.length; b++) {
    const band = BANDS[b];
    if (band && start >= band[0] && start <= band[1]) return [b];
  }
  return [];
}

function isAllAgesLabel(age: string | undefined): boolean {
  return low(age).includes("all ages");
}

function resolveSource(): string {
  if (srcArg) {
    const p = path.resolve(ROOT, srcArg.split("=")[1] ?? "");
    if (!fs.existsSync(p)) throw new Error(`--src file not found: ${p}`);
    return p;
  }
  const dirs = [
    SRC_DIR,
    ...fs
      .readdirSync(ROOT, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^IHME-GBD/i.test(d.name))
      .map((d) => path.join(ROOT, d.name)),
  ];
  const cands: string[] = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (/gbd.*\.csv(\.gz)?$/i.test(f) || /\.csv(\.gz)?$/i.test(f)) {
        cands.push(path.join(dir, f));
      }
    }
  }
  // Prefer a file whose name mentions gbd or cause/death.
  const pick = cands.find((f) => /gbd|cause|death/i.test(path.basename(f))) || cands[0];
  if (!pick) {
    throw new Error(
      `No GBD CSV found. Export Deaths-by-cause from the GBD Results Tool and save ` +
        `it under ${rel(SRC_DIR)} or an IHME-GBD_* folder, or pass --src=<path>.`,
    );
  }
  return pick;
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
