---
phase: 4
plan: 04-06
title: Add Eurostat regional age/sex and cause tables
type: implementation
wave: 4
depends_on:
  - 04-02
  - 04-05
  - 04-08
files_modified:
  - pipeline/sources/eurostat.py
  - pipeline/sources.lock.json
  - data/eurostat-regional.json
autonomous: true
requirements:
  - PERS-01
  - PERS-02
---

<objective>
Three Eurostat tables give observed regional persona inputs across ~35 countries in one API call each, joining onto the 287 NUTS-2 keys already committed: `demo_r_magec` (deaths by region x age x sex), `demo_r_mweek3` (weekly by region x age x sex) and `hlth_cd_asdr2` (causes by region x age x sex).
</objective>

<tasks>

1. **Pin the NUTS revision**
   - type: implementation
   - files: `pipeline/sources/eurostat.py`
   - action: Pull each table at the NUTS revision matching the committed GISCO geometry and the existing `demo_r_gind3` pull behind `data/subnational-cdr.json`, or a slice of regions will silently fail to join.
   - verify: Assert every returned region code resolves to a committed NUTS-2 key; fail on unmatched codes.
   - acceptance_criteria:
     - Zero unmatched region codes, or each is explicitly listed and justified.
     - The revision is recorded in the output `meta`.

2. **Rates average, counts sum**
   - type: implementation
   - files: `pipeline/sources/eurostat.py`
   - action: `hlth_cd_asdr2` is a standardised death rate, so it is intensive and must be averaged rather than summed when aggregating — the same distinction the Russia RusSTMF handling already makes.
   - verify: Unit test on a two-region fixture asserting rate averaging and count summing.
   - acceptance_criteria:
     - Intensive and extensive quantities are aggregated differently and the choice is documented.

3. **Reuse the existing crosswalks**
   - type: implementation
   - files: `pipeline/sources/eurostat.py`
   - action: Fold ages into the shared nine-band `BANDS` array and map Eurostat's cause groupings onto the label vocabulary 04-02 emits, reusing its normalisation map rather than writing a second one. (04-02 no longer builds an ICD-10 crosswalk — WHO's Global Health Estimates ships cause labels directly — so what there is to reuse is the WHO-label-to-project-wording map, and Eurostat's ICD-10-based groupings need their own mapping onto that same vocabulary.)
   - verify: Assert emitted labels are a subset of the existing vocabulary.
   - acceptance_criteria:
     - No second, divergent cause vocabulary exists.

</tasks>

<verification>

- `pnpm run lint:notebooks`
- Join check against the 287 committed NUTS-2 keys.
- Aggregation unit test for rate vs count.
- Cross-check derived pyramids from 04-04 against Eurostat observed values.

</verification>

<success_criteria>

- 287 NUTS-2 regions have observed age x sex and cause distributions.
- Region codes join cleanly to committed geometry.
- The result is usable as a second validation set for 04-04.

</success_criteria>

<notes>
Declare exact new filenames rather than the `pipeline/sources/` directory, so this plan does not falsely collide with 04-08 under the pairwise overlap check.
</notes>
