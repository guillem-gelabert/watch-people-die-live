---
created: 2026-08-21T10:56:28.783Z
title: Rebuild the amplitude map as a per-cell map with a month slider
priority: 11
area: story
resolved: >-
  2026-08-29 — shipped in nine commits and deployed. The frame is now [[-18,-36],[93,72]] on an
  equal-area Equal Earth, and the fills are the 0.5-degree rate-grid cells rather than admin
  polygons, coloured by excess deaths per month — deaths x (multiplier - 1) / 12 — on a diverging
  ramp whose neutral band is one death a month. Not deaths x multiplier: the static term swamps the
  seasonal one, measured at 52.7% of cells crossing a colour bin January-to-July against 10.1%. A
  native range control scrubs the twelve months, and provenance moved to an SVG outline of the unit
  each cell's curve came from, solid where measured and dashed where reconstructed. Prose and aria
  rewritten in three languages, and the prose says the within-country texture is population, not
  seasonality, because only ZAF, western RUS and climate-modelled IND/CHN have regional curves
  inside this frame.
spike_finding: >-
  The plan's batching optimisation was backwards. Nine batched paths of ~3,000 quads each take 188ms
  to fill; the same quads filled one at a time, still one fillStyle per bin, take 6ms — a path that
  large falls off the rasteriser's fast route. Cached Path2D fills in 0.3ms but costs 193ms per
  month to build. Recorded in amplitudeCells.ts so it is not re-litigated.
files:
  - app/roadmap/charts/AmplitudeMap.tsx
  - app/roadmap/charts/amplitudeCells.ts
  - app/roadmap/charts/amplitudeCells.test.ts
  - app/roadmap/charts/basemap.test.ts
  - app/roadmap/palette.ts
  - app/roadmap/palette.test.ts
  - app/roadmap/useRoadmapData.ts
  - app/roadmap/types.ts
  - app/roadmap/roadmap.css
  - lib/i18n/en.charts.ts
  - docs/ROADMAP.md
---

## Problem

Three separate changes to the **"Amplitude by country and region"** figure
(`docs/ROADMAP.md:188`, slot `[amplitude map]` at `storySlots.tsx:226`).

### 1. Wrong frame

`AmplitudeMap.tsx:57-60` hardcodes

    const BBOX: Bbox = [[-11, -25.5], [43, 28.5]];

which is Africa plus a sliver of southern Europe — the aria label at
`en.charts.ts:253` says as much ("Map of Africa"). The four countries the figure
is meant to let the reader compare are **Norway** (to ~71°N), **Bangladesh**
(to ~92°E), **South Africa** (to ~35°S) and **Mauritania** (to ~17°W), none of
which except Mauritania is inside that box. The frame needs to be roughly
`[[-18, -36], [93, 72]]`, checked against the actual feature extents.

Note that widening this far changes the projection question:
`fitRegionProjection` is `geoEquirectangular` (`basemap.ts:15-22`), which at
108° of longitude and 108° of latitude will distort Norway badly.
`fitProjection` exists precisely so a figure can pick its own — worth
reconsidering here.

### 2. Cells instead of choropleth

Today the map fills country and Admin-1 **polygons** with a 7-step ramp
(`RAMP_STEPS = 7`, `:32`). It should instead be a **cell map**, drawing the
calculated mortality for each grid cell — the same 59,954-cell
`data/rate-grid.json` the globe samples, rendered the way `DensityMap` renders
its raster. That removes the visual lie that mortality is uniform inside a
border, which is the point the surrounding section is arguing.

### 3. Month slider

Add a slider along the bottom running **January → December**, so the reader
scrubs the seasonal cycle and watches the cells breathe, instead of reading a
single amplitude scalar per unit. `lib/spatial-seasonality.ts` already resolves
a 12-point curve per unit through its five-tier resolver
(observed → own-regions → bordering-countries → climate → latitude), so the
per-month value is available; the current figure collapses it to one amplitude
number.

## Solution

TBD in detail, but the shape is clear enough to sequence:

1. Fix `BBOX` and choose the projection. Cheapest change, independently
   shippable, and worth doing first even if the rest waits.
2. Decide the cell rendering path. `DensityMap` is canvas by design (the one
   exception to the SVG rule for roadmap maps) and already does grid-to-raster
   with a colour ramp — reuse that machinery rather than writing a second one.
   The overlay chrome (borders, legend, tooltip, slider) stays SVG/DOM.
3. Per-cell monthly mortality needs the seasonality curve joined to the rate
   grid. Two paths: resolve at runtime per cell via `spatial-seasonality`
   (12 × 59,954 values, likely too slow to recompute on every slider tick), or
   bake a month dimension into the grid offline.

   **Relationship to Phase 04 (checked 2026-08-21).** Wait for **04-05**, which
   bakes a `geo`+`key` region identity onto every populated cell in
   `data/rate-grid.json` — that is exactly the join key a cell needs to find its
   own region's seasonality curve, and building a second cell→region resolution
   here would duplicate it. **04-07** is *not* the same thing and does not supply
   this: its `data/seasonal-composition.json` is a cause×month and age×month
   reweighting of *who* dies, mean-1 normalised so annual totals are unchanged.
   This figure needs monthly mortality *level* per cell — the cell's rate times
   its region's seasonal curve — which is a different quantity. Neither plan
   produces it, so this figure either derives it at runtime or gets its own
   baked artifact.
4. Slider: needs to be smooth enough to read as a cycle, which argues for
   precomputed per-month colour arrays and a redraw on tick rather than a
   recompute. Also needs a keyboard story and a decision on autoplay.
5. `en.charts.ts:252-263` strings all change — the aria label, the legend
   caption ("monthly deviation strength" may no longer describe it), and the
   tooltips, which currently name a source tier per polygon. What a per-cell
   tooltip says about provenance is an open question: the tier is a property of
   the unit the curve came from, not of the cell.
