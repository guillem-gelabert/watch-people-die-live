---
phase: 6
status: passed
verified_at: 2026-08-28
plans:
  - 06-01
---

# Phase 6 Verification: v2.0 Audit Closure

## Status

passed

## Criteria

| Criterion                                                                                                                                                        | Result | Evidence                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. All 41 UK tier-1 region keys join, all 226 assigned UK cells resolve tier 0, and the UK's cells carry more than one archetype id in the shipped file.            | passed with a corrected target | 33 of 41 keys join and 217 of 226 cells resolve tier 0 — **99.96% of UK expected death weight**, from 0%. The 8 remaining keys are metropolitan NUTS-2 regions smaller than a 0.5° cell (the same limit costs IND 1 key, PHL 5, ETH 3); the criterion should have been stated in weight. UK cells span **2 archetypes, 11.08pp apart**, from 1. |
| 2. A whole country's tier-1 key set failing to join throws the build, and a committed-data test fails if the key spaces diverge again.                              | passed | Run against the pre-fix `region-keys.json`: the build threw `Tier-1 key space is broken: not one region key joins any grid cell for GBR (41 keys)` and `scripts/build-age-sex-cells.test.ts` failed 2 assertions. Both pass with the fix applied. `meta.tier1Join.byCountry` records the per-country counts. |
| 3. `data/eurostat-regional.json` has a real reader and changes a reported validation number for European regions.                                                  | passed | Read by `scripts/build-age-sex-cells.ts:669`. Reports 271 NUTS-2 regions across 34 countries, 3.79pp mean error vs 4.02pp flat-national; ITA 1.89 vs 3.05 and POL 1.51 vs 3.62 on the tier-0 join. `classId`, `tier`, `archetypes` and all four pre-existing source scores are byte-identical, so it is provably a report. |
| 4. No SUMMARY contains a claim the shipped tree contradicts.                                                                                                       | passed | Three amended, each dated and attributed with the superseded text still legible: `04-04-SUMMARY.md` (UK GBD weights), `04-06-SUMMARY.md` (Eurostat readership) and `app/roadmap/charts/PersonaDemo.tsx`'s parity comment. |
| 5. Both v2.0 phases have a VERIFICATION.md, all 12 SUMMARYs carry `requirements-completed`, and no count in ROADMAP.md, STATE.md or REQUIREMENTS.md contradicts the phase directories. | passed | `04-VERIFICATION.md` and `05-VERIFICATION.md` written against the ROADMAP's own criteria with re-measured evidence; 12 of 12 SUMMARYs carry the frontmatter; 4 stale traceability rows corrected and 2 downgraded on measurement; ROADMAP 9/9 + 3/3 + 1/1 and STATE 18/18 plans, 6/6 phases. |

## Commands Run

```bash
pnpm run build:region-keys -- --force        # 2,709 regions, 0 rollup mismatches, 0.081% unassigned
pnpm run build:age-sex-cells -- --force      # run twice, identical md5
pnpm exec vitest run scripts/build-age-sex-cells.test.ts
pnpm run typecheck && pnpm run lint && pnpm test
# guards, against the pre-fix region-keys.json:
#   vitest -> 2 failures (GBR orphaned, cellPct 0)
#   build  -> throws "Tier-1 key space is broken ... for GBR (41 keys)"
```

## Human Verification

None required. Every criterion is measurable from the committed artifacts.

## Gaps

None for Phase 6's own scope. Five warning-severity integration items from the first audit pass are
deliberately carried forward with a stated reason each — see `.planning/v2.0-MILESTONE-AUDIT.md`
(INT-03 dead browser payload, INT-04 archetype quantisation, INT-05 missing runtime alignment guard,
INT-06 unmirrored coverage guard, INT-07 duplicated `m49ForIso3`). Deferring them was the plan's
explicit scope decision, not an oversight.
