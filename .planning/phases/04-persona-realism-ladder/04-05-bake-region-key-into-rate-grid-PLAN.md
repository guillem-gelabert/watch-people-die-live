---
phase: 4
plan: 04-05
title: Bake an admin-1 / NUTS-2 region key into the rate grid
type: implementation
wave: 2
depends_on: []
files_modified:
  - data/rate-grid.json
  - scripts/build-region-keys.ts
autonomous: true
requirements:
  - PERS-02
  - REAL-01
---

<objective>
Give each populated cell the same `geo`+`key` region identity `data/subnational-cdr.json` already uses, so region-keyed tabular sources (04-03, 04-06, and backlog 999.1) can reach the persona. Needs no new data: the admin-1 and NUTS-2 layers are already committed.
</objective>

<notes>
Moved from wave 3 to wave 2, and no longer depends on 04-04. The dependency reversed: attaching
04-03's regional age/sex pyramids to a cell requires this region key, so this plan now runs first.
For the population-weighted assignment in task 1 it uses the **already committed
`data/density-grid.json`** rather than waiting on 04-04's WorldPop raster, which is what previously
created the dependency.

Budget for point-in-polygon accordingly: the committed layers hold **4,596** admin-1 features
(`data/admin1-10m.json`, key `adm1_code`) and **334** NUTS-2 (`data/nuts2-20m.json`, key `NUTS_ID`) —
4,930 polygons. The 694 / 287 figures in the original scoping are the subsets carrying a CDR value in
`subnational-cdr.json`, not the geometry counts, and ~47 NUTS-2 polygons have geometry but no CDR row.
</notes>

<tasks>

1. **Assign cells by population, not centroid**
   - type: implementation
   - files: `scripts/build-region-keys.ts`
   - action: Match the existing border convention: assign each cell to whichever region holds the most population within it — weighting with the committed `data/density-grid.json` — as the country assignment already does, rather than naive centroid containment which misattributes coastal and border cells.
   - verify: Spot-check known border cells (Benelux, West Africa) and coastal cells against the committed layers.
   - acceptance_criteria:
     - Assignment reproduces the country assignment when regions are rolled up.
     - Coastal and border cells are not misattributed.

2. **Keys are interned, not repeated**
   - type: implementation
   - files: `data/rate-grid.json`
   - action: Add the region key as an index into a key table, mirroring the existing `names` table for countries, rather than a repeated string per cell.
   - verify: Byte-size report before and after.
   - acceptance_criteria:
     - Payload growth stays proportionate to a single integer per cell.
     - Existing consumers of the grid keep working unchanged.

3. **Unmatched cells have a documented null path**
   - type: implementation
   - files: `scripts/build-region-keys.ts`
   - action: Give ocean-fringe, disputed and Antarctic cells an explicit null region, following the precedent of `seasonality-applied-fallbacks.json`'s `unassignedTargets`.
   - verify: Count and list unassigned cells with their population share.
   - acceptance_criteria:
     - Unassigned cells are enumerated with their share of expected deaths.
     - Downstream lookups handle a null region without throwing.

</tasks>

<verification>

- `pnpm run typecheck`
- `pnpm test`
- Rollup check: region assignment aggregates to the existing country assignment.
- Byte-size report for `data/rate-grid.json`.

</verification>

<success_criteria>

- Every populated cell carries an admin-1 or NUTS-2 key, or an explicit null.
- Keys match `data/subnational-cdr.json`'s key space exactly.
- Grid payload growth is bounded and measured.

</success_criteria>
