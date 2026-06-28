# Watch People Die Live

## What This Is

Watch People Die Live is a real-time 3D globe where each flash represents one statistically modeled real death. Death timing comes from national crude death rates and population totals, placement is weighted by population density so events happen where people live, and the feed generates representative age, sex, and cause personas from demographic datasets.

It is a portfolio visualizer: experiential rather than narrative, built to become one of 2-3 data-driven stories that demonstrate data visualization and creative development work.

## Core Value

Make the reality of global mortality feel immediate while staying statistically honest about timing, placement, and representative identity.

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

<!-- Current scope. Building toward these. -->

- [ ] Build and commit `data/causes.json` from a manual IHME GBD export so personas use full per-country, age, and sex cause distributions instead of sample/fallback causes.
- [ ] Update methodology copy so the public explanation matches the current cause-data fidelity once `data/causes.json` exists.
- [ ] Add social preview metadata, including `og:image` and `og:description`, so the project shares cleanly.
- [ ] Build a public `/roadmap` page that communicates implemented realism layers and planned future layers.
- [ ] Publish the MVP and add it to the portfolio as the visualizer piece.

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Real-time individual death records - the project is statistical and representative, not surveillance or a record of identifiable people.
- Native mobile app - web-first is enough for the portfolio MVP.
- Authentication or user accounts - there is no user-specific product workflow.
- Persistent analytics or user tracking - not needed for MVP and would complicate the privacy posture.
- Advanced realism layers in the MVP - sub-national rates, time-of-day patterns, seasonal patterns, climate/biome weighting, weather-driven modulation, conflict overlays, and epidemic toggles are tracked as future layers.
- Large architecture refactor before MVP - current single-process Express and static frontend structure is adequate; refactor only when a concrete feature needs it.

## Context

The codebase is a brownfield Node/Express and vanilla browser ES-module app. `server.js` serves the app shell, static data, vendored libraries from `node_modules`, and runtime JSON APIs. `public/app.js` owns the globe lifecycle, data loading, Poisson scheduling, density placement, death flashes, camera behavior, and feed updates. `public/shaders.js` owns the earth and shockwave material logic, while `public/persona.js` owns persona sampling and fallbacks.

Runtime data joins depend on numeric M49 country ids across World Bank rows, `world-atlas` geometry, density cells, and persona distributions. Most data is precomputed and committed under `data/`; live runtime calls are limited to World Bank mortality/population and best-effort IP geolocation. Build scripts generate the density grid, UN age/sex mortality distribution, and IHME cause distribution.

The current MVP gaps are product-facing rather than foundational: the core visualization works, but the project still needs the real `data/causes.json`, share metadata, a public roadmap page, and portfolio publication polish. The codebase map in `.planning/codebase/` captures the current architecture, stack, conventions, testing gaps, integrations, and concerns.

## Constraints

- **Tech stack**: Keep Node.js >=20, Express, Three.js, D3, TopoJSON, and static browser modules unless a concrete feature requires a change - the current stack is deployed and working.
- **Data integrity**: Preserve country-level annual death totals and density-weighted placement - this is the core statistical promise of the project.
- **Identity/privacy**: Personas must remain statistically representative and never imply an identifiable real person - the app is not a surveillance tool.
- **Data sources**: `data/causes.json` requires a manual IHME GBD CSV export because there is no tokened GBD API - the workflow must account for that human step.
- **Deployment**: Railway is the current production platform - changes should preserve `railway.json`, `PORT` behavior, and build/runtime fallbacks.
- **Runtime resilience**: World Bank, UN, GBD, GPWv4, and ip-api dependencies can be unavailable - keep graceful fallbacks and clear source labeling.
- **MVP discipline**: No polishing or broad refactors until causes, social preview, roadmap page, publish, and portfolio addition are done.
- **Testing**: There is no general test runner yet - use `node scripts/verify-globe-alignment.mjs` for coordinate-sensitive changes and add focused verification where risk justifies it.

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use World Bank CDR and population for runtime death rates | Public no-key runtime API; equivalent source lineage to UN WPP crude death rate and deploy-friendly | Good so far |
| Use M49 numeric ids as the shared country join key | Matches `world-atlas` geometry and avoids name/ISO ambiguity at runtime | Good so far |
| Use GPWv4-derived density grid for within-country placement | Preserves national totals while making events cluster where people live | Good so far |
| Generate personas statistically, not from real records | Communicates mortality without identifying real individuals | Good so far |
| Keep the MVP web-first and deployed on Railway | Fastest path to a portfolio-ready visualizer | Pending |
| Treat advanced realism layers as future roadmap work | Protects MVP scope while preserving the long-term realism ambition | Pending |
| Map the brownfield codebase before initialization | Planning should reflect the existing architecture and shipped behavior | Good so far |

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
*Last updated: 2026-06-28 after initialization*
