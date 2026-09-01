---
created: 2026-09-01T09:59:36.652Z
title: Colour the conflict stack by continent, and pin Others to the bottom
area: story
discuss: true
files:
  - app/roadmap/charts/ConflictEwmaWidget.tsx:58-93
  - app/roadmap/charts/ConflictEwmaWidget.tsx:126-130
  - app/roadmap/charts/ConflictEwmaWidget.tsx:203-228
  - app/roadmap/charts/ConflictEwmaWidget.tsx:302-313
  - app/roadmap/palette.ts:584-595
  - app/roadmap/palette.test.ts:418-425
  - lib/m49-geoscheme.ts
  - lib/acled-weekly.ts:505
  - lib/acled-weekly.ts:526
---

## Problem

Three requests for **"Weekly fatalities, and the weighted mean the globe uses"**, as asked:

1. Colour the bands by **continent**.
2. **Others** (the `elsewhere` band) always sits at the **bottom** of the bar.
3. Everything above it is sorted by size, **biggest at the top, smallest just above Others**.

Requests 2 and 3 are fully specified and need no design work. Request 1 is a
design problem, because colouring by continent alone reintroduces the exact
failure the current scheme exists to prevent — see below.

### Where each of the three lives today

**Order.** The bar is drawn in payload order, accumulating from the axis up
(`ConflictEwmaWidget.tsx:203-228`), and `buildWeekSegments` sorts biggest-first
(`lib/acled-weekly.ts:505` and `:526`). So today the **biggest band is at the
bottom**, the smallest at the top, and Others falls wherever its size puts it —
currently mid-stack, since it is 11-20% of a bar since the floor went to 10%.
The request inverts that and pins Others.

This is a presentation change, not a data change: `data/conflicts.json` can stay
sorted biggest-first and the widget can transform to
`[elsewhere, ...rest ascending]` at render. Do it that way — re-sorting the
payload would need the snapshot rebuilt for a change no consumer of the data
wants, and the builder's sort is what `keys` ranking and the tooltip's
"largest first" member lists read.

**The gotcha.** The draw order is encoded in *two* loops that must agree: the
`<rect>` loop at `:203-228` and the pointer hit-test at `:302-313`, which walks
`week.segments` accumulating the same way to decide which band the cursor is
over. Change one without the other and every tooltip names the wrong country.
`hover.si` is an index into `week.segments`, so either both loops iterate a
shared reordered array, or the reorder has to be a lookup that preserves the
index.

**Colour.** Today colour is keyed to the *place*, not the continent, over two
ramps: six vivid hues for country bands (`--conflict-color-0..5`) and eight
quiet mono shades for region bands (`--conflict-region-color-0..7`), generated
in `palette.ts:584-595` and asserted slot-by-slot in `palette.test.ts:418-425`.
Assignment is a greedy graph colouring over "these two bands are ever drawn in
the same bar" (`ConflictEwmaWidget.tsx:58-93`), which is what guarantees no bar
shows the same fill twice.

### Why request 1 needs a decision first

Measured against the current committed snapshot, resolving each band's continent
from its members' M49 chains:

- Only **four** continents ever appear — Africa, Asia, Americas, Europe. Oceania
  never does: ACLED's at-sea events have no M49 and go to Others.
- **Two bands share a continent in 11 of the 12 bars**, at most two per continent
  per bar. Examples: `Myanmar + Asia`, `Western Africa + Eastern Africa`,
  `Sub-Saharan Africa + Burkina Faso`, `Asia + Southern Asia`.
- **Others spans more than one continent in all 12 weeks**, by construction — it
  collects leftovers plus the no-M49 orphans.

So one colour per continent would put two identical fills in the same bar in
almost every bar, which with no legend reads as one band. That is the defect
s09's decision note records the greedy colouring as fixing. A continent scheme
therefore needs a **shade ramp per continent**, at least two deep, with the same
greedy assignment applied *within* a continent — four hues × 2-3 shades, plus a
neutral for Others, in place of today's 6 + 8.

Note also that `geoschemeChain` takes a **country** M49 and returns the chain
ending at a continent; passing it a region code (11, 142, 202) returns null. A
band's continent has to come from its members, which is sound because a rolled-up
band's members all sit inside it.

## Solution

TBD for the colour half. The order half is settled.

**Order** — transform at render: `[elsewhere, ...rest.sort(ascending)]`, drawn
from the axis up, applied to the `<rect>` loop and the hit-test together. Leave
`buildWeekSegments` and the payload alone.

**Colour** — the shape of the answer is four continent hues with a shade ramp
each, but the open questions are the design call:

- Which hues? The section's palette is generated from the sky, so this is
  `harmony(4, sky, true)` for the continents plus a mono ramp per hue, rather
  than four hand-picked colours. Needs a look at whether four vivid hues each
  with 2-3 shades stays legible at the bar widths the chart actually gets.
- Does a **country** band keep a vivid fill and a **region** band a quiet one
  within its continent's hue, preserving today's country-vs-region read? That
  would make the shade carry two meanings at once — kind and collision
  avoidance — which may be one too many.
- What colour is Others, given it is genuinely multi-continent? A neutral grey is
  the obvious answer and pairs with pinning it to the bottom.
- Does the legend need to change? There is none today; the tooltip carries the
  names. Colouring by continent invites a four-swatch legend, which is new
  chrome in a section that has deliberately little.

**This supersedes, rather than regresses, s09's colour decision** ("colour is a
graph colouring, not a cycle"). The greedy pass stays — it just runs within a
continent's ramp instead of across one global ramp per kind. Say so in whatever
ships, so the next reader does not mistake it for the bug s09 fixed.
