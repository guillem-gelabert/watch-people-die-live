---
phase: 4
plan: 04-08
title: Unfilter age/sex in pipelines that already download it
type: implementation
wave: 2
depends_on: []
files_modified:
  - pipeline/sources/canada.py
  - pipeline/sources/brazil.py
  - pipeline/sources/mexico.py
  - pipeline/sources/australia.py
  - pipeline/sources.lock.json
autonomous: true
requirements:
  - PERS-02
---

<objective>
Four seasonality pipelines fetch files carrying age, sex and (Brazil, Mexico) cause, then discard those columns at parse time. Widen the reads so the extra dimensions survive — these five countries are the validation set for the derived regional pyramids in 04-04.
</objective>

<tasks>

1. **Canada keeps its age and sex breakdown**
   - type: implementation
   - files: `pipeline/sources/canada.py`
   - action: Drop the `"all ages"` / `"Both sexes"` filter that immediately discards the `Age at time of death` and `Sex` columns already loaded from StatCan 13-10-0768, and emit regional age x sex counts alongside the existing weekly totals.
   - verify: Run the Canada source and compare the age x sex sum against the existing all-ages total per province-week.
   - acceptance_criteria:
     - Age x sex rows sum to the previously emitted totals.
     - The existing seasonality curve output is unchanged.

2. **Brazil and Mexico keep age, sex and cause**
   - type: implementation
   - files: `pipeline/sources/brazil.py`, `pipeline/sources/mexico.py`
   - action: Widen `usecols` beyond the date/geography columns to include the age, sex and ICD-10 cause fields present in DATASUS SIM and registro_defunciones microdata.
   - verify: Row counts and totals match the current output; new columns are non-null for the expected share of rows.
   - acceptance_criteria:
     - Existing monthly totals per region are bit-identical.
     - Cause, age and sex are available for downstream use.
     - `pipeline/sources.lock.json` provenance still validates.

3. **Australia keeps its breakdown**
   - type: implementation
   - files: `pipeline/sources/australia.py`
   - action: Request the age and sex dimensions the ABS `PROV_MORTALITY_WK` dataflow publishes rather than the totals-only slice.
   - verify: Compare against the current totals per state-week.
   - acceptance_criteria:
     - Totals reconcile.
     - The dataflow query stays within ABS API limits.

</tasks>

<verification>

- `pnpm run lint:notebooks`
- Run each touched source and reconcile totals against current output.
- Confirm `pipeline/sources.lock.json` hashes still match.

</verification>

<success_criteria>

- Regional age x sex counts are available for CAN, AUS, MEX and BRA.
- Cause is available for MEX and BRA.
- No existing seasonality output changes.

</success_criteria>
