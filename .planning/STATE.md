---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Persona Realism
status: executing
last_updated: "2026-08-27T18:26:23.284Z"
last_activity: 2026-08-27
progress:
  total_phases: 6
  completed_phases: 5
  total_plans: 18
  completed_plans: 17
  percent: 83
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-28)

**Core value:** Make the reality of global mortality feel immediate while staying statistically honest about timing, placement, and representative identity.
**Current focus:** Phase 04 — persona-realism-ladder

## Current Position

Phase: 04 (persona-realism-ladder) — EXECUTING
Plan: 4 of 8
Status: Ready to execute
global all-ages export is rejected in favour of the age-gated fallback table, and the quota-bound
GBD export spec (`gbd-export-spec.md`) has been rewritten around the one query GBD is still needed
for. 04-02 and 04-03 were re-sourced on 2026-08-22: the national cause cube now comes from WHO's
Global Health Estimates (keyless, CC BY 4.0, 183 countries, 175 leaf causes), because the WHO
Mortality Database has zero rows for Nigeria, Ethiopia, DR Congo and India and the 16-chunk GBD
export is infeasible at 100k rows per download. GBD is now one ~30,000-row subnational pull, which
reversed the 04-04/04-05 dependency. Phase 05 was added 2026-08-21 from the story batch and is deliberately disjoint from
Phase 04 — no shared files, so the two phases can run concurrently. Phase 05's 05-03 is `autonomous: false` (it needs a colour decision); 05-01 and
05-02 are autonomous.
Last activity: 2026-08-27

Progress: [█████████░] 94%

v1.0 MVP: phases 1-3, 5/5 plans, complete 2026-06-29. Progress above is v2.0-scoped, matching how
v1.0 was tracked. Backlog 999.1 is unsequenced and excluded from the count.

## Performance Metrics

**Velocity:**

- Total plans completed: 12
- Average duration: n/a
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
| ----- | ----- | ----- | -------- |
| -     | -     | -     | -        |

**Recent Trend:**

- Last 5 plans: 01-01, 01-02, 02-01, 02-02, 03-01
- Trend: complete

_Updated after each plan completion_
| Phase 04 P04 | 35min | 4 tasks | 9 files |
| Phase 04 P09 | 65min | 4 tasks | 9 files |
| Phase 04 P07 | 80min | 3 tasks | 19 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Initialization: Brownfield codebase map was created before project initialization.
- Initialization: Planning docs are local-only from this point forward (`commit_docs: false`).
- Initialization: Coarse, Vertical MVP roadmap with parallel execution and interactive gates.
- 2026-07-31: Opened milestone **v2.0 Persona Realism** rather than extending completed v1.0.
  Metadata applied by hand, not via `$gsd-new-milestone` — that workflow spawns a roadmapper to
  build a fresh roadmap and can archive phase directories, which would have destroyed the
  already-written Phase 4 plans.

- 2026-07-31: Phase 4 waves derived from pairwise `files_modified` overlap, not from priority
  order, so `$gsd-execute-phase`'s intra-wave safety check has something real to enforce.

- 2026-07-31: p09 routed to backlog 999.1 instead of a plan — full subnational coverage is
  unreachable, so a plan would have implied committed work.

- 2026-08-22: **National cause data comes from WHO Global Health Estimates, not IHME GBD.**
  Verified by direct call: WHO's `xmart-api-public.who.int/DEX_CMS/GHE_FULL` is keyless, CC BY 4.0,
  183 countries, 19 disjoint five-year bands, 175 leaf causes. The WHO Mortality Database that
  04-02 originally targeted has zero rows for Nigeria, Ethiopia, DR Congo and India; GBD's results
  tool gates every data endpoint behind a sign-in and caps a download at `max_rows_per_download:
  100000`, making the national cause cube tens of thousands of requests.

- 2026-08-22: **GBD kept only for subnational**, as one ~30,000-row export covering 519 admin-1
  units across 17 countries — WHO has no subnational data at any resolution. The roadmap's
  "unreachable at any effort level" verdict holds for observed national-statistics data, not for
  modelled estimates: GBD publishes admin-1 for India, Indonesia, Pakistan, Ethiopia and Nigeria.

- 2026-08-22: **04-04/04-05 dependency reversed.** Attaching a regional pyramid to a cell needs
  04-05's region key, so 04-05 moved to wave 2 and 04-04 to wave 4.

- 2026-08-22: **Derived data ships as files aligned to grid cell order, never as extra rate-grid
  columns.** `pipeline/climate_fallback.py` unpacks each cell as exactly four values, and the baked
  ACLED layer snaps onto cells by a `"lon,lat"` key that a grid rewrite can silently invalidate.

- 2026-08-25: **04-03 runs against GBD's HTTP API, not the Results Tool UI.** Probed directly:
  `php/metadata/`, `php/hierarchy/`, `php/app_settings.php` and `php/get_download_result.php` need no
  auth; only `POST php/download.php` returns 401 without a bearer token. `php/data.php` is also
  behind Cloudflare Turnstile, so the pre-download row counter is out of reach and the export spec's
  checker validates the delivered file instead. Manual surface: one sign-in, one token in `.env`.
  Stays `autonomous: false` — the IHME account is where the non-commercial agreement is accepted, and
  no client-credentials path exists, so routing around the sign-in would circumvent the terms.

- 2026-08-26: **The GBD export landed and 04-03 is done.** Superseding the note below: a 500 from
  `download.php` is not a reliable failure signal — at least one 500 had enqueued a task, which
  completed and was emailed. `Origin`/`Referer` headers are required, `version: 8352` is correct
  (not 8016), results are retrievable with no auth from `get_download_result.php`, and only task
  creation needs a token. A 723-location request 500s deterministically without enqueuing, so a
  re-run must chunk by location.

- 2026-08-26: **GBD subnational joins on hierarchy leaves, not depth >= 4.** Brazil, Italy and the
  UK publish macro-regions and the real units one level below; taking every depth-4 node
  double-counts. 508 leaves, 444 matched, 98.44% of subnational deaths.

- 2026-08-26: **Italy, Poland and the UK join to NUTS-2, not Natural Earth**, because that is the
  layer whose level matches what GBD publishes. Italy scores 0/21 against Natural Earth's 110
  provinces and 21/21 against NUTS-2. The UK and Poland's Mazowieckie roll *down* to NUTS-2
  children — sound only because the output is a distribution, so nothing is duplicated.

- 2026-08-26: **The national cross-check is a permanent part of the artifact.** Rolled-up
  subnational vs UN WPP agrees to 1-4% where civil registration exists (JPN, USA, GBR, POL, ITA,
  BRA) and parts by 15-23% where GBD models around its absence (PAK, NGA, ETH, IDN). Nigeria's
  subnational total is 0.67x the UN national one. The gradient is the finding, not a defect.

- 2026-08-25: **`download.php` could not be driven headlessly; use a permalink instead.**
  `Origin` and `Referer` headers turned the bare Flask 500 into real responses, and `version` is
  8016 rather than the advertised 8352 — but after ~20 requests the endpoint began 500ing on a body
  that had just been accepted, which reads as throttling. The route that works: `permalink.php` is
  unauthenticated and stores the query server-side, so a script builds and verifies the exact
  selection and a human presses Download once. The verified permalink (22 ages x 723 locations =
  31,812 rows) is recorded in `gbd-export-spec.md`.

- 2026-08-25: **Eurostat joins to the committed geometry (334 keys), not the CDR's 287.** NL31,
  NL33, PT16-PT18 and NO0B exist in `nuts2-20m.json` and not in `subnational-cdr.json`, so joining
  to the CDR would discard rows for regions the globe can already draw.

- 2026-08-25: **Standardised rates average across regions but add across disjoint causes.** Both
  rules apply to `hlth_cd_asdr2` and the first implementation applied only the first, which
  silently halved every label fed by two ICD groupings. Guarded by `pipeline/test_eurostat.py`.

- 2026-08-25: **The GBD age selection is 22 ids, not 21.** GBD 2023 has no `1-4 years` group; below
  five the disjoint set is `<1 year` + `12-23 months` + `2-4 years`. GBD's `type` field cannot select
  it — `<1 year` and `95+` are typed `aggregate` and are wanted, `80+`/`85+`/`20+`/`10-19` are typed
  `specific` and are not. The ids are frozen in `gbd-export-spec.md` with the nine-band fold table.

- [Phase 04-04]: WorldPop 2020 age/sex population (the locked plan source) is infeasible: ~118 GB across 36 age-sex bands with no HTTP range support, and the coarser GPWv4 BDC alternative's host is unreachable from this environment. — Derived tier instead shifts each national pyramid by the region's own subnational-cdr.json CDR gap, calibrated against 04-03's real regional weights -- zero new external data, fully reproducible offline, and the resulting weak fit (R2=0.034) is reported rather than hidden.
- [Phase 04-09]: WorldPop 2020 was half-wrong in 04-04 — a 1km per-country tree exists (5.1 MB per Nigerian band) distinct from the 118 GB global 100m mosaic 04-04 tested. Fetched 72 countries (51.75% of world expected deaths); tier 2 is now population x national-rate, resolved per cell, with the CDR-gap proxy kept as the fallback for uncovered countries.
- [Phase 04-09]: The plan's R2-against-417-regions pass condition is structurally unreachable via the 'cells not answered by tier 1' fetch-priority order the plan itself specifies, since the 17 GBD tier-1 countries have ~0% weight in that ordering. Canada's MAE improved (10.67 to 9.86pp) but missed the plan's <=8.67pp bar; Australia's improved decisively (1.72 to 0.55pp, a 68% reduction). Reported as a measured partial result, not reframed.
- [Phase ?]: 2026-08-27: [Phase 04-07] Age x month tensor re-pulls Eurostat's demo_r_mwk2_05 for 2015-2019 under a new SEASONAL_YEARS constant, separate from 04-06's YEAR=2022 annual/cause pull -- 2022 sits inside pipeline.curve.COVID_YEARS, which the month tensor's own acceptance criterion requires excluding.
- [Phase ?]: 2026-08-27: [Phase 04-07] Cause x month is measured for exactly two countries (Brazil, Mexico) at ICD-10 chapter granularity plus two leaf groups (drowning, exposure to forces of nature) -- cause LOO validation is reported as structurally unevaluable (0 folds) because the two donors share neither a Koppen class/family nor a border.
- [Phase ?]: 2026-08-27: [Phase 04-07] Age coverage went from all-or-nothing per country to per-band after measurement showed band [5,14] routinely falls under the volume floor while every other band in the same country clears it -- 24 countries reach full inclusion, more contribute individual bands.

### Pending Todos

Eight promoted to Phase 04 plans on 2026-07-31; the ninth (p09) became backlog 999.1. The todo files remain in
`.planning/todos/pending/` as the source narrative (each carries `promoted_to:`); the plans are
the executable artifact. Plan numbers preserve the captured priority rank; **waves come from the
pairwise `files_modified` overlap analysis, not from priority.**

Revised 2026-08-22 after the WHO re-source reversed the 04-04/04-05 dependency:

| Wave | Plans (parallel within a wave) | Why these can run together                            | Status |
| ---- | ------------------------------ | ----------------------------------------------------- | ------ |
| 1    | 04-01                          | alone — clears persona.ts; ~10 lines, minutes         | done   |
| 2    | 04-02, 04-05, 04-08            | build-causes vs rate-grid vs pipeline/\*.py, disjoint | done   |
| 3    | 04-03                          | alone — scripted GBD export, one pasted token         | done   |
| 4    | 04-04, 04-06                   | age-sex-cells/globe vs pipeline/eurostat, disjoint    | 04-06 done, 04-04 open |
| 5    | 04-07                          | needs persona.ts free after 04-04                     | open   |

Max parallelism is 3 (wave 2); five waves total. 04-08 sits in wave 2 rather than wave 1 deliberately: it has no
dependencies, but pairing it with the two substantial wave-2 plans is faster than pairing it with
the ~10-minute 04-01, since wave cost is the slowest member.

`app/globe/persona.ts` is the chokepoint — 04-01, 04-04 and 04-07 all modify it, so they cannot
share a wave. Splitting persona.ts into a sampling half and a label/prose half would unlock more
parallelism than any other refactor here.

**Start:** not here. Corrected 2026-08-21 — 04-01 is cheap (~10 lines) but it is a *precondition*
of the cause ladder, not a standalone win: honouring the `coverage` flag only pays off once there
is a better export to fall through to (04-02 WHO MDB, 04-03 GBD). Do 04-01 when the IHME ladder
is set up, in the same sitting, rather than as an easy first task. The earlier "start with wave 1"
advice over-weighted its line count.

Superseded 2026-08-25: 04-03 is no longer wall-clock-bound. It was rewritten around GBD's HTTP API
after probing the endpoints — `php/metadata/`, `php/hierarchy/` and `php/app_settings.php` need no
auth, `php/get_download_result.php` needs no auth, and only `POST php/download.php` wants a bearer
token. So it is a normal implementation plan with one manual step at the front: sign in once, paste
the token into `.env` as `GBD_TOKEN`, and the script does the query, the polling and the download.
It stays `autonomous: false` — the IHME account is where the non-commercial agreement is accepted,
and there is no client-credentials path — but "kick it off on day one" no longer applies, because
there is no queue to wait on. Tokens last about an hour, so a run must finish inside one.

The same pass found the export spec's age set was wrong: GBD 2023 has no `1-4 years` group, so the
disjoint selection is 22 ids (`<1 year` + `12-23 months` + `2-4 years` below five), not 21. GBD's
own `type` field cannot pick that set — `<1 year` and `95+` are typed `aggregate` and are wanted,
while `80+`, `85+`, `20+` and `10-19` are typed `specific` and are not. `gbd-export-spec.md` now
carries the frozen id list and the nine-band fold table.

Dropped during validation: "top up UN WPP from 172 to ~200 countries" — the 55 grid countries
lacking age/sex data account for **0.0000%** of global expected deaths (micro-territories only),
because `scripts/build-mortality.ts:119` targets exactly the countries the globe can render.

#### Story / UI batch — captured 2026-08-21 (s01–s12, not yet promoted)

Twelve items from a reading pass over the story (s10-s12 added later the same day). Unlike the p01–p09 batch these are front-end,
mostly in `app/roadmap/`, and none is promoted to a plan yet.

| Rank | #   | Item                                                     | Prio | Area  | Note                |
| ---- | --- | -------------------------------------------------------- | ---- | ----- | ------------------- |
| 1    | s04 | Remove the concept tiles under the deaths-by-age chart   | high | story | DONE - plan 05-01   |
| 2    | s11 | Pull-to-top fires on scroll inertia; raise its cost      | high | story | DONE - plan 05-02   |
| 3    | s01 | Predefined (not sky-derived) proxy strip colours         | high | story | DONE - plan 05-03   |
| 4    | s13 | ACLED xlsx from request path into the build              | high | data  | DONE                |
| 5    | s14 | Keep the built layer current and honest about its age    | high | data  | PART DONE - cadence |
| 6    | s10 | Last screen needs a background colour, not black        | mid  | story | CLOSED - kept black |
| 7    | s12 | Pull control off hardcoded white onto palette tokens    | mid  | story | DONE                |
| 8    | s03 | Proxy modal opens on reload; scroll jump on close        | high | story | needs discussion    |
| 9    | s02 | Unstick the proxy card when the fold completes           | high | story | needs discussion    |
| 10   | s05 | One-word scale toggle with animated curvature            | mid  | story |                     |
| 11   | s06 | Amplitude map: recentre, per-cell, month slider          | mid  | story | enabled by 04-05    |
| 12   | s07 | Schedule cause refresh; state vintage in the Who chapter | mid  | data  | one mechanism w/s14 |
| 13   | s09 | Weekly conflict stack: 5% + UN geoscheme rollup          | low  | data  | easier after s13    |
| 14   | s08 | Reachable chart tooltips on touch                        | low  | story | deepest design      |

`priority:` in the todo files carries this rank. It is **batch-scoped** - the p01-p09 batch keeps
its own frozen 1-9, because Phase 04's plan numbers preserve that captured rank. Filenames keep
their capture id (s01-s14) as the stable reference, so rank and filename do not match.

**Architectural rule set 2026-08-21: the server parses JSON or CSV only at runtime.** Recorded in
PROJECT.md constraints and Key Decisions. `exceljs` in `lib/acled-weekly.ts` is the only
violation - it parses workbooks on the request path, which is also the cause of a test that failed
7/20 runs and blocked three commits today, and a latent production failure (a one-shot HTTP stream
with no replay, on a reader that mis-parses a valid ZIP entry order).

**Resolved 2026-08-21: fetch and parse the workbooks at build time**, in the `prebuild` chain
alongside the four scripts already there. Not the REST API - probed with this project's
credentials, `data_query_restrictions.date_recency` is twelve **months**, and the layer needs a
rolling current twelve-**week** window, so `year=2026` returns nothing. Format was never the
barrier (the API serves csv/json/xml/txt); recency is, and it is a documented per-account
restriction. Not a hand-run notebook either, because the window would age silently.

Building it also fixes the flake properly: a build script can download each workbook and use
ExcelJS's buffered reader, measured 0/20 against 7/20 for the streaming one. `exceljs` stays a
dependency - it is needed at build time - but leaves the request path.

Settled: **fail the deploy** if ACLED is unreachable - no silent fallback, so a broken
integration is visible rather than the site serving month-old fatalities as current.
`data/conflicts.json` is still committed, as the artifact the request path reads and what makes
`pnpm dev` work without credentials, not as a fallback. `prebuild` only, never `predev`. This
couples deploys to a third party: an ACLED outage blocks unrelated hotfixes too, so the script
should retry transient failures, fail fast and loudly on 401/403, and probably offer a documented
escape hatch.

The cost, which is what s14 now covers: **freshness becomes deploy cadence**, and
`freshness.refreshedAt` must report the workbook's own `latestThrough` rather than the build
clock, or a rebuild with no new upstream data would claim to be current.

### Session 2026-08-21 — what shipped

Phase 05 (s04, s11, s01) implemented, plus the colour model rework and the ACLED migration.

- **s13 done.** `scripts/build-conflicts.ts` bakes the layer in `prebuild`; `/api/conflicts`,
  `lib/acled-cache.ts` and the whole runtime snapshot path are gone. Verified by a production
  build: the route no longer appears, and `app/` imports nothing from `lib/acled` but an erased
  type, so `exceljs` is off the request path. `upstreamCutoff()` skips six workbook downloads when
  the committed snapshot already covers the advertised week - 3s instead of minutes.

- **s14 half done.** Its sharpest point is closed: `freshness` was *removed* rather than
  repointed, because a baked artifact has no honest status to carry and nothing read the field.
  `commonThrough` is the honest one and `ConflictMap` already shows it. **Outstanding: the deploy
  cadence.** Freshness is now literally deploy frequency, and nothing schedules a redeploy.

- **s12 done**, and it was the precondition for s10: four literal whites in the pull control moved
  onto `--ink`, byte-identical today because `ink` resolves to `#ffffff` on a dark sky.

- **s10 closed as a no-op.** `#0c223f` shipped briefly and was reverted to `#000000` on request,
  so the closing sky is unchanged from where the day started. s12 survives it and is the useful
  half: the sky can now be changed to anything without stranding the pull control. Note for
  anyone revisiting - the last screen *is* painted (`.story` background-color from `--sky`, plus
  `StoryClient` mirroring it onto `document.body`), so there is no unpainted region and the
  original report can only have meant the hue.

Still open, in rank order: s03/s02 (the two `useProxyFold` items, both `discuss: true`, and they
are the same mechanic seen twice), s05, s06, s07, s09, s08. Phase 04 remains 0/8 - the entire
v2.0 persona-realism milestone is untouched.

Two standing annoyances: `lib/acled-weekly.test.ts` still fails roughly one run in three (fixture
entry order, not production - it blocked five commits today), and nothing is pushed.
