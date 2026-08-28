# Requirements: Watch People Die Live

**Defined:** 2026-06-28
**Core Value:** Make the reality of global mortality feel immediate while staying statistically honest about timing, placement, and representative identity.

## Features

Two features, each with its own goal and roadmap:

- **Globe** — the 3D map of death events. Goal: the most statistically accurate _temporal_ (when) and _spatial_ (where) generation of simulated deaths.
- **Personas** — the "last deaths" feed text. Goal: the most statistically accurate representative _persona_ (age, sex, cause) for a death, given the country the Globe's logic already picked.
- **Shared** — product-level surfaces (methodology, sharing, publishing) that support both features without belonging to either.

Every requirement below is tagged with the feature it belongs to. The v1 milestone (complete) delivered a shared foundation touching both; v2 splits cleanly into the two feature roadmaps.

## v1 Requirements

Requirements for the MVP completion milestone. Each maps to roadmap phases.

### Cause Data

**Feature:** Personas

- [x] **DATA-01**: The project has a committed `data/causes.json` generated from an IHME GBD deaths-by-cause CSV export.
- [x] **DATA-02**: The cause builder can be run from documented source input using `npm run build:causes -- --force` or `--src=...`.
- [x] **DATA-03**: Generated cause distributions preserve sex and age-band stratification compatible with `public/persona.js`.
- [x] **DATA-04**: The app still falls back gracefully when `data/causes.json` is unavailable or incomplete.

### Methodology

**Feature:** Shared

- [x] **METH-01**: The methodology page accurately describes whether causes come from committed IHME GBD country/sex/age data or fallback/sample data.
- [x] **METH-02**: The methodology page clearly states personas are statistical representatives, not real identifiable individuals.
- [x] **METH-03**: The methodology page lists the current mortality, population-density, age/sex, cause, and geolocation data sources.

### Sharing

**Feature:** Shared

- [x] **SHARE-01**: The home page includes `og:title`, `og:description`, and canonical social preview metadata.
- [x] **SHARE-02**: The home page includes an `og:image` suitable for link previews.
- [x] **SHARE-03**: Social preview metadata describes the project accurately without overstating real-time or individual-level precision.

### Roadmap Page

**Feature:** Shared

- [x] **ROAD-01**: Users can open `/roadmap` in the deployed app.
- [x] **ROAD-02**: The roadmap page shows which realism layers are already implemented.
- [x] **ROAD-03**: The roadmap page shows planned future realism layers, including sub-national rates, time-of-day, seasonal, climate/biome, weather, conflict, and epidemic/pandemic layers.
- [x] **ROAD-04**: The roadmap page is consistent with `requirements.md` and does not imply future layers are already shipped.

### Publishing

**Feature:** Shared

- [ ] **PUB-01**: The deployed Railway app runs with the MVP assets and pages available. Partial: local assets and pages are verified; production Railway URL smoke is pending because this checkout is not linked to a Railway project.
- [x] **PUB-02**: The project has a portfolio-ready entry point or link target for the visualizer piece.
- [x] **PUB-03**: A final smoke check verifies the globe loads, methodology page works, roadmap page works, and social metadata exists.

## v2 Requirements

Deferred to future releases. Grouped by feature roadmap; see `ROADMAP.md` for the two forward-looking tracks.

### Globe: Realism Layers

**Feature:** Globe — deepens temporal and spatial accuracy of _where_ and _when_ deaths are generated.

- **REAL-01**: Death placement or rates can use sub-national mortality data where available.
- **REAL-02**: Death timing can be modulated by time-of-day patterns for relevant causes.
- **REAL-03**: Death timing can be modulated by seasonal mortality patterns.
- **REAL-04**: Cause or rate weighting can account for climate or biome patterns.
- **REAL-05**: Real-time weather can modulate relevant causes during heat, cold, storms, or other conditions.
- **REAL-06**: Conflict or excess mortality overlays can elevate relevant causes in active conflict zones.
- **REAL-07**: Pandemic or epidemic event modes can adjust mortality rates for known periods or scenarios.

### Personas: Representative Identity Fidelity

**Feature:** Personas — deepens accuracy of _who_ is represented once the Globe has already placed a death in a country.

- **PERS-01**: Cause-of-death distributions are country-specific **and age-banded** rather than falling back to the global IHME table. `data/causes.json`'s `countries` object is empty, and the committed global export is additionally age-flat (`coverage.age: "all_ages_repeated_across_bands"`), so only 12 of its 140 cause labels are ever reachable and infant personas draw adult causes. Malaria, HIV/AIDS, tuberculosis, suicide and interpersonal violence are unreachable for every country.
- **PERS-02**: Age and sex distributions are region-specific rather than national. `data/mortality-age-sex.json` is country-level only, so a death in Chukotka draws the same pyramid as one in Moscow, even though regional age structure is the largest driver of the regional death-rate spread.
- **PERS-03**: Persona composition varies with the season the globe is already simulating. `makePersona()` takes no date, so a January and a July death in the same country draw identical age, sex and cause distributions despite the winter excess being overwhelmingly respiratory and circulatory deaths among the very old.

### Story: Reading Experience

**Feature:** Shared — the scrollytelling story at `/roadmap`, which is the project's argument rather than its data.

- **STORY-01**: Sections end on their argument. Expandable asides that restate caveats the surrounding prose has already made are removed rather than kept as a contents list.
- **STORY-02**: The return-to-globe gesture fires only on deliberate input. Scroll momentum arriving at the end of the page never triggers it, however hard the flick.
- **STORY-03**: Each seasonality proxy has a stable identity colour. Reordering the ranking does not repaint a strip, and neither does the story's sky changing underneath it.

### Engineering

**Feature:** Shared

- **ENG-01**: A general automated test runner covers API fallbacks and critical browser smoke behavior.
- **ENG-02**: Frontend modules are split if roadmap/social/publishing features make `public/app.js` harder to change safely.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature                                | Reason                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Real-time individual death records     | The project is statistical and representative, not surveillance or an identifiable record system. |
| Native mobile app                      | Web-first is sufficient for the MVP and portfolio use case.                                       |
| Authentication or accounts             | There is no user-specific workflow in this visualization.                                         |
| Persistent analytics or user tracking  | Not needed for MVP and would complicate the privacy posture.                                      |
| Advanced realism layers in v1          | The MVP focuses on finishing existing data fidelity, sharing, roadmap, and publishing.            |
| Broad architecture refactor before MVP | The current Express/static frontend structure is working and deployed.                            |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase   | Status                                              |
| ----------- | ------- | --------------------------------------------------- |
| DATA-01     | Phase 1 | Complete                                            |
| DATA-02     | Phase 1 | Complete                                            |
| DATA-03     | Phase 1 | Complete                                            |
| DATA-04     | Phase 1 | Complete                                            |
| METH-01     | Phase 1 | Complete                                            |
| METH-02     | Phase 1 | Complete                                            |
| METH-03     | Phase 1 | Complete                                            |
| SHARE-01    | Phase 2 | Complete                                            |
| SHARE-02    | Phase 2 | Complete                                            |
| SHARE-03    | Phase 2 | Complete                                            |
| ROAD-01     | Phase 2 | Complete                                            |
| ROAD-02     | Phase 2 | Complete                                            |
| ROAD-03     | Phase 2 | Complete                                            |
| ROAD-04     | Phase 2 | Complete                                            |
| PUB-01      | Phase 3 | Partial - production URL smoke pending Railway link |
| PUB-02      | Phase 3 | Complete                                            |
| PUB-03      | Phase 3 | Complete                                            |
| PERS-01     | Phase 4 | Complete - plans 04-01, 04-02 (coverage flag honoured; 183 countries, 90 causes, age-banded — verified in 04-VERIFICATION.md) |
| PERS-01     | 999.1   | Backlog - subnational causes (partial coverage)     |
| PERS-02     | Phase 4 | Complete - plans 04-03, 04-04, 04-05, 04-06, 04-08, 04-09, 06-01 (04-09 replaces 04-04's weak derived tier with a real WorldPop population model for 72 countries, see 04-09-SUMMARY.md; 06-01 fixed the UK tier-1 join, which had silently reached 0 of 41 keys) |
| PERS-02     | 999.1   | Backlog - subnational age/sex (partial coverage)    |
| PERS-03     | Phase 4 | Partial - plan 04-07 (composition varies by month; 56 of 90 cause labels resolve a curve, the rest reweight by 1.0) |
| REAL-01     | Phase 4 | Partial - plan 04-05 bakes the region key only      |
| REAL-03     | Phase 4 | Partial - plan 04-07 covers composition, not timing |
| STORY-01    | Phase 5 | Complete - plan 05-01 (verified in 05-VERIFICATION.md) |
| STORY-02    | Phase 5 | Complete - plan 05-02 (verified in 05-VERIFICATION.md; tactile threshold asserted from the original session) |
| STORY-03    | Phase 5 | Partial - plan 05-03 (colours frozen; white ink below WCAG AA on 3 of 5 fills, accepted by decision and pinned by test) |

**Coverage:**

- v1 requirements: 17 total, 17 mapped, 0 unmapped
- v2 requirements: 15 total (REAL-01..07, PERS-01..03, ENG-01..02, STORY-01..03)
- v2.0 milestone scope: PERS-01..03 (Phase 4, 9 plans), STORY-01..03 (Phase 5, 3 plans) and the
  audit-closure pass (Phase 6, 1 plan, inserted 2026-08-28)
- v2 mapped to phases: 8 (PERS-01..03 and STORY-01..03 fully; REAL-01, REAL-03 partially — Phase 4)
- v2 unmapped: 7 (REAL-02, REAL-04, REAL-05, REAL-06, REAL-07, ENG-01, ENG-02)

**Note on STORY-01..03:** added 2026-08-21 from the s01-s12 story capture batch. Only the three
that Phase 5 plans are promoted to requirements; the remaining nine todos stay in
`.planning/todos/pending/` until they are planned, so the requirement list does not imply
committed work.

**Note on the two partials:** Phase 4 is a Personas phase. It touches `REAL-01` and `REAL-03` only
where the Personas work needs the same artifacts — region keys on the grid, and the existing
seasonal curves. Neither Globe requirement is satisfied by Phase 4: `REAL-01` still needs
sub-national data feeding the globe's *placement and rates* (the rate grid remains national plus
density), and `REAL-03` already modulates *timing* but Phase 4 only adds *composition*.

---

_Requirements defined: 2026-06-28_
_Last updated: 2026-08-28 after plan 06-01 (v2.0 audit closure — four stale "Not started" rows
corrected, PERS-03 and STORY-03 downgraded to partial on measurement)_
