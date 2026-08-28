---
phase: 6
plan: 06-01
title: Close the v2.0 audit gaps — UK tier-1 join, the dead Eurostat artifact, and the verification backfill
type: implementation
wave: 1
depends_on: []
files_modified:
  - scripts/build-region-keys.ts
  - scripts/build-age-sex-cells.ts
  - scripts/build-age-sex-cells.test.ts
  - data/region-keys.json
  - data/age-sex-cells.json
  - .planning/phases/04-persona-realism-ladder/04-01-SUMMARY.md
  - .planning/phases/04-persona-realism-ladder/04-02-SUMMARY.md
  - .planning/phases/04-persona-realism-ladder/04-03-SUMMARY.md
  - .planning/phases/04-persona-realism-ladder/04-04-SUMMARY.md
  - .planning/phases/04-persona-realism-ladder/04-05-SUMMARY.md
  - .planning/phases/04-persona-realism-ladder/04-06-SUMMARY.md
  - .planning/phases/04-persona-realism-ladder/04-08-SUMMARY.md
  - .planning/phases/04-persona-realism-ladder/04-VERIFICATION.md
  - .planning/phases/05-story-reading-experience/05-01-SUMMARY.md
  - .planning/phases/05-story-reading-experience/05-02-SUMMARY.md
  - .planning/phases/05-story-reading-experience/05-03-SUMMARY.md
  - .planning/phases/05-story-reading-experience/05-VERIFICATION.md
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
  - .planning/STATE.md
  - .planning/v2.0-MILESTONE-AUDIT.md
autonomous: false
requirements:
  - PERS-01
  - PERS-02
  - PERS-03
  - REAL-01
  - REAL-03
  - STORY-01
  - STORY-02
  - STORY-03
---

<objective>
`.planning/v2.0-MILESTONE-AUDIT.md` returned `gaps_found` on three things, and this plan closes all
three in one pass:

1. **INT-01 (blocker, functional).** 04-03 emits the UK's 41 regions as `nuts2:UKC1…`; 04-05 keys
   every UK cell `adm1:GBR-nnnn`, because it takes its NUTS-preferring country set from
   `subnational-cdr.json`'s `meta.nutsCountriesIso3` and the UK stopped reporting to Eurostat.
   **0 of 41 GBR tier-1 keys join**, so all 226 assigned UK cells silently use a WorldPop-derived
   pyramid instead of the GBD-measured one — 1.09% of world expected deaths — and nothing anywhere
   says so. `04-04-SUMMARY.md:81` records the opposite as verified.
2. **INT-02 (blocker, dead artifact).** `data/eurostat-regional.json` is 1.77 MB, committed, and
   read by nothing. Its `ageSex` layer is 4,896 rows of *observed* NUTS-2 deaths over the exact nine
   shared bands, for 291 regions in 35 countries — precisely the validation set 04-06 said it was,
   for a harness that currently validates against four non-European countries only.
3. **The paperwork.** Neither v2.0 phase has a `VERIFICATION.md`, 9 of 12 SUMMARYs omit
   `requirements-completed`, and four `REQUIREMENTS.md` traceability rows still read "Not started"
   for plans that are complete. Under the audit's own status matrix that scores 0 of 8 requirements
   satisfied even where the integration checker traced them wired.

**Definition of done:** the audit re-runs and returns `passed`, with the UK's tier-0 pyramids
reaching the shipped `classId` array (not merely joining), the Eurostat set scoring real European
regions inside `build:age-sex-cells`, and every claim in the SUMMARYs matching the shipped tree.

**Explicitly out of scope:** INT-03 through INT-07 (all `warning`). They are recorded as accepted
tech debt in the audit and stay there — except where task 5's measurement makes INT-04's archetype
quantisation a blocker for task 3's own acceptance, which is why that is a checkpoint and not a
silent decision.
</objective>

<notes>
**Verified before planning, on the shipped files (2026-08-28):**

- `data/nuts2-20m.json` **does** contain all 41 UK NUTS-2 polygons (`CNTR_CODE: "UK"`, 334 features
  total), and `loadRegions()` already maps `UK → GB → GBR` at `build-region-keys.ts:115-117`. So the
  fix is a set membership change, not new geometry.
- `subnational-age-sex.json` emits `nuts2` for exactly three countries — GBR (41), ITA (21), POL (17)
  — and `adm1` for the other twelve. No country appears under both layers, so a per-country layer
  preference is well defined and one key per cell stays sufficient.
- `subnational-cdr.json` has 40 GBR regions under `adm1`. Switching GBR's region key to `nuts2`
  therefore drops GBR from the CDR-gap proxy's *calibration sample* and from its tier-2 coverage.
  This is acceptable and must be stated, not hidden: tier 0 wins before tier 2 for every UK cell
  after the fix, so the CDR-gap value for GBR would never have been used anyway. Measure the effect
  on the fitted shift rather than assuming it is nil.
- `eurostat-regional.json`'s `ageSex.bands` is byte-identical to `BANDS` in
  `build-age-sex-cells.ts:65`. No band folding is needed for that layer.
- **The Eurostat set has zero UK keys** (35 countries, no `UK*`) — the UK left Eurostat. So task 4
  cannot validate the UK fix. What it *can* do is score ITA and POL, the two other tier-0 NUTS-2
  countries, which tests the same join mechanism the UK fix restores. Do not claim otherwise.
- `scoreAgainstObserved()` hardcodes its key resolution to
  `isoToAdm1.get(isoRegion) → 'adm1:' + adm1` (`:504-505`). That is the single line standing between
  the harness and a NUTS-2 source.
- `ARCHETYPE_COUNT = 20` (`:79`), k-means over distinct pyramids weighted by expected deaths,
  globally. INT-04 measured the UK's 227 cells collapsing to 1 archetype *before* this fix. A tier-0
  UK that still collapses to 1 archetype ships nothing new, which is why task 3 verifies at
  `classId` level.
</notes>

<tasks>

1. **Make the region-key layer preference cover every tier-1 key space**
   - type: implementation
   - files: `scripts/build-region-keys.ts`
   - action: Derive the NUTS-preferring country set as the union of `subnational-cdr.json`'s
     `meta.nutsCountriesIso3` and every country that `data/subnational-age-sex.json` emits under
     `geo: "nuts2"`. The existing comment ("Mirror how subnational-cdr.json chooses a layer per
     country, so the two key spaces stay the same key space") states an intent that was true of one
     consumer and false of the other — replace it with the actual rule: *region-keys must be able to
     express every key space any consumer joins against*. Assert no country appears under both
     `adm1` and `nuts2` in `subnational-age-sex.json` and fail the build if one ever does, since a
     single key per cell could not then serve it. Record the union and its two sources in output
     `meta`.
   - verify: `pnpm exec tsx scripts/build-region-keys.ts --force`, then assert on the rebuilt
     `data/region-keys.json`: all 41 GBR keys present as `nuts2:UK*`, ITA and POL unchanged, the
     0.081% unassigned share and the 0 rollup mismatches from 04-05 both hold, and cell count still
     59,954.
   - acceptance_criteria:
     - Every `geo:key` in `subnational-age-sex.json` for a nuts2 country exists in `region-keys.json`.
     - Rollup to country m49 still reproduces the grid's own assignment for every cell (0 mismatches).
     - Unassigned share does not grow beyond 04-05's recorded 0.081%.
     - `meta` names both inputs to the preferring set, so the next reader cannot repeat the mistake.

2. **Add the diagnostic whose absence let INT-01 ship**
   - type: implementation
   - files: `scripts/build-age-sex-cells.ts`, `scripts/build-age-sex-cells.test.ts`
   - action: After `tier1ByKey` is built (`:230-231`) and cells are resolved, report every tier-1 key
     that won no cell, grouped by country, with the share of `subnational-age-sex.json`'s own death
     weight it represents. **Throw** when a country's *entire* tier-1 key set joins nothing — that is
     never a data quirk, it is always a key-space bug, and it is exactly the failure that shipped.
     Warn (do not throw) on individual unmatched keys, which are legitimately possible for a small
     region no 0.5° cell centre lands in. Then add `scripts/build-age-sex-cells.test.ts` (precedent:
     `scripts/build-seasonality-validation.test.ts`) pinning the invariant against the *committed*
     files: for every country in `subnational-age-sex.json`, at least one of its keys appears in
     `region-keys.json`, and for the three nuts2 countries, all of them do.
   - verify: `pnpm test`; then temporarily revert task 1 and confirm the new test fails and the build
     throws for GBR — a guard that does not fail on the bug it was written for is not a guard.
   - acceptance_criteria:
     - The build throws, naming the country, when a whole tier-1 key set joins nothing.
     - The test fails with task 1 reverted and passes with it applied (both states recorded).
     - Per-country unmatched-key counts appear in the build log and in `age-sex-cells.json` `meta`.

3. **Rebuild `age-sex-cells.json` and verify the UK reaches the reader**
   - type: implementation
   - files: `data/age-sex-cells.json`
   - action: Rebuild with `--force`. Verify the fix at three depths, because only the third is what a
     reader sees: (a) 41 of 41 GBR keys join tier 1; (b) all 226 assigned UK cells resolve `tier = 0`;
     (c) the UK's cells span **more than one** `classId` in the shipped archetype array, and the
     archetypes they point at differ materially from the WorldPop-derived ones they used before.
     Report the tier mix by expected deaths before and after, and the change in the CDR-gap proxy's
     fitted shift now that GBR has left its calibration sample.
   - verify: A node one-liner over the rebuilt file for each of (a), (b), (c), with the numbers
     recorded in the SUMMARY rather than asserted in prose.
   - acceptance_criteria:
     - Tier-0 share of world expected deaths rises by approximately the UK's 1.09%.
     - UK cells carry ≥ 2 distinct `classId` values, or task 5's checkpoint is triggered.
     - `classId`/`tier` arrays are still length 59,954 and the four-file alignment assertion passes.
     - The CDR-gap calibration change is measured and reported, not assumed to be zero.

4. **Wire `eurostat-regional.json` in as the European validation set**
   - type: implementation
   - files: `scripts/build-age-sex-cells.ts`
   - action: Give `scoreAgainstObserved()` a per-source key resolver instead of the hardcoded
     `isoToAdm1` lookup: a `nuts2` source resolves `nuts2:${isoRegion}` directly, an `adm1` source
     keeps today's ISO-3166-2 → `adm1_code` path. Then adapt `eurostat-regional.json`'s `ageSex`
     layer into the existing `ObservedData` shape — one `ObservedSource` per country (35 of them),
     `geo: "nuts2"`, `bands` = the nine shared bands, rows expanded from
     `[keyIndex, band, sexIndex, deaths]`. Only the `ageSex` layer is in scope; `weekly` and `causes`
     have their own band sets and no consumer asked for them here. Keep the Eurostat rows out of any
     statistic that would treat a GBD-modelled pyramid as observed truth — they are the observed side
     of the comparison, which is the whole point.
   - verify: `pnpm exec tsx scripts/build-age-sex-cells.ts --force`. Report, per country: regions
     compared, regions missing a key, tier mix, mean TVD error, and the national-baseline TVD it must
     beat. ITA and POL are the two tier-0 countries in the set — state whether tier 0 beats the
     national baseline there, in numbers.
   - acceptance_criteria:
     - `data/eurostat-regional.json` has at least one real reader, and the file's existence changes a
       reported number.
     - ≥ 280 of the 291 Eurostat regions resolve a region key; every miss is listed.
     - The four existing sources (CAN, AUS, MEX, BRA) report the same numbers as before this task —
       the new source must not perturb the old scores.
     - Whether tier 0 beats baseline on ITA/POL is stated as a measurement, with the losing case
       reported as a finding rather than smoothed over.

5. **CHECKPOINT — the archetype budget, only if the UK fix does not survive quantisation**
   - type: decision
   - files: `scripts/build-age-sex-cells.ts`
   - action: If task 3(c) showed the UK's cells collapsing to a single `classId`, or task 4 showed
     tier 0 losing to the national baseline on ITA/POL, stop and report. The fix would then be real
     at the join and invisible at runtime, and choosing between "raise `ARCHETYPE_COUNT`",
     "stratify k-means so each tier-0 country keeps its own centres", and "accept and record" is a
     payload-versus-fidelity trade-off that is not mine to make silently. Present measured options:
     for each candidate K, the resulting archetype count, file size, and how many of the 15 tier-0
     countries keep more than one archetype. If neither condition triggered, note that explicitly and
     continue without stopping.
   - verify: The trigger condition is evaluated from task 3 and 4 output, not from expectation.
   - acceptance_criteria:
     - The checkpoint either fires with a measured options table, or is recorded as not triggered
       with the numbers that cleared it.
     - No change to `ARCHETYPE_COUNT` is made without an explicit decision.

6. **Correct the two SUMMARY claims the audit found false**
   - type: implementation
   - files: `.planning/phases/04-persona-realism-ladder/04-04-SUMMARY.md`,
     `.planning/phases/04-persona-realism-ladder/04-06-SUMMARY.md`
   - action: In `04-04-SUMMARY.md`, replace the claim that the UK uses real GBD weights (`:81`) with
     what was actually true at the time and what is true now, both dated — a SUMMARY is a record, so
     the correction is an amendment with the original visible, not a rewrite that hides it. In
     `04-06-SUMMARY.md`, the claim that `eurostat-regional.json` is "a build-time validation input,
     like `observed-regional-age-sex.json`" was false when written and is made true by task 4: say so
     with the same dating, naming this plan.
   - verify: `grep` both files for the corrected claims; confirm no remaining sentence asserts UK GBD
     coverage or Eurostat readership as of the original date.
   - acceptance_criteria:
     - Neither SUMMARY contains a statement contradicted by the shipped tree.
     - Both corrections are dated and attributed to 06-01, with the superseded claim still legible.

7. **Backfill `04-VERIFICATION.md` and `05-VERIFICATION.md`**
   - type: implementation
   - files: `.planning/phases/04-persona-realism-ladder/04-VERIFICATION.md`,
     `.planning/phases/05-story-reading-experience/05-VERIFICATION.md`
   - action: Write both against the five (Phase 4) and three (Phase 5) success criteria in
     `.planning/ROADMAP.md`, following the format of `02-VERIFICATION.md` — frontmatter
     (`phase`, `status`, `verified_at`, `plans`), a criteria table with per-criterion evidence, the
     commands run, human-verification notes, and a Gaps section. Evidence comes from re-running the
     checks now, plus the audit's own verified findings; where a criterion is partially met, say
     which part and why (Phase 4 criterion 2 is 183 countries not 204; criterion 4 holds but 34 of 90
     cause labels are unmapped for reweighting). Phase 4 supersedes nothing in `04-UAT.md` — reference
     it and note it covered 6 of 9 plans. Phase 5's criterion 3 must record the accepted WCAG failure
     from 05-03 as a decision, not a pass.
   - verify: Every "passed" cell names a file, a command, or a number. Re-run
     `pnpm test app/roadmap/storyTranslations.test.ts` and `pnpm test app/roadmap/palette.test.ts`
     for the Phase 5 criteria rather than citing the original session.
   - acceptance_criteria:
     - Both files exist with valid GSD frontmatter and a status that reflects measurement.
     - No criterion is marked passed on the strength of a SUMMARY's assertion alone.
     - Phase 5's accepted contrast failure appears as a recorded decision in the Gaps section.

8. **Close the traceability loop**
   - type: implementation
   - files: `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, the 9 SUMMARYs
     listed in `files_modified`
   - action: Add `requirements-completed` frontmatter to the 9 SUMMARYs that lack it (04-01, 04-02,
     04-03, 04-05, 04-06, 04-08, 05-01, 05-02, 05-03), each listing only what that plan actually
     delivered — 04-05 gets `REAL-01` as partial, not complete. Update the four stale
     `REQUIREMENTS.md` rows (PERS-01, STORY-01, STORY-02, STORY-03) from "Not started" to their real
     state with plan references. Fix `ROADMAP.md`'s stale progress table, which still reads
     "4. Persona Realism Ladder — 4/8 — In progress" against nine checked plans, and add the Phase 6
     row. Update `STATE.md`'s position, counts and percentage.
   - verify: `gsd-sdk query` (or equivalent) reports no requirement whose plans are complete and whose
     traceability row is not; the ROADMAP plan counts match the checkbox counts.
   - acceptance_criteria:
     - Every v2.0 requirement's traceability row matches the shipped state and names its plans.
     - `requirements-completed` present on all 12 v2.0 SUMMARYs.
     - No count in ROADMAP.md or STATE.md contradicts the phase directories.

9. **Re-run the audit**
   - type: verification
   - files: `.planning/v2.0-MILESTONE-AUDIT.md`
   - action: Re-run the milestone audit and rewrite the report. INT-01 and INT-02 should close; the
     five `warning`-severity items should carry forward as explicitly accepted debt with the reason
     each was left, not silently disappear. If the requirements matrix still does not reach `passed`,
     say which specific artifact is still missing rather than adjusting the verdict.
   - verify: `pnpm run typecheck && pnpm run lint && pnpm test` all green; the audit's own
     `status:` field is the result, not an aspiration.
   - acceptance_criteria:
     - `status: passed`, or a named blocker with the evidence for it.
     - Carried-forward warnings are listed with a reason each, and INT-04's disposition matches
       whatever task 5 decided.
     - All gates green, commits atomic per task group, pushed.

</tasks>
