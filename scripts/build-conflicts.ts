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
// Failure policy: if this build *decides* to contact ACLED and cannot, it does not ship. Silently
// falling back to the committed snapshot would let a broken integration serve month-old fatalities
// as current for as long as nobody looked. Set SKIP_CONFLICTS_BUILD=1 to override — deliberately,
// for a hotfix during an upstream outage, not as a habit.
//
// Note the scope: it is "if we decide to contact ACLED", not "on every build". The freshness gate
// below narrows when that decision is taken, so a build during a short ACLED outage now succeeds
// when the snapshot we already hold is recent enough. That is deliberate, and it is a change.
//
// Freshness policy: ACLED publishes weekly and its workbooks already lag ~2 weeks, so contacting it
// on every push bought nothing and cost a great deal — on 2026-08-28 it got this builder's IP
// blocked by ACLED's Imunify360 bot protection after seven builds in four hours. lib/conflict-
// snapshot.ts decides whether to make contact at all; see its header for why the committed file
// alone could never make the old guard work. Escape hatches: `--force` rebuilds regardless,
// CONFLICTS_MAX_AGE_HOURS=0 checks upstream on this build, SKIP_CONFLICTS_BUILD=1 stays offline.
//
// Output: data/conflicts.json, committed. It is what the request path reads and what makes
// `pnpm dev` work without ACLED credentials; it is not a fallback.
//
// Usage: node --import tsx scripts/build-conflicts.ts

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildConflictsSnapshot, upstreamCutoff } from "../lib/acled";
import { isCompleteSnapshot } from "../lib/acled-weekly";
import {
  DEFAULT_MAX_AGE_HOURS,
  decideRefresh,
  pickFreshest,
  readSnapshotFile,
  resolveCachePath,
  resolveMaxAgeHours,
  shouldDownloadWorkbooks,
  tryWriteSnapshotFile,
  writeSnapshotFile,
} from "../lib/conflict-snapshot";

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

  const force = process.argv.includes("--force");
  const maxAge = resolveMaxAgeHours(process.env.CONFLICTS_MAX_AGE_HOURS, DEFAULT_MAX_AGE_HOURS);
  if (maxAge.warning) console.warn(`conflicts: ${maxAge.warning}`);
  const cacheFile = resolveCachePath(ROOT, process.env.CONFLICTS_CACHE_DIR);

  // Two places a usable snapshot can be: the file that came with the git checkout, and the build
  // cache from a previous build on this machine. `committed` is passed first so an exact timestamp
  // tie resolves to the tracked artifact.
  const committed = readSnapshotFile(OUT);
  const cached = cacheFile ? readSnapshotFile(cacheFile, { pruneOnCorrupt: true }) : null;
  const best = pickFreshest([
    { origin: "committed", payload: committed },
    { origin: "cache", payload: cached },
  ]);

  // INVARIANT, and the sequencing rule everything else depends on: from here down, OUT is the
  // snapshot we chose, on every path out of this function. scripts/sync-data.ts copies OUT to
  // public/data/, which is the only thing the site reads — so returning early without materialising
  // a cache win would ship the *older* committed payload having skipped the fetch, which is worse
  // than not caching at all. Decide about the network second.
  if (best?.origin === "cache") {
    writeSnapshotFile(OUT, best.payload);
    console.log(`conflicts: restored the build cache (through ${best.payload.commonThrough}).`);
  }

  const decision = decideRefresh({
    snapshot: best?.payload ?? null,
    now: Date.now(),
    maxAgeHours: maxAge.hours,
    force,
    skipRequested: Boolean(process.env.SKIP_CONFLICTS_BUILD),
  });

  if (decision.action === "skip") {
    if (!best) {
      console.error(
        "conflicts: SKIP_CONFLICTS_BUILD is set but no usable snapshot was found.\n" +
          "  There is nothing to serve. Unset it and let the build fetch, or commit a snapshot.",
      );
      process.exit(1);
    }
    if (decision.reason === "skip-flag") {
      if (force) console.warn("conflicts: --force ignored, SKIP_CONFLICTS_BUILD outranks it.");
      console.warn(
        `conflicts: SKIP_CONFLICTS_BUILD set — keeping the snapshot through ` +
          `${best.payload.commonThrough}. The conflict layer will be as old as this file.`,
      );
      return;
    }
    console.log(
      `conflicts: last checked ACLED ${decision.ageHours.toFixed(1)}h ago, under the ` +
        `${decision.maxAgeHours}h gate — not contacting it (through ${best.payload.commonThrough}).`,
    );
    return;
  }

  // Ask what week ACLED is advertising before pulling six workbooks for a week we already have.
  // Any failure here is a real failure: it means the landing pages or the credentials are broken,
  // and proceeding would only fail later and slower.
  const cutoff = await upstreamCutoff();

  if (best && !shouldDownloadWorkbooks({ snapshot: best.payload, upstreamCutoff: cutoff, force })) {
    // Upstream is still on our week. That answer is worth keeping: stamping it renews the gate, so
    // the next build inside the window skips the seven requests we just spent learning it.
    const confirmed = { ...best.payload, verifiedAt: new Date().toISOString() };
    writeSnapshotFile(OUT, confirmed);
    if (cacheFile) tryWriteSnapshotFile(cacheFile, confirmed);
    console.log(
      `conflicts: upstream is still on ${cutoff} — confirmed, skipping six workbook downloads.`,
    );
    return;
  }

  if (best) {
    console.log(
      `conflicts: have ${best.payload.commonThrough}, upstream ${cutoff}` +
        `${force ? " (forced)" : ""} — rebuilding.`,
    );
  }

  const payload = await buildConflictsSnapshot();
  // buildSnapshot can only produce a complete payload from six parsed regions, but this is the
  // last point before the file is committed and read as truth, so it is checked rather than
  // assumed. A partial snapshot on disk is worse than a failed build.
  if (!isCompleteSnapshot(payload)) {
    throw new Error("ACLED build produced an incomplete snapshot; refusing to write it");
  }
  // No verifiedAt here on purpose: generatedAt already is the moment of contact, and leaving the
  // field unset keeps exactly one writer of it.
  writeSnapshotFile(OUT, payload);
  const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
  console.log(`conflicts: wrote data/conflicts.json (${kb} KB, through ${payload.commonThrough})`);
  if (cacheFile) tryWriteSnapshotFile(cacheFile, payload);
}

main().catch((error: unknown) => {
  console.error(`conflicts: build failed — ${explain(error)}`);
  console.error(
    "  The deploy is stopped on purpose: shipping the previous snapshot would present stale\n" +
      "  fatalities as current. For a hotfix during an ACLED outage, set SKIP_CONFLICTS_BUILD=1.",
  );
  process.exit(1);
});
