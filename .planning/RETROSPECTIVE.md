# Project Retrospective

_A living document updated after each milestone. Lessons feed forward into future planning._

## Milestone: v2.0 — Persona Realism

**Shipped:** 2026-08-28
**Phases:** 3 (4, 5, 6) | **Plans:** 13 | **Commits:** 61 | **Timeline:** 7 days

### What Was Built

- **Country-specific, age-banded cause distributions** — 183 countries × 90 causes from WHO Global Health Estimates, replacing a single global age-flat table in which only 12 of 140 labels were reachable and a female infant drew Alzheimer's at 5.4%.
- **A three-tier per-cell age/sex resolver** — all 59,954 grid cells resolve a pyramid from GBD subnational weights (tier 0), WorldPop 1km population × national rate (tier 1), or national tables (tier 2). Tier mix 44.60 / 51.84 / 3.56.
- **A seasonal composition tensor** — cause × month and age × month curves measured as order-4 harmonics and transferred to every country through the existing Köppen donor cascade. `makePersona()` now takes the simulated death's date.
- **A region key space on the grid** — admin-1 / NUTS-2 keys baked per cell by area majority on a sub-cell lattice, with 0.081% of expected deaths explicitly unassigned.
- **Three story fixes** — dead asides removed, scroll momentum can no longer fire the pull-to-globe gesture, five proxy identity colours frozen against the changing sky.
- **An audit-closure pass** — two silent data defects fixed and guarded, two false SUMMARY claims corrected, both phase verifications backfilled.

### What Worked

- **Deriving waves from `files_modified` overlap rather than priority order.** Phase 4 ran 9 plans across 6 waves with no collision. The analysis correctly identified `app/globe/persona.ts` as the chokepoint and forced its three consumers (04-01, 04-04, 04-07) into three separate waves. This is now the default.
- **Treating source selection as an investigation.** Both 04-02's and 04-03's originally-named sources turned out to be unusable — the WHO Mortality Database has *zero rows* for Nigeria, Ethiopia, DR Congo and India, and GBD's cause export is infeasible under its own 100k row cap. Catching this during planning rather than implementation saved the phase. The plan was rewritten; the requirement was not.
- **Running the milestone audit at all, and letting it return `gaps_found`.** The first pass separated two claims that look identical from inside — "the work is done and wired" and "the verification says so" — and found two real defects hiding behind the second. Without it, v2.0 would have shipped with the UK on the wrong tier and 1.77 MB of dead data.
- **Verifying a fix at three depths.** The UK join was checked at the key level (33 of 41 join), the cell level (217 of 226 resolve tier 0, 99.96% of death weight), and the *output* level (the UK's cells span 2 archetypes 11.08pp apart). Only the third is what a reader actually sees — a fix that was real at the join but erased by k-means quantisation would have looked identical at the first two.
- **Watching guards fail before trusting them to pass.** Both new tests were verified to fail with the fix reverted. A guard that has never been seen red is an assumption.
- **Reporting measured partials instead of reframing them.** 04-09 missed its own pass condition for Canada (9.86pp against an 8.67pp bar) and said so, while reporting Australia's decisive 68% improvement in the same breath.

### What Was Inefficient

- **Two requirements shipped as "complete" and had to be downgraded during the audit.** PERS-03 and STORY-03 were both marked complete on assertion; the audit downgraded both to partial on measurement. The work was fine — the claim about the work was not. Verification should have happened at plan close, not at milestone close.
- **No phase had a VERIFICATION.md until Phase 6 backfilled all three.** `workflow.verifier` is enabled in config, and it still did not run. The backfill cost a whole extra phase.
- **A 1.77 MB artifact was built, committed, and read by nothing for two days** — and its own SUMMARY described it as "a build-time validation input", which it was not yet. The gap between "produced" and "consumed" was invisible because nothing checked it.
- **The UK defect was undetectable by design.** `build-region-keys.ts` derived its NUTS-preferring country set from `subnational-cdr.json`, which has no `GBR`. All 41 keys silently missed, 226 cells silently fell to a derived tier, and no output anywhere said so. A per-key warning existed; a per-*country* throw did not.
- **Three of 13 plan summaries used a different one-liner format**, so extraction at close needed a fallback. Minor, but the archive tooling assumes the convention.
- **Story polish work happened outside the phase structure.** s10, s12, s13 and part of s14 shipped during the milestone window without being plans, so they were invisible to the roadmap and the requirement count, and their todos were still sitting in `pending/` at close.

### Patterns Established

- **A key space must express every key space a consumer joins against** — not mirror whichever upstream file it was derived from. Now enforced by a build throw when a whole country's key set joins nothing (per-key warnings stay warnings, since single misses are legitimate grid-resolution limits).
- **Cell-keyed files ship aligned to `rate-grid.json`'s cell order**, never a wider grid row, and the tier or provenance resolved is part of the output (`classId` + `tier` arrays), not an implementation detail. A derived estimate must be distinguishable from a measured one at read time.
- **A month-conditioned reweighting tensor is measured as `HarmonicCurve` objects** (order-4, mean-1) fit with the existing pipeline primitives, so it composes with evaluate/blend/shift rather than becoming a parallel representation.
- **Deliberate deviations are documented as deviations.** `worldpop.py` interleaves fetch and reduce, breaking `eurostat.py`'s clean split, because it must delete large rasters as it goes — recorded in the SUMMARY as a choice, not left to look like an oversight.
- **An accepted cost is recorded in the code and pinned by a test**, not just noted in planning. The WCAG failure lives in `palette.ts` where someone would touch it.
- **Audit warnings carry a `reason_left`.** The distinction between a deliberate deferral and an oversight cannot be reconstructed later, so it is written down at the moment of deferring.

### Key Lessons

1. **"Done and wired" and "verified" are different claims, and only an outside pass can separate them.** Every phase in this milestone believed it was complete. Two were wrong about a specific number, and the phase records asserted those numbers confidently. Run the audit before believing the summaries.
2. **A join that silently produces zero matches is worse than one that throws.** The UK cost 1.09% of world deaths on the wrong tier for two days at zero visible signal. Any join across two independently-derived key spaces needs a wholly-unjoined assertion, not just per-record warnings.
3. **Verify a data fix at the depth the reader sees it.** A fix that is real at the join and erased by downstream quantisation looks identical to a working one at every intermediate layer.
4. **A produced artifact with no consumer is a defect, not a loose end.** Check the "every artifact reaches a consumer" seam explicitly — it caught 1.77 MB here, and the same check would have caught it on day one.
5. **Investigate sources before planning against them.** Two of Phase 4's nine plans named sources that could not do the job. Both were caught by probing rather than by attempting, which cost hours instead of days.
6. **Work done outside the phase structure becomes invisible.** Four story items shipped inside the milestone window but outside its plans, and none of them appeared in any count until the close reconciled the todo files by hand.

### Cost Observations

- Model mix: not instrumented this milestone.
- Sessions: not instrumented. Timeline was 7 calendar days, 2026-08-21 → 2026-08-28.
- Notable: Phase 6 was pure rework — one plan, one day, entirely spent closing gaps the earlier phases should not have left. That is the measurable cost of skipping the verifier: roughly 8% of the milestone's plans.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Timeline | Phases | Plans | Key change |
|-----------|----------|--------|-------|------------|
| v1.0 MVP | 70 days | 3 | 5 | Brownfield mapped before initialization; GSD planning adopted onto work already in flight |
| v2.0 Persona Realism | 7 days | 3 | 13 | Waves derived from file-overlap analysis; milestone audit run and acted on; verification became a phase of its own |

### Cumulative Quality

| Milestone | Test files | Test cases | Runtime deps | Notes |
|-----------|-----------|-----------|--------------|-------|
| v1.0 | 18 | — | — | Vitest adopted outside a phase; ENG-01 never formally closed |
| v2.0 | 20 | ~149 | 14 (+27 dev) | +2 test files, both guards on data invariants rather than behaviour |

### Top Lessons (Verified Across Milestones)

1. **A requirement can be satisfied in form and false in substance.** v1.0's `DATA-03` demanded age-band stratification and got a file that had the shape but repeated all-ages values across every band — caught 32 days after the milestone was declared complete. v2.0's `PERS-03` and `STORY-03` were both downgraded for the same class of reason. Verify the values, not the schema.
2. **Say what shipped, not what was intended.** Established in v1.0 when 01-02 documented the global age-flat cause layer honestly rather than describing the target state, and re-applied in v2.0 when `PersonaDemo.tsx`'s parity claim was corrected to name the flat national tables it actually reads. Both times the honest version was more useful than the aspirational one.
3. **Deferrals need a recorded reason at the moment of deferring.** v1.0 left `PUB-01` partial with a clear cause (no Railway link) and it is still actionable two milestones later. Debt without a reason becomes indistinguishable from an oversight within weeks.
