---
created: 2026-08-21T15:40:00.000Z
title: Move ACLED off server-side xlsx onto a committed JSON artifact
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

TBD in detail, but the target is settled: **the server reads a committed JSON artifact and
nothing else.**

**Use the REST API, not the workbooks.** ACLED publishes an authenticated REST API that
returns JSON or CSV — `_format=json` / `_format=csv`, base `https://acleddata.com/api/`,
with `https://acleddata.com/api/acled/` for political-violence events. Checked
2026-08-21 against their getting-started docs.

The catch, and it is the main design question: that API serves **raw event-level** rows,
not the pre-aggregated week × admin-1 tables the current workbooks provide. So the offline
job has to do the aggregation. Most of that logic already exists and is source-agnostic —
`buildWeeklyStack`, the region and cell mapping, `countryM49` — it just currently consumes
workbook rows. Raw events mean more rows over the wire (twelve weeks, global) but as JSON
that is unremarkable, and it is strictly more information: per-event detail would also
unblock **s09**, which wants weekly fatalities regrouped by UN geoscheme.

Shape of the work:

1. Confirm the API can serve the twelve-week window with the fields the model needs —
   week/date, country, admin1, fatalities, centroid latitude/longitude. Credentials are
   already configured (`ACLED_USERNAME`, `ACLED_PASSWORD`); there is an
   `acled-api-access-request.txt` in `.gitignore` that may already record the answer.
2. Write the offline job. A script under `scripts/` fits the existing convention better
   than a notebook, since the six existing `build-*.ts` scripts are the precedent and this
   needs no exploration. It authenticates, pulls JSON, aggregates, writes
   `data/conflicts.json`.
3. Move the aggregation out of `lib/acled-weekly.ts` into something the script imports, and
   delete the workbook path: `parseRegionalWorkbook`, `discoverWorkbook`,
   `validateWorkbookHeaders`, `headerIndexes`, and the `exceljs` dependency.
4. Reduce `/api/conflicts` to serving the committed JSON. Decide what happens to
   `lib/acled-cache.ts` — with no runtime fetch there is nothing to cache and no TTL to
   honour, so most of it goes, but the `freshness` field the UI reads has to keep working
   (see s14).
5. `lib/acled-weekly.test.ts` loses its workbook fixtures and the flake with them. Keep the
   tests for the aggregation logic, which is the part worth testing.

**The cost, stated plainly:** ACLED is the only genuinely live layer in the project. Baking
it makes the conflict layer only as fresh as the last run of the job, and nothing schedules
anything here yet. That is **s14**, and this todo is half a solution without it.
