# Roadmap: Watch People Die Live

## Features

The project is two features, each with its own goal and its own forward-looking roadmap (see "Future Roadmaps" below):

- **Globe** — the 3D map of death events. Goal: the most statistically accurate _temporal_ (when) and _spatial_ (where) generation of simulated deaths.
- **Personas** — the "last deaths" feed text. Goal: the most statistically accurate representative _persona_ (age, sex, cause) for a death, given the country the Globe's logic already picked.

## Overview

Phases 1-3 below are the v1 MVP milestone (complete) — a shared foundation that touched both features (real cause data and methodology for Personas; sharing, public roadmap, and publishing as Shared product surfaces) without yet splitting into independent tracks. Future work (v2) forks into the two feature roadmaps.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)
- 999.x phases: Unsequenced backlog parking lot (marked with BACKLOG), see `## Backlog`

Decimal phases appear between their surrounding integers in numeric order.

**Milestone v1.0 — MVP** (complete):

- [x] **Phase 1: Cause Fidelity and Methodology** - Build real cause data and make the methodology match the data pipeline.
- [x] **Phase 2: Shareable Public Surface** - Add social previews and a public roadmap page.
- [x] **Phase 3: Publish and Portfolio Handoff** - Verify the deployed MVP and connect it to the portfolio.

**Milestone v2.0 — Persona Realism** (current):

- [x] **Phase 4: Persona Realism Ladder** - Make persona age, sex and cause vary by region and season instead of one global table. (completed 2026-08-27)
- [x] **Phase 5: Story Reading Experience** - Fix the three story defects that are cheap and independent: a dead aside block, a gesture that fires itself, and proxy colours that drift with the sky.
- [ ] **Phase 6: v2.0 Audit Closure** - Close the two blockers and the verification backfill the v2.0 milestone audit found. (INSERTED 2026-08-28)

Backlog (unsequenced, see `## Backlog`): 999.1.

## Phase Details

### Phase 1: Cause Fidelity and Methodology

**Goal**: The deaths feed uses full IHME-derived cause distributions when available, and the public methodology accurately explains the current data fidelity.
**Feature:** Personas (cause data) + Shared (methodology)
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: [DATA-01, DATA-02, DATA-03, DATA-04, METH-01, METH-02, METH-03]
**UI hint**: yes
**Success Criteria** (what must be TRUE):

1. `data/causes.json` exists and can be loaded by the existing persona pipeline.
2. The cause build workflow is documented and repeatable from a GBD CSV source.
3. Missing or incomplete cause data still falls back without breaking the globe or feed.
4. `/methodology` accurately describes mortality, density, age/sex, cause, geolocation, and representative-identity caveats.
   **Plans**: 2 plans

Plans:

- [x] 01-01: Build and verify real cause data
- [x] 01-02: Update methodology and fallback explanation

### Phase 2: Shareable Public Surface

**Goal**: The app can be shared cleanly and includes a public roadmap explaining shipped and planned realism layers.
**Feature:** Shared
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: [SHARE-01, SHARE-02, SHARE-03, ROAD-01, ROAD-02, ROAD-03, ROAD-04]
**UI hint**: yes
**Success Criteria** (what must be TRUE):

1. The home page has accurate social preview metadata and a usable preview image.
2. Shared links describe the project without overstating real-time precision or individual identity.
3. `/roadmap` loads in the app and shows implemented realism layers separately from planned layers.
4. Roadmap content stays consistent with `requirements.md` and the methodology page.
   **Plans**: 2 plans

Plans:

- [x] 02-01: Add social preview metadata and image
- [x] 02-02: Build public roadmap page

### Phase 3: Publish and Portfolio Handoff

**Goal**: The deployed app is verified as an MVP and ready to serve as the portfolio visualizer piece.
**Feature:** Shared
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: [PUB-01, PUB-02, PUB-03]
**UI hint**: yes
**Success Criteria** (what must be TRUE):

1. The Railway deployment serves the globe, methodology page, roadmap page, and social metadata.
2. A final smoke check confirms the primary visualization and public pages work.
3. The project has a portfolio-ready link target or entry guidance.
4. Remaining advanced realism layers are explicitly deferred rather than blocking the MVP.
   **Plans**: 1 plan

Plans:

- [x] 03-01: Verify deployment and prepare portfolio handoff

### Phase 4: Persona Realism Ladder

**Goal**: Persona age, sex and cause vary by region and by season, instead of every death drawing from one global, age-flat cause table and one national age pyramid.
**Feature:** Personas
**Mode:** v2
**Depends on**: Phase 1 (cause data foundation)
**Requirements**: [PERS-01, PERS-02, PERS-03, REAL-01, REAL-03]
**UI hint**: no
**Success Criteria** (what must be TRUE):

1. An infant persona never draws an adult-only cause; the `coverage` flag written by the builder is read by the consumer.
2. Cause distributions are country-specific for all 183 countries WHO GHE covers, including those without vital registration.
3. Age/sex distributions resolve per grid cell rather than per country, validated against observed regional counts for at least four countries.
4. Persona composition shifts with the season the globe is already simulating.
5. Estimated inputs are labelled as estimates and excluded from validation statistics.
   **Plans**: 8 plans

Ordering is by wave, not by plan number. Plan numbers preserve the captured priority ranking p01-p08 (p09 became backlog 999.1), while waves come from the pairwise `files_modified` overlap analysis: no two plans in a wave touch a shared path, so a wave's members are safe to run concurrently.

`app/globe/persona.ts` is the chokepoint — 04-01, 04-04 and 04-07 all modify it, so they cannot share a wave. Max parallelism is 3, in wave 2.

**Re-sourced 2026-08-22.** 04-02 and 04-03 were rewritten after investigation: the national cause
cube now comes from WHO's Global Health Estimates (`xmart-api-public.who.int/DEX_CMS/GHE_FULL` —
keyless, CC BY 4.0, 183 countries, 19 disjoint five-year bands, 175 leaf causes), because the WHO
Mortality Database 04-02 originally targeted has **zero rows** for Nigeria, Ethiopia, DR Congo and
India, and the 16-chunk GBD cause export 04-03 originally described is infeasible at
`max_rows_per_download: 100000`. GBD is now used only for what WHO lacks entirely — subnational —
as a single ~31,800-row query covering 519 admin-1 units across 17 countries. That also reverses
the 04-04/04-05 dependency: 04-04 needs 04-05's region key to attach a regional pyramid to a cell,
so 04-05 moves to wave 2 and 04-04 to wave 4.

**04-03 rewritten around the API, 2026-08-25.** GBD's endpoints are ordinary HTTP and its dimension
metadata (`php/metadata/`, `php/hierarchy/`, `php/app_settings.php`) is served with no auth at all.
Only `php/download.php` needs a bearer token, and the result poll does not. So 04-03 is a script with
one manual step — sign in once, paste the token — rather than a UI session. It stays
`autonomous: false` because the IHME account is where the non-commercial agreement is accepted, but
it is no longer wall-clock-bound by portal quota. The same pass corrected the age set: GBD 2023 has
no `1-4 years` group, so the disjoint selection is 22 ids, not the 21 the spec had.

Plans:

- [x] 04-01: Honour the cause coverage flag in pickCause _(wave 1)_
- [x] 04-02: Source country age/sex causes from WHO Global Health Estimates _(wave 2)_
- [x] 04-05: Bake an admin-1 / NUTS-2 region key into the rate grid _(wave 2)_
- [x] 04-08: Unfilter age/sex in pipelines that already download it _(wave 2)_
- [x] 04-03: Pull GBD subnational age/sex death weights _(wave 3)_
- [x] 04-04: Resolve age/sex per cell from regional estimates and gridded population _(wave 4)_
- [x] 04-06: Add Eurostat regional age/sex and cause tables _(wave 4)_
- [x] 04-07: Make persona composition seasonal _(wave 5)_
- [x] 04-09: Rebuild tier 2 on WorldPop 1km population, replacing the CDR-gap proxy _(wave 6)_

Deliberately **not** a plan: opportunistic subnational sourcing beyond Eurostat moved to backlog
999.1. Its own scoping said "not a planned sweep", and full subnational coverage is unreachable at
any effort level (China, India, Indonesia, Pakistan, Ethiopia, Nigeria, DRC have weak or no public
access per `seasonality-data-guide.md`). Keeping it as a plan implied committed work.

That "unreachable" verdict stands for **observed** data from national statistics offices, which is
what `seasonality-data-guide.md` catalogues. It does not hold for **modelled** estimates: GBD 2023
publishes admin-1 age/sex estimates for India, Indonesia, Pakistan, Ethiopia and Nigeria (five of
the seven named), plus Kenya and the Philippines. 04-03 now takes those, labelled as estimates.
China and DR Congo remain absent.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 (v1.0, complete) -> 4 (v2.0, current)

### Phase 5: Story Reading Experience

**Goal**: Three independent story defects are fixed — the concept tiles beneath the deaths-by-age chart are gone, the pull-to-globe gesture can no longer be fired by scroll momentum, and each seasonality proxy keeps one identity colour regardless of the section sky.
**Feature:** Shared (the `/roadmap` story)
**Mode:** v2
**Depends on**: Nothing. Deliberately disjoint from Phase 4 — no plan here touches `scripts/`, `data/`, `pipeline/` or `app/globe/`, and no Phase 4 plan touches `app/roadmap/`, `docs/ROADMAP*.md` or `lib/i18n/`. The two phases can run concurrently.
**Requirements**: [STORY-01, STORY-02, STORY-03]
**UI hint**: yes
**Success Criteria** (what must be TRUE):

1. The `who` section ends on the deaths-by-age chart; no `[what the clock got wrong]` slot remains in any of the three story markdown files, and `storyTranslations.test.ts` still passes.
2. Coasting into the bottom of the page with a hard trackpad flick never returns the reader to the top, and a deliberate sustained pull still does.
3. The five proxy strip colours are fixed values that do not change when the story's sky changes, and each still clears its contrast floor against every sky the seasonality chapter passes through.

**Plans**: 3, all in wave 1 — `files_modified` are pairwise disjoint, so they run in parallel.

| Plan  | Todo | Title                                        | Autonomous |
| ----- | ---- | -------------------------------------------- | ---------- |
| 05-01 | s04  | Remove the concept tiles from the who section | yes — done |
| 05-02 | s11  | Reject scroll inertia in the pull-to-globe gesture | yes — done |
| 05-03 | s01  | Freeze the proxy identity colours             | no — done, colour choice made |

### Phase 6: v2.0 Audit Closure (INSERTED)

**Goal**: The v2.0 milestone closes on measurement rather than on assertion — the UK's GBD-measured
pyramids actually reach the reader, every artifact the milestone produced has a consumer, and each
requirement has a verification record that names a number.
**Feature:** Shared (data pipeline + planning records)
**Mode:** v2
**Depends on**: Phases 4 and 5 (this closes their audit gaps)
**Requirements**: [PERS-01, PERS-02, PERS-03, REAL-01, REAL-03, STORY-01, STORY-02, STORY-03]
**UI hint**: no
**Success Criteria** (what must be TRUE):

1. All 41 UK tier-1 region keys join, all 226 assigned UK cells resolve tier 0, and the UK's cells
   carry more than one archetype id in the shipped file — the fix survives quantisation.
2. A whole country's tier-1 key set failing to join throws the build, and a committed-data test fails
   if the key spaces diverge again.
3. `data/eurostat-regional.json` has a real reader and changes a reported validation number for
   European regions.
4. No SUMMARY contains a claim the shipped tree contradicts.
5. Both v2.0 phases have a VERIFICATION.md, all 12 SUMMARYs carry `requirements-completed`, and no
   count in ROADMAP.md, STATE.md or REQUIREMENTS.md contradicts the phase directories.

**Plans**: 1. Inserted 2026-08-28 from `.planning/v2.0-MILESTONE-AUDIT.md` (`status: gaps_found`),
which recommended a single corrective plan over a new multi-plan phase because both blockers are
small and well-localised.

- [ ] 06-01: Close the v2.0 audit gaps — UK tier-1 join, the dead Eurostat artifact, and the
      verification backfill _(wave 1, `autonomous: false` — one checkpoint on the archetype budget)_

Deliberately **not** in scope: INT-03 through INT-07, all `warning` severity, which stay recorded as
accepted debt. The one exception is INT-04 (archetype quantisation), which becomes a decision only if
it swallows the UK fix.

Within Phase 4, waves execute in order 1 -> 5; plans inside a wave run in parallel.

| Milestone | Phase                             | Plans Complete | Status      | Completed  |
| --------- | --------------------------------- | -------------- | ----------- | ---------- |
| v1.0      | 1. Cause Fidelity and Methodology | 2/2            | Complete    | 2026-06-29 |
| v1.0      | 2. Shareable Public Surface       | 2/2            | Complete    | 2026-06-29 |
| v1.0      | 3. Publish and Portfolio Handoff  | 1/1            | Complete    | 2026-06-29 |
| **v2.0**  | 4. Persona Realism Ladder         | 4/8            | In progress | -          |
| **v2.0**  | 5. Story Reading Experience       | 3/3            | Complete    | 2026-08-23 |

v1.0 (MVP): 5/5 plans, complete 2026-06-29. v2.0: 7/11 plans (Phase 4 persona realism 4/8, Phase 5 story 3/3 complete).

## Future Roadmaps

With the v1 shared foundation complete, future work forks into two independent roadmaps. Each can progress at its own pace and does not block the other.

### Globe Roadmap — Temporal & Spatial Accuracy

**Goal**: The most statistically accurate generation of _when_ and _where_ a simulated death occurs.

Backlog (see `REQUIREMENTS.md` v2 `REAL-01..07`, not yet phased):

- Sub-national mortality-rate placement (`REAL-01`)
- Time-of-day modulation for circadian-sensitive causes (`REAL-02`)
- Seasonal mortality modulation (`REAL-03`)
- Climate/biome-weighted rates (`REAL-04`)
- Real-time weather modulation (`REAL-05`)
- Conflict/excess-mortality overlays (`REAL-06`)
- Epidemic/pandemic event modes (`REAL-07`)

### Personas Roadmap — Representative Identity Accuracy

**Goal**: The most statistically accurate persona (age, sex, cause) for a death, given the country the Globe already picked.

Now phased as **Phase 4: Persona Realism Ladder** (`PERS-01`, `PERS-02`, `PERS-03`). The original backlog entry was narrower than the work turned out to be:

- `PERS-01` assumed the only gap was an empty `countries` object. Investigation on 2026-07-31 found the committed export is also **age-flat** — `coverage.age: "all_ages_repeated_across_bands"` — so only 12 of 140 shipped cause labels are reachable, and infant personas draw adult causes. Malaria, HIV/AIDS, tuberculosis and suicide are unreachable for every country.
- `PERS-02` and `PERS-03` were added for the regional age/sex and seasonal-composition gaps, which `PERS-01` did not cover.

Phase 4 overlaps the Globe roadmap at `REAL-01` (sub-national data) and `REAL-03` (seasonal modulation), since the same region keys and seasonal curves serve both features.

## Backlog

Unsequenced ideas that are not ready for active planning. Promote with `/gsd:review-backlog`.

### Phase 999.1: Subnational cause and age sourcing beyond Eurostat (BACKLOG)

**Goal:** Cover selected admin-1 regions outside Eurostat's reach with observed cause and
age x sex data, taken opportunistically rather than as a sweep.
**Requirements:** PERS-01, PERS-02 (partial)
**Plans:** 0 plans

Plans:

- [ ] TBD (promote with /gsd:review-backlog when ready)

**Why it is backlog, not a phase:** full subnational coverage is unreachable at any effort level.
`seasonality-data-guide.md` documents China, India, Indonesia, Pakistan, Ethiopia, Nigeria, DRC,
Libya and Madagascar as having weak or no public subnational access, and those hold a large share
of global deaths. Each remaining country is a bespoke parser. Phase 4's plan 04-04 covers the same
ground by derivation (gridded population x national age-specific rates) for all 981 regions, which
is why leaving this unsequenced is acceptable rather than a gap.

**Take a country only when** it is already half-done by another plan (Brazil/Mexico via 04-08),
it is large enough that a single national pyramid reads as visibly false in the feed, or it is
needed as a 04-04 validation fixture.

A drafted task breakdown is preserved at
`.planning/phases/999.1-subnational-cause-and-age-sourcing-beyond-eurostat/DRAFT-PLAN.md`
and the source narrative at `.planning/todos/pending/2026-07-31-p09-*.md`.
