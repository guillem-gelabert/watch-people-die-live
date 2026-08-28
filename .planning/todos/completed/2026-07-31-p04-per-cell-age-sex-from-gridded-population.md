---
created: 2026-07-31T10:44:09.396Z
title: Derive per-cell age/sex death weights from gridded population
priority: 4
promoted_to: phase-04 plan 04-04
area: data
files:
  - data/rate-grid.json
  - data/mortality-age-sex.json
  - scripts/build-density.ts
  - app/globe/persona.ts:192-214
  - app/globe/Globe.tsx:190-193
---

## Problem

`data/mortality-age-sex.json` (UN WPP deaths by age × sex) is **country-level only**: 172
countries × 9 bands × 2 sexes. So every death in Russia draws from one national pyramid,
whether it fired in Moscow or in Chukotka — even though regional age structure is the single
largest driver of the regional CDR spread the roadmap's Step 4 is built around
(`data/subnational-cdr.json` → `meta.note`: *"most of the between-region gap reflects age
structure"*).

The scalable fix does **not** need per-country data hunting or region polygons: a gridded
age-sex population product × the country's age-specific death rates yields an age/sex death
pyramid for every populated cell, finer than admin-1, for the whole planet. That is why this
outranks the region-keyed tabular sources (p06, p09).

## Solution

Bake per-cell age/sex weights alongside the existing `[lon, lat, countryId, w]` rows.

**Open question — which source.** Resolve before planning:

- **GPWv4 Basic Demographic Characteristics (CIESIN).** Same provider and pipeline the project
  already uses for `data/density-grid.json` via `scripts/build-density.ts`, and a genuinely
  single global product with age × sex. Caveat: 2010 vintage and coarser bands — age structure
  moves materially in 15 years (China especially).
- **WorldPop age/sex structures.** Current and 1 km, but distributed as per-country,
  per-age-sex-group GeoTIFFs (~200 countries × 36 groups). Mechanical and uniform rather than a
  bespoke per-country hunt, but a large fetch job.
- **GHS-POP is not a candidate** — no age/sex breakdown.

**The cost that was initially understated: payload.** `data/rate-grid.json` has **59,954 cells**.
A naive 18-number pyramid per cell is ~1.08M numbers, dwarfing the current 1.7 MB grid, and the
grid is fetched on every globe load. So this is *not* a simple bake step. Options:

- Cluster cells into N age-structure archetypes and store one small `classId` per cell plus N
  pyramids. Almost certainly the right answer; N in the low tens should capture most variance
  given how smoothly age structure varies spatially.
- Or store a per-cell *deviation* from the national pyramid at reduced precision.
- Or ship as a separate lazily-fetched file so the globe's first paint is unaffected.

**Plumbing.** `sampleSex`/`sampleAge` (persona.ts:192-214) resolve by `m49`; they would take a
cell reference or a resolved pyramid instead. `Globe.tsx:193` calls `makePersona(m49, country)`
and would need to pass the sampled cell through.

**Validation.** p08 unfilters real regional age × sex counts for Canada, Australia, Mexico and
Brazil from files already downloaded — use those as the check set for the derived pyramids
before trusting this globally.

Derived, not observed: this is national age-specific rates × local population structure, so it
captures *who lives there* but not local cause/health differences. Honest and a large step up
from a flat national pyramid; worth a line of roadmap copy.
