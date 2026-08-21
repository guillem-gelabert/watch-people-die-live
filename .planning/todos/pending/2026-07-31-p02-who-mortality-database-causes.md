---
created: 2026-07-31T10:44:09.396Z
title: Source country × age × sex causes from WHO Mortality Database
priority: 2
promoted_to: phase-04 plan 04-02
area: data
files:
  - scripts/build-causes.ts
  - data/causes.json
---

## Problem

Cause of death currently varies by sex only (see p01, p03). The GBD Results Tool is the obvious
fix but is quota- and row-cap-bound (p03: ~13 chunked requests over days). The WHO Mortality
Database is the cheap complement: a **single free bulk download, no account, no quota, no row
cap**, giving registered deaths by country × year × ICD-10 cause × age × sex.

It is not a replacement for GBD, and the reason matters for sequencing. WHO MDB carries only
countries with functioning vital registration — roughly 120 — and by *death share* that is a
much weaker figure than it sounds: India is absent (mortality there is SRS-estimated, not
registered) and China appears only as a limited urban/rural sample. Those two alone are around
a third of global deaths. So WHO MDB buys most of Europe, the Americas, Japan, Korea and
Australasia at near-zero sourcing cost, and leaves exactly the high-death-count, high-distortion
countries to p03.

## Solution

Download the WHO MDB bulk CSVs, aggregate to the shared 9-band `BANDS` array and the same
`{ causes, global, countries }` JSON shape `build-causes.ts` already emits, so `persona.ts`
needs no change beyond p01.

Work involved:

- **ICD-10 → persona label map.** This is the real cost. WHO MDB codes are ICD-10 (and older
  revisions for historical years); `build-causes.ts`'s `LABELS` map is keyed to GBD cause names.
  Either write an ICD-10 → existing-label crosswalk, or map ICD-10 → GBD-cause-name → existing
  label. Prefer collapsing to the label vocabulary already in `data/causes.json` so the feed's
  prose stays consistent regardless of which source supplied a given country.
- **Pick one year per country** (most recent complete), since reporting years differ.
- **Decide the merge policy with p03.** Cleanest is a single `causes.json` with a per-country
  `source` marker, WHO MDB preferred where present (registered > modelled) and GBD filling the
  rest. Record the split in `coverage` so p01's guard can reason about it.
- Watch the same `TOP = 8` truncation trap as p03: apply top-N **per country**, never to a
  pooled aggregate, or low-income-profile causes get erased again.

Licence: WHO MDB is open for research use — confirm attribution requirements and add to the
source list alongside the GBD free-use note in `data/subnational-cdr.json` → `meta.license`.

Depends on p01. Complements p03 — do both; neither alone covers the world.
