---
created: 2026-07-31T10:44:09.396Z
title: Add Eurostat regional age/sex and cause tables (NUTS-2)
priority: 6
promoted_to: phase-04 plan 04-06
area: data
files:
  - data/nuts2-20m.json
  - data/subnational-cdr.json
  - pipeline/sources/
---

## Problem

Once a region key exists on the grid (p05), Europe is the cheapest place to get *observed*
regional persona inputs, because Eurostat is one API covering ~35 countries rather than a
per-country hunt. Three tables map directly onto the **287 NUTS-2 keys already committed** in
`data/nuts2-20m.json` / `data/subnational-cdr.json`:

| Table              | Gives                                        | Feeds            |
| ------------------ | -------------------------------------------- | ---------------- |
| `demo_r_magec`     | deaths by NUTS-2 × age × sex                 | regional pyramid |
| `demo_r_mweek3`    | weekly deaths by NUTS × age × sex            | p07 seasonality  |
| `hlth_cd_asdr2`    | causes of death by NUTS-2 × age × sex        | regional causes  |

One API call each, no scraping, no account. This is the best available observed check on p04's
*derived* pyramids for a third of the regions in `subnational-cdr.json`.

## Solution

Add Eurostat fetchers under `pipeline/sources/` following the existing per-source module
convention (`argentina_adm1.py`, `canada.py` etc. — each exposes `fetch()` / `load()` and
records provenance in `pipeline/sources.lock.json`).

Notes:

- Eurostat's NUTS version matters. `data/subnational-cdr.json` already pins GISCO NUTS-2
  geometry and lists 36 `nutsCountriesIso3`; the statistical tables must be pulled at the
  matching NUTS revision or a slice of regions will fail to join. Reuse whatever revision the
  existing Eurostat `demo_r_gind3` pull for `subnational-cdr.json` used.
- `hlth_cd_asdr2` is a **standardised death rate**, not counts — intensive, so it averages
  rather than sums when aggregating (the same distinction `seasonality-subnational.json`'s
  method note already handles for Russia's RusSTMF rates).
- Cause labels arrive as ICD-10 groupings; reuse whatever crosswalk p02 builds rather than
  writing a second one.
- Age bands need folding into the shared 9-band `BANDS` array.

Depends on p05 for the region key, and on p02 for the ICD-10 label map.
