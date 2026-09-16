// Regional cause-of-death reweighting, from the GBD 2023 subnational cause export.
//
// The cause table in data/causes.json is national: every death drawn inside a country shares one
// cause distribution, while age and sex already resolve to 474 subnational regions. This closes
// part of that gap. It does NOT replace the WHO vocabulary — 22 GBD chapter groups cannot carry
// 87 specific labels — it shifts weight between groups per region, exactly the shape
// pipeline/seasonal_composition.py already applies for the month.
//
// Only three of the 22 groups are here: Cardiovascular diseases, Neoplasms and Chronic
// respiratory diseases. That is not a design choice. The public results tool caps a download at
// 100,000 rows and spends a per-release allowance that never refills; the 22-group export over
// 723 locations is 699,864 rows across 8 downloads, the downloads were ordered biggest-first so
// that stopping early would cost least, and the allowance ran out after the first. Those three
// groups are 55.01% of all deaths, measured against the all-cause export rather than assumed.
//
// The estimator is a transfer of regional contrasts, not a replacement of the national mix. For
// each region r inside country c, and each age band and sex:
//
//     a_g = b_r,g / b_c,g          for the three groups
//     a_U = b_r,U / b_c,U          for everything else, taken together
//
// where b is a share of that stratum's all-cause deaths, and U is the unobserved complement,
// 1 - sum of the three. Every label the crosswalk does not name gets a_U, which keeps the
// national proportions *inside* the complement untouched while pricing the complement as a whole
// — the alternative, leaving it at 1 and renormalising, throws away a constraint we actually
// have. The WHO baseline keeps its own group masses: this borrows GBD's spatial contrast, it does
// not assert GBD's national composition. The resulting regional group shares therefore do not
// equal GBD's exactly, which is a property of the estimator and not a defect in it.
//
// Output: data/cause-cells.json
//   { meta, groups, labelGroup, archetypes: [{m,f}], classId: [cellIdx -> archetype | -1] }
// `classId` is aligned to data/rate-grid.json's cell order, like data/age-sex-cells.json, so the
// runtime needs no region lookup of its own. -1 means no regional cause data for that cell, and
// the national table answers unchanged.
//
// Usage: node --import tsx scripts/build-cause-regional.ts [--force]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "data", "cause-cells.json");
const CAUSE_DIR = path.join(ROOT, "data", "source", "gbd-subnational-causes");
const AGE_SEX_DIR = path.join(ROOT, "data", "source", "gbd-subnational-age-sex");

const CITATION =
  "Source: Institute for Health Metrics and Evaluation. Used with permission. All rights " +
  "reserved. Global Burden of Disease Collaborative Network. Global Burden of Disease Study 2023 " +
  "(GBD 2023) Results. Seattle, United States: Institute for Health Metrics and Evaluation " +
  "(IHME), 2024. Available from https://vizhub.healthdata.org/gbd-results/.";

const force = process.argv.includes("--force");

// MUST match BANDS in build-causes.ts, build-subnational-age-sex.ts and build-mortality.ts,
// AGE_BANDS in app/globe/persona.ts, and BANDS in pipeline/age_bands.py.
const BAND_COUNT = 9;

// GBD age_group_id -> band index. Copied deliberately rather than imported: build-subnational-
// age-sex.ts owns the same table and a shared module would make one script's rebuild silently
// depend on the other's. The comment there explains why GBD's own `type` field cannot select it.
const AGE_BAND = new Map<number, number>([
  [28, 0],
  [238, 1],
  [34, 1],
  [6, 2],
  [7, 2],
  [8, 3],
  [9, 3],
  [10, 3],
  [11, 4],
  [12, 4],
  [13, 4],
  [14, 4],
  [15, 5],
  [16, 5],
  [17, 5],
  [18, 6],
  [19, 6],
  [20, 7],
  [30, 7],
  [31, 8],
  [32, 8],
  [235, 8],
]);

const SEX = new Map<number, "m" | "f">([
  [1, "m"],
  [2, "f"],
]);

// The three GBD depth-2 groups the one delivered download carries, in the order they appear in
// every archetype's per-band array. The fourth slot is the complement.
const GROUPS = ["Cardiovascular diseases", "Neoplasms", "Chronic respiratory diseases"] as const;
const GROUP_ID = new Map<number, number>([
  [491, 0], // Cardiovascular diseases
  [410, 1], // Neoplasms
  [508, 2], // Chronic respiratory diseases
]);
const SLOTS = GROUPS.length + 1; // three groups plus the complement
const OTHER = GROUPS.length;

// data/causes.json label -> which GBD group it belongs to. Every label absent from this map is
// part of the complement and takes a_U.
//
// Two collisions are worth naming because they are easy to get backwards. "lower respiratory
// infection", "upper respiratory infections" and "tuberculosis" are NOT chronic respiratory —
// they are GBD's separate "Respiratory infections and tuberculosis" group, which this download
// does not contain, so they take the complement multiplier. And "other neoplasms" is WHO's
// benign/in-situ bucket, which GBD does place under Neoplasms, so it is mapped rather than left
// to the complement.
const LABEL_GROUP = new Map<string, number>([
  // Cardiovascular diseases
  ["ischaemic heart disease", 0],
  ["a stroke", 0],
  ["hypertensive heart disease", 0],
  ["other cardiovascular and circulatory diseases", 0],
  ["cardiomyopathy and myocarditis", 0],
  ["rheumatic heart disease", 0],
  // Neoplasms
  ["lung cancer", 1],
  ["stomach cancer", 1],
  ["colorectal cancer", 1],
  ["breast cancer", 1],
  ["liver cancer", 1],
  ["esophageal cancer", 1],
  ["prostate cancer", 1],
  ["cervical cancer", 1],
  ["pancreatic cancer", 1],
  ["leukaemia", 1],
  ["brain and central nervous system cancer", 1],
  ["bladder cancer", 1],
  ["ovarian cancer", 1],
  ["kidney cancer", 1],
  ["lip and oral cavity cancer", 1],
  ["nasopharynx cancer", 1],
  ["gallbladder and biliary tract cancer", 1],
  ["uterine cancer", 1],
  ["testicular cancer", 1],
  ["malignant skin melanoma", 1],
  ["multiple myeloma", 1],
  ["hodgkin lymphoma", 1],
  ["non-hodgkin lymphoma", 1],
  ["other malignant neoplasms", 1],
  ["other neoplasms", 1],
  // Chronic respiratory diseases
  ["COPD", 2],
  ["asthma", 2],
  ["other chronic respiratory diseases", 2],
]);

// A multiplier this far from 1 is a modelling artefact or a stratum with almost no deaths in it,
// not a real regional contrast worth drawing. Clamping rather than dropping keeps the direction
// of the signal; the count of clamped strata is reported so a silent epidemic of them cannot hide.
const CLAMP_LO = 0.25;
const CLAMP_HI = 4;

// Split one CSV line, respecting double quotes: the cause export quotes any field with a comma in
// it, and a naive split shifts every column after the quoted one.
function splitCsv(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      out.push(field);
      field = "";
    } else field += c;
  }
  out.push(field);
  return out;
}

function onlyCsv(dir: string): string[] {
  if (!fs.existsSync(dir)) throw new Error(`Missing ${path.relative(ROOT, dir)}.`);
  const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".csv"));
  if (!files.length) throw new Error(`No CSVs in ${path.relative(ROOT, dir)}.`);
  return files.map((f) => path.join(dir, f));
}

// Both exports are read through one reader. They do not share a column spelling — the August
// age/sex download has bare id columns, the September cause download has `location_id` +
// `location_name` pairs — so every lookup accepts either.
interface Row {
  location: number;
  sex: number;
  age: number;
  cause: number;
  val: number;
}

function readRows(file: string): Row[] {
  const text = fs.readFileSync(file, "utf8").trim();
  const [header, ...lines] = text.split("\n");
  const cols = splitCsv(header as string);
  const idx = (name: string): number => {
    const i = cols.indexOf(`${name}_id`);
    const j = i >= 0 ? i : cols.indexOf(name);
    if (j < 0) throw new Error(`${path.basename(file)}: no "${name}" column.`);
    return j;
  };
  const [L, S, A, C, V] = [idx("location"), idx("sex"), idx("age"), idx("cause"), idx("val")];
  const out: Row[] = [];
  for (const line of lines) {
    if (!line) continue;
    const f = splitCsv(line);
    out.push({
      location: Number(f[L]),
      sex: Number(f[S]),
      age: Number(f[A]),
      cause: Number(f[C]),
      val: Number(f[V]),
    });
  }
  return out;
}

type BySexBand = { m: number[]; f: number[] };
const freshBands = (): BySexBand => ({
  m: new Array(BAND_COUNT).fill(0),
  f: new Array(BAND_COUNT).fill(0),
});

function main(): void {
  if (fs.existsSync(OUT) && !force) {
    console.log(`${path.relative(ROOT, OUT)} already exists — pass --force to rebuild.`);
    return;
  }

  // All-cause denominators, from the export the age/sex layer already builds on.
  const all = new Map<number, BySexBand>();
  let allRows = 0;
  for (const file of onlyCsv(AGE_SEX_DIR)) {
    for (const r of readRows(file)) {
      const band = AGE_BAND.get(r.age);
      const sex = SEX.get(r.sex);
      if (band === undefined || !sex) continue;
      if (r.cause !== 294) throw new Error(`${path.basename(file)}: expected only cause 294.`);
      const e = all.get(r.location) ?? freshBands();
      e[sex][band] = (e[sex][band] ?? 0) + r.val;
      all.set(r.location, e);
      allRows++;
    }
  }

  // Group deaths, from whichever cause downloads have been delivered so far.
  const groups = new Map<number, BySexBand[]>(); // location -> per group
  const seenGroups = new Set<number>();
  let causeRows = 0;
  for (const file of onlyCsv(CAUSE_DIR)) {
    for (const r of readRows(file)) {
      const band = AGE_BAND.get(r.age);
      const sex = SEX.get(r.sex);
      const g = GROUP_ID.get(r.cause);
      if (band === undefined || !sex) continue;
      seenGroups.add(r.cause);
      if (g === undefined) continue; // a group from a later download this build does not model
      const e = groups.get(r.location) ?? GROUPS.map(() => freshBands());
      const slot = e[g];
      if (!slot) continue;
      slot[sex][band] = (slot[sex][band] ?? 0) + r.val;
      groups.set(r.location, e);
      causeRows++;
    }
  }
  const unmodelled = [...seenGroups].filter((c) => !GROUP_ID.has(c));
  if (unmodelled.length) {
    throw new Error(
      `Cause ids ${unmodelled.join(", ")} are in the export but not in GROUP_ID. A later ` +
        `download has landed — extend GROUPS/GROUP_ID/LABEL_GROUP rather than dropping them.`,
    );
  }

  // Shares of all-cause deaths, per location, sex and band: the three groups plus the complement.
  const shares = new Map<number, { m: number[][]; f: number[][] }>();
  for (const [location, per] of groups) {
    const denom = all.get(location);
    if (!denom) continue; // no all-cause row: cannot form a share, so this location cannot speak
    const entry = { m: [] as number[][], f: [] as number[][] };
    for (const sex of ["m", "f"] as const) {
      for (let b = 0; b < BAND_COUNT; b++) {
        const total = denom[sex][b] ?? 0;
        const row = new Array<number>(SLOTS).fill(0);
        if (total > 0) {
          let sum = 0;
          for (let g = 0; g < GROUPS.length; g++) {
            const v = (per[g]?.[sex][b] ?? 0) / total;
            row[g] = v;
            sum += v;
          }
          row[OTHER] = Math.max(0, 1 - sum);
        }
        entry[sex].push(row);
      }
    }
    shares.set(location, entry);
  }

  // Parent-country baselines. Only the countries that actually have matched regions are needed,
  // and each is found by name in the export rather than by a hardcoded id, so a GBD renumbering
  // is a build failure and not a silently wrong denominator.
  const sub = JSON.parse(
    fs.readFileSync(path.join(ROOT, "data", "subnational-age-sex.json"), "utf8"),
  ) as { regions: { key: string; country: string; locationId: number; name: string }[] };

  const NATIONAL = new Map<string, number>([
    ["BRA", 135],
    ["ETH", 179],
    ["GBR", 95],
    ["IDN", 11],
    ["IND", 163],
    ["IRN", 142],
    ["ITA", 86],
    ["JPN", 67],
    ["MEX", 130],
    ["NGA", 214],
    ["PAK", 165],
    ["PHL", 16],
    ["POL", 51],
    ["USA", 102],
    ["ZAF", 196],
  ]);
  for (const [iso3, id] of NATIONAL) {
    if (!shares.has(id)) throw new Error(`No cause shares for ${iso3}'s national location ${id}.`);
  }
  const countries = new Set(sub.regions.map((r) => r.country));
  for (const c of countries) {
    if (!NATIONAL.has(c)) {
      throw new Error(
        `${c} has matched regions but no national baseline id. GBD's location set has changed — ` +
          `add it to NATIONAL rather than letting its regions fall back to no reweighting.`,
      );
    }
  }

  // One archetype per GBD location that has both its own shares and its country's.
  const archetypes: { m: number[][]; f: number[][] }[] = [];
  const archetypeOf = new Map<number, number>(); // locationId -> archetype index
  let clamped = 0;
  let strata = 0;
  for (const region of sub.regions) {
    if (archetypeOf.has(region.locationId)) continue;
    const mine = shares.get(region.locationId);
    const nat = shares.get(NATIONAL.get(region.country) as number);
    if (!mine || !nat) continue;
    const entry = { m: [] as number[][], f: [] as number[][] };
    for (const sex of ["m", "f"] as const) {
      for (let b = 0; b < BAND_COUNT; b++) {
        const row = new Array<number>(SLOTS).fill(1);
        for (let g = 0; g < SLOTS; g++) {
          const base = nat[sex][b]?.[g] ?? 0;
          const here = mine[sex][b]?.[g] ?? 0;
          if (base <= 0 || here <= 0) continue; // no contrast to transfer: leave it at 1
          const raw = here / base;
          const value = Math.min(CLAMP_HI, Math.max(CLAMP_LO, raw));
          if (value !== raw) clamped++;
          row[g] = Number(value.toFixed(2));
        }
        entry[sex].push(row);
        strata++;
      }
    }
    archetypeOf.set(region.locationId, archetypes.length);
    archetypes.push(entry);
  }

  // Per-cell assignment, through the same region keys the age/sex layer uses.
  const rk = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "region-keys.json"), "utf8")) as {
    count: number;
    keys: { key: string }[];
    cells: number[];
  };
  const rate = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "rate-grid.json"), "utf8")) as {
    cells: [number, number, number, number][];
  };
  if (rk.cells.length !== rate.cells.length) {
    throw new Error(`region-keys has ${rk.cells.length} cells, rate-grid ${rate.cells.length}.`);
  }
  const locOfKey = new Map(sub.regions.map((r) => [r.key, r.locationId]));
  const classId = new Array<number>(rk.cells.length).fill(-1);
  let reached = 0;
  let reachedDeaths = 0;
  const world = rate.cells.reduce((a, c) => a + c[3], 0);
  for (let i = 0; i < rk.cells.length; i++) {
    const ki = rk.cells[i] as number;
    if (ki < 0) continue;
    const key = rk.keys[ki]?.key;
    const loc = key ? locOfKey.get(key) : undefined;
    const a = loc !== undefined ? archetypeOf.get(loc) : undefined;
    if (a === undefined) continue;
    classId[i] = a;
    reached++;
    reachedDeaths += rate.cells[i]?.[3] ?? 0;
  }
  if (!reached) throw new Error("No cell resolved to a regional cause archetype.");

  // What fraction of deaths the three groups are, measured rather than claimed.
  let groupDeaths = 0;
  let allDeaths = 0;
  for (const [location, per] of groups) {
    const denom = all.get(location);
    if (!denom) continue;
    for (const sex of ["m", "f"] as const) {
      for (let b = 0; b < BAND_COUNT; b++) {
        allDeaths += denom[sex][b] ?? 0;
        for (let g = 0; g < GROUPS.length; g++) groupDeaths += per[g]?.[sex][b] ?? 0;
      }
    }
  }

  const labelGroup: Record<string, number> = {};
  for (const [label, g] of LABEL_GROUP) labelGroup[label] = g;

  const out = {
    meta: {
      note:
        "Per-cell regional cause multipliers. Each archetype is [Cardiovascular, Neoplasms, " +
        "Chronic respiratory, complement] per age band per sex — the region's share of that " +
        "stratum's deaths divided by its country's. Multiply a national cause weight by the " +
        "entry for its group and renormalise. classId is aligned to rate-grid.json's cell " +
        "order; -1 means no regional cause data and the national table stands.",
      source: "IHME Global Burden of Disease 2023, subnational cause export",
      citation: CITATION,
      year: 2023,
      groups: GROUPS,
      groupShareOfDeaths: Number((groupDeaths / allDeaths).toFixed(4)),
      archetypes: archetypes.length,
      cellsReached: reached,
      cellDeathShare: Number((reachedDeaths / world).toFixed(4)),
      clampedStrata: clamped,
      totalStrata: strata,
      clamp: [CLAMP_LO, CLAMP_HI],
      generatedAt: new Date().toISOString(),
    },
    groups: GROUPS,
    labelGroup,
    archetypes,
    classId,
  };

  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log(
    `Read ${allRows.toLocaleString()} all-cause rows and ${causeRows.toLocaleString()} cause rows.`,
  );
  console.log(
    `${GROUPS.length} groups = ${(100 * (groupDeaths / allDeaths)).toFixed(2)}% of deaths in the export.`,
  );
  console.log(
    `${archetypes.length} archetypes, ${reached.toLocaleString()} cells ` +
      `(${(100 * (reachedDeaths / world)).toFixed(2)}% of expected deaths).`,
  );
  console.log(
    `Clamped ${clamped.toLocaleString()} of ${strata.toLocaleString()} strata ` +
      `(${(100 * (clamped / strata)).toFixed(2)}%) to [${CLAMP_LO}, ${CLAMP_HI}].`,
  );
  console.log(
    `Wrote ${path.relative(ROOT, OUT)}: ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB.`,
  );
}

main();
