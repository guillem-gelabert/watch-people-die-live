// Bake the ACLED weekly conflict layer into data/conflicts.json at build time.
//
// Why this exists: ACLED publishes the aggregated regional data as .xlsx and nothing else — the
// landing pages carry one workbook link each, the same path with .csv or .json 404s, and the REST
// API, which does serve csv/json/xml, is embargoed twelve months for this account
// (`data_query_restrictions.date_recency`), so it cannot feed a rolling twelve-week window. The
// project's rule is that the server parses JSON or CSV only *at runtime*, so the Excel parsing
// lives here, in the build, and the request path reads only the JSON this writes.
//
// `exceljs` therefore stays a dependency on purpose. It is no longer on the request path, which is
// what the rule asks — do not "clean it up" out of package.json.
//
// Streaming, not buffered: Africa's sheet alone expands past 100 MB, and lib/acled.ts processes the
// six workbooks one at a time to keep that bounded. Real ACLED workbooks store sharedStrings.xml
// and workbook.xml ahead of the worksheet, so the streaming reader has everything it needs when the
// sheet arrives. (Workbooks written *by* ExcelJS put the worksheet first, which is why the test
// fixtures in lib/acled-weekly.test.ts are flaky and real workbooks are not.)
//
// Failure policy: a build that cannot reach ACLED does not ship. Silently falling back to the
// committed snapshot would let a broken integration serve month-old fatalities as current for as
// long as nobody looked. Set SKIP_CONFLICTS_BUILD=1 to override — deliberately, for a hotfix
// during an upstream outage, not as a habit.
//
// Output: data/conflicts.json, committed. It is what the request path reads and what makes
// `pnpm dev` work without ACLED credentials; it is not a fallback.
//
// Usage: node --import tsx scripts/build-conflicts.ts

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildConflictsSnapshot, upstreamCutoff } from "../lib/acled";
import { isCompleteSnapshot, type ConflictsPayload } from "../lib/acled-weekly";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "data", "conflicts.json");

// Next.js loads .env for the app but not for a standalone tsx script, and Railway sets these as
// real environment variables. So fill in only what is missing, and never override.
function loadDotEnv(): void {
  const file = path.join(ROOT, ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match || line.trimStart().startsWith("#")) continue;
    const [, key, raw] = match;
    if (process.env[key!] === undefined) {
      process.env[key!] = raw!.trim().replace(/^(["'])(.*)\1$/, "$2");
    }
  }
}

function readCommitted(): ConflictsPayload | null {
  try {
    const value: unknown = JSON.parse(fs.readFileSync(OUT, "utf8"));
    return isCompleteSnapshot(value) ? value : null;
  } catch {
    return null;
  }
}

function write(payload: ConflictsPayload): void {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  // Written via a temp file in the same directory so an interrupted build cannot leave a
  // half-written snapshot where the next one would read it as committed truth.
  const temporary = `${OUT}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(payload)}\n`, "utf8");
  fs.renameSync(temporary, OUT);
  const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
  console.log(`conflicts: wrote data/conflicts.json (${kb} KB, through ${payload.commonThrough})`);
}

// A rejected credential is not going to get better by trying again, and it is the failure a
// rotated password produces — so it earns a message that names the cause rather than the symptom.
// Note the OAuth endpoint answers bad credentials with **400**, not 401: it is an OAuth2
// `invalid_grant`, which is a malformed-grant response rather than an unauthenticated one.
function explain(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/OAuth returned HTTP 4\d\d/.test(message) || /\b(401|403)\b/.test(message)) {
    return `${message}\n  ACLED rejected the credentials. Check ACLED_USERNAME and ACLED_PASSWORD.`;
  }
  if (/credentials are not configured/.test(message)) {
    return `${message}\n  Set ACLED_USERNAME and ACLED_PASSWORD (Railway variables, or .env locally).`;
  }
  return message;
}

async function main(): Promise<void> {
  loadDotEnv();
  const committed = readCommitted();

  if (process.env.SKIP_CONFLICTS_BUILD) {
    if (!committed) {
      console.error(
        "conflicts: SKIP_CONFLICTS_BUILD is set but data/conflicts.json is missing or incomplete.\n" +
          "  There is nothing to serve. Unset it and let the build fetch, or commit a snapshot.",
      );
      process.exit(1);
    }
    console.warn(
      `conflicts: SKIP_CONFLICTS_BUILD set — keeping the committed snapshot ` +
        `(through ${committed.commonThrough}). The conflict layer will be as old as this file.`,
    );
    return;
  }

  // Ask what week ACLED is advertising before pulling six workbooks for a week we already have.
  // Any failure here is a real failure: it means the landing pages or the credentials are broken,
  // and proceeding would only fail later and slower.
  const cutoff = await upstreamCutoff();
  if (committed && committed.commonThrough === cutoff) {
    console.log(
      `conflicts: committed snapshot already covers ${cutoff} — skipping six workbook downloads.`,
    );
    return;
  }
  if (committed) {
    console.log(
      `conflicts: committed ${committed.commonThrough}, upstream ${cutoff} — rebuilding.`,
    );
  }

  const payload = await buildConflictsSnapshot();
  // buildSnapshot can only produce a complete payload from six parsed regions, but this is the
  // last point before the file is committed and read as truth, so it is checked rather than
  // assumed. A partial snapshot on disk is worse than a failed build.
  if (!isCompleteSnapshot(payload)) {
    throw new Error("ACLED build produced an incomplete snapshot; refusing to write it");
  }
  write(payload);
}

main().catch((error: unknown) => {
  console.error(`conflicts: build failed — ${explain(error)}`);
  console.error(
    "  The deploy is stopped on purpose: shipping the previous snapshot would present stale\n" +
      "  fatalities as current. For a hotfix during an ACLED outage, set SKIP_CONFLICTS_BUILD=1.",
  );
  process.exit(1);
});
