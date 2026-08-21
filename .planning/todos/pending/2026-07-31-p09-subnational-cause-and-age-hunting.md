---
created: 2026-07-31T10:44:09.396Z
title: Subnational cause and age sourcing beyond Eurostat
priority: 9
promoted_to: backlog 999.1 (not a phase-04 plan)
area: data
files:
  - seasonality-data-guide.md
  - data/subnational-cdr.json
  - pipeline/sources/
---

## Problem

After Eurostat (p06) covers 287 NUTS-2 regions, the remaining 694 admin-1 regions in
`data/subnational-cdr.json` need observed cause and age × sex data from national sources — one
bespoke parser each, no shared API, no shared schema.

Candidates, roughly by yield per effort:

- **GBD subnational releases** — US states, Brazil, India, China, Mexico, Japan, Indonesia,
  Kenya, UK. Same CSV shape as p03, so `build-causes.ts` handles it; separate location sets, and
  the same quota problem as p03.
- **US CDC WONDER** — multiple-cause by state, monthly. Also feeds p07.
- **Brazil DATASUS SIM / Mexico `registro_defunciones`** cause re-parse — see p08, files already
  fetched.
- **Rosstat** — 80 admin-1 regions already curve-mapped in `seasonality-subnational.json`.

## Why this is last, and why it has a ceiling

`seasonality-data-guide.md` (already in the repo, 16 countries surveyed) documents that **China,
India, Indonesia, Pakistan, Ethiopia, Nigeria, DRC, Libya and Madagascar have weak or no public
subnational access** — its own section headings say so. Those countries hold a very large share
of global deaths, so full observed subnational cause and age coverage is **not achievable at any
effort level**.

That is the strongest argument for p04's derived approach: gridded population × national
age-specific rates covers all 981 regions and every populated cell today, whereas this item
asymptotes at maybe 40% of the world's deaths after a long series of bespoke parsers.

## Solution

Treat as an opportunistic backlog rather than a planned sweep. Pick individual countries up when
one of these is true:

1. It is already half-done by another item (Brazil/Mexico via p08, US via p07's CDC WONDER pull).
2. It is visibly wrong on the globe — a country large enough that a single national pyramid or
   cause mix reads as obviously false in the feed.
3. It is needed as a p04 validation fixture (see p08).

Do **not** treat full subnational coverage as a milestone goal. Also relevant: the existing
`seasonality-subnational.json` already precedents an honest middle path — India and China admin-1
rows are marked `measurement: "climate-modeled"` and excluded from validation, i.e. estimates
labelled as estimates rather than gaps left blank or fake data presented as observed.
