// Download WHO Global Health Estimates deaths by country x age x sex x cause.
//
// Source: WHO's public xMart OData endpoint. Keyless — no account, no token, no quota:
//   https://xmart-api-public.who.int/DEX_CMS/GHE_FULL
// Licence: CC BY 4.0 via data.who.int, which permits the derived redistribution this
// project does. Cite as: World Health Organization, data.who.int, Global Health
// Estimates 2021: Deaths by Cause, Age, Sex, by Country and by Region, 2000-2021.
//
// This replaces the hand-exported IHME GBD CSV the cause table used to be built from.
// GBD's results tool gates every data endpoint behind an interactive sign-in and caps a
// download at 100,000 rows, which makes the country x age x sex x cause cube tens of
// thousands of requests; and the WHO Mortality Database, the other candidate, is raw
// registration data with no rows at all for Nigeria, Ethiopia, DR Congo or India.
//
// Fetches one request per country (~6,650 rows each) rather than paging one 1.2M-row
// query, so a failure resumes at a country boundary instead of restarting.
//
// Output: data/source/who-ghe/ghe-<year>-deaths.csv (gitignored; only the built
// data/causes.json is committed)
//
// Usage: node --import tsx scripts/fetch-who-ghe.ts [--year=2021] [--force]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const API = "https://xmart-api-public.who.int/DEX_CMS/GHE_FULL";

const yearArg = process.argv.find((a) => a.startsWith("--year="));
const YEAR = yearArg ? Number(yearArg.split("=")[1]) : 2021;
const force = process.argv.includes("--force");

const OUT_DIR = path.join(ROOT, "data", "source", "who-ghe");
const OUT = path.join(OUT_DIR, `ghe-${YEAR}-deaths.csv`);

// WHO ships 22 age codes and three of them overlap: Y0T1 is exactly D0T27 + M1T11
// (Nigeria 2021 male, all causes: 279,531.29 = 142,010.37 + 137,520.91). Excluding the
// two sub-year codes and TOTAL leaves 19 disjoint bands that reconcile to WHO's own
// total. TOTAL is dropped for sex too, for the same reason.
const EXCLUDED_AGES = ["TOTAL", "D0T27", "M1T11"];

// FLAG_SINGLE_CAUSE marks the 175 leaf causes, which reach 97.58% of all deaths — no WHO
// flag is a clean partition, so FLAG_LEVEL 0 (All Causes) comes along in the same query
// and the builder carries the remainder as "other causes".
const FILTER = [
  `DIM_YEAR_CODE eq ${YEAR}`,
  `DIM_SEX_CODE ne 'TOTAL'`,
  ...EXCLUDED_AGES.map((a) => `DIM_AGEGROUP_CODE ne '${a}'`),
  `(FLAG_SINGLE_CAUSE eq 1 or FLAG_LEVEL eq 0)`,
].join(" and ");

const FIELDS = [
  "DIM_COUNTRY_CODE",
  "DIM_AGEGROUP_CODE",
  "DIM_SEX_CODE",
  "DIM_GHECAUSE_TITLE",
  "FLAG_LEVEL",
  "VAL_DTHS_COUNT_NUMERIC",
];

async function get(params: Record<string, string>): Promise<string> {
  const url = `${API}?${new URLSearchParams(params).toString()}`;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { Accept: "*/*" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (attempt >= 4) throw err;
      await sleep(2000 * attempt);
    }
  }
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function countryCodes(): Promise<string[]> {
  const body = await get({ $apply: "groupby((DIM_COUNTRY_CODE))" });
  const rows = (JSON.parse(body) as { value: { DIM_COUNTRY_CODE: string }[] }).value;
  return rows
    .map((r) => r.DIM_COUNTRY_CODE)
    .filter(Boolean)
    .sort();
}

async function main(): Promise<void> {
  if (fs.existsSync(OUT) && !force) {
    console.log(`${rel(OUT)} already exists — pass --force to refetch.`);
    return;
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const codes = await countryCodes();
  console.log(`WHO GHE ${YEAR}: ${codes.length} countries`);

  const tmp = `${OUT}.partial`;
  fs.writeFileSync(tmp, `${FIELDS.join(",")}\n`);
  let total = 0;
  for (const [i, code] of codes.entries()) {
    const csv = await get({
      $filter: `DIM_COUNTRY_CODE eq '${code}' and ${FILTER}`,
      $select: FIELDS.join(","),
      $orderby: "DIM_GHECAUSE_TITLE,DIM_AGEGROUP_CODE,DIM_SEX_CODE",
      $top: "100000",
      $format: "csv",
    });
    // Drop the per-response header; keep the one written above.
    const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const body = lines.slice(1);
    if (!body.length) throw new Error(`${code} returned no rows`);
    fs.appendFileSync(tmp, `${body.join("\n")}\n`);
    total += body.length;
    if ((i + 1) % 25 === 0 || i === codes.length - 1) {
      console.log(`  ${i + 1}/${codes.length} countries, ${total.toLocaleString()} rows`);
    }
    await sleep(150);
  }
  fs.renameSync(tmp, OUT);
  const mb = (fs.statSync(OUT).size / 1e6).toFixed(1);
  console.log(`Wrote ${rel(OUT)}: ${total.toLocaleString()} rows, ${mb} MB`);
}

function rel(p: string): string {
  return path.relative(ROOT, p);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
