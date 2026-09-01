---
created: 2026-09-01T12:00:00.000Z
title: Give the conflict stacked bar chart a rounded background
area: story
resolved: >-
  2026-09-01 — shipped in 02dd7f6, the same day it was captured. Scoped to this chart as an
  exception recorded on .ewma-widget, with the two "figures carry no chrome" rules left standing for
  the other ~20 figures. The plate is the palette's own paper tone, it wraps the whole widget rather
  than just the svg so it cannot cut between the chart and its sliders, and the radius needed no
  decision because .story-figure already declared 10px against a transparent background.
decisions:
  - >-
    The bars are now generated against the plate, not the sky. stackBand, shadeRamp and stackNeutral
    take the background explicitly. This was the whole of the real work: measured, a plate only 10%
    off the sky puts every fill under 3:1 on all ten skies, and paper on the dark sky takes the
    residual's neutral to 2.26:1. The neutral fails first in both cases, because it sits closest to
    the background's own luminance by construction.
  - >-
    Retargeting improved the bars rather than merely keeping them legal. A light plate leaves the
    dark band three times the room the sky did, so the shade pair two co-occurring bands of one
    continent get went from 32 apart in RGB to 105, and from 2.28:1 to 3.9:1 on the Conflicts sky.
  - >-
    It settled the aesthetic question this chart was left open with. Asia's lighter shade was neon
    magenta against the peach sky and reads as a soft lilac against paper, so the hue-slot
    reordering that was on the table is no longer needed.
  - >-
    Rejected a subtle plate — the sky nudged 10% toward ink — even though it is what the no-chrome
    rule would have preferred. It sits at 1.17:1 against its own sky, which is not a background
    anyone can see, and moving the background toward mid-luminance squeezed the shade pair to 24
    apart.
  - >-
    Left alone: the estimate box is --ink at 14% opacity, so over a light plate it reads grey where
    over peach it read tan. It is the projection rather than the data, and being easier to tell
    apart is the right way round.
test_finding: >-
  A palette test has to name the surface it is asserting about. The old assertion — every conflict
  fill clears 3:1 against the sky — would have kept passing after the plate landed while being a
  statement about a surface the bars are no longer drawn on. There is now also a test that the plate
  is visible against the sky at all, at least 1.15:1 everywhere and 1.5:1 on the Conflicts sky,
  because nothing else would have caught a background nobody can see.
files:
  - app/roadmap/palette.ts
  - app/roadmap/palette.test.ts
  - app/roadmap/roadmap.css
---

## Problem

Asked for: a background with rounded corners behind the conflicts stacked bar chart
(**"Weekly fatalities, and the weighted mean the globe uses"**).

The radius is already there and unused. `.story-figure` sets `border-radius: 10px` with
`background: transparent` (`roadmap.css:621-628`), so the moment a background lands the corners
round themselves at 10px with no new value to pick.

**The background is the part that needs deciding, because two comments in the stylesheet say
figures do not get one, and they give a reason rather than a preference.**

`roadmap.css:621` — _"Every figure in the story is transparent and sits directly on the section's
sky."_

`roadmap.css:851-854` — _"Figures carry no chrome. Every canvas and svg in the story is transparent
and composites straight onto the section's sky, so a card around one would put a second surface
between the reader and the page — and the palette already tells them where the figure starts."_

So this is not "add a background to one chart". It is either a deliberate exception for the one
figure that has earned it, or a change of mind about figure chrome across the whole story. Which of
those it is changes the work: an exception is one rule scoped to `.ewma-widget`, and a change of
mind is `.story-figure` plus `.chart-panel` and a look at all ~20 figures on all ten skies.

There is also a live reason this chart in particular might want one, which is worth weighing rather
than assuming: since 2026-09-01 its bands are coloured by continent and every fill is generated to
clear 3:1 **against the section's sky**. A plate behind the bars changes what they are measured
against, so `shadeRamp` in `palette.ts` would have to take the plate's colour instead of the sky's
— otherwise the contrast guarantee the palette tests assert becomes a guarantee about the wrong
surface.

## Solution

TBD — the questions below are the decision, not the CSS.

- Exception or new rule? If exception, why this figure and not the others: because it is the only
  one with a residual band that can be a 1.6px hairline against the sky, or for another reason?
- What colour is the plate? The story has no panel surface today. `skinFromSky` produces `paper`
  and panel tones that nothing in a figure currently uses, so there may already be a right answer
  in the palette rather than a new value to invent.
- Does the plate sit behind the whole `.ewma-widget` (chart plus its sliders and readout) or just
  the `<svg>`? The controls are type on the sky today, and a plate behind only the chart would cut
  between them.
- `shadeRamp` and `stackNeutral` must then measure against the plate, not the sky, and
  `palette.test.ts` asserts 3:1 against the sky for every conflict fill across all ten skies. Those
  assertions move with the decision.
- Radius: 10px is already declared and matches the story's other 9-12px radii. Nothing to pick
  unless the plate wants a different one from the figure clip.
