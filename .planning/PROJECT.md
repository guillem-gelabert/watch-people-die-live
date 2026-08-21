# Watch People Die Live

## What This Is

Watch People Die Live is a real-time 3D globe where each flash represents one statistically modeled real death. Death timing comes from national crude death rates and population totals, placement is weighted by population density so events happen where people live, and the feed generates representative age, sex, and cause personas from demographic datasets.

It is experiential rather than narrative: the globe carries the argument and the prose supports it, rather than the other way round.

## Core Value

Make the reality of global mortality feel immediate while staying statistically honest about timing, placement, and representative identity.

## Features

The project is two features, each with its own goal and roadmap (see `REQUIREMENTS.md` and `ROADMAP.md`):

- **Globe** — the 3D map of death events. Goal: the most statistically accurate _temporal_ (when) and _spatial_ (where) generation of simulated deaths, given real mortality-rate, density, and seasonal data.
- **Personas** — the "last deaths" feed text. Goal: the most statistically accurate representative _persona_ (age, sex, cause) for a death once the Globe's logic has already decided a death happens in a given country.

Some work is `Shared` — product-level surfaces (methodology, sharing, publishing) that support both features without belonging to either.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- Validated: The app renders a realistic Three.js globe with day/night earth, clouds, atmosphere, drag/zoom controls, and north-up interaction - existing.
- Validated: Each mapped country emits deaths as an independent Poisson process derived from World Bank crude death rate and population totals - existing.
- Validated: Death placement is weighted by the committed GPWv4-derived density grid so national totals are preserved while dense regions flash more often - existing.
- Validated: The deaths feed generates representative personas using committed UN WPP age/sex mortality data with sample and hardcoded fallbacks - existing.
- Validated: The app serves a methodology page explaining data sources, statistical modeling, caveats, and privacy posture - existing.
- Validated: Runtime data and geolocation have fallback behavior so the globe still renders when upstream services are unavailable - existing.
- Validated: The app is deployed on Railway with Nixpacks and a build-time UN data refresh path - existing.

### Active

<!-- v1.0 scope. All shipped 2026-06-29; v2.0 scope lives in ROADMAP.md. -->

- [x] Build and commit `data/causes.json` from a manual IHME GBD export so personas use full per-country, age, and sex cause distributions instead of sample/fallback causes.
- [x] Update methodology copy so the public explanation matches the current cause-data fidelity once `data/causes.json` exists.
- [x] Add social preview metadata, including `og:image` and `og:description`, so the project shares cleanly.
- [x] Build a public `/roadmap` page that communicates implemented realism layers and planned future layers.
- [x] Publish the MVP.

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Real-time individual death records - the project is statistical and representative, not surveillance or a record of identifiable people.
- Native mobile app - web-first is enough.
- Authentication or user accounts - there is no user-specific product workflow.
- Persistent analytics or user tracking - not needed for MVP and would complicate the privacy posture.
- Advanced realism layers in the MVP - sub-national rates, time-of-day patterns, seasonal patterns, climate/biome weighting, weather-driven modulation, conflict overlays, and epidemic toggles are tracked as future layers.
- Large architecture refactor before MVP - current single-process Express and static frontend structure is adequate; refactor only when a concrete feature needs it.

## Context

The codebase is a brownfield Node/Express and vanilla browser ES-module app. `server.js` serves the app shell, static data, vendored libraries from `node_modules`, and runtime JSON APIs. `public/app.js` owns the globe lifecycle, data loading, Poisson scheduling, density placement, death flashes, camera behavior, and feed updates. `public/shaders.js` owns the earth and shockwave material logic, while `public/persona.js` owns persona sampling and fallbacks.

Runtime data joins depend on numeric M49 country ids across World Bank rows, `world-atlas` geometry, density cells, and persona distributions. Most data is precomputed and committed under `data/`; live runtime calls are limited to World Bank mortality/population, ACLED conflict data and best-effort IP geolocation. Build scripts generate the density grid, UN age/sex mortality distribution, and IHME cause distribution.

v1.0 shipped on 2026-06-29 (causes data, share metadata, public roadmap page, publish). Current work is v2.0 Persona Realism - see `ROADMAP.md`. `.planning/codebase/ARCHITECTURE.md` describes the current architecture; the other codebase maps were dropped as pre-Next-migration and can be regenerated with `/gsd:map-codebase`.

## Constraints

- **Tech stack**: Keep Node.js >=20, Next.js 16 (App Router, React 19), strict TypeScript, Three.js via react-three-fiber, D3 and TopoJSON unless a concrete feature requires a change - the current stack is deployed and working. (Superseded the original Express + static-browser-module build.)
- **Data integrity**: Preserve country-level annual death totals and density-weighted placement - this is the core statistical promise of the project.
- **Identity/privacy**: Personas must remain statistically representative and never imply an identifiable real person - the app is not a surveillance tool.
- **Data sources**: `data/causes.json` requires a manual IHME GBD CSV export because there is no tokened GBD API - the workflow must account for that human step.
- **Deployment**: Railway is the current production platform - changes should preserve `railway.json`, `PORT` behavior, and build/runtime fallbacks.
- **Runtime resilience**: World Bank, UN, GBD, GPWv4, and ip-api dependencies can be unavailable - keep graceful fallbacks and clear source labeling.
- **MVP discipline**: No polishing or broad refactors until causes, social preview, roadmap page, publish, and portfolio addition are done.
- **Testing**: Vitest is the test runner (`pnpm test`), enforced with lint/format/typecheck on every commit via Husky + lint-staged. Use `scripts/verify-globe-alignment.ts` for coordinate-sensitive changes.

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision                                                    | Rationale                                                                                           | Outcome     |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------- |
| Use World Bank CDR and population for runtime death rates   | Public no-key runtime API; equivalent source lineage to UN WPP crude death rate and deploy-friendly | Good so far |
| Use M49 numeric ids as the shared country join key          | Matches `world-atlas` geometry and avoids name/ISO ambiguity at runtime                             | Good so far |
| Use GPWv4-derived density grid for within-country placement | Preserves national totals while making events cluster where people live                             | Good so far |
| Generate personas statistically, not from real records      | Communicates mortality without identifying real individuals                                         | Good so far |
| Keep the MVP web-first and deployed on Railway              | Fastest path to a deployed, shareable visualizer                                                    | Good so far |
| Treat advanced realism layers as future roadmap work        | Protects MVP scope while preserving the long-term realism ambition                                  | Pending     |
| Map the brownfield codebase before initialization           | Planning should reflect the existing architecture and shipped behavior                              | Good so far |
| Open v2.0 for persona realism rather than extend v1.0       | v1.0 shipped; STATE.md claiming an in-progress v1.0 contradicted a complete ROADMAP                 | 2026-07-31  |
| Derive Phase 4 waves from file overlap, not priority order  | Gives `$gsd-execute-phase`'s intra-wave safety check something real to enforce                       | 2026-07-31  |

## Current Milestone: v2.0 — Persona Realism

**Opened:** 2026-07-31 · **Phase:** 4 (Persona Realism Ladder) · **Plans:** 8, across 5 waves

**Goal:** persona age, sex and cause vary by region and by season, instead of every death drawing
from one global, age-flat cause table and one national age pyramid.

**Requirements in scope:** PERS-01, PERS-02, PERS-03. Touches REAL-01 and REAL-03 only where the
Personas work needs the same artifacts (region keys on the grid, the existing seasonal curves);
neither Globe requirement is satisfied by this milestone.

**Why now:** an investigation on 2026-07-31 found the shipped persona data is materially wrong,
not merely incomplete. `data/causes.json` is global *and* age-flat, so only 12 of its 140 cause
labels are reachable and a female infant draws Alzheimer's & dementia at 5.4%. Full evidence in
`.planning/phases/04-persona-realism-ladder/04-CONTEXT.md`.

**Previous milestone:** v1.0 (MVP) — phases 1-3, 5/5 plans, complete 2026-06-29. One documented
follow-up remains open (PUB-01, production Railway URL smoke).

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

_Last updated: 2026-06-28 after initialization_
