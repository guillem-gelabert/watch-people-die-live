---
created: 2026-07-31T10:44:09.396Z
title: Honour the causes.json coverage flag in pickCause
priority: 1
promoted_to: phase-04 plan 04-01
area: data
files:
  - app/globe/persona.ts:38-42
  - app/globe/persona.ts:224-241
  - app/globe/persona.ts:88-136
  - scripts/build-causes.ts:101-115
---

## Problem

`scripts/build-causes.ts` writes a `coverage` object into `data/causes.json`
(`{ location, age, sex }`, declared at :101-115) that records whether the export had real age
bands or just all-ages weights repeated across every band. **`persona.ts` never reads it.** The
`CauseData` interface (:38-42) declares only `causes`, `global`, `countries` — `coverage` isn't
even in the type.

Consequence: `pickCause` (:224) takes `CAUSE.global[sex][bandIdx]` unconditionally, and the
committed file has `coverage.age: "all_ages_repeated_across_bands"`, so every age band holds
identical all-ages weights. The age- and sex-gated fallback table at :88-136 — which exists
precisely for this and would give an infant *neonatal complications* or *birth asphyxia* —
is unreachable, because `if (CAUSE)` at :225 always wins.

Measured on the current committed file, infant personas draw:

| female infant           |      | male infant             |       |
| ----------------------- | ---: | ----------------------- | ----: |
| ischaemic heart disease | 14.2% | ischaemic heart disease | 15.4% |
| a stroke                | 11.9% | a stroke                | 10.8% |
| COPD                    |  5.7% | COPD                    |  5.7% |
| Alzheimer's & dementia  |  5.4% | lung cancer             |  4.2% |
| breast cancer           |  2.8% | neonatal complications  |  2.9% |

**The committed GBD file currently makes the feed less realistic than shipping no GBD file at
all.** This is the cheapest fix on the persona ladder: no new data, global effect, and it is a
prerequisite for verifying every later cause export — without the guard you cannot distinguish
"the new export worked" from "the guard was never there".

## Solution

Add `coverage` to the `CauseData` interface, then in `pickCause` treat a cell as unusable when
`coverage.age === "all_ages_repeated_across_bands"` and fall through to the existing `CAUSES`
fallback table. Consider also honouring `coverage.location === "global"` when a country lookup
was requested, so the caller can tell "no country data" from "country data that happens to
match global".

Keep the global table reachable as a *last* resort ahead of the hand-written table for adult
bands if that reads better — but for bands 0-2 the fallback table is unambiguously more correct.

Prerequisite for p03 (GBD re-export) and p02 (WHO MDB). Do this first regardless of whether
either export ever lands.
