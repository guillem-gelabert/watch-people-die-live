// Build a compact per-country cause-of-death distribution by sex and age band.
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
//   Location = all countries/territories
//   Age      = <1, 1-4, 5-9, ... in 5-year groups (or the closest available set)
//   Sex      = Male, Female
//   Year     = most recent (e.g. 2021)
// Save it (optionally gzipped) under data/source/, e.g. data/source/gbd-deaths.csv[.gz].
//
// Output: data/causes.json
//   { source, year, bands, causes: [<label>...],
//     global: { m:[ {causeIdx:weight,...} per band ], f:[...] },
//     countries: { <m49>: { m:[ {causeIdx:weight} per band ], f:[...] }, ... } }
//
// Usage: node scripts/build-causes.mjs [--src=path] [--top=8] [--force]

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import isoCountries from "i18n-iso-countries";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "data", "causes.json");
const SRC_DIR = path.join(ROOT, "data", "source");

// MUST match BANDS in build-mortality.mjs and AGE_BANDS in public/persona.js.
const BANDS = [
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

// Keep only the strongest causes per (country, sex, band); the rest fold into "other".
const topArg = process.argv.find((a) => a.startsWith("--top="));
const TOP = topArg ? Number(topArg.split("=")[1]) : 8;
const force = process.argv.includes("--force");
const srcArg = process.argv.find((a) => a.startsWith("--src="));

// GBD cause names -> short, readable persona labels (with articles where it reads
// better). Anything not listed keeps its GBD name, lower-cased. Edit here to taste.
const LABELS = new Map([
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

function main() {
  if (fs.existsSync(OUT) && !force) {
    console.log(`${rel(OUT)} already exists — pass --force to rebuild.`);
    return;
  }
  const src = resolveSource();
  console.log(`Reading GBD CSV from ${rel(src)} ...`);
  const csv = readCsv(src);

  // m49 -> { m: [Map<causeIdx,weight> per band], f: [...] }
  const byCountry = new Map();
  const global = freshCountry();
  const causeIdx = new Map(); // label -> index
  const causes = [];
  const idxOf = (label) => {
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
  let year = 0;
  for (const r of rows) {
    if (low(r[col.measure]) !== "deaths") continue;
    if (col.metric != null && low(r[col.metric]) !== "number") continue;
    const sex = sexKey(r[col.sex]);
    if (!sex) continue;
    const band = bandOf(r[col.age]);
    if (band < 0) continue;
    const m49 = Number(isoCountries.alpha3ToNumeric(isoOf(r[col.location])) || 0);
    if (!m49) continue;
    const value = Number(r[col.val]);
    if (!(value > 0)) continue;
    const label = labelOf(r[col.cause]);
    const ci = idxOf(label);
    year = Math.max(year, Number(r[col.year]) || 0);

    bump(global, sex, band, ci, value);
    let c = byCountry.get(m49);
    if (!c) byCountry.set(m49, (c = freshCountry()));
    bump(c, sex, band, ci, value);
    used++;
  }
  if (!used) throw new Error("No usable Deaths/Number rows — check the CSV selection.");
  console.log(`Aggregated ${used.toLocaleString()} rows, ${byCountry.size} countries.`);

  const otherIdx = idxOf("other causes");
  const countries = {};
  for (const [m49, c] of byCountry) countries[m49] = trim(c, otherIdx);

  const out = {
    source: "IHME Global Burden of Disease — Deaths by cause, age and sex",
    year,
    bands: BANDS,
    causes,
    global: trim(global, otherIdx),
    countries,
  };
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log(`Wrote ${rel(OUT)}: ${causes.length} causes, ${Object.keys(countries).length} countries.`);
}

// --- aggregation containers ------------------------------------------------------

function freshCountry() {
  return {
    m: Array.from({ length: BANDS.length }, () => new Map()),
    f: Array.from({ length: BANDS.length }, () => new Map()),
  };
}

function bump(c, sex, band, ci, value) {
  const m = c[sex][band];
  m.set(ci, (m.get(ci) || 0) + value);
}

// Keep the TOP causes per band, fold the remainder into "other causes", round weights.
function trim(c, otherIdx) {
  const out = { m: [], f: [] };
  for (const sex of ["m", "f"]) {
    for (let b = 0; b < BANDS.length; b++) {
      const entries = [...c[sex][b]].sort((a, z) => z[1] - a[1]);
      const obj = {};
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

// --- CSV parsing -----------------------------------------------------------------

function readCsv(file) {
  let text;
  if (file.endsWith(".gz")) text = zlib.gunzipSync(fs.readFileSync(file)).toString("utf8");
  else text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const find = (...names) => {
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
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]) rows.push(splitCsvLine(lines[i]));
  }
  return { rows, col };
}

// Minimal CSV splitter that respects double-quoted fields (cause names contain commas).
function splitCsvLine(line) {
  const out = [];
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

function low(s) {
  return String(s || "").trim().toLowerCase();
}

function sexKey(s) {
  const v = low(s);
  if (v === "male") return "m";
  if (v === "female") return "f";
  return null;
}

function labelOf(cause) {
  const v = low(cause);
  return LABELS.get(v) || v;
}

// GBD location_name -> ISO3. Most names resolve directly; a few common GBD spellings
// differ from the i18n-iso-countries table, so patch those explicitly.
const NAME_FIX = new Map([
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

function isoOf(location) {
  const v = low(location);
  if (NAME_FIX.has(v)) return NAME_FIX.get(v);
  return isoCountries.getAlpha3Code(location, "en") || null;
}

// Parse a GBD age label to its band index. Handles "<1 year", "1 to 4", "5-9 years",
// "80 plus", "95+ years", "All ages" (ignored), etc.
function bandOf(age) {
  const v = low(age);
  if (!v || v.includes("all ages") || v.includes("age-standardized")) return -1;
  let start;
  if (/^<\s*1/.test(v) || v.includes("neonatal") || v.includes("post neonatal")) start = 0;
  else if (/^<\s*5/.test(v)) start = 0;
  else {
    const m = v.match(/(\d+)/);
    if (!m) return -1;
    start = Number(m[1]);
  }
  for (let b = 0; b < BANDS.length; b++) {
    if (start >= BANDS[b][0] && start <= BANDS[b][1]) return b;
  }
  return -1;
}

function resolveSource() {
  if (srcArg) {
    const p = path.resolve(ROOT, srcArg.split("=")[1]);
    if (!fs.existsSync(p)) throw new Error(`--src file not found: ${p}`);
    return p;
  }
  if (!fs.existsSync(SRC_DIR)) {
    throw new Error(
      `No GBD CSV found. Download one from the GBD Results Tool (see the header of ` +
        `this file) and place it under data/source/, or pass --src=<path>.`
    );
  }
  const cands = fs
    .readdirSync(SRC_DIR)
    .filter((f) => /gbd.*\.csv(\.gz)?$/i.test(f) || /\.csv(\.gz)?$/i.test(f));
  // Prefer a file whose name mentions gbd or cause/death.
  const pick =
    cands.find((f) => /gbd|cause|death/i.test(f)) || cands[0];
  if (!pick) {
    throw new Error(
      `No .csv found in ${rel(SRC_DIR)}. Export Deaths-by-cause from the GBD Results ` +
        `Tool and save it there (see this file's header), or pass --src=<path>.`
    );
  }
  return path.join(SRC_DIR, pick);
}

function rel(p) {
  return path.relative(ROOT, p);
}

try {
  main();
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
