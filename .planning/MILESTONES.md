# Milestones: Watch People Die Live

Shipped versions, newest first. Full detail lives in `.planning/milestones/`.

---

## v2.0 — Persona Realism

**Shipped:** 2026-08-28
**Phases:** 4-6 (Phase 6 inserted from the milestone audit) · **Plans:** 13 · **Commits:** 61
**Timeline:** 2026-08-21 → 2026-08-28 (7 days)
**Git range:** `48b61131` → `3db1a5a6` · 114 files changed, +10,809 / −1,484
**Archive:** [`milestones/v2.0-ROADMAP.md`](milestones/v2.0-ROADMAP.md) · [`milestones/v2.0-REQUIREMENTS.md`](milestones/v2.0-REQUIREMENTS.md) · [`milestones/v2.0-MILESTONE-AUDIT.md`](milestones/v2.0-MILESTONE-AUDIT.md)

**Delivered:** Persona age, sex and cause stopped being one global table — all three now vary by region and by season, and the milestone closed on measurement rather than assertion.

**Key accomplishments:**

1. **Cause data went country-specific and age-banded** — 183 countries × 90 causes from WHO Global Health Estimates, replacing a single global age-flat table where only 12 of 140 labels were ever reachable and infant personas drew adult causes.
2. **Per-cell age/sex pyramids in three tiers** — all 59,954 grid cells resolve a pyramid from GBD subnational weights, WorldPop 1km population, or national tables (tier mix 44.60 / 51.84 / 3.56), validated against four national-statistics sources and 34 Eurostat countries.
3. **Persona composition became seasonal** — a measured cause × month and age × month tensor transferred through the existing Köppen donor cascade; southern-hemisphere re-phasing is real (AUS band 8: ×0.903 Jan vs ×1.246 Jul).
4. **Three story defects fixed** — dead asides removed, scroll momentum can no longer fire the pull-to-globe gesture, and the five proxy identity colours are frozen against the story's changing sky.
5. **Closure on measurement** — the UK's 41 GBD region keys had silently joined *nothing*; 99.96% of UK expected death weight now resolves tier 0, guarded by a build throw and a test both watched to fail without the fix.
6. **A real validation harness** — the 1.77 MB Eurostat artifact that had no reader became the European validation set: 271 NUTS-2 regions, 34 countries, 3.79pp mean error against a 4.02pp flat-national baseline.

**Requirements:** 8 in scope — 4 satisfied (PERS-01, PERS-02, STORY-01, STORY-02), 4 partial (PERS-03 at 56/90 cause labels; REAL-01 and REAL-03 partial by design; STORY-03 an accepted WCAG AA failure), 0 unsatisfied.

### Known gaps

Two requirements were **downgraded from complete to partial during the audit**, because the evidence did not carry the claim:

- **PERS-03** — 34 of 90 cause labels resolve no seasonal curve, including "other causes" at 34–52% of adult band weight (aseasonal by decision as of 2026-08-28).
- **STORY-03** — white ink is below WCAG AA on 3 of 5 proxy fills (3.37 / 1.61 / 1.44). Both alternatives evaluated and rejected; documented in `palette.ts` and pinned by test.

**Accepted debt — 5 audit warnings carried forward:** INT-03 (392 KB dead browser copy of `region-keys.json`), INT-04 (20-archetype quantisation flattens 19.43% of expected deaths; ETH, JPN and ZAF still collapse to one archetype), INT-05 (no runtime alignment guard between rate-grid and age-sex-cells), INT-06 (coverage guard not mirrored on the story side), INT-07 (`m49ForIso3` duplicated byte-identically).

**Known deferred items at close:** 9 (see STATE.md Deferred Items).

---

## v1.0 — MVP

**Shipped:** 2026-06-29 (archived retroactively 2026-08-28)
**Phases:** 1-3 · **Plans:** 5 · **Commits:** 136
**Timeline:** 2026-06-12 → 2026-08-21 (70 days)
**Git range:** `52948cbd` → `48b61131` · 281 files changed, +63,364 / −1
**Archive:** [`milestones/v1.0-ROADMAP.md`](milestones/v1.0-ROADMAP.md) · [`milestones/v1.0-REQUIREMENTS.md`](milestones/v1.0-REQUIREMENTS.md) · [`milestones/v1.0-MILESTONE-AUDIT.md`](milestones/v1.0-MILESTONE-AUDIT.md)

**Delivered:** A shared foundation touching both features — real cause data and an honest methodology for Personas; social sharing, a public roadmap, and publishing as Shared product surfaces.

**Key accomplishments:**

1. **Real cause data** — an IHME-derived global, sex-specific `data/causes.json`, repeatable from a documented GBD CSV workflow, replacing placeholder distributions.
2. **Methodology matched to the shipped pipeline** — public claims describe what actually ships, including the fallback path and the representative-identity caveat. This became the project's standing convention.
3. **Shareable links** — accurate Open Graph and Twitter metadata plus a committed preview image.
4. **The public `/roadmap` route** — shipped realism layers shown separately from planned ones, so the page cannot overstate fidelity.
5. **Deployment verified and handed off** — Railway deployment checked and a portfolio handoff artifact created with explicit follow-up.

**Requirements:** 17 total — 16 complete, 1 partial.

### Known gaps

- **PUB-01** — partial. Local assets and pages verified; the production Railway URL smoke check is still pending because the checkout was never linked to a Railway project. **Still outstanding at the v2.0 close.**
- **DATA-03** was satisfied in form but not substance: the committed cause export was age-flat, so only 12 of 140 labels were reachable and infant personas drew adult causes. Discovered 2026-07-31, three days after the milestone was declared complete, and fixed in v2.0 by PERS-01. The requirement was right; the verification was not deep enough to catch the flat export.

**Note:** v1.0 was declared complete on 2026-06-29 but never formally archived — no `milestones/` directory, no `MILESTONES.md`, no git tag existed until the v2.0 close on 2026-08-28 created all three.

---

_Last updated: 2026-08-28_
