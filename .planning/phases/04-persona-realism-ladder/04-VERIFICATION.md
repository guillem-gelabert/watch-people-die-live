---
phase: 4
status: passed_with_gaps
verified_at: 2026-08-28
verified_by: 06-01
plans:
  - 04-01
  - 04-02
  - 04-03
  - 04-04
  - 04-05
  - 04-06
  - 04-07
  - 04-08
  - 04-09
---

# Phase 4 Verification: Persona Realism Ladder

## Status

passed_with_gaps

Backfilled by plan 06-01 after the v2.0 milestone audit found the phase had no verification record
— only `04-UAT.md` (`status: complete`, `phase_complete: false`), which covered 6 of the 9 plans.
Two defects the audit found are fixed by 06-01 and re-measured here; the remaining gaps are named
below rather than folded into a pass.

Every number in this table was measured on 2026-08-28 against the committed data files, not carried
over from the plans' own SUMMARYs — which is the point, since one of those SUMMARYs recorded a
claim the shipped tree contradicted.

## Criteria

| Criterion                                                                                                                                   | Result       | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. An infant persona never draws an adult-only cause; the `coverage` flag written by the builder is read by the consumer.                     | passed       | `data/causes.json` declares `coverage: {location: "country", age: "age_bands", sex: "male_female"}`; `app/globe/persona.ts`'s `pickCause` guard reads it and falls through to the age-gated fallback table when `age !== "age_bands"`. `app/globe/persona.test.ts` — 15 tests, passing — asserts infant personas draw perinatal causes and never Alzheimer's/IHD/breast or lung cancer, and was shown to fail with the guard removed. |
| 2. Cause distributions are country-specific for all 183 countries WHO GHE covers, including those without vital registration.                 | passed       | `data/causes.json`: 90 leaf causes, **183** country entries, `coverage.location: "country"`. Nigeria, Ethiopia, DR Congo and India are present — the four the WHO Mortality Database has zero rows for, which is why 04-02/04-03 were re-sourced onto WHO Global Health Estimates. Residual folded to `other causes` is 1.46%.                                                                                                       |
| 3. Age/sex distributions resolve per grid cell rather than per country, validated against observed regional counts for at least four countries. | passed       | `data/age-sex-cells.json`: 20 archetypes + a `classId` and `tier` per each of 59,954 cells. Tier mix by expected deaths: regional 44.60%, derived 51.84%, national 3.56%. Validated against **four** national-statistics sources — Brazil 3.88pp vs 11.24pp flat-national, Mexico 3.25pp vs 8.05pp, Canada 9.86pp vs 10.7pp, Australia 0.55pp vs 1.82pp — and, since 06-01, against **34 more** via Eurostat (271 NUTS-2 regions, 3.79pp vs 4.02pp). |
| 4. Persona composition shifts with the season the globe is already simulating.                                                                | **partial**  | `makePersona()` takes the simulated death's date and reweights both age and cause by `data/seasonal-composition.json`'s mean-1 curves through `lib/seasonal-composition.ts`'s donor cascade; southern-hemisphere re-phasing is real (Australia band 8 ×0.903 in January against ×1.246 in July, measured live). But only **56 of 90** cause labels resolve a curve — see Gaps.                                                        |
| 5. Estimated inputs are labelled as estimates and excluded from validation statistics.                                                        | passed       | `data/subnational-age-sex.json` carries `measurement: "gbd-modeled"` on every one of its 474 rows, with the note that they must be excluded from validation statistics; the validation harness scores the resolver *against* observed registrations (04-08's four countries, Eurostat's 34) and never treats a GBD row as ground truth. `data/seasonal-composition.json` carries its own `meta.measurement` and `meta.transfer`.       |

## Fixed by 06-01 (were the audit's two blockers)

- **INT-01 — the UK's tier-1 join.** 0 of 41 GBD region keys joined any grid cell, so all 226
  assigned UK cells used a derived pyramid instead of the measured one, at 1.09% of world expected
  deaths and with no diagnostic. Now 217 of 226 resolve tier 0 (99.96% of UK expected death weight);
  tier-0 share of world deaths rose 43.51% → 44.60%; the UK's cells span two archetypes 11.08pp
  apart where they previously shared one. Guarded by a build-time throw and by
  `scripts/build-age-sex-cells.test.ts`, both shown to fail with the fix reverted.
- **INT-02 — `data/eurostat-regional.json` had no reader.** Its `ageSex` layer is now the European
  validation set 04-06 said it was, scoring 271 NUTS-2 regions in 34 countries. The two tier-0
  countries it reaches confirm the mechanism independently: ITA 1.89pp vs 3.05pp flat-national, POL
  1.51pp vs 3.62pp.

## Commands Run

```bash
pnpm run build:region-keys -- --force      # 59,328/59,954 assigned, 2,709 regions, 0 rollup mismatches, 0.081% unassigned
pnpm run build:age-sex-cells -- --force    # tier mix + all five validation reports
pnpm exec vitest run app/globe/persona.test.ts scripts/build-age-sex-cells.test.ts
pnpm run typecheck && pnpm run lint && pnpm test    # 20 files / 157 tests
```

## Human Verification

None required for criteria 1–3 and 5; all are measurable from the committed artifacts. Criterion 4's
*visible* effect on the globe (a January feed skewing older and more respiratory in the northern
hemisphere) was observed in 04-07's own session and is not re-measured here — the curve arithmetic
is, above.

## Gaps

- **Criterion 4, cause coverage: 34 of 90 labels resolve no seasonal curve** and are reweighted by
  1.0. The list includes `other causes` — 16.6–52.1% of adult band cause weight, median 35.6% —
  plus malaria, dengue, meningitis, covid-19, measles, a diarrhoeal disease and 28 others. Age
  reweighting covers every band, so the seasonal signal is real; cause reweighting reaches a
  minority of cause mass.

  **Split into two different things on 2026-08-28.** For `other causes`, aseasonal is now a
  *decided* answer rather than a gap: the residual is a mixture of unrelated deaths with no single
  ICD-10 chapter, and lending it the country's all-cause curve would assert a month shape nothing
  has measured for that mixture. Documented at all four sites where the assumption is visible —
  `pipeline/seasonal_composition.py`'s docstring, the shipped `meta.causeLabelCoverage`,
  `lib/seasonal-composition.ts`'s `causeMultiplier` contract, `app/globe/persona.ts` — and disclosed
  to the reader in the `who` chapter of all three story files. The other 33 remain real tech debt,
  and the diagnosis is narrower than it looked: `chapter_of_cause_label()` derives its map from
  Eurostat's *European* cause list, so it structurally cannot name tropical causes. Chapter I is
  already measured from the Brazilian and Mexican microdata, so those 33 are a mapping gap, not a
  measurement gap. `covid-19` is the exception — ICD-10 U07.1 sits outside the 21 chapters, and the
  tensor excludes 2020–2022 anyway.
- **20-archetype quantisation flattens 19.4% of expected deaths to one pyramid per country** (audit
  INT-04, re-measured 2026-08-28 after 06-01: 164 of 226 grid countries resolve exactly one
  archetype across all their cells, down from 168 / 21.39%). Germany is still 202 cells → 1; among
  the tier-0 countries Ethiopia, Japan and South Africa still collapse, discarding *measured*
  regional variation. The UK now escapes it (2 archetypes), which was the criterion that mattered
  for 06-01's own fix. `ARCHETYPE_COUNT` was deliberately left at 20: raising it is a
  payload-versus-fidelity decision that belongs to whoever wants the fidelity.
- **No runtime alignment guard** between `rate-grid.json` and `age-sex-cells.json` (audit INT-05).
  `persona.ts` indexes `CELLS.classId[cellIndex]` with no length check, and neither bake is in
  `predev`/`prebuild`, so rebuilding the grid alone would silently give every persona another
  region's pyramid. The build scripts assert alignment; the runtime does not.
- **The coverage guard is not mirrored on the story side** (audit INT-06). `usePersonaTables.ts`
  declares its cause table with no `coverage` field, so a future age-flat export would be rejected
  by the globe and still rendered by `PersonaDemo`/`AgeMix` — the exact failure 04-01 exists to
  prevent, half-fixed.
- **`data/region-keys.json` is synced to `public/` with no runtime fetcher** (audit INT-03): 392 KB
  of dead browser payload. Its three real consumers read it off disk at build time.
- **`m49ForIso3` is duplicated byte-identically** at `lib/spatial-seasonality.ts:120` and
  `lib/fallback-proxy-assignment.ts:81` (audit INT-07), free to diverge.
- **`pipeline/` is still covered by no lint script.** `ruff check pipeline/` reports a pre-existing
  `B905` at `pipeline/geo.py:57`, untouched throughout the phase.
- **`gbd-export-spec.md` records `download.php` throttling after ~20 requests as unresolved.** The
  subnational pull succeeded as one ~31,800-row query, so nothing in this phase is blocked by it,
  but a future export at that scale would be.
