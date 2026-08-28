---
phase: 6
plan: 06-01
subsystem: data
tags:
  - region-keys
  - validation
  - eurostat
  - audit-closure
  - planning-records
requirements-completed: [PERS-01, PERS-02, STORY-01, STORY-02]
requirements-partial: [PERS-03, REAL-01, REAL-03, STORY-03]

requires:
  - phase: 04-03
    provides: data/subnational-age-sex.json, whose nuts2 keys for GBR/ITA/POL are the key space that had to be expressible
  - phase: 04-05
    provides: scripts/build-region-keys.ts and data/region-keys.json, where the layer preference was wrong
  - phase: 04-06
    provides: data/eurostat-regional.json, the artifact with no reader
  - phase: 04-09
    provides: the three-tier resolver and its validation harness
provides:
  - A region-key layer preference derived from every consumer, not one, so the UK's GBD pyramids reach the reader
  - Two guards against key-space divergence — a build-time throw and a committed-data test, both shown to fail without the fix
  - data/eurostat-regional.json's ageSex layer as the European validation set, 271 NUTS-2 regions across 34 countries
  - 04-VERIFICATION.md and 05-VERIFICATION.md, and requirements-completed on all 12 v2.0 SUMMARYs
  - A v2.0 milestone audit that passes on measurement, with five warnings carried forward with a stated reason each
affects: [anyone rebuilding region-keys.json or age-sex-cells.json; anyone reading the v2.0 records]

tech-stack:
  added: []
  patterns:
    - "A derived set that must serve several consumers is built from all of them and asserted, not mirrored from the first one that happened to need it — the original comment stated an intent that was true of one consumer and false of the other, which is how the bug hid"
    - "A guard is verified by reverting the fix and watching it fail; a guard that has never failed on the bug it was written for is not yet a guard"
    - "A fix to a quantised pipeline is verified at the quantised output (classId), not at the join it repairs — 'the keys now match' and 'the reader sees something different' are different claims"
    - "A SUMMARY is a record: a claim the tree contradicts is amended in place with the superseded text still legible and the correction dated, not rewritten to look right"

key-files:
  modified:
    - scripts/build-region-keys.ts
    - scripts/build-age-sex-cells.ts
    - data/region-keys.json
    - data/age-sex-cells.json
    - app/roadmap/charts/PersonaDemo.tsx
  created:
    - scripts/build-age-sex-cells.test.ts
    - .planning/phases/04-persona-realism-ladder/04-VERIFICATION.md
    - .planning/phases/05-story-reading-experience/05-VERIFICATION.md
---

# Plan 06-01 Summary: Close the v2.0 audit gaps

## One-liner

The UK's 41 GBD region keys joined nothing, `data/eurostat-regional.json` had no reader, and neither
v2.0 phase had a verification record — all three closed, with the two blockers guarded by tests that
were watched to fail before they were trusted to pass.

## Completed Work

- **The key space.** `build-region-keys.ts`'s NUTS-preferring country set is now the union of both
  consumers of `region-keys.json` — `subnational-cdr.json`'s `nutsCountriesIso3` *and* every country
  `subnational-age-sex.json` emits under `nuts2`. Mixing layers within one country now throws,
  because one key per cell could not serve it. **217 of 226** assigned UK cells resolve tier 0
  (99.96% of UK expected death weight, previously 0%); tier-0 share of world expected deaths rose
  43.51% → 44.60%.
- **The fix survives quantisation.** The UK's cells now span 2 archetypes 11.08pp apart where all
  227 previously shared one, so the repair reaches the shipped `classId` array and not just the join.
- **Two guards.** The build throws when a whole country's tier-1 key set joins nothing (and warns per
  unmatched key, since single misses are legitimate at 0.5°), recording `meta.tier1Join.byCountry`;
  `scripts/build-age-sex-cells.test.ts` pins the invariant against the committed files.
- **Eurostat is a validation set.** `scoreAgainstObserved()` resolves each source in its own key
  space, so the `ageSex` layer scores 271 NUTS-2 regions across 34 countries: 3.79pp mean error
  against 4.02pp flat-national, beating the baseline in 15 of 34. ITA 1.89pp vs 3.05pp and POL
  1.51pp vs 3.62pp are the tier-0 cases, and they are the point.
- **The records.** Both v2.0 phases have a VERIFICATION.md written against the ROADMAP's own success
  criteria with re-measured evidence; all 12 v2.0 SUMMARYs carry `requirements-completed`; the four
  stale traceability rows are corrected; ROADMAP and STATE counts match the phase directories.
- **Three false claims amended**, each dated and attributed: 04-04's "the UK … use real GBD-modelled
  regional weights", 04-06's "It is a build-time validation input", and `PersonaDemo.tsx`'s comment
  claiming parity with the globe's distribution.

## Task Commits

1. **Tasks 1–3: key space, diagnostic, rebuild** — `a583017d` (fix) — `scripts/build-region-keys.ts`,
   `scripts/build-age-sex-cells.ts`, `scripts/build-age-sex-cells.test.ts`, `data/region-keys.json`,
   `data/age-sex-cells.json`
2. **Task 4: Eurostat as the European validation set** — `f513a42e` (feat) —
   `scripts/build-age-sex-cells.ts`, `data/age-sex-cells.json`
3. **Tasks 6–7: SUMMARY corrections and both verifications** — `8b62b038` (docs)
4. **Task 8: traceability** — `2583835d` (docs)
5. **Task 9: re-audit** — this commit — `.planning/v2.0-MILESTONE-AUDIT.md`,
   `app/roadmap/charts/PersonaDemo.tsx`

## Deviations from the plan

- **Task 1's acceptance criterion said all 41 GBR keys would join; 33 do.** Eight — `UKD3`, `UKE3`,
  `UKG3`, `UKI3`–`UKI7` (Greater Manchester, South Yorkshire, West Midlands, the inner-London
  subdivisions) — win no 0.5° cell because they are smaller than one. This is the resolution limit
  the plan itself anticipated for individual keys, so the criterion was mis-set rather than the fix
  incomplete: IND loses 1 key the same way, PHL 5, ETH 3. What matters is the weight, and it is
  99.96%. The criterion should have been stated in death weight from the start.
- **Task 4's criterion asked for ≥ 280 of 291 Eurostat regions; 271 resolve.** The 20 misses are
  enumerated in the audit — city-states and enclaves (AT13 Vienna, BE10 Brussels, CZ01 Prague, DE30
  Berlin, DE50 Bremen, DE60 Hamburg, HU11 Budapest, HR05 Zagreb, RO32 Bucharest, LI00, ES63/ES64) and
  the five French overseas departments (FRY1–FRY5) plus NO0B Svalbard. Same resolution and
  out-of-Europe limits, not a join failure. Reported rather than smoothed.
- **Task 5's checkpoint did not fire.** Its two trigger conditions were the UK collapsing to a single
  archetype (it spans 2, 11.08pp apart) and tier 0 losing to the national baseline on ITA/POL (it
  wins on both by 1.16pp and 2.11pp). `ARCHETYPE_COUNT` is unchanged at 20 and no decision was
  needed.
- **`app/roadmap/charts/PersonaDemo.tsx` was edited**, which `files_modified` did not list. Its
  comment claimed the demo reads "the same distribution the globe samples from", which stopped being
  true at 04-04 and 04-07 — the audit's one broken flow. Correcting a false claim in a comment sits
  with tasks 6's corrections, and leaving it while writing an audit that flags it would have been
  worse than the deviation.
- **PERS-03 and STORY-03 were downgraded** from "complete" to "partial" in the traceability table.
  Not planned, but writing the verification records forced the measurement: 34 of 90 cause labels
  resolve no seasonal curve, and STORY-03's white ink is below AA on 3 of 5 fills by decision.

## Verification

- `pnpm run typecheck`, `pnpm run lint`, `pnpm test` (20 files / 157 tests, up from 19 / 151) green at every commit.
- `pnpm run build:region-keys -- --force`: 59,328/59,954 cells, 2,709 regions, **0 rollup
  mismatches**, 0.081% unassigned — all unchanged from 04-05 except the UK's layer.
- `pnpm run build:age-sex-cells -- --force`: rebuilt twice with identical md5, so the output is
  deterministic. Brazil 3.88/11.24, Canada 9.86/10.7, Australia 0.55/1.82 and Mexico 3.25/8.05 are
  byte-identical to before, and so are `classId`, `tier`, `archetypes` and the tier-2 estimator
  decision — the Eurostat set is a report and provably changes nothing that ships.
- Both guards were run against the pre-fix `region-keys.json`: the test failed on 2 assertions
  (`expected [ 'GBR' ] to deeply equal []`, and `cellPct: 0`), and the build threw
  `Tier-1 key space is broken: not one region key joins any grid cell for GBR (41 keys)`.

## Notes for whoever picks this up

- **The bug was in a comment as much as in the code.** `build-region-keys.ts` said "Mirror how
  subnational-cdr.json chooses a layer per country, so the two key spaces stay the same key space" —
  a true statement about one consumer, written before the second consumer existed, and never
  revisited when it did. The replacement states the invariant instead of the mechanism.
- **Eurostat cannot validate the UK.** It has zero `UK*` rows; the UK left Eurostat. ITA and POL
  test the same tier-0 mechanism, which is as close as this data gets.
- **`meta.tier1Join.byCountry` is the thing to read** after any change to either builder. Nine
  countries currently have unmatched keys, all for the 0.5° reason; a country dropping to 0 is the
  failure mode, and that now throws.
- The `weekly` and `causes` layers of `eurostat-regional.json` still have no consumer. `weekly` uses
  its own 8-band set and `causes` is an under-65/65-plus split of standardised *rates* — neither
  answers the question the age/sex harness asks, so wiring them needs a purpose first.
