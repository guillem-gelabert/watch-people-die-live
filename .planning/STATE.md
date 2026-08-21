---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Persona Realism
status: in_progress
stopped_at: Phase 04 wave 1 done (04-01 + the GBD export spec). Wave 2 next: 04-02, 04-08, 04-04.
last_updated: "2026-08-21T20:30:00.000Z"
last_activity: 2026-08-21 -- 04-01 executed: pickCause honours coverage; GBD export spec written
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 8
  completed_plans: 1
  percent: 13
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-28)

**Core value:** Make the reality of global mortality feel immediate while staying statistically honest about timing, placement, and representative identity.
**Current focus:** Phase 04 — persona realism. v1.0 MVP shipped; production URL verification remains a documented follow-up.

## Current Position

Phase: 04 (Persona Realism Ladder) — IN PROGRESS, wave 1 done · Phase 05 (Story Reading Experience) — PLANNED, not started
Plan: 1 of 11 (Phase 04: 1/8, wave 2 next = 04-02 + 04-08 + 04-04; Phase 05: 0/3, all wave 1)
Status: Phase 04 wave 1 landed — `pickCause` now honours the `coverage` flag, so the committed
global all-ages export is rejected in favour of the age-gated fallback table, and the quota-bound
GBD export spec (`gbd-export-spec.md`) is ready for the portal requests to run in parallel with
waves 2-5. Phase 05 was added 2026-08-21 from the story batch and is deliberately disjoint from
Phase 04 — no shared files, so the two phases can run concurrently. Phase 05's 05-03 is `autonomous: false` (it needs a colour decision); 05-01 and
05-02 are autonomous.
Last activity: 2026-08-21 -- 04-01 executed: pickCause honours coverage; GBD export spec written

Progress: [#_________] 9% (1/11 plans in milestone v2.0)

v1.0 MVP: phases 1-3, 5/5 plans, complete 2026-06-29. Progress above is v2.0-scoped, matching how
v1.0 was tracked. Backlog 999.1 is unsequenced and excluded from the count.

## Performance Metrics

**Velocity:**

- Total plans completed: 6
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

### Pending Todos

Eight promoted to Phase 04 plans on 2026-07-31; the ninth (p09) became backlog 999.1. The todo files remain in
`.planning/todos/pending/` as the source narrative (each carries `promoted_to:`); the plans are
the executable artifact. Plan numbers preserve the captured priority rank; **waves come from the
pairwise `files_modified` overlap analysis, not from priority.**

| Wave | Plans (parallel within a wave) | Why these can run together                            |
| ---- | ------------------------------ | ----------------------------------------------------- |
| 1    | 04-01                          | alone — clears persona.ts; ~10 lines, minutes         |
| 2    | 04-02, 04-04, 04-08            | build-causes vs rate-grid vs pipeline/\*.py, disjoint |
| 3    | 04-03, 04-05                   | build-causes/causes.json vs rate-grid                 |
| 4    | 04-06                          | needs 04-02 + 04-05 + 04-08                           |
| 5    | 04-07                          | needs persona.ts free after 04-04                     |

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

When the ladder does start, kick off 04-03's GBD export requests on day one — it is wall-clock-bound
by the portal quota, not effort-bound, and does not fit a wave.

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
