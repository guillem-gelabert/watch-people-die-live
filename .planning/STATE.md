---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Persona Realism
status: in_progress
stopped_at: Phase 04 planned (8 plans, 5 waves); no plan executed yet. Wave 1 is 04-01 alone.
last_updated: "2026-07-31T10:44:09.396Z"
last_activity: 2026-07-31 -- Phase 04 created from the nine captured persona-realism todos
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 8
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-28)

**Core value:** Make the reality of global mortality feel immediate while staying statistically honest about timing, placement, and representative identity.
**Current focus:** Phase 04 — persona realism. v1.0 MVP shipped; production URL verification remains a documented follow-up.

## Current Position

Phase: 04 (Persona Realism Ladder) — PLANNED, not started
Plan: 0 of 8 (wave 1 of 5 ready: 04-01)
Status: Plans written with enforced waves; awaiting execution
Last activity: 2026-07-31 -- Phase 04 created from the nine captured persona-realism todos

Progress: [__________] 0% (0/8 plans in milestone v2.0)

v1.0 MVP: phases 1-3, 5/5 plans, complete 2026-06-29. Progress above is v2.0-scoped, matching how
v1.0 was tracked. Backlog 999.1 is unsequenced and excluded from the count.

## Performance Metrics

**Velocity:**

- Total plans completed: 5
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

| #   | Item                                                       | Prio | Area  | Note              |
| --- | ---------------------------------------------------------- | ---- | ----- | ----------------- |
| s01 | Predefined (not sky-derived) proxy strip colours           | high | story |                   |
| s02 | Unstick the proxy card when the fold completes             | high | story | needs discussion  |
| s03 | Proxy modal opens on reload; scroll jump on close          | high | story | needs discussion  |
| s04 | Remove the concept tiles under the deaths-by-age chart     | high | story | smallest of the 9 |
| s05 | One-word scale toggle with animated curvature              | mid  | story |                   |
| s06 | Amplitude map: recentre, per-cell, month slider            | mid  | story | overlaps p05, p07 |
| s07 | Schedule cause refresh; state vintage in the Who chapter   | mid  | data  | blocked by 04-02/03 |
| s08 | Reachable chart tooltips on touch                          | low  | story | needs discussion  |
| s09 | Weekly conflict stack: 5% + UN geoscheme rollup            | low  | data  |                   |
| s10 | Last screen needs a background colour, not black            | mid  | story | prio inferred     |
| s11 | Pull-to-top fires on scroll inertia; raise its cost         | high | story | prio inferred     |
| s12 | Pull control off hardcoded white onto palette tokens        | mid  | story | split from s10    |

Three carry `discuss: true` in frontmatter (s02, s03, s08) — the desired end state is a design
call, not a mechanical fix. s02 and s03 are the same scroll mechanic (`useProxyFold`) seen from
two angles and should be discussed together.

**Deduplicated against Phase 04 on 2026-08-21.** No Phase 04 plan touches `app/roadmap/*`,
`docs/ROADMAP*.md` or `lib/i18n/*` (verified across all eight `files_modified` sets), so s01–s06,
s08 and s09 have no file overlap with the phase. Two corrections were applied:

- **s07 was substantially already-committed work** and has been rewritten and narrowed. 04-02
  already ingests the WHO Mortality Database and records per-country source + year; 04-03 already
  folds in the GBD export and records the WHO/GBD split, and has already decided that export is
  human-in-the-loop (`autonomous: false`). What survives in s07 is only the two things the phase
  demonstrably does not do — scheduling anything at all (a grep of the phase for
  cron/schedule/refresh/freshness returns nothing), and telling the reader the vintage in the
  story's **Who** chapter. It now carries `blocked_by: phase-04 plans 04-02, 04-03`.
- **s06 mis-stated its Phase 04 relationship.** It is enabled by 04-05 (region key on every cell)
  but *not* served by 04-07, whose seasonal-composition tensor reweights who dies rather than
  giving monthly mortality level per cell. Corrected in the todo.

**Agreed working set (2026-08-21):** s04, s11, s01, s10 — confirmed by the user, in that
priority order. Notes on it:

- **04-01 is explicitly NOT in this set.** It is cheap but it is a precondition of the cause
  ladder; do it with 04-02/04-03, not as an easy first task. See the corrected `**Start:**` note
  above.
- **s04 and s11 are the only two that are finishable in one sitting.** s01's diff is trivial but
  gated on choosing five hues that clear contrast against every sky in the seasonality chapter;
  s10 is one value in three files but gated on a design choice.
- **s10 was split**: it now covers only the colour decision. The pull control's hardcoded white,
  which is what blocks a light colour, became **s12**. Do s12 first if the chosen sky is light;
  skip it if the sky stays dark.
- The `priority:` fields in the todo files still carry their capture-order numbers and have NOT
  been renumbered to match this set.

One open question surfaced by the dedup: `docs/ROADMAP.md:265` asserts the GBD table "is exported
once by hand" — 04-02 makes that sentence false for ~120 countries the moment it ships. Either
04-02 gains a story-edit task, or the story ships a known falsehood until s07 lands.

### Blockers/Concerns

- Production Railway smoke checks require a linked Railway project or deployed URL; `PORTFOLIO-HANDOFF.md` records the follow-up.
- ~~No general automated test runner~~ - resolved: Vitest (`pnpm test`) plus the Husky pre-commit chain. `scripts/verify-globe-alignment.ts` remains the coordinate-sensitive check.
- **RESOLVED 2026-08-21 — `.planning` across parallel agents.** `commit_docs` is now `true` and
  `.planning/` is out of `.gitignore`, so GSD's cross-worktree planning sync works and Phase 04's
  five-wave parallel structure is unblocked. The repo is **public**, so planning docs are public:
  before the first commit, the six pre-Next-migration codebase maps (CONCERNS, CONVENTIONS,
  INTEGRATIONS, STACK, STRUCTURE, TESTING — all dated 2026-06-28, all describing the dead
  Express/`public/app.js` architecture) were deleted, keeping only the accurate
  `ARCHITECTURE.md` (2026-07-03). Regenerate with `/gsd:map-codebase` if needed. PROJECT.md's
  false Express/no-test-runner constraints were corrected and its portfolio framing trimmed.
  **Anything written here from now on is public — no credentials, no third-party specifics.**

- **Superseded — original wording of the above.** Deferred 2026-07-31. `commit_docs: false`
  plus the `.gitignore` entry disables GSD's native cross-worktree planning sync, so multiple
  worktrees each get an independent (or absent) `.planning`. Blocks any parallel execution of
  Phase 4's waves across worktrees. Options and evidence in
  `.planning/notes/2026-07-31-planning-sharing-across-parallel-agents.md`.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category       | Item                                                                                                     | Status                               | Deferred At    |
| -------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------- |
| Realism layers | Sub-national rates, time-of-day, seasonal, climate/biome, weather, conflict, and epidemic/pandemic modes | Deferred to v2+                      | initialization |
| Engineering    | General automated test runner and broader frontend modularization                                        | Deferred until MVP risk justifies it | initialization |

## Quick Tasks Completed

| ID          | Task                                                                | Date       | Commits              |
| ----------- | ------------------------------------------------------------------- | ---------- | -------------------- |
| 260819-hk3  | Darken the LaTeX formula tiles (were rendering white on dark skies)  | 2026-08-19 | `cb7a2a48`, `13da08d9` |

## Session Continuity

Last session: 2026-07-31
Stopped at: Phase 4 planned and documented (8 plans, 5 waves, 04-CONTEXT.md written);
no plan executed. Next action is wave 1 = plan 04-01, plus kicking off 04-03's GBD export requests.
Resume file: None
