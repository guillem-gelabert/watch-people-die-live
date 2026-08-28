// Build a compact per-country age x sex distribution of DEATHS for the front-end.
//
// Source: UN World Population Prospects via the UN Population Division Data Portal API
//   https://population.un.org/dataportalapi/api/v1
// Indicator: "Deaths by age and sex" (absolute deaths). The relative magnitudes across
// age bands ARE exactly the sampling weights we want: given that a death occurs in a
// country, draw an age band (and sex) in proportion to how many deaths actually fall
// there. A death in Japan then skews old; one in Nigeria skews young.
//
// The UN portal does NOT carry cause-of-death data — that comes from IHME GBD, built
// separately by scripts/build-causes.mjs. This script only produces the age/sex split.
//
// Output: data/mortality-age-sex.json
//   { source, year, indicator, bands, global: {m:[...],f:[...]},
//     countries: { <m49>: { m:[w per band], f:[w per band] }, ... } }
//   Weights are raw death counts; persona.js normalises at sample time.
//
// Auth: set the Data Portal bearer token in UN_API_KEY (or un_api_key, the name used on
// Railway — either casing works).
// Usage: UN_API_KEY=... node scripts/build-mortality.ts [--year=2023] [--force]
//
// This also runs during the Railway build (see railway.json), where the token is
// present and population.un.org is reachable, so the deployed app gets fresh data
// without committing it. The build command tolerates failure: if the fetch fails the
// file is simply absent and the client falls back to the bundled persona sample.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { politeFetchJson } from "../lib/http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "data", "mortality-age-sex.json");
const ATLAS = path.join(ROOT, "node_modules", "world-atlas", "countries-110m.json");
const API = "https://population.un.org/dataportalapi/api/v1";

// Shared 9-band scheme. MUST stay in sync with AGE_BANDS in app/globe/persona.js and the
// bands in scripts/build-causes.mjs. [min, max] inclusive ages in years.
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

const TOKEN = process.env.UN_API_KEY || process.env.un_api_key;
const force = process.argv.includes("--force");
const yearArg = process.argv.find((a) => a.startsWith("--year="));
const YEAR = yearArg ? Number(yearArg.split("=")[1]) : 2023;

interface CountryAgg {
  m: number[];
  f: number[];
}

interface CountryOut {
  m: number[];
  f: number[];
}

interface MortalityOutput {
  source: string;
  year: number;
  indicator: number;
  bands: [number, number][];
  global: CountryOut;
  countries: Record<number, CountryOut>;
}

interface DataPortalRow {
  sex?: string;
  variant?: string;
  locationId?: number | string;
  value?: number | string;
  timeLabel?: number | string;
  timeMid?: number | string;
  ageStart?: number | string;
  ageEnd?: number | string;
}

interface DataPortalIndicator {
  id: number;
  name?: string;
}

interface PagedResponse<T> {
  data?: T[];
  nextPage?: string | null;
}

interface CountryTopology {
  objects: {
    countries: {
      geometries: { id?: string | number }[];
    };
  };
}

async function main(): Promise<void> {
  if (fs.existsSync(OUT) && !force) {
    console.log(`${rel(OUT)} already exists — pass --force to rebuild.`);
    return;
  }
  if (!TOKEN) {
    console.error(
      "UN_API_KEY (or un_api_key) is not set. Export the Data Portal bearer token and " +
        "retry, e.g.\n  UN_API_KEY=eyJ... node scripts/build-mortality.ts",
    );
    process.exit(1);
  }

  const m49s = atlasM49(); // real, mappable countries only
  console.log(`Targeting ${m49s.length} countries from world-atlas.`);

  // The Data Portal exposes deaths split by age + sex as "Deaths by 5-year age groups
  // and sex" (id 64) and "Deaths by 1-year age groups and sex" (id 69). We want the
  // 5-year version — it matches our band scheme and is far smaller to fetch. Match it
  // by name (id may change across revisions) and fall back to a 1-year groups variant.
  const indicatorId =
    (await findIndicator(/deaths\s+by\s+5-year\s+age\s+groups?\s+and\s+sex/i)) ??
    (await findIndicator(/deaths\s+by\s+.*age\s+groups?\s+and\s+sex/i));
  if (!indicatorId) throw new Error('No "Deaths by ... age groups and sex" indicator found.');
  console.log(`Using indicator ${indicatorId} ("Deaths by 5-year age groups and sex").`);

  // Fetch in location chunks to keep URLs and responses manageable.
  const byCountry = new Map<number, CountryAgg>(); // m49 -> { m:[9], f:[9] }
  const chunk = 40;
  let maxYear = 0;
  for (let i = 0; i < m49s.length; i += chunk) {
    const ids = m49s.slice(i, i + chunk);
    const url =
      `${API}/data/indicators/${indicatorId}/locations/${ids.join(",")}` +
      `/start/${YEAR}/end/${YEAR}`;
    for await (const row of paged<DataPortalRow>(url)) {
      const sex = sexKey(row);
      if (!sex) continue; // skip "Both sexes"
      if (row.variant && !/median/i.test(row.variant)) continue; // estimates/median only
      const m49 = Number(row.locationId);
      if (!m49) continue;
      const value = Number(row.value);
      if (!(value >= 0)) continue;
      maxYear = Math.max(maxYear, Number(row.timeLabel) || Number(row.timeMid) || 0);
      let c = byCountry.get(m49);
      if (!c) {
        c = { m: zeros(), f: zeros() };
        byCountry.set(m49, c);
      }
      // An age group may span more than one band; split by year overlap.
      addByOverlap(c[sex], Number(row.ageStart), ageEndOf(row), value);
    }
    console.log(`  fetched ${Math.min(i + chunk, m49s.length)}/${m49s.length} countries`);
  }

  if (!byCountry.size) throw new Error("No usable rows returned from the UN API.");

  const countries: Record<number, CountryOut> = {};
  const global: CountryAgg = { m: zeros(), f: zeros() };
  for (const [m49, c] of byCountry) {
    countries[m49] = { m: round1(c.m), f: round1(c.f) };
    for (let b = 0; b < BANDS.length; b++) {
      global.m[b] = (global.m[b] ?? 0) + (c.m[b] ?? 0);
      global.f[b] = (global.f[b] ?? 0) + (c.f[b] ?? 0);
    }
  }

  const out: MortalityOutput = {
    source: "UN World Population Prospects — Deaths by age and sex (Data Portal API)",
    year: maxYear || YEAR,
    indicator: indicatorId,
    bands: BANDS,
    global: { m: round1(global.m), f: round1(global.f) },
    countries,
  };
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log(`Wrote ${rel(OUT)}: ${Object.keys(countries).length} countries, year ${out.year}.`);
}

// --- UN API helpers --------------------------------------------------------------

function headers(): Record<string, string> {
  return { Authorization: `Bearer ${TOKEN}`, Accept: "application/json" };
}

// One page from the UN Data Portal. The retry policy, the spacing between calls and the
// fail-fast-on-4xx rule all live in lib/http.ts now — this build used to carry its own copy, as did
// every other caller, which is how the ACLED path drifted into retrying a 403 three times.
async function getJson<T>(url: string): Promise<T> {
  return politeFetchJson<T>(url, { headers: headers() }, { label: "UN Data Portal" });
}

// Find an indicator id by matching its name, or null if none match. /indicators is
// itself paginated. (Callers chain matchers with ?? to degrade gracefully.)
async function findIndicator(re: RegExp): Promise<number | null> {
  for await (const ind of paged<DataPortalIndicator>(`${API}/indicators/`)) {
    if (re.test(ind.name || "")) return ind.id;
  }
  return null;
}

// Yield every record across the Data Portal's paginated responses. The API returns
// either a bare array or an object { data: [...], nextPage: <url|null> }.
async function* paged<T>(url: string): AsyncGenerator<T> {
  let next: string | null = url;
  while (next) {
    const j: T[] | PagedResponse<T> = await getJson<T[] | PagedResponse<T>>(next);
    if (Array.isArray(j)) {
      yield* j;
      return;
    }
    const rows = Array.isArray(j.data) ? j.data : [];
    yield* rows;
    // The API hands back an http:// nextPage; following it would 301 to https and
    // Node's fetch drops the Authorization header across that redirect (-> 401). Force
    // https so the bearer token survives.
    next = j.nextPage ? j.nextPage.replace(/^http:\/\//i, "https://") : null;
  }
}

// Data Portal sex labels: "Male" / "Female" / "Both sexes". Map to m/f, skip both.
function sexKey(row: DataPortalRow): Sex | null {
  const s = String(row.sex || "").toLowerCase();
  if (s === "male") return "m";
  if (s === "female") return "f";
  return null;
}

function ageEndOf(row: DataPortalRow): number {
  const e = Number(row.ageEnd);
  return Number.isFinite(e) && e > 0 ? e : 200; // open-ended top group (e.g. 100+)
}

// --- band math -------------------------------------------------------------------

function zeros(): number[] {
  return new Array(BANDS.length).fill(0) as number[];
}

// Distribute `value` from an age interval [start, end) across the bands it overlaps,
// in proportion to the number of years of overlap. Approximate for groups that cross a
// band edge (e.g. UN "0-4" -> the 0 and 1-4 bands), exact when a group sits in one band.
function addByOverlap(arr: number[], start: number, end: number, value: number): void {
  if (!Number.isFinite(start)) return;
  const span = Math.max(1, end - start); // years in the source group
  for (let b = 0; b < BANDS.length; b++) {
    const band = BANDS[b];
    if (!band) continue;
    const [lo, hi] = band;
    const ov = Math.max(0, Math.min(end, hi + 1) - Math.max(start, lo));
    if (ov > 0) arr[b] = (arr[b] ?? 0) + (value * ov) / span;
  }
}

function round1(arr: number[]): number[] {
  return arr.map((n) => Math.round(n * 10) / 10);
}

// --- misc ------------------------------------------------------------------------

function atlasM49(): number[] {
  const topo = JSON.parse(fs.readFileSync(ATLAS, "utf8")) as CountryTopology;
  return topo.objects.countries.geometries
    .map((g) => Number(g.id))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function rel(p: string): string {
  return path.relative(ROOT, p);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
