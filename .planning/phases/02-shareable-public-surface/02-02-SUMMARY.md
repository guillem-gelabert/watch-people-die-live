---
phase: 2
plan: 02-02
subsystem: public-roadmap
tags:
  - roadmap
  - public-page
  - express-route
key-files:
  - server.js
  - public/roadmap.html
  - requirements.md
  - public/methodology.html
metrics:
  shipped_layers: 5
  planned_layers: 7
---

# Plan 02-02 Summary: Build public roadmap page

## One-liner

Added a clean `/roadmap` route and static public roadmap page separating shipped realism layers from planned future layers.

## Completed Work

- Added an explicit `/roadmap` route in `server.js`, matching the existing `/methodology` route pattern.
- Created `public/roadmap.html` with an app-native static page focused on shipped vs planned realism layers.
- Listed shipped layers: national rates, population-density placement, age/sex personas, global sex-specific IHME causes, and fallbacks/caveats.
- Listed planned layers: subnational rates, time-of-day, seasonal, climate/biome, live weather, conflict/disaster, and epidemic/pandemic modes.
- Updated `requirements.md` to remove stale statements that `data/causes.json` was pending or per-country/age-specific.
- Updated `public/methodology.html` footer source wording to match current IHME-only cause source.

## Commits

| Task                   | Commit       | Description                                                                                                        |
| ---------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------ |
| Roadmap route and page | working tree | Changes are present but not committed because `commit_docs=false` and the repository already has uncommitted work. |

## Verification

Passed:

```bash
node --check server.js
rg -n "Shipped realism layers|Planned realism layers|National death rates|Population-density placement|Age and sex personas|Cause personas|Subnational rates|Time-of-day patterns|Seasonal patterns|Climate and biome|Live weather|Conflict and disaster|Epidemic and pandemic" public/roadmap.html
PORT=3003 npm start
curl http://localhost:3003/roadmap
```

HTTP smoke results:

| Route      | Status |
| ---------- | ------ |
| `/roadmap` | 200    |

## Deviations

- The page uses inline static-page styling, matching `public/methodology.html`, rather than adding shared CSS to `public/styles.css`.
- No commit was created during execution.

## Self-Check

PASSED. `/roadmap` loads, separates shipped and planned realism layers, and does not imply future layers are already implemented.
