---
created: 2026-08-21T15:40:00.000Z
title: Move ACLED xlsx parsing from the request path into the build
priority: 4
resolved: done 2026-08-21
area: data
files:
  - lib/acled-weekly.ts
  - lib/acled.ts
  - lib/acled-cache.ts
  - lib/acled-weekly.test.ts
  - app/api/conflicts/route.ts
  - package.json
---

## Problem

**Architectural rule, set 2026-08-21: the server parses JSON or CSV only.** Any upstream
source that publishes Excel or another binary format is converted offline — a one-off
script or a notebook — and its output committed, the way `data/rate-grid.json` already
works.

`exceljs` is the **only** thing in the project that violates this. Surveyed: every other
runtime read is JSON (World Bank via `lib/worldbank.ts`, geolocation via `lib/geo.ts`,
topojson, `data/rate-grid.json`). `exceljs` appears in exactly two files,
`lib/acled-weekly.ts` and its test.

The current ACLED flow does all of this on the server, per request-with-TTL:

1. OAuth password grant for a bearer token (`lib/acled.ts:101`).
2. Fetch six regional landing pages and **scrape them for dated `.xlsx` links**
   (`discoverWorkbook`, `lib/acled.ts:128`).
3. Stream each workbook over HTTP and parse it with ExcelJS
   (`parseRegionalWorkbook`, `lib/acled-weekly.ts:276`).
4. Aggregate into weeks, regions and cells; snapshot to disk with a 24h TTL
   (`lib/acled-cache.ts:5`); `/api/conflicts` serves it and refreshes in `after()`.

Steps 1–3 should not be on the server at all. Two further reasons beyond the rule:

- **It is unreliable.** ExcelJS's streaming reader parses a worksheet before the
  shared-string table when the ZIP entry order puts the sheet first, and every string cell
  then arrives as an unresolved object. Measured 7/20 failures in
  `lib/acled-weekly.test.ts`; 0/20 with a buffered reader. The `workbookRels` workaround
  already in `parseRegionalWorkbook` is a partial fix for the same class of bug. Production
  streams a one-shot `Readable` from HTTP (`lib/acled.ts:184`) with no replay, so if a real
  ACLED workbook ever ships in that entry order the conflict layer fails outright.
- **It scrapes HTML for links.** `discoverWorkbook` regexes `.xlsx` hrefs out of a landing
  page. That breaks whenever ACLED restyles a page.

## Solution

**Decided 2026-08-21: fetch and parse the workbooks at build time.** Not offline in a
notebook, not at runtime. A script in the `prebuild` chain downloads the six regional
workbooks, parses them, aggregates, and writes `data/conflicts.json`; the request path reads
only that JSON.

This is the project's existing pattern rather than a new one — `prebuild` already runs
`build-seasonality-fallbacks`, `build-seasonality-validation`, `build-closeup-outlines` and
`sync-data`, and derived JSON already lives in `data/` and is copied to `public/data/`.

**Correction, 2026-08-21: do not switch to the buffered reader.** An earlier note here claimed
the build should use ExcelJS's buffered reader because it measured 0/20 failures against 7/20
for the streaming one. That measurement was taken against a tiny generated fixture and the
conclusion was wrong twice over:

- `buildConflictsSnapshot` processes the six workbooks one at a time precisely because
  **Africa's sheet alone expands past 100 MB**. The buffered reader materialises the entire
  workbook model in memory, so it would trade a test-only problem for a real one.
- **Real ACLED workbooks are not affected by the race at all.** Read the ZIP local headers of a
  live workbook and the stored order is the safe one:

  ```
  xl/sharedStrings.xml       <- before
  xl/workbook.xml            <- before
  xl/worksheets/sheet1.xml   <- last
  ```

  Both dependencies precede the worksheet, so ExcelJS resolves every cell on its immediate
  path. Workbooks written *by ExcelJS* put the worksheet first, which is the pathological order
  — so the flake lives entirely in `lib/acled-weekly.test.ts`'s generated fixtures, and the
  streaming reader is correct for the real thing.

So the build keeps the streaming reader, and **the flaky test is a separate, test-only problem**:
fix the fixture's entry order (needs a zip writer — `jszip` is transitive-only under pnpm), or
stop generating fixtures with ExcelJS. Filed as its own concern rather than folded in here.

The `workbookRels` monkey-patch stays too. For real workbooks it is a no-op — `workbook.xml`
arrives before the worksheet anyway, so the getter returns the real value when it matters. It
only changes behaviour for the pathological order, i.e. for the fixtures.

(What still is not explained: why the deferred path ExcelJS takes for those fixtures fails
intermittently rather than never, given it re-parses the sheet after both dependencies are
loaded. Not chased further, because it cannot affect production.)

### Why not the alternatives

- **Runtime JSON from the REST API** — impossible at current access. `data_query_restrictions.date_recency` is twelve months (probed 2026-08-21); `year=2026` returns nothing. See the finding above.
- **A hand-run notebook** — the twelve-week window would age silently between runs.

### Shape of the work

1. New `scripts/build-conflicts.ts`, added to `prebuild` (and `predev`, matching the other four).
2. Move the aggregation out of `lib/acled-weekly.ts` into something the script imports. `buildWeeklyStack`, the region and cell mapping and `countryM49` are already source-agnostic and move unchanged.
3. Swap the streaming reader for the buffered one; delete the `workbookRels` patch and the `Readable` input path.
4. Reduce `/api/conflicts` to serving `data/conflicts.json`. `lib/acled-cache.ts` largely goes — with no runtime fetch there is no TTL to honour — but `ConflictsPayload.freshness` is rendered by the story and has to keep meaning something (see s14).
5. Keep the aggregation tests; drop the workbook fixtures that carried the flake.

### Decisions (settled 2026-08-21)

- **ACLED unreachable at build time: fail the deploy.** No silent fallback. A deploy that
  cannot reach ACLED does not ship, so a broken integration is visible immediately instead of
  the site quietly serving month-old fatalities as current.
- **`data/conflicts.json` is committed** — but as the artifact the request path reads and as
  what makes `pnpm dev` work without credentials, **not** as a build fallback. The build
  always regenerates it and fails if it cannot.
- **`prebuild` only, not `predev`.** In `predev` every `pnpm dev` would pull six workbooks
  from ACLED — slow, and it spends API quota for nothing, since the committed JSON is already
  there. The other four scripts are in both because they are offline and cheap.
- **`exceljs` stays a dependency** — the build needs it. It leaves the request path, which is
  what the rule asks, but `pnpm why exceljs` will still show it. Note that in the script
  header so nobody "cleans it up".

### Consequences of failing the deploy

Worth writing down, because this couples the deploy pipeline to a third party:

- **An ACLED outage blocks every deploy**, including hotfixes with nothing to do with
  conflicts. Railway builds on push, so a push during an outage does not ship.
- **Credentials are a password grant** (`lib/acled.ts:101`, OAuth `grant_type=password`). If
  the password rotates or the account lapses, deploys stop until someone notices — which is
  the intended behaviour, but it should fail with a message that names the cause rather than
  a generic parse error.
- **Retry transient failures before giving up.** `lib/acled.ts:74` already has
  `retry(operation, attempts = 3)`; the script should use it, and should distinguish a
  transient network failure (retry, then fail) from a 401/403 (fail immediately — retrying an
  auth failure is pointless and looks like a brute-force attempt).
- **Consider an explicit escape hatch**, e.g. `SKIP_CONFLICTS_BUILD=1`, so a genuine hotfix
  can ship during an upstream outage. It keeps fail-by-default while leaving a documented way
  out that is deliberate rather than silent. Open question — not assumed.
