---
created: 2026-08-21T15:40:00.000Z
title: Move ACLED xlsx parsing from the request path into the build
priority: 4
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

It also fixes the flake properly rather than by deletion: a build script can download each
workbook to disk and use ExcelJS's **buffered** reader instead of the streaming one. That was
measured at 0/20 failures against 7/20 for the streaming path, because the buffered reader
parses the whole archive before resolving cells and so is immune to ZIP entry order. The
`workbookRels` monkey-patch in `parseRegionalWorkbook` can go with it.

### Why not the alternatives

- **Runtime JSON from the REST API** — impossible at current access. `data_query_restrictions.date_recency` is twelve months (probed 2026-08-21); `year=2026` returns nothing. See the finding above.
- **A hand-run notebook** — the twelve-week window would age silently between runs.

### Shape of the work

1. New `scripts/build-conflicts.ts`, added to `prebuild` (and `predev`, matching the other four).
2. Move the aggregation out of `lib/acled-weekly.ts` into something the script imports. `buildWeeklyStack`, the region and cell mapping and `countryM49` are already source-agnostic and move unchanged.
3. Swap the streaming reader for the buffered one; delete the `workbookRels` patch and the `Readable` input path.
4. Reduce `/api/conflicts` to serving `data/conflicts.json`. `lib/acled-cache.ts` largely goes — with no runtime fetch there is no TTL to honour — but `ConflictsPayload.freshness` is rendered by the story and has to keep meaning something (see s14).
5. Keep the aggregation tests; drop the workbook fixtures that carried the flake.

### Open decisions

- **ACLED unreachable at build time: fail the deploy, or fall back?** Failing is loud and correct in CI; falling back to the last committed `data/conflicts.json` keeps deploys unblocked but can ship stale numbers silently. Leaning fail-with-fallback-only-if-a-committed-file-exists.
- **Is `data/conflicts.json` committed?** If generated only at build, local `pnpm dev` needs ACLED credentials or the layer is empty. Committing it matches `data/rate-grid.json` and keeps dev working without secrets, at the cost of a churning binary-ish diff every rebuild.
- **`exceljs` stays a dependency** — it is needed at build time. It moves off the request path, which is what the rule asks, but `pnpm why exceljs` will still show it. Worth a note in the script header so nobody "cleans it up".
