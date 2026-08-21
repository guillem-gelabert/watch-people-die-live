---
phase: 3
status: passed
verified_at: 2026-06-29
plans:
  - 03-01
---

# Phase 3 Verification: Publish and Portfolio Handoff

## Status

passed

## Criteria

| Criterion                                                                                     | Result  | Evidence                                                                                                                                                               |
| --------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The Railway deployment serves the globe, methodology page, roadmap page, and social metadata. | partial | Railway CLI is installed and authenticated, but this checkout is not linked to a Railway project. The limitation and follow-up are recorded in `PORTFOLIO-HANDOFF.md`. |
| A final smoke check confirms the primary visualization and public pages work.                 | passed  | Local Express smoke returned HTTP 200 for `/`, `/methodology`, `/roadmap`, and `/social-preview.png`.                                                                  |
| The project has a portfolio-ready link target or entry guidance.                              | passed  | `PORTFOLIO-HANDOFF.md` provides portfolio positioning, link placeholder, and URL verification commands.                                                                |
| Remaining advanced realism layers are explicitly deferred rather than blocking the MVP.       | passed  | Handoff and roadmap list subnational, time-of-day, seasonal, climate/biome, live weather, conflict/disaster, and epidemic/pandemic layers as deferred.                 |

## Commands Run

```bash
node --check server.js
rg -n "og:title|og:description|og:image|twitter:card|summary_large_image|individual death records|identifiable" public/index.html
rg -n "Shipped realism layers|Planned realism layers|National death rates|Population-density placement|Age and sex personas|Cause personas|Subnational rates|Time-of-day patterns|Seasonal patterns|Climate and biome|Live weather|Conflict and disaster|Epidemic and pandemic" public/roadmap.html
rg -n "global, sex-specific|representative|not individual" public/methodology.html
file public/social-preview.png
PORT=3004 npm start
curl http://localhost:3004/
curl http://localhost:3004/methodology
curl http://localhost:3004/roadmap
curl http://localhost:3004/social-preview.png
railway --version
railway whoami --json
railway status --json
```

## Human Verification

None required for local MVP handoff. Production URL verification remains a manual follow-up because the checkout is not linked to Railway.

## Gaps

Production Railway smoke checks remain pending until a Railway project link or deployed URL is available.
