---
created: 2026-07-31T10:44:09.396Z
title: Queue chunked GBD cause export (country × age × sex)
priority: 3
promoted_to: phase-04 plan 04-03
area: data
files:
  - scripts/build-causes.ts:9-17
  - scripts/build-causes.ts:176-194
  - app/globe/persona.ts:224-241
  - data/causes.json
---

## Problem

`data/causes.json` was exported from the GBD Results Tool with **Location = Global** and
**Age = All ages**, so `coverage.location: "global"`, `coverage.age:
"all_ages_repeated_across_bands"`, and `countries: {}` is empty. The persona feed therefore
varies cause by **sex only** — not by country, not by age.

The concrete damage is worse than "no geography". `TOP = 8` applied to a *global* aggregate
means the file ships 140 cause labels of which only **12 are ever reachable**; 128 are dead
weight in the payload. The global top 8 is entirely cardiovascular / COPD / cancer, so these
are all structurally unreachable:

    malaria                      idx  58
    HIV/AIDS                     idx 120
    tuberculosis                 idx 119
    a diarrhoeal disease         idx 121
    maternal complications       idx  96
    suicide                      idx  51
    interpersonal violence       idx  52
    a congenital condition       idx  21
    protein-energy malnutrition  idx  33

A death in Nigeria can never surface as malaria, one in South Africa never as HIV/AIDS, and
nobody anywhere can die of suicide or violence — all folded into `other causes`, already ~50%
of every cell. Per-country top-8 fixes this automatically (malaria *is* in Nigeria's top 8).

Because every band holds the same all-ages weights, infant personas are visibly wrong: a
female infant currently draws **Alzheimer's & dementia at 5.4%** and **breast cancer at 2.8%**;
a male infant draws **ischaemic heart disease at 15.4%** and **lung cancer at 4.2%**.

This is queued rather than done because the GBD Results Tool has tight daily/weekly quotas and
a 100k-row cap per request — it is **wall-clock-bound, not effort-bound**, so it should be
started early and allowed to trickle in over the quota window while other work proceeds.

## Solution

Re-export from the GBD Results Tool (https://vizhub.healthdata.org/gbd-results/) changing only
the Location and Age selections, then `pnpm run build:causes -- --force`. Both ends are already
built — `build-causes.ts` keys countries by M49 via `isoOf` → `alpha3ToNumeric`, `bandsOf()`
already parses every GBD 5-year label including the neonatal subdivisions, and
`persona.ts:226` already tries `CAUSE.countries[m49]` before `CAUSE.global`. **No new code.**

| Field           | Today                | Re-export                                        |
| --------------- | -------------------- | ------------------------------------------------ |
| Location        | Global (1)           | All countries/territories (204)                  |
| Age             | All ages (1)         | Disjoint 5-year groups `<1`,`1-4`,`5-9`…`95+` (21) |
| Sex             | Male, Female         | unchanged                                        |
| Cause           | Level 3 (~140)       | unchanged                                        |
| Measure/Metric  | Deaths / Number      | unchanged                                        |

Row math: 204 × 2 × 21 × ~140 ≈ **1.2M rows** against the 100k cap → **13+ requests**, chunked
by location group across days. Prefer this over dropping to level 2 (~22 causes, ~190k rows,
2 requests): level-2 labels read "Woman 78, neoplasms – Spain" instead of "breast cancer", and
specificity is the point of the feed. A 2-request level-2 variant that keeps specific labels
would need a hierarchical sampler (country level-2 shares × global within-level-2 level-3
composition) — no longer the zero-code option.

**Traps, in order:**

1. **Land the `coverage` guard first.** `pickCause` (persona.ts:224) never reads `coverage`, so
   today's data always beats the age-aware fallback table at persona.ts:88. Fix that first or
   you cannot distinguish "the new export worked" from "the guard was never there" — and if the
   export is delayed or partial, the fallback table is strictly better than what ships now.
2. **Export only the disjoint 5-year set.** `build-causes.ts:183` diverts all-ages rows away
   from the *global* accumulator, but the country loop at :187 has **no `isAllAges` guard** — a
   mixed export silently double-counts every country while `coverage.age` still reports
   `"age_bands"` (since `allAgesRows !== used`). Same hazard for GBD aggregate bands
   (`Under 5`, `5-14`, `50-69`, `70+`): `bandsOf` resolves them to one wrong band instead of
   rejecting them. Add the guard, or guarantee the selection.
3. **Keep the `Global` location out of the country file**, or the fallback table absorbs the
   country sum on top of itself.
4. **Measure the payload.** 5.9 KB → est. 400–700 KB (204 × 2 sexes × 9 bands × 9 entries),
   fetched by `initPersona()` on every globe load. Not fatal beside the committed 1.7 MB
   `rate-grid.json`, but ~100× on this file; repetitive integer JSON should gzip to ~150 KB.
   Lowering `TOP` to 6 is the cheap lever.
5. **Modelled, not observed** for non-VR countries — wide uncertainty intervals presented with
   false precision in a one-line persona. Already accepted upstream (World Bank CDR is itself a
   UN WPP estimate); worth a line of roadmap copy rather than a blocker.
6. **The joint stays inconsistent** — age/sex from UN WPP, cause from GBD, disagreeing on
   per-country totals. Fine for a feed, unavoidable without one source for both.
7. **Licence:** GBD free-use agreement, non-commercial. Already accepted in
   `data/subnational-cdr.json` → `meta.license`.

Context: this sits at **#5** on the persona-realism priority ladder (global reach first, then
sourcing cost, then implementation cost). WHO Mortality Database (#4) is one free quota-free
bulk download covering cause × age × sex for ~120 vital-registration countries, so it should
land first; GBD's unique value is the ~80 countries **without** vital registration — Nigeria,
Ethiopia, DRC, Pakistan, Bangladesh — which is exactly where the current global table is most
wrong. The two are complements, not alternatives.

Relates to phase `01-cause-fidelity-and-methodology`.
