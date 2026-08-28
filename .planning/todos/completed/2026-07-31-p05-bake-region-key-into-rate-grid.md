---
created: 2026-07-31T10:44:09.396Z
title: Bake an admin-1 / NUTS-2 region key into the rate grid
priority: 5
promoted_to: phase-04 plan 04-05
area: data
files:
  - data/rate-grid.json
  - data/admin1-10m.json
  - data/nuts2-20m.json
  - data/subnational-cdr.json
  - app/globe/Globe.tsx:190-193
---

## Problem

The globe samples one cell per death and knows only its country. `data/rate-grid.json` rows are
`[lon, lat, countryId, w]` (59,954 cells), and `Globe.tsx:193` calls
`makePersona(m49, country)`. Nothing downstream can tell which admin-1 or NUTS-2 region the
death fell in.

That blocks every *tabular* regional persona source — Eurostat causes/age by NUTS-2 (p06), GBD
subnational, national office tables (p09) — all of which are keyed by region, not by coordinate.

Needs **no new data**: `data/admin1-10m.json` (694 admin-1) and `data/nuts2-20m.json` (287
NUTS-2) are already committed, and `data/subnational-cdr.json` already defines the exact key
space to match (`geo` + `key`, e.g. `BEL-3477`, 981 regions total). Pure local geometry.

## Solution

Point-in-polygon each populated cell centroid against the committed admin-1 and NUTS-2 layers,
assigning the same `geo`/`key` pair `subnational-cdr.json` uses, and add the key (or an index
into a key table) as a fifth column on each cell row.

Notes:

- Mirror the existing border convention. The roadmap's Step 3 already resolves the
  0.5°-cell-vs-real-border mismatch by assigning each cell to *whichever country holds the most
  population in it* — regional assignment should follow the same rule, not naive centroid
  containment, or coastal and border regions will be misattributed.
- Prefer an interned key table (`names`-style, as `rate-grid.json` already does for countries)
  over repeating strings per cell, to keep the payload down.
- Cells with no region match (open ocean fringes, disputed areas, Antarctica) need a documented
  null path — `seasonality-applied-fallbacks.json` already precedents this with its
  `unassignedTargets: ["Antarctica"]`.

**Deliberately ranked below p04.** This is an *enabler* — it improves nothing on its own, and
p04 reaches finer than admin-1 without needing it at all. Build it when a genuinely region-keyed
table (p06) is actually about to land, not before.
