// Build a compact cause-of-death distribution by country, age band and sex.
//
// Source: WHO Global Health Estimates 2021, fetched by scripts/fetch-who-ghe.ts from
// WHO's keyless xMart OData API. 183 countries — including every country with no usable
// death registration — 19 disjoint five-year age bands, both sexes, 175 leaf causes.
//
// This used to be built from a hand-exported IHME GBD CSV. GBD gates every data endpoint
// behind an interactive sign-in and caps a download at 100,000 rows, which makes the
// country x age x sex x cause cube tens of thousands of requests; WHO serves the same
// shape keylessly under CC BY 4.0. The one thing GBD still has that WHO does not is
// subnational detail, which is a separate export (see .planning phase 04-03).
//
// Output: data/causes.json
//   { source, year, coverage, bands, causes: [<label>...],
//     global: { m:[ {causeIdx:weight,...} per band ], f:[...] },
//     countries: { <m49>: { m:[...], f:[...] }, ... } }
//
// Usage: node --import tsx scripts/build-causes.ts [--src=path] [--top=8] [--force]

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import isoCountries from "i18n-iso-countries";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "data", "causes.json");
const SRC_DIR = path.join(ROOT, "data", "source", "who-ghe");

// MUST match BANDS in build-mortality.ts and AGE_BANDS in app/globe/persona.ts.
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

// WHO age code -> band index. WHO ships 22 codes and three of them overlap: Y0T1 is
// exactly D0T27 + M1T11, so taking all three would count infancy twice. These 19 are
// disjoint and reconcile to WHO's own TOTAL row; TOTAL, D0T27 and M1T11 are absent on
// purpose and any code missing from this table fails the build rather than being guessed.
const AGE_BAND = new Map<string, number>([
  ["Y0T1", 0],
  ["Y1T4", 1],
  ["Y5T9", 2],
  ["Y10T14", 2],
  ["Y15T19", 3],
  ["Y20T24", 3],
  ["Y25T29", 3],
  ["Y30T34", 4],
  ["Y35T39", 4],
  ["Y40T44", 4],
  ["Y45T49", 4],
  ["Y50T54", 5],
  ["Y55T59", 5],
  ["Y60T64", 5],
  ["Y65T69", 6],
  ["Y70T74", 6],
  ["Y75T79", 7],
  ["Y80T84", 7],
  ["YGE_85", 8],
]);

type Sex = "m" | "f";

const topArg = process.argv.find((a) => a.startsWith("--top="));
const TOP = topArg ? Number(topArg.split("=")[1]) : 8;
const force = process.argv.includes("--force");
const srcArg = process.argv.find((a) => a.startsWith("--src="));

const OTHER = "other causes";

// WHO cause titles -> the persona vocabulary already translated in lib/i18n/{ca,de}.causes.ts.
// Three jobs: reconcile spelling ("Oesophagus cancer" is the project's "esophageal cancer"),
// name the thing where WHO names only the site ("Nasopharynx" alone cannot end a sentence),
// and collapse aetiology splits the feed has no use for (four kinds of liver cancer read the
// same to a reader). Causes that are real but effectively never fatal — cataracts, dental
// caries, migraine — go to "other causes", which is where top-8 truncation would put them
// anyway. Anything absent from this map keeps its WHO title, lower-cased.
const LABELS = new Map<string, string>([
  ["acute hepatitis a", "acute hepatitis"],
  ["acute hepatitis b", "acute hepatitis"],
  ["acute hepatitis c", "acute hepatitis"],
  ["acute hepatitis e", "acute hepatitis"],
  ["alzheimer disease and other dementias", "Alzheimer's & dementia"],
  ["amphetamine use disorders", "drug use disorders"],
  ["cannabis use disorders", "drug use disorders"],
  ["cocaine use disorders", "drug use disorders"],
  ["opioid use disorders", "drug use disorders"],
  ["other drug use disorders", "drug use disorders"],
  ["ascariasis", "intestinal nematode infections"],
  ["hookworm disease", "intestinal nematode infections"],
  ["trichuriasis", "intestinal nematode infections"],
  ["birth asphyxia and birth trauma", "birth asphyxia"],
  ["brain and nervous system cancers", "brain and central nervous system cancer"],
  ["cardiomyopathy, myocarditis, endocarditis", "cardiomyopathy and myocarditis"],
  ["cervix uteri cancer", "cervical cancer"],
  ["chronic kidney disease due to diabetes", "kidney disease"],
  ["other chronic kidney disease", "kidney disease"],
  ["chronic obstructive pulmonary disease", "COPD"],
  ["cirrhosis due to alcohol use", "cirrhosis and other chronic liver diseases"],
  ["cirrhosis due to hepatitis b", "cirrhosis and other chronic liver diseases"],
  ["cirrhosis due to hepatitis c", "cirrhosis and other chronic liver diseases"],
  ["other liver cirrhosis", "cirrhosis and other chronic liver diseases"],
  ["cleft lip and cleft palate", "a congenital condition"],
  ["congenital heart anomalies", "a congenital condition"],
  ["neural tube defects", "a congenital condition"],
  ["down syndrome", "a congenital condition"],
  ["other chromosomal anomalies", "a congenital condition"],
  ["other congenital anomalies", "a congenital condition"],
  ["collective violence and legal intervention", "conflict and terrorism"],
  ["colon and rectum cancers", "colorectal cancer"],
  ["corpus uteri cancer", "uterine cancer"],
  ["diabetes mellitus", "diabetes"],
  ["diarrhoeal diseases", "a diarrhoeal disease"],
  ["echinococcosis", "cystic echinococcosis"],
  ["epilepsy", "idiopathic epilepsy"],
  ["fire, heat and hot substances", "fire, heat, and hot substances"],
  ["food-bourne trematodes", "other neglected tropical diseases"],
  ["lymphatic filariasis", "other neglected tropical diseases"],
  ["onchocerciasis", "other neglected tropical diseases"],
  ["trachoma", "other neglected tropical diseases"],
  ["leprosy", "other neglected tropical diseases"],
  ["gastritis and duodenitis", "upper digestive system diseases"],
  ["peptic ulcer disease", "upper digestive system diseases"],
  // Both stroke types collapse: "a stroke" is what the feed already says, and it is the
  // word a reader expects. The ischaemic/haemorrhagic split is a clinical distinction the
  // sentence cannot carry.
  ["haemorrhagic stroke", "a stroke"],
  ["ischaemic stroke", "a stroke"],
  ["iron-deficiency anaemia", "other nutritional deficiencies"],
  ["iodine deficiency", "other nutritional deficiencies"],
  ["vitamin a deficiency", "other nutritional deficiencies"],
  ["lip and oral cavity", "lip and oral cavity cancer"],
  ["liver cancer secondary to alcohol use", "liver cancer"],
  ["liver cancer secondary to hepatitis b", "liver cancer"],
  ["liver cancer secondary to hepatitis c", "liver cancer"],
  ["other liver cancer", "liver cancer"],
  ["lower respiratory infections", "lower respiratory infection"],
  ["nasopharynx", "nasopharynx cancer"],
  ["other pharynx", "other pharynx cancer"],
  ["natural disasters", "exposure to forces of nature"],
  ["neonatal sepsis and infections", "neonatal complications"],
  ["preterm birth complications", "neonatal complications"],
  ["other neonatal conditions", "neonatal complications"],
  ["oesophagus cancer", "esophageal cancer"],
  ["chlamydia", "sexually transmitted infections excluding hiv"],
  ["genital herpes", "sexually transmitted infections excluding hiv"],
  ["gonorrhoea", "sexually transmitted infections excluding hiv"],
  ["syphilis", "sexually transmitted infections excluding hiv"],
  ["trichomoniasis", "sexually transmitted infections excluding hiv"],
  ["other stds", "sexually transmitted infections excluding hiv"],
  ["other circulatory diseases", "other cardiovascular and circulatory diseases"],
  [
    "other endocrine, blood and immune disorders",
    "endocrine, metabolic, blood, and immune disorders",
  ],
  ["other haemoglobinopathies and haemolytic anaemias", "hemoglobinopathies and hemolytic anemias"],
  ["sickle cell disorders and trait", "hemoglobinopathies and hemolytic anemias"],
  ["thalassaemias", "hemoglobinopathies and hemolytic anemias"],
  ["other infectious diseases", "other unspecified infectious diseases"],
  ["other neurological conditions", "other neurological disorders"],
  ["other respiratory diseases", "other chronic respiratory diseases"],
  ["other urinary diseases", "urinary diseases and male infertility"],
  ["urolithiasis", "urinary diseases and male infertility"],
  ["benign prostatic hyperplasia", "urinary diseases and male infertility"],
  ["infertility", "urinary diseases and male infertility"],
  ["ovary cancer", "ovarian cancer"],
  ["pancreas cancer", "pancreatic cancer"],
  ["parkinson disease", "parkinson's disease"],
  ["road injury", "a road injury"],
  ["self-harm", "suicide"],
  ["trachea, bronchus, lung cancers", "lung cancer"],
  ["whooping cough", "pertussis"],
  // Real deaths, but ones the feed cannot name usefully or that never survive truncation.
  ["other covid-19 pandemic-related outcomes", OTHER],
  ["anxiety disorders", OTHER],
  ["attention deficit/hyperactivity syndrome", OTHER],
  ["autism and asperger syndrome", OTHER],
  ["back and neck pain", OTHER],
  ["bipolar disorder", OTHER],
  ["cataracts", OTHER],
  ["conduct disorder", OTHER],
  ["dental caries", OTHER],
  ["edentulism", OTHER],
  ["glaucoma", OTHER],
  ["gout", OTHER],
  ["idiopathic intellectual disability", OTHER],
  ["macular degeneration", OTHER],
  ["migraine", OTHER],
  ["non-migraine headache", OTHER],
  ["osteoarthritis", OTHER],
  ["other hearing loss", OTHER],
  ["other mental and behavioural disorders", OTHER],
  ["other oral disorders", OTHER],
  ["other sense organ disorders", OTHER],
  ["other vision loss", OTHER],
  ["periodontal disease", OTHER],
  ["schizophrenia", OTHER],
  ["uncorrected refractive errors", OTHER],
]);

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
  citation: string;
  year: number;
  generatedAt: string;
  coverage: Coverage;
  bands: [number, number][];
  causes: string[];
  global: CountryOut;
  countries: Record<number, CountryOut>;
}

interface Columns {
  country: number;
  age: number;
  sex: number;
  cause: number;
  level: number;
  deaths: number;
}

function main(): void {
  if (fs.existsSync(OUT) && !force) {
    console.log(`${rel(OUT)} already exists — pass --force to rebuild.`);
    return;
  }
  const src = resolveSource();
  const sourceYear = yearFromSourceName(src);
  if (sourceYear === null) {
    console.warn(
      `Could not read a GHE year from ${rel(src)} — labelling the output 2021. ` +
        `Rename the file to ghe-<year>-deaths.csv if that is wrong.`,
    );
  }
  const year = sourceYear ?? 2021;
  console.log(`Reading WHO GHE rows from ${rel(src)} (GHE ${year}) ...`);
  const { rows, col } = readCsv(src);

  const byCountry = new Map<number, CountryAgg>();
  const global = freshCountry();
  // All-causes totals per cell, so the share the 175 leaf causes do not cover (about 2.4%,
  // because no WHO flag is a clean partition) is carried as "other causes" instead of lost.
  const totals = new Map<string, number>();
  const globalTotals = new Map<string, number>();
  const causeIdx = new Map<string, number>();
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
  const otherIdx = idxOf(OTHER);
  const key = (m49: number, sex: Sex, band: number): string => `${m49}|${sex}|${band}`;

  let leafRows = 0;
  let totalRows = 0;
  const unknownAges = new Set<string>();
  const unresolvedCountries = new Set<string>();

  for (const r of rows) {
    const ageCode = String(r[col.age] ?? "").trim();
    const band = AGE_BAND.get(ageCode);
    if (band === undefined) {
      unknownAges.add(ageCode);
      continue;
    }
    const sex = sexKey(r[col.sex]);
    if (!sex) continue;
    const iso3 = String(r[col.country] ?? "").trim();
    const m49 = Number(isoCountries.alpha3ToNumeric(iso3) || 0);
    if (!m49) {
      unresolvedCountries.add(iso3);
      continue;
    }
    const deaths = Number(r[col.deaths]);
    if (!Number.isFinite(deaths) || deaths <= 0) continue;

    if (Number(r[col.level]) === 0) {
      totals.set(key(m49, sex, band), (totals.get(key(m49, sex, band)) ?? 0) + deaths);
      globalTotals.set(key(0, sex, band), (globalTotals.get(key(0, sex, band)) ?? 0) + deaths);
      totalRows++;
      continue;
    }

    const ci = idxOf(labelOf(r[col.cause]));
    let c = byCountry.get(m49);
    if (!c) byCountry.set(m49, (c = freshCountry()));
    bump(c, sex, band, ci, deaths);
    bump(global, sex, band, ci, deaths);
    leafRows++;
  }

  if (unknownAges.size) {
    throw new Error(
      `Unrecognised WHO age codes: ${[...unknownAges].join(", ")}. ` +
        `Add them to AGE_BAND, or exclude them in the fetch — an aggregate folded into one ` +
        `band is exactly the silent double-count this table exists to prevent.`,
    );
  }
  if (unresolvedCountries.size) {
    console.warn(`Skipped unresolvable ISO3 codes: ${[...unresolvedCountries].join(", ")}`);
  }
  if (!leafRows) throw new Error("No usable leaf-cause rows — check the CSV selection.");
  console.log(
    `Aggregated ${leafRows.toLocaleString()} leaf rows and ` +
      `${totalRows.toLocaleString()} all-causes rows across ${byCountry.size} countries.`,
  );

  // Fold the uncovered share into "other causes" before truncating.
  let residualShare = 0;
  let grandTotal = 0;
  for (const [m49, c] of byCountry) {
    for (const sex of ["m", "f"] as const) {
      for (let b = 0; b < BANDS.length; b++) {
        const all = totals.get(key(m49, sex, b)) ?? 0;
        const bandMap = c[sex][b];
        if (!bandMap) continue;
        let sum = 0;
        for (const v of bandMap.values()) sum += v;
        grandTotal += all;
        if (all > sum) {
          residualShare += all - sum;
          bandMap.set(otherIdx, (bandMap.get(otherIdx) ?? 0) + (all - sum));
        }
      }
    }
  }
  for (const sex of ["m", "f"] as const) {
    for (let b = 0; b < BANDS.length; b++) {
      const all = globalTotals.get(key(0, sex, b)) ?? 0;
      const bandMap = global[sex][b];
      if (!bandMap) continue;
      let sum = 0;
      for (const v of bandMap.values()) sum += v;
      if (all > sum) bandMap.set(otherIdx, (bandMap.get(otherIdx) ?? 0) + (all - sum));
    }
  }
  console.log(
    `Residual folded into "${OTHER}": ${((residualShare / grandTotal) * 100).toFixed(2)}% of deaths.`,
  );

  const trimmedCountries = new Map<number, CountryOut>();
  for (const [m49, c] of byCountry) trimmedCountries.set(m49, trim(c));
  const trimmedGlobal = trim(global);

  // Only labels that survived truncation can ever reach a reader, so only those are shipped.
  // The old export listed 140 causes of which 12 were reachable; every label here is real.
  const used = new Set<number>();
  const collect = (o: CountryOut): void => {
    for (const sex of ["m", "f"] as const) {
      for (const band of o[sex]) for (const k of Object.keys(band)) used.add(Number(k));
    }
  };
  collect(trimmedGlobal);
  for (const o of trimmedCountries.values()) collect(o);

  const oldToNew = new Map<number, number>();
  const finalCauses: string[] = [];
  for (const i of [...used].sort((a, b) => a - b)) {
    oldToNew.set(i, finalCauses.length);
    finalCauses.push(causes[i] as string);
  }
  const reindex = (o: CountryOut): CountryOut => ({
    m: o.m.map((band) => remap(band, oldToNew)),
    f: o.f.map((band) => remap(band, oldToNew)),
  });

  const countries: Record<number, CountryOut> = {};
  for (const [m49, o] of trimmedCountries) countries[m49] = reindex(o);

  const out: CausesOutput = {
    source: `WHO Global Health Estimates ${year} — deaths by cause, age and sex`,
    citation:
      `World Health Organization, data.who.int, Global Health Estimates ${year}: Deaths by ` +
      `Cause, Age, Sex, by Country and by Region, 2000-${year} (CC BY 4.0).`,
    year,
    // When this file was built — the release label above says which estimates these are, this
    // says when we pulled them. The same distinction conflicts.json draws with generatedAt.
    generatedAt: new Date().toISOString(),
    coverage: { location: "country", age: "age_bands", sex: "male_female" },
    bands: BANDS,
    causes: finalCauses,
    global: reindex(trimmedGlobal),
    countries,
  };
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log(
    `Wrote ${rel(OUT)}: ${finalCauses.length} reachable causes, ` +
      `${Object.keys(countries).length} countries, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB.`,
  );
}

function remap(band: Record<number, number>, to: Map<number, number>): Record<number, number> {
  const out: Record<number, number> = {};
  for (const [k, v] of Object.entries(band)) {
    const n = to.get(Number(k));
    if (n !== undefined) out[n] = v;
  }
  return out;
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
function trim(c: CountryAgg): CountryOut {
  const otherIdx = 0; // OTHER is interned first, so its index is stable.
  const out: CountryOut = { m: [], f: [] };
  for (const sex of ["m", "f"] as const) {
    for (let b = 0; b < BANDS.length; b++) {
      const bandMap = c[sex][b] ?? new Map<number, number>();
      const entries = [...bandMap].sort((a, z) => z[1] - a[1]);
      const obj: Record<number, number> = {};
      let other = 0;
      let kept = 0;
      for (const [ci, w] of entries) {
        if (ci !== otherIdx && kept < TOP) {
          obj[ci] = Math.round(w);
          kept++;
        } else other += w;
      }
      if (other > 0) obj[otherIdx] = (obj[otherIdx] || 0) + Math.round(other);
      out[sex].push(obj);
    }
  }
  return out;
}

function readCsv(file: string): { rows: string[][]; col: Columns } {
  const text = file.endsWith(".gz")
    ? zlib.gunzipSync(fs.readFileSync(file)).toString("utf8")
    : fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  const header = splitCsvLine(lines[0] ?? "").map((h) => h.trim().toUpperCase());
  const find = (name: string): number => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`CSV is missing a "${name}" column. Got: ${header.join(", ")}`);
    return i;
  };
  const col: Columns = {
    country: find("DIM_COUNTRY_CODE"),
    age: find("DIM_AGEGROUP_CODE"),
    sex: find("DIM_SEX_CODE"),
    cause: find("DIM_GHECAUSE_TITLE"),
    level: find("FLAG_LEVEL"),
    deaths: find("VAL_DTHS_COUNT_NUMERIC"),
  };
  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line) rows.push(splitCsvLine(line));
  }
  return { rows, col };
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

// The GHE release year, read from the fetcher's filename pattern (ghe-<year>-deaths.csv). The
// output's source/citation/year used to be hardcoded 2021 literals, which meant a --year=2022
// refetch would have shipped a causes.json still labelled 2021 — the numbers new, the label wrong,
// and nothing to catch it. Deriving the label from the same file the numbers come from removes
// that failure by construction.
export function yearFromSourceName(name: string): number | null {
  const match = /^ghe-(\d{4})-deaths\.csv(\.gz)?$/i.exec(path.basename(name));
  return match ? Number(match[1]) : null;
}

function resolveSource(): string {
  if (srcArg) {
    const p = path.resolve(ROOT, srcArg.split("=")[1] ?? "");
    if (!fs.existsSync(p)) throw new Error(`--src file not found: ${p}`);
    return p;
  }
  const files = fs.existsSync(SRC_DIR)
    ? fs
        .readdirSync(SRC_DIR)
        .filter((f) => /\.csv(\.gz)?$/i.test(f))
        .sort()
        .reverse()
    : [];
  const pick = files[0];
  if (!pick) {
    throw new Error(
      `No WHO GHE CSV found under ${rel(SRC_DIR)}. ` +
        `Run: pnpm run fetch:who-ghe  (keyless, no account needed)`,
    );
  }
  return path.join(SRC_DIR, pick);
}

function rel(p: string): string {
  return path.relative(ROOT, p);
}

// Run only as an entrypoint. The module is also imported by its test for yearFromSourceName, and
// an import must never kick off a full build.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (err: unknown) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
