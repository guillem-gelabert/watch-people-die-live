---
phase: 4
plan: 04-03
subsystem: data
tags:
  - gbd
  - age-sex
  - subnational
  - estimates
key-files:
  - scripts/build-subnational-age-sex.ts
  - data/subnational-age-sex.json
  - .planning/phases/04-persona-realism-ladder/gbd-export-spec.md
requirements-completed: [PERS-02]
---

# Plan 04-03 Summary: Pull GBD subnational age/sex death weights

## One-liner

444 of GBD's 508 leaf subnational units — 98.44% of subnational deaths — now carry age × sex
weights joined to the committed admin-1 / NUTS-2 key space, from a single 31,812-row export that
matched the spec exactly.

## Completed Work

- **The export landed.** `IHME-GBD_2023_DATA-a8bd9db5-1.csv`: 31,812 rows, 723 locations, 22 age
  groups, 2 sexes, one cause, one year, Deaths/Number — exactly the row count `gbd-export-spec.md`
  predicted. Staged in gitignored `data/source/gbd-subnational-age-sex/` alongside the two open
  GBD metadata endpoints, so the build reproduces offline.
- **`scripts/build-subnational-age-sex.ts`** folds the 22 age ids onto the project's nine bands,
  joins to the committed key space, and writes `data/subnational-age-sex.json` — 161 KB of
  normalised weights, never counts.
- **Every row carries `measurement: "gbd-modeled"`** plus IHME's required attribution and citation
  in `meta`, following the `seasonality-subnational.json` precedent.

## The join

| | |
| --- | --- |
| Leaf subnational units | 508 |
| Matched | 444 (474 emitted rows after roll-down) |
| Death share covered | 98.44% |
| Death share skipped | 1.56% |

Three structural things the plan did not anticipate:

- **Leaves, not depth ≥ 4.** Brazil, Italy and the UK publish macro-regions *and* the real units
  one level below. Taking every depth-4 node would have double-counted them against each other,
  so the build takes hierarchy leaves. That is why the denominator is 508, not the spec's 519.
- **Italy, Poland and the UK join to NUTS-2, not Natural Earth.** GBD's 21 Italian regions *are*
  the 21 Italian NUTS-2 regions; Natural Earth carries 110 Italian provinces instead. Name-matching
  Italy against Natural Earth scored 0/21; against NUTS-2 it scores 21/21.
- **The UK and Poland roll *down*.** GBD publishes 12 NUTS-1-level UK regions against a NUTS-2
  layer, so each broadcasts to its NUTS-2 children by code prefix. This is only sound because the
  output is a distribution: a child inherits its parent's shape and no deaths are duplicated,
  because no deaths are emitted.

Skipped, all listed in `meta.skipped` with their forgone death share — nothing dropped silently:

| What | Share | Why |
| --- | --- | --- |
| Kenya (47 units) | 1.06% | GBD publishes 47 counties; Natural Earth carries 8 pre-2013 provinces |
| Norway (11 units) | 0.17% | GBD uses post-2020 counties; both committed layers predate the reorganisation |
| Sidama, South West (ETH) | 0.22% | carved out of SNNPR after the Natural Earth vintage |
| Other Union Territories (IND) | 0.09% | a GBD aggregate, not one region |
| North Kalimantan, Davao Occidental, Dinagat Islands | 0.02% | created after the Natural Earth vintage |

## Verification

- `pnpm run typecheck`, `pnpm run lint`, `pnpm test` (133 tests), `prettier --check` all pass.
- Weights sum to 1 across `m[] + f[]` for all 474 rows; every row carries a measurement value.
- Every emitted key is valid committed geometry. 57 of them win no cell in `data/region-keys.json`
  — Delhi, Jakarta, Osaka, Mexico City and other small or urban regions lose the 0.5° area-majority
  vote. That is a property of 04-05's assignment, not of this join, and is noted in `meta`.
- **National cross-check is now a permanent part of the artifact** (`meta.nationalCrossCheck`),
  not a one-off. Rolling the subnational counts up and comparing shape against UN WPP:

  | Close | | Divergent | |
  | --- | --- | --- | --- |
  | JPN | 1.2% | PAK | 23.0% |
  | USA / GBR | 1.9% | NGA | 19.9% |
  | POL / ITA | 2.0–2.3% | ETH | 19.5% |
  | BRA | 3.6% | IDN | 14.8% |

  The gradient is the finding, not a defect: the two sources agree where both rest on civil
  registration and part where GBD is modelling around its absence. Nigeria's subnational total is
  only 0.67× the UN national one. Anything reading these pyramids for a low-registration country
  is reading an estimate, which is what `measurement: "gbd-modeled"` is for.

## How the export was actually obtained

Worth recording, because the plan's instructions were wrong in a way that cost time:

- **`Origin` and `Referer` headers are required.** Without them a well-formed authenticated POST
  to `php/download.php` returns a bare Flask 500 rather than a useful error.
- **A 500 does not mean the task failed.** At least one request that returned 500 had in fact
  enqueued a task, which completed and was emailed. The 500 is not a reliable failure signal.
- **Results are retrievable with no auth at all.** `php/get_download_result.php?taskID=` is open,
  and a completed task's `urls` point at public `dl.healthdata.org` objects. Only task *creation*
  needs a token.
- **A 723-location request is too large** and 500s deterministically without enqueuing. The small
  probe queries succeeded. If this is ever re-run, chunk by location.
- **`version: 8352` works.** An earlier note in this file claimed 8016 was required; the successful
  task used 8352.

`gbd-export-spec.md` carries all of this.
