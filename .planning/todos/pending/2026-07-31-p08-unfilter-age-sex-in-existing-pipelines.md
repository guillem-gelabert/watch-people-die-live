---
created: 2026-07-31T10:44:09.396Z
title: Unfilter age/sex in pipelines that already download it
priority: 8
promoted_to: phase-04 plan 04-08
area: tooling
files:
  - pipeline/sources/canada.py:66-80
  - pipeline/sources/brazil.py:65
  - pipeline/sources/mexico.py:75
  - pipeline/sources/australia.py
---

## Problem

Four seasonality pipelines already fetch files containing age, sex and (for Brazil and Mexico)
cause, then discard those columns at parse time:

- `pipeline/sources/canada.py:69` loads `Age at time of death` and `Sex` from StatCan
  13-10-0768, then **filters to `"all ages"` / `"Both sexes"`** on the very next line.
- `pipeline/sources/brazil.py:65` — `usecols=["DTOBITO", "CODMUNRES"]` only, from DATASUS SIM
  microdata that carries ICD-10 cause, age and sex.
- `pipeline/sources/mexico.py:75` — `usecols=["ENT_RESID", "MES_OCURR", "ANIO_OCUR"]` only, from
  `registro_defunciones` microdata that carries cause, age, sex and more.
- Australia's ABS `PROV_MORTALITY_WK` dataflow publishes age and sex breakdowns too.

The data is on disk (or one already-scripted fetch away) and the provenance is already recorded
in `pipeline/sources.lock.json`. Extracting the extra dimensions is close to free per pipeline —
one filter change for Canada.

## Problem with doing it early

**Each one helps exactly one country.** Under the "global reach before per-country work" rule
that puts it near the bottom despite being the cheapest code on the ladder — this is the
clearest case on the list where cheap-to-implement and high-priority come apart, and it is
ranked here deliberately, not by oversight.

## Solution

Widen `usecols` / drop the total-only filters, and emit regional age × sex (and cause, where
present) alongside the existing monthly death counts.

**The reason to do it anyway, and the reason it is 8 and not 9:** these five countries
(CAN, AUS, MEX, BRA, plus USA via p09's CDC WONDER) are the **validation set for p04**. p04
derives regional age pyramids from gridded population × national rates for the entire planet; it
needs somewhere with real observed regional age × sex counts to be checked against before it can
be trusted globally. That makes this a test fixture for the highest-value item on the ladder, not
just five countries' worth of polish.

Do it when p04 reaches verification. Brazil and Mexico additionally give the tropical and
southern cause × month references p07 needs, so those two pay for themselves twice.
