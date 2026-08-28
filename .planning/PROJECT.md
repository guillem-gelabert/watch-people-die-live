# Watch People Die Live

## What This Is

Watch People Die Live is a real-time 3D globe where each flash represents one statistically modeled real death. Death timing comes from national crude death rates and population totals, placement is weighted by population density so events happen where people live, and the feed generates a representative age, sex and cause persona for each one.

Since v2.0, that persona is no longer drawn from one global table. Cause distributions are country-specific and age-banded across 183 countries, age and sex resolve per grid cell rather than per country, and composition shifts with the month the globe is already simulating.

It is experiential rather than narrative: the globe carries the argument and the prose supports it, rather than the other way round.

## Core Value

Make the reality of global mortality feel immediate while staying statistically honest about timing, placement, and representative identity.

Two milestones in, this is still the right priority — and v2.0 sharpened what "honest" costs. Twice during the closing audit a requirement was **downgraded from complete to partial** because the evidence did not carry the claim. Recording a measured limit is part of the core value, not a failure against it.

## Features

The project is two features, each with its own goal and roadmap (see `REQUIREMENTS.md` and `ROADMAP.md`):

- **Globe** — the 3D map of death events. Goal: the most statistically accurate _temporal_ (when) and _spatial_ (where) generation of simulated deaths, given real mortality-rate, density, and seasonal data.
- **Personas** — the "last deaths" feed text. Goal: the most statistically accurate representative _persona_ (age, sex, cause) for a death once the Globe's logic has already decided a death happens in a given country.

Some work is `Shared` — product-level surfaces (methodology, sharing, publishing, and the `/roadmap` story) that support both features without belonging to either.

## Current State

**Shipped:** v2.0 Persona Realism (2026-08-28). Two milestones, 6 phases, 18 plans.

- **v1.0 MVP** — phases 1-3, 5 plans, 2026-06-29. Real cause data, honest methodology, social previews, the public `/roadmap` route, deployed.
- **v2.0 Persona Realism** — phases 4-6, 13 plans, 2026-08-28. Region- and season-varying personas, three story fixes, and an audit-closure pass.

Full history: `MILESTONES.md`. Archives: `.planning/milestones/`.

**Open follow-ups carried across the boundary:**

- `PUB-01` (from v1.0) — production Railway URL smoke check still pending; the checkout was never linked to a Railway project.
- 5 accepted audit warnings from v2.0 (INT-03…INT-07) — each a deliberate deferral with a recorded reason, not an oversight.
- 9 open todos in `.planning/todos/pending/` — 7 unpromoted story polish items, 1 partially done (s14's cadence), and p09 parked as backlog 999.1.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

_Pre-milestone foundation:_

- ✓ The app renders a realistic Three.js globe with day/night earth, clouds, atmosphere, drag/zoom controls, and north-up interaction.
- ✓ Each mapped country emits deaths as an independent Poisson process derived from World Bank crude death rate and population totals.
- ✓ Death placement is weighted by the committed density grid so national totals are preserved while dense regions flash more often.
- ✓ The app serves a methodology page explaining data sources, statistical modeling, caveats, and privacy posture.
- ✓ Runtime data and geolocation have fallback behavior so the globe still renders when upstream services are unavailable.
- ✓ The app is deployed on Railway with Nixpacks and a build-time data refresh path.

_v1.0 — MVP:_

- ✓ Committed `data/causes.json` from an IHME GBD export, repeatable from documented source input — v1.0 (DATA-01..04)
- ✓ Methodology copy matches the shipped cause-data fidelity — v1.0 (METH-01..03)
- ✓ Social preview metadata including `og:image` — v1.0 (SHARE-01..03)
- ✓ A public `/roadmap` page separating implemented from planned realism layers — v1.0 (ROAD-01..04)
- ✓ MVP published, with a portfolio-ready entry point — v1.0 (PUB-02, PUB-03)

_v2.0 — Persona Realism:_

- ✓ Cause distributions are country-specific and age-banded — v2.0 (PERS-01; 183 countries × 90 causes from WHO GHE, coverage flag guarded by 15 tests)
- ✓ Age and sex distributions are region-specific rather than national — v2.0 (PERS-02; 59,954 cells, three tiers, tier mix 44.60/51.84/3.56)
- ✓ Sections end on their argument, with restating asides removed — v2.0 (STORY-01)
- ✓ The return-to-globe gesture fires only on deliberate input, never on scroll momentum — v2.0 (STORY-02)

### Active

<!-- Not yet scoped to a milestone. Run /gsd:new-milestone to define the next version. -->

_Measured partials carried forward from v2.0:_

- [~] **PERS-03**: Persona composition varies with the season — live, but 34 of 90 cause labels resolve no curve. A mapping limit (`chapter_of_cause_label()` derives from Eurostat's European cause list and cannot name tropical causes), not a measurement one.
- [~] **STORY-03**: Proxy identity colours are stable — done, but white ink is below WCAG AA on 3 of 5 fills. Accepted by decision, pinned by test.
- [~] **REAL-01**: Sub-national data feeds the globe's *placement and rates* — only the region key is baked so far; the rate grid remains national plus density.
- [~] **REAL-03**: Seasonal modulation of *timing* — exists; v2.0 added composition, which is a different axis.

_Unmapped, never scoped to a phase:_

- [ ] **REAL-02**: Time-of-day modulation for circadian-sensitive causes.
- [ ] **REAL-04**: Climate/biome-weighted cause or rate weighting.
- [ ] **REAL-05**: Real-time weather modulation during heat, cold and storms.
- [ ] **REAL-06**: Conflict or excess-mortality overlays in active conflict zones.
- [ ] **REAL-07**: Epidemic/pandemic event modes.
- [ ] **ENG-01**: A general automated test runner covering API fallbacks and browser smoke behaviour. — *largely overtaken by events:* Vitest is the runner, enforced on every commit via Husky + lint-staged. The remaining gap is browser smoke coverage, not the runner.
- [ ] **ENG-02**: Split frontend modules if roadmap/social/publishing features make them harder to change safely. — *obsolete as written:* `public/app.js` no longer exists. The Next.js migration split the frontend along different lines.
- [ ] **PUB-01**: Production Railway URL smoke check (open since v1.0).

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. Audited 2026-08-28. -->

- Real-time individual death records — the project is statistical and representative, not surveillance or a record of identifiable people. **Reasoning holds; this is the project's identity.**
- Native mobile app — web-first is enough. **Reasoning holds**, and mobile parity work has been done in the browser instead.
- Authentication or user accounts — there is no user-specific product workflow. **Reasoning holds.**
- Persistent analytics or user tracking — not needed and would complicate the privacy posture. **Reasoning holds.**
- Large architecture refactor without a driving feature — refactor only when a concrete feature needs it. **Reasoning holds**, and was honoured through the Next.js migration, which a concrete need did drive.
- ~~Advanced realism layers in the MVP~~ — **removed 2026-08-28.** This was a v1.0 scope fence and v2.0 walked through it deliberately. The layers are tracked in `REQUIREMENTS.md` v2 and the two Future Roadmaps, not as out-of-scope.

_Added 2026-08-28 from what v2.0 invalidated:_

- Full observed subnational coverage as a sweep — unreachable at any effort level. China, India, Indonesia, Pakistan, Ethiopia, Nigeria and DRC have weak or no public subnational access, and each remaining country is a bespoke parser. Derivation (gridded population × national age-specific rates) covers the same ground for all 981 regions. Opportunistic pickups only, parked as backlog 999.1.
- Binary-format parsing on the request path — see Constraints. Resolved for ACLED in v2.0; the rule now has no outstanding violations.

## Context

The codebase is a Next.js 16 App Router app in strict TypeScript — 32,443 tracked lines of TS/Python (app 14,564 · lib 6,177 · scripts 4,916 · pipeline 4,890 · notebooks 1,881). Route handlers under `app/api/` serve runtime JSON; `app/globe/` owns the globe lifecycle, Poisson scheduling, density placement, death flashes, camera behaviour and the feed; `app/roadmap/` owns the scrollytelling story and its figures; `lib/` holds the data helpers; `pipeline/` is a Python package for subnational retrieval.

Runtime data joins depend on numeric M49 country ids across World Bank rows, `world-atlas` geometry, density cells, and persona distributions. Since v2.0 there is a second join key space — admin-1 / NUTS-2 region keys, baked per grid cell and aligned to `rate-grid.json`'s cell order across four files. That alignment is the milestone's main structural liability: it is asserted by the build scripts but has no runtime guard (audit warning INT-05).

Most data is precomputed and committed under `data/`; live runtime calls are limited to World Bank mortality/population and best-effort IP geolocation. ACLED conflict data moved off the request path into `prebuild` during v2.0.

The story at `/roadmap` is trilingual (English, Catalan, German), selected from `Accept-Language`. Its prose is one markdown file per language and `storyTranslations.test.ts` enforces that they keep identical section keys, skies and slot placeholders.

`.planning/codebase/ARCHITECTURE.md` describes the current architecture; the other codebase maps were dropped as pre-Next-migration and can be regenerated with `/gsd:map-codebase`.

## Constraints

- **Tech stack**: Keep Node.js >=20, Next.js 16 (App Router, React 19), strict TypeScript, Three.js via react-three-fiber, D3 and TopoJSON unless a concrete feature requires a change — the current stack is deployed and working.
- **Server data formats**: The server parses JSON or CSV only **at runtime**. Any upstream source that publishes Excel or another binary format is converted at build time by a script under `scripts/` (or offline in a notebook), and the request path reads only its JSON output. Set 2026-08-21. **Satisfied as of v2.0** — `scripts/build-conflicts.ts` runs in `prebuild` and the app imports only types from `lib/acled`; there is no longer a runtime xlsx parse.
- **Data integrity**: Preserve country-level annual death totals and density-weighted placement — this is the core statistical promise of the project.
- **Cell alignment**: Any file keyed by grid cell must ship aligned to `rate-grid.json`'s cell order, never a wider grid row, and the tier or provenance resolved is part of the output rather than an implementation detail.
- **Key spaces**: A key space must express every key space a consumer joins against — not mirror whichever upstream file it was derived from. This is what INT-01 cost v2.0; it is now enforced by a build throw rather than by convention.
- **Identity/privacy**: Personas must remain statistically representative and never imply an identifiable real person — the app is not a surveillance tool.
- **Data sources**: National causes come from WHO Global Health Estimates (keyless, CC BY 4.0). GBD supplies subnational age/sex only, and its `download.php` needs a bearer token pasted by hand, because the IHME account is where the non-commercial agreement is accepted — the workflow must account for that human step.
- **Deployment**: Railway is the current production platform — changes should preserve `railway.json`, `PORT` behavior, and build/runtime fallbacks.
- **Runtime resilience**: World Bank, WHO, GBD, WorldPop, Eurostat and ip-api dependencies can be unavailable — keep graceful fallbacks and clear source labeling.
- **Translations**: `lib/i18n/en.ts` is the schema; a new key is a type error in `ca.ts` and `de.ts` until translated. Country, region and cause names are never translated — they come from the data.
- **Testing**: Vitest is the test runner (`pnpm test`), enforced with lint/format/typecheck on every commit via Husky + lint-staged. Use `scripts/verify-globe-alignment.ts` for coordinate-sensitive changes.
- ~~**MVP discipline**~~ — retired 2026-08-28. It named the v1.0 checklist, which shipped.

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision                                                    | Rationale                                                                                           | Outcome     |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------- |
| Use World Bank CDR and population for runtime death rates   | Public no-key runtime API; equivalent source lineage to UN WPP crude death rate and deploy-friendly | ✓ Good |
| Use M49 numeric ids as the shared country join key          | Matches `world-atlas` geometry and avoids name/ISO ambiguity at runtime                             | ✓ Good |
| Use a GPWv4-derived density grid for within-country placement | Preserves national totals while making events cluster where people live                             | ✓ Good |
| Generate personas statistically, not from real records      | Communicates mortality without identifying real individuals                                         | ✓ Good |
| Keep the project web-first and deployed on Railway          | Fastest path to a deployed, shareable visualizer                                                    | ✓ Good |
| Map the brownfield codebase before initialization           | Planning should reflect the existing architecture and shipped behavior                              | ✓ Good |
| Parse JSON or CSV only at runtime                           | A binary parser on the request path is a reliability risk and cannot be exercised offline; ExcelJS's streaming reader failed 7/20 on a valid ZIP entry order | ✓ Good — violation cleared in v2.0 |
| Open v2.0 for persona realism rather than extend v1.0        | v1.0 shipped; STATE.md claiming an in-progress v1.0 contradicted a complete ROADMAP                 | ✓ Good |
| Derive phase waves from `files_modified` overlap, not priority order | Gives the intra-wave safety check something real to enforce                                  | ✓ Good — Phase 4 ran 9 plans over 6 waves with no collision |
| Treat source selection as an investigation, not an assumption | 04-02's and 04-03's named sources were both unusable — the WHO Mortality Database has zero rows for Nigeria, Ethiopia, DR Congo and India | ✓ Good — caught before implementation, not after |
| National causes from WHO GHE; GBD for subnational only       | WHO GHE is keyless and covers 183 countries including those without vital registration; GBD is the only subnational source but is token-gated and row-capped | ✓ Good |
| Ship a derived tier aligned to `rate-grid.json`, with the tier in the output | A wider grid row invites silent misalignment; a hidden tier makes a derived estimate indistinguishable from a measured one | ✓ Good |
| Measure a month-conditioned tensor as `HarmonicCurve` objects | Composes with the existing timing curve's evaluate/blend/shift primitives instead of becoming a parallel representation | ✓ Good |
| Accept the WCAG AA failure on 3 of 5 proxy fills, and record it | Both alternatives were evaluated and rejected on design grounds; the cost is documented in `palette.ts` and pinned by test rather than hidden | ⚠️ Revisit — an accessibility debt with a known owner |
| Treat the "other causes" residual as aseasonal by decision   | 16.6–52.1% of adult band cause weight with no derivable curve; a stated decision beats an unexplained 1.0 reweight | ⚠️ Revisit — revisit if the label mapping widens |
| Keep 20 archetypes rather than raising `ARCHETYPE_COUNT`      | A payload-versus-fidelity trade-off with no forcing function; the UK fix survived quantisation, which was the acceptance test | ⚠️ Revisit — still flattens 19.43% of expected deaths |
| Insert an audit-closure phase instead of accepting the gaps   | The first audit pass separated "the work is done" from "the verification says so" and found two real defects behind the second | ✓ Good — both blockers were real and are now guarded |

## Next Milestone Goals

Not yet defined. Run `/gsd:new-milestone` to scope it (questioning → research → requirements → roadmap).

Candidate directions, in no committed order:

1. **Close PERS-03's coverage gap** — widen `chapter_of_cause_label()` beyond Eurostat's European cause list so tropical causes resolve a seasonal curve. The single largest measured limitation the milestone shipped with.
2. **REAL-01 properly** — make sub-national data feed the globe's placement and rates, not just the region key. The artifacts now exist; only the rate grid is still national plus density.
3. **Pay down the five accepted audit warnings** — particularly INT-05, the missing runtime alignment guard, which is the one with a real failure mode behind it.
4. **The remaining story polish batch** — 7 unpromoted todos in `.planning/todos/pending/`, plus s14's outstanding cadence.
5. **Close PUB-01** — link the checkout to Railway and run the production smoke check, open since v1.0.

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):

1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):

1. Full review of all sections
2. Core Value check - still the right priority?
3. Audit Out of Scope - reasons still valid?
4. Update Context with current state

---

_Last updated: 2026-08-28 after the v2.0 milestone._
