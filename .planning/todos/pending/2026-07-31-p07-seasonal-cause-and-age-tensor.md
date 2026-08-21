---
created: 2026-07-31T10:44:09.396Z
title: Make personas seasonal (cause × month, age × month)
priority: 7
promoted_to: phase-04 plan 04-07
area: data
files:
  - app/globe/persona.ts:245-252
  - lib/spatial-seasonality.ts
  - data/seasonality-subnational.json
  - data/seasonality-climate-fallback.json
  - data/seasonality-applied-fallbacks.json
---

## Problem

The seasonality stack is the most developed layer in the project — 89 measured country curves,
296 measured admin-1 curves, Köppen climate donor blends, ERA5 temperature climatology, LOO
validation, and a five-tier runtime resolver in `lib/spatial-seasonality.ts`
(observed → own-regions → bordering-countries → climate → latitude).

**All of it controls only when and how fast deaths fire. None of it touches who dies.**
`makePersona(m49, country)` (persona.ts:245) takes **no date argument at all**, so a January
death in Sweden and a July death in Sweden draw from byte-identical age, sex and cause
distributions — even though the winter excess is overwhelmingly respiratory and circulatory
deaths among the very old, which is the whole mechanism behind the curve that made the death
fire faster in the first place.

## Solution

A month-conditioned re-weighting of the existing distributions, normalised so it perturbs shape
without changing annual totals — exactly how the existing curves are mean-1 normalised.

**The idea that makes this cheap:** don't hunt for monthly-by-cause data country by country. The
*shape* of cause seasonality is largely universal (respiratory and circulatory winter peak;
drowning, heat exposure and road injuries in summer), so measure a cause × month and
age × month tensor from a handful of well-instrumented countries and transfer it by climate
zone — reusing the donor-proxy machinery the repo **already has and has already LOO-validated**
for the curves themselves (`seasonality-climate-fallback.json`,
`seasonality-applied-fallbacks.json`, `lib/spatial-seasonality.ts`). Southern-hemisphere
re-phasing is already implemented there too.

Measurement sources, cheapest first:

- **Eurostat `demo_r_mweek3`** (p06) — weekly deaths × age × sex across ~35 countries in one
  call. Gets the age × month half almost free.
- **Brazil DATASUS SIM** — already in `pipeline/sources.lock.json` for seasonality; daily, with
  ICD-10 cause, age and sex. `pipeline/sources/brazil.py:65` reads only `DTOBITO, CODMUNRES`.
  Gives a tropical/southern reference.
- **Mexico `registro_defunciones`** — same story, `mexico.py:75` reads only
  `ENT_RESID, MES_OCURR, ANIO_OCUR`; has cause, sex, age.
- **US CDC WONDER** provisional monthly by cause × state, for a cold-temperate reference.

WHO MDB (p02) is annual, so it cannot supply the monthly dimension.

**Plumbing:** `makePersona()` gains the event's simulated date; `Globe.tsx` already knows it.
Keep COVID years excluded to match `seasonality-subnational.json`'s `covidExcluded: [2020,
2021, 2022]`.

Sequence after p02/p06 (label crosswalk + Eurostat weekly), and after p01. The output is the
most *visible* realism gain on the whole ladder — it makes the feed's composition visibly shift
with the season the globe is already simulating.
