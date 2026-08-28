---
phase: 4
plan: 04-04
title: Resolve age/sex per cell from regional estimates and gridded population
type: implementation
wave: 4
depends_on:
  - 04-03
  - 04-05
files_modified:
  - scripts/build-age-sex-cells.ts
  - data/age-sex-cells.json
  - app/globe/persona.ts
  - app/globe/useGlobeData.ts
  - app/globe/Earth.tsx
  - app/globe/GlobeStage.tsx
  - scripts/sync-data.ts
autonomous: true
requirements:
  - PERS-02
---

<objective>
Stop every death in a country drawing that country's single national age pyramid — a death in
Chukotka currently gets Moscow's age profile, even though `subnational-cdr.json`'s own note says
"most of the between-region gap reflects age structure". Resolve a pyramid per grid cell, preferring
the real regional estimates 04-03 supplies and falling back to a population-derived pyramid
elsewhere.
</objective>

<notes>
**Two changes from the original plan.** First, this is now a two-tier resolver rather than a pure
derivation: 04-03 gives measured-and-modelled age × sex death distributions for 519 admin-1 units
across 17 countries — including India, Nigeria, Indonesia, Pakistan and Ethiopia — so for those
regions we no longer need to *infer* the pyramid from population at all. The roadmap's premise that
subnational data was "unreachable at any effort level" holds for *observed* national-statistics data,
which is what `seasonality-data-guide.md` catalogues, but not for GBD's modelled estimates.

Second, the dependency direction with 04-05 is reversed. This plan previously came first and 04-05
reused its population raster; now attaching a regional pyramid to a cell *requires* the cell→region
key that 04-05 bakes, so 04-05 goes first and does its population weighting with the existing
`data/density-grid.json` instead.

Source decision for the fallback tier, settled 2026-08-21: **WorldPop 2020** age/sex structures,
whose vintage matches the 2024 rate grid and whose raster doubles as a weighting input. GPWv4 BDC
was rejected on a 2010 age structure that misses ageing in China and Eastern Europe and Gulf
migration. GHS-POP has no age/sex breakdown at all.

Filenames corrected: `app/globe/Globe.tsx` no longer exists. The runtime chain is
`Earth.tsx:349-350` (`sampler.sampleCell()` → `onPushDeath`) → `GlobeStage.tsx:54-65` → `makePersona`.
</notes>

<tasks>

1. **Two-tier resolution, with the tier recorded**
   - type: implementation
   - files: `scripts/build-age-sex-cells.ts`
   - action: For each populated cell, resolve a pyramid in this order: (1) the regional age/sex
     weights from 04-03, looked up by the cell's region key from 04-05; (2) a derived pyramid from
     WorldPop 2020 age/sex population × the country's age-specific death rates; (3) the national
     pyramid from `data/mortality-age-sex.json`. Record which tier answered, per cell, following the
     five-tier precedent in `lib/spatial-seasonality.ts` where the resolver's source is part of its
     output rather than an implementation detail.
   - verify: Report the share of expected deaths served by each tier.
   - acceptance_criteria:
     - Tier is queryable per cell, and the global tier mix is reported.
     - Cells with no region key and no WorldPop coverage still resolve, via the national pyramid.
     - The derived tier is documented as capturing who *lives* there, not local health differences.

2. **Payload stays bounded, and out of the rate grid**
   - type: implementation
   - files: `scripts/build-age-sex-cells.ts`, `data/age-sex-cells.json`, `scripts/sync-data.ts`
   - action: A naive 18-number pyramid across 59,954 cells is ~1.08M numbers on a file already at
     1.7 MB raw / 469 KB gzipped, fetched on every globe load. Cluster cells into a small set of
     age-structure archetypes (target 12–24) and ship one class id per cell plus the archetype
     pyramids, as a **separate file** aligned to `rate-grid.json` cell order — asserting length
     59,954. Keeping it out of `rate-grid.json` matters: the ACLED conflict layer snaps
     `conflicts.json` onto grid cells by `${floor(lon/cs)*cs},${floor(lat/cs)*cs}` string keys
     (`useGlobeData.ts:174-228`), and rewriting the grid risks silently invalidating that join.
     Add the file to `sync-data.ts` and fetch it with `.catch(() => null)` like the seasonality
     layers, so the globe degrades rather than fails.
   - verify: Byte-size report raw and gzipped; confirm first paint is not slowed.
   - acceptance_criteria:
     - Grid growth is a deliberate, documented number.
     - `rate-grid.json` is untouched, so the conflict snap keys stay stable.
     - A missing file leaves the globe working on national pyramids.

3. **Thread the cell through to the persona**
   - type: implementation
   - files: `app/globe/useGlobeData.ts`, `app/globe/Earth.tsx`, `app/globe/GlobeStage.tsx`,
     `app/globe/persona.ts`
   - action: `sampleCell()` (`useGlobeData.ts:231-245`) currently discards the binary-search index it
     already computes and returns only jittered `[lon, lat, m49]`. Return the index too, widen the
     sampler type (`:65-68`), the `onPushDeath` callback (`Earth.tsx:96`, `GlobeStage.tsx:55`), and
     `makePersona`, so `sampleSex`/`sampleAge` (`persona.ts:214`/`:225`) resolve the cell's pyramid
     with the national one as fallback.
   - verify: Node smoke comparing age distributions for two cells in one country with very different
     age structures.
   - acceptance_criteria:
     - Two regions of one country produce visibly different age distributions.
     - Cells without a pyramid fall back to national.
     - `makePersona()` still never throws.

4. **Validate the derived tier against observed counts**
   - type: verification
   - files: `scripts/build-age-sex-cells.ts`
   - action: Check tier-2 derived pyramids against the observed regional age × sex counts 04-08
     unlocks for Canada, Australia, Mexico and Brazil, and — more usefully — against tier 1 itself
     wherever both exist, which is a free 519-region check the original plan could not run.
   - verify: Per-region error report against observed counts and against 04-03's regional weights.
   - acceptance_criteria:
     - Derived pyramids track observed regional age structure within a stated tolerance.
     - Systematic bias is documented rather than hidden.
     - Where tier 1 and tier 2 disagree sharply, the regions are listed for inspection.

</tasks>

<verification>

- `pnpm run typecheck && pnpm run lint && pnpm test`
- Byte-size report for `data/age-sex-cells.json`, raw and gzipped.
- Tier-mix report: share of expected deaths served by regional, derived and national tiers.
- Error report against 04-08's observed counts and against 04-03's regional weights.
- Playwright check on the dev server: globe loads, feed reads sensibly, no console errors.

</verification>

<success_criteria>

- Every populated cell resolves an age/sex pyramid, and the tier that answered is recorded.
- The 17 countries 04-03 covers use real regional estimates rather than an inference.
- Payload growth is measured, bounded, and outside `rate-grid.json`.
- The derived tier is validated against two independent references and its bias documented.

</success_criteria>
