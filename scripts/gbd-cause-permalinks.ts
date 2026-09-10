// Build the GBD permalinks for a subnational CAUSE export, and check the files that come back.
//
// The age/sex export (04-03, scripts/build-subnational-age-sex.ts) dropped the cause dimension to
// stay inside one download. This is the version that keeps it, at GBD's depth-2 cause level — 22
// groups like "Cardiovascular diseases" rather than 309 specific causes.
//
// Why depth 2 and not the detail: the download limit is a row budget per GBD release, not a rate
// (see .planning/phases/04-persona-realism-ladder/gbd-export-spec.md, amendment 2026-09-10). The
// most-detailed cube is ~9.8M rows against an allowance of unknown size that never refills.
// Depth 2 is ~0.70M, which is worth spending speculatively; the detailed version is a request to
// make of IHME, not a download to take.
//
// What comes out is NOT a replacement for data/causes.json. Twenty-two chapter-level groups cannot
// carry 87 specific WHO labels. It is a reweighting layer: shift weight between chapters per
// region, the way pipeline/seasonal_composition.py already reweights by ICD-10 chapter.
//
// The selection is machine-built and machine-checked, which is the property worth keeping from the
// spec's permalink route. Rather than retyping 723 location ids, this reads them back off the
// permalink that actually delivered the 31,812-row age/sex export — so the geometry is an observed
// fact, not a literal that can rot. Only the cause list changes.
//
// Neither endpoint used here needs a token and neither spends download quota: permalink.php stores
// a query, get_permalink_settings.php reads one back. The human step is opening each URL and
// pressing Download.
//
// Usage:
//   node --import tsx scripts/gbd-cause-permalinks.ts              # plan only, no network writes
//   node --import tsx scripts/gbd-cause-permalinks.ts --create     # POST the permalinks, print URLs
//   node --import tsx scripts/gbd-cause-permalinks.ts --check      # validate the downloaded CSVs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "data", "source", "gbd-subnational-causes");

const BASE = "https://vizhub.healthdata.org/gbd-results";
// Origin and Referer are not optional: without them a well-formed request returns a bare Flask 500
// rather than a useful error. Observed 2026-08-25, still true 2026-09-10.
const HEADERS = {
  Origin: "https://vizhub.healthdata.org",
  Referer: "https://vizhub.healthdata.org/gbd-results/",
};

// The permalink whose download is the proven geometry: 723 locations x 22 ages x 2 sexes = 31,812
// rows, delivered 2026-08-25 as IHME-GBD_2023_DATA-a8bd9db5-1.csv. Every parameter except `cause`
// is taken from it, including `version: 8016` — which app_settings.php does NOT advertise; it
// reports 8352, and the tool's own traffic uses 8016.
const TEMPLATE = "gbd-api-2023-permalink/d0073be13a7f988f991b67040b9a27e0";

// GBD's published per-download ceiling, from php/app_settings.php. Asserted against live settings
// below rather than trusted, since a change here silently changes how many chunks are needed.
const MAX_ROWS_PER_DOWNLOAD = 100_000;

interface PermalinkParams {
  version: number;
  measure: number[];
  metric: number[];
  location: number[];
  sex: number[];
  age: number[];
  cause: number[];
  year: number[];
  population_group: number;
  api_version: string;
  base: string;
  context: string;
  singleOrMult: string;
  idsOrNames: string;
  rows: number;
  language: string;
  fetch_all_years: string;
  [key: string]: unknown;
}

// qs.stringify's shape: indexed keys, `age[0]=28&age[1]=238`. Repeated bare keys reach validation
// and fail it ("expected a list of measure IDs"), and a JSON body is not parsed at all.
function encodeForm(params: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      value.forEach((v, i) =>
        parts.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(v))}`),
      );
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.join("&");
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

// Note the envelope: app_settings, hierarchy and metadata answer `{status, data}`, but this one
// answers `{params, state}` with no wrapper. Both shapes are accepted rather than assumed.
async function readPermalink(bucketPath: string): Promise<PermalinkParams> {
  const body = await getJson<{
    params?: PermalinkParams;
    data?: { params?: PermalinkParams };
  }>(`${BASE}/php/get_permalink_settings.php?bucket_path=${encodeURIComponent(bucketPath)}`);
  const params = body.params ?? body.data?.params;
  if (!params) throw new Error(`No params in permalink ${bucketPath}`);
  return params;
}

// Ids only in the hierarchy; names live in the metadata dimension tables.
interface Node {
  id: number;
  children?: Node[];
}

function atDepth(nodes: Node[], want: number, depth = 0, out: number[] = []): number[] {
  for (const node of nodes) {
    if (depth === want) out.push(node.id);
    else atDepth(node.children ?? [], want, depth + 1, out);
  }
  return out;
}

async function depthTwoCauses(): Promise<{ id: number; name: string }[]> {
  const hierarchy = await getJson<{ data: { causes: Node[] } }>(`${BASE}/php/hierarchy/`);
  const metadata = await getJson<{ data: { cause: Record<string, { name: string }> } }>(
    `${BASE}/php/metadata/?language=en`,
  );
  const ids = atDepth(hierarchy.data.causes, 2);
  // Depth 2 is GBD's chapter level and has been 22 groups for several releases. Asserted rather
  // than assumed: a different count means the tree moved and the chunking below is wrong.
  if (ids.length !== 22) {
    throw new Error(`Expected 22 depth-2 causes, found ${ids.length}. The cause tree has changed.`);
  }
  return ids.map((id) => {
    const name = metadata.data.cause[String(id)]?.name;
    if (!name) throw new Error(`Cause ${id} has no name in live metadata.`);
    return { id, name };
  });
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function plan() {
  const template = await readPermalink(TEMPLATE);
  const settings = await getJson<{ data: { max_rows_per_download: number } }>(
    `${BASE}/php/app_settings.php`,
  );
  const cap = settings.data.max_rows_per_download;
  if (cap !== MAX_ROWS_PER_DOWNLOAD) {
    console.warn(
      `app_settings.php now reports max_rows_per_download=${cap}, not ${MAX_ROWS_PER_DOWNLOAD}. ` +
        `Chunking below uses the live value.`,
    );
  }

  const causes = await depthTwoCauses();
  const rowsPerCause = template.location.length * template.age.length * template.sex.length;
  // Floor, not round: a chunk one cause too large is a download that fails after the human has
  // already spent the click and the rows.
  const causesPerChunk = Math.max(1, Math.floor(cap / rowsPerCause));
  const chunks = chunk(causes, causesPerChunk);

  return { template, causes, rowsPerCause, causesPerChunk, chunks, cap };
}

async function createPermalink(params: PermalinkParams): Promise<string> {
  const res = await fetch(`${BASE}/php/permalink.php`, {
    method: "POST",
    headers: { ...HEADERS, "Content-Type": "application/x-www-form-urlencoded" },
    body: encodeForm(params),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`POST permalink.php -> ${res.status} ${text}`);
  const body = JSON.parse(text) as {
    bucket_path?: string;
    hash?: string;
    data?: { bucket_path?: string; hash?: string };
  };
  const found = body.bucket_path ?? body.data?.bucket_path;
  const hash = body.hash ?? body.data?.hash;
  const bucket = found ?? (hash && `gbd-api-2023-permalink/${hash}`);
  if (!bucket) throw new Error(`No bucket_path in permalink response: ${text.slice(0, 200)}`);
  return bucket;
}

// Round-trip every stored query rather than trusting the POST. This is the whole point of the
// permalink route: the selection is verified before a human spends a download on it.
function assertStored(stored: PermalinkParams, want: PermalinkParams, label: string): void {
  const same = (a: number[], b: number[]) =>
    a.length === b.length &&
    [...a].sort((x, y) => x - y).join() === [...b].sort((x, y) => x - y).join();
  const problems: string[] = [];
  if (!same(stored.cause, want.cause)) problems.push(`cause ${stored.cause} != ${want.cause}`);
  if (!same(stored.location, want.location))
    problems.push(`location count ${stored.location.length} != ${want.location.length}`);
  if (!same(stored.age, want.age)) problems.push(`age ${stored.age} != ${want.age}`);
  if (!same(stored.sex, want.sex)) problems.push(`sex ${stored.sex} != ${want.sex}`);
  if (!same(stored.year, want.year)) problems.push(`year ${stored.year} != ${want.year}`);
  if (!same(stored.measure, [1])) problems.push(`measure ${stored.measure} != [1] (Deaths)`);
  if (!same(stored.metric, [1])) problems.push(`metric ${stored.metric} != [1] (Number)`);
  if (problems.length) throw new Error(`${label} stored wrong:\n  ${problems.join("\n  ")}`);
}

async function main(): Promise<void> {
  const mode = process.argv.includes("--create")
    ? "create"
    : process.argv.includes("--check")
      ? "check"
      : "plan";

  if (mode === "check") return check();

  const { template, causes, rowsPerCause, causesPerChunk, chunks, cap } = await plan();

  console.log(`Template ${TEMPLATE}`);
  console.log(
    `  ${template.location.length} locations x ${template.age.length} ages x ` +
      `${template.sex.length} sexes = ${rowsPerCause.toLocaleString()} rows per cause`,
  );
  console.log(`  version ${template.version}, context ${template.context}, base ${template.base}`);
  console.log(
    `\n${causes.length} depth-2 causes, ${causesPerChunk} per download ` +
      `(${(causesPerChunk * rowsPerCause).toLocaleString()} of ${cap.toLocaleString()} rows), ` +
      `${chunks.length} downloads, ${(causes.length * rowsPerCause).toLocaleString()} rows total.\n`,
  );

  for (const [i, group] of chunks.entries()) {
    console.log(`  ${String(i + 1).padStart(2)}. ${group.map((c) => c.name).join(", ")}`);
  }

  if (mode === "plan") {
    console.log(`\nPlan only — nothing was sent. Re-run with --create to store these queries.`);
    return;
  }

  console.log("");
  const urls: string[] = [];
  for (const [i, group] of chunks.entries()) {
    const params: PermalinkParams = { ...template, cause: group.map((c) => c.id) };
    delete params.hash;
    delete params.origin;
    const bucket = await createPermalink(params);
    assertStored(await readPermalink(bucket), params, `chunk ${i + 1}`);
    const url = `${BASE}?params=${bucket}`;
    urls.push(url);
    console.log(`  ${String(i + 1).padStart(2)}. verified  ${url}`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const listing = path.join(OUT_DIR, "permalinks.txt");
  fs.writeFileSync(listing, urls.join("\n") + "\n");
  console.log(
    `\nWrote ${path.relative(ROOT, listing)}. Sign in, open each, press Download, and put the ` +
      `CSVs in ${path.relative(ROOT, OUT_DIR)}/ — then re-run with --check.`,
  );
}

// The row-count check. There is no pre-download counter on this path (php/data.php is behind
// Turnstile), so the delivered files are the only place the selection can be confirmed.
function check(): void {
  if (!fs.existsSync(OUT_DIR)) throw new Error(`No ${path.relative(ROOT, OUT_DIR)} yet.`);
  const files = fs.readdirSync(OUT_DIR).filter((f) => f.toLowerCase().endsWith(".csv"));
  if (!files.length) throw new Error(`No CSVs in ${path.relative(ROOT, OUT_DIR)}.`);

  const locations = new Set<number>();
  const ages = new Set<number>();
  const sexes = new Set<number>();
  const causes = new Set<number>();
  const years = new Set<number>();
  let rows = 0;
  const problems: string[] = [];

  for (const file of files) {
    const text = fs.readFileSync(path.join(OUT_DIR, file), "utf8").trim();
    const [header, ...lines] = text.split("\n");
    const cols = (header as string).split(",");
    const idx = (name: string) => cols.indexOf(name);
    for (const name of ["location", "age", "sex", "cause", "year", "measure", "metric", "val"]) {
      if (idx(name) < 0) problems.push(`${file}: no "${name}" column (header: ${cols.join(",")})`);
    }
    if (problems.length) break;
    for (const line of lines) {
      const f = line.split(",");
      rows++;
      locations.add(Number(f[idx("location")]));
      ages.add(Number(f[idx("age")]));
      sexes.add(Number(f[idx("sex")]));
      causes.add(Number(f[idx("cause")]));
      years.add(Number(f[idx("year")]));
      if (Number(f[idx("measure")]) !== 1) problems.push(`${file}: measure != 1 (Deaths)`);
      if (Number(f[idx("metric")]) !== 1) problems.push(`${file}: metric != 1 (Number)`);
    }
  }

  console.log(
    `${rows.toLocaleString()} rows · ${locations.size} locations · ${ages.size} ages · ` +
      `${causes.size} causes · ${sexes.size} sexes · years ${[...years].join(", ")}`,
  );

  if (causes.has(294))
    problems.push(`"All causes" (294) present — it sums on top of the 22 groups`);
  if (sexes.has(3)) problems.push(`"Both" sexes (3) present — it sums on top of male + female`);
  if (years.size > 1) problems.push(`more than one year: rows would be summed across them`);
  if (ages.size !== 22) problems.push(`${ages.size} age groups, expected the 22 disjoint ones`);
  if (causes.size !== 22) problems.push(`${causes.size} causes, expected 22 depth-2 groups`);

  const expected = locations.size * ages.size * sexes.size * causes.size;
  if (rows !== expected) {
    problems.push(
      `${rows.toLocaleString()} rows but ${locations.size} x ${ages.size} x ${sexes.size} x ` +
        `${causes.size} = ${expected.toLocaleString()} — a download is missing or truncated`,
    );
  }

  if (problems.length) {
    console.error(`\nREJECT:\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  console.log("\nComplete and disjoint — ready to build from.");
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
