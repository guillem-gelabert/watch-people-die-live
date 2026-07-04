// Dump a static snapshot of the World Bank crude-death-rate + population feed for the
// rate-grid combine notebook. The globe fetches this live via /api/mortality at runtime;
// notebooks can't call a Next.js route, so this snapshot is the offline equivalent.
//
// Output: data/source/cdr-snapshot.json (gitignored, like the rest of data/source/)
//   { indicator, year, source, values: [{ id, iso3, name, value, year, population }] }
//   Same shape as lib/worldbank.js's getMortality().
//
// Usage: node scripts/dump-cdr.ts

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getMortality } from "../lib/worldbank";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "data", "source", "cdr-snapshot.json");

async function main(): Promise<void> {
  const mortality = await getMortality();
  if (mortality.source !== "worldbank") {
    console.warn(
      `Warning: live World Bank fetch failed, snapshot will contain sample fallback data (source=${mortality.source}).`,
    );
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(mortality));
  console.log(
    `Wrote ${rel(OUT)}: ${mortality.values.length} countries, source=${mortality.source}.`,
  );
}

function rel(p: string): string {
  return path.relative(ROOT, p);
}

try {
  await main();
} catch (err: unknown) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
