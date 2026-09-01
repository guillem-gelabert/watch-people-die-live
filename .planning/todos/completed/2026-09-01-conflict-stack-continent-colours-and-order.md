---
created: 2026-09-01T09:59:36.652Z
title: Colour the conflict stack by continent, and pin Others to the bottom
area: story
resolved: >-
  2026-09-01 — shipped in 45c994f, both halves in one change. Others is pinned to the bottom of
  every bar and the bands above it climb to the largest at the top; colour is the band's continent,
  and the shade within it carries nothing but collision avoidance, which is the design call taken
  when this was captured. The order lives in charts/conflictStack.ts rather than in
  buildWeeklyStack, so the payload stays sorted biggest-first and no snapshot rebuild was needed.
  Verified in a browser across all 12 bars: Others is the floor of each, the heights climb above it,
  no bar repeats a fill or a resolved colour.
decisions:
  - >-
    The hue is a fixed slot from CONTINENTS, not a ranked one. That is stronger than the scheme it
    replaces: a continent keeps its colour across weeks it misses, across a snapshot rebuild, and
    across a change to the stack's floor, where the ranked scheme was stable only as long as the
    ranking was.
  - >-
    shadeRamp exists because mono(3) through marks() cannot work. contrastFix walks a colour until
    it clears 3:1 against the sky, so two shades of one hue both arrive at the same boundary —
    measured at 1.03:1 on the "Who" sky. Deriving the usable luminance band from the sky first and
    placing the shades inside it makes both properties true by construction. Ordered extremes-first
    so two co-occurring bands spend the most separated pair available.
  - >-
    Shades fan 14 degrees in hue as well as climbing in luminance, because a mid-luminance sky
    leaves almost no luminance room at 3:1 — on #cf7a68 the whole usable band is 0.02 to 0.05. The
    fan is narrow on purpose: harmony() at six puts two of its own hues 30 degrees apart, so a wider
    one would reach into a neighbouring continent's family.
  - >-
    A band's saturation is capped and the band's floor is reserved for the residual's neutral. Both
    constants come from a sweep against all three properties at once rather than a guess. At 0.5 and
    0.1 the pair a co-occurring couple gets is 32 apart in RGB at worst and 2.28:1 on the Conflicts
    sky, the neutral is 28 from the nearest shade, and every fill clears 3.08:1 against its own sky.
  - >-
    The aria label was left alone. It never described band order, so the reorder adds no strings and
    no translation debt.
  - >-
    Left open, and free to change: Asia is the loudest band on the Conflicts sky, because its slot
    lands about 120 degrees off a peach hue. Which continent takes which hue slot only has to be
    fixed, not CONTINENTS' own order.
test_finding: >-
  A screenshot caught what none of the numeric tests could. Asia's lighter shade rendered
  rgb(157,8,241), neon magenta beside bands of near-black green and brown — blue carries so little
  of the luminance that such a fill measures dark, passes every contrast assertion in
  palette.test.ts, and still reads as an alert. Contrast ratios cannot see chroma. Before that, the
  palette test caught two skies the measurement script had missed, because SKIES holds ten and only
  eight had been sampled: assert over the canonical list, never over a hand-copied one.
files:
  - app/roadmap/charts/conflictStack.ts
  - app/roadmap/charts/conflictStack.test.ts
  - app/roadmap/charts/ConflictEwmaWidget.tsx
  - app/roadmap/palette.ts
  - app/roadmap/palette.test.ts
  - lib/m49-geoscheme.ts
  - lib/m49-geoscheme.test.ts
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
