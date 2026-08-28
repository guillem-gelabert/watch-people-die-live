---
phase: 4
plan: 04-05
subsystem: grid
tags:
  - region-keys
  - subnational
  - geo
key-files:
  - scripts/build-region-keys.ts
  - data/region-keys.json
requirements-completed: [PERS-02]
requirements-partial: [REAL-01]
---

# Plan 04-05 Summary: Bake an admin-1 / NUTS-2 region key per mortality-grid cell

## One-liner

Every populated grid cell now carries the same `geo`+`key` region identity `subnational-cdr.json` uses, assigned by area majority on a sub-cell lattice, with 0.081% of expected deaths left explicitly unassigned.

## Completed Work

- Added `scripts/build-region-keys.ts`: loads the committed Natural Earth admin-1 (4,596 polygons) and GISCO NUTS-2 (334) layers, indexes them into 2-degree buckets, and votes each cell on a 5x5 sub-cell lattice.
- Layer choice per country mirrors `subnational-cdr.json`'s own `nutsCountriesIso3`, so the two key spaces are one key space rather than two of the same shape.
- Mapped Natural Earth's non-ISO country codes (`SDS` South Sudan, `PSX` Palestine, `SOL` Somaliland, `KOS` Kosovo) and added an admin-1 fallback for NUTS-preferring countries, which rescues Atlantic and Aegean islands outside NUTS coverage.
- Unassigned cells get an explicit `-1` and are enumerated per country with their death share in the output, following `seasonality-applied-fallbacks.json`'s `meta.unassignedTargets` precedent.
- Added a `build:region-keys` script; added `d3-geo` as a dev dependency.

## Commits

| Task                     | Commit     | Description                                                       |
| ------------------------ | ---------- | ----------------------------------------------------------------- |
| Baker, data, wiring      | `9870e1a8` | feat(grid): bake an admin-1 / NUTS-2 region key per mortality-grid cell |

## Verification

```bash
pnpm run build:region-keys -- --force
pnpm run typecheck && pnpm run lint && pnpm test
```

| Measure | Result |
| ------- | ------ |
| Cells assigned | 59,328 of 59,954 |
| Distinct regions used | 2,755 |
| Keys also present in `subnational-cdr.json` | 789 |
| Nearest-region fallback | 3,907 cells |
| Unassigned | 626 cells = **0.081%** of expected deaths, across 41 countries |
| Rollup mismatches | **0** of 59,328, verified from the written file |
| Output size | 394 KB |

Alias and fallback fixes took unassigned from 0.396% to 0.081%. Sudan (117 cells, 0.073%) is the only non-trivial remainder, where the grid's own country layer and Natural Earth's boundaries disagree.

Spot checks, confirming area majority behaves correctly on border cells:

| Cell | Assigned | Correct? |
| ---- | -------- | -------- |
| Brussels (4, 50.5) | `nuts2:BE24` Vlaams-Brabant | yes — Brussels-Capital is a small part of that cell |
| Delhi (76.5, 28.5) | `adm1:IND-2430` Haryana | yes — the Delhi enclave is east of the cell |
| Lagos (3, 6.5) | `adm1:NGA-2852` Ogun | yes — Ogun covers most of that box |
| Texas, Tokyo, Rio, St Petersburg | Texas, Tokyo, Rio de Janeiro, Leningrad | yes |

## Deviations

- **Shipped as its own file, not a fifth column on `rate-grid.json`.** `pipeline/climate_fallback.py:113` unpacks each cell as exactly four values, so a wider row is a crash, not a warning; and `useGlobeData.ts` snaps the baked ACLED layer onto cells by a `"lon,lat"` key, so rewriting the grid risks silently invalidating that join. The output is aligned to cell order and asserts its own length, which is the contract the extra column would have had.
- **Assignment is by area majority, not population.** The plan asked for whichever region holds the most population in the cell. `data/density-grid.json` is itself 0.5 degrees — the same resolution as the cells — so no sub-cell population exists to weight with. Stated in the script header rather than implied away.
- **Moved from wave 3 to wave 2, dependency on 04-04 dropped.** Attaching a regional pyramid to a cell needs this key, so the dependency runs the other way. `04-05-PLAN.md`, the roadmap wave table and `04-CONTEXT.md` were updated before execution.
- The rollup counter is close to tautological, since candidates are filtered by country before voting. It survives as a cheap guard against a bug in that filter, and was additionally verified independently from the written file.

## Unblocked

- Pending todo `2026-08-21-s06` (amplitude-map cells and month slider) was waiting on exactly this cell-to-region join key.

## Self-Check

PASSED. Every populated cell carries an admin-1 or NUTS-2 key or an explicit null; keys match `subnational-cdr.json`'s key space; payload growth is measured and outside `rate-grid.json`.
