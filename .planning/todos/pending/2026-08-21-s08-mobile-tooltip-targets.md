---
created: 2026-08-21T10:56:28.783Z
title: Make a chosen subset of chart tooltips reachable on touch
priority: 14
area: story
discuss: true
files:
  - app/roadmap/tooltip.ts:33-53
  - app/roadmap/charts/AmplitudeScatter.tsx
  - app/roadmap/charts/LatitudeScatter.tsx
  - app/roadmap/charts/NeighbourScatter.tsx
  - app/roadmap/charts/GdpScatter.tsx
  - app/roadmap/charts/Pop65Scatter.tsx
  - docs/mobile-parity-report.md
---

## Problem

**Needs discussion in depth — this is a design problem before it is a code
problem.**

`app/roadmap/tooltip.ts` is a single shared `<div>` positioned by direct DOM
writes from D3 `.on()` handlers, driven off pointer events. On a phone there is
no hover, so every tooltip in the story is unreachable — and with it every
country name, every amplitude figure, every provenance tier the scatters encode
only in their tooltips.

The obvious fix (make tooltips tap-triggered) does not work here: the scatters
plot hundreds of countries or regions and the dots cluster hard, so most taps
would either hit nothing or hit an arbitrary member of a clump. A 44px touch
target over a chart where twenty dots share 44px is not a tooltip, it is a
lottery.

The idea to explore instead: **do not make every tooltip reachable — choose
which one a region of the chart shows.** Partition each chart's plot area into
zones and give each zone one representative point whose tooltip a tap surfaces,
picked for what it teaches rather than for proximity to the finger.

## Solution

TBD — deliberately open. Things the discussion needs to settle:

- **What "representative" means.** Candidates: the most extreme point in the
  zone, the largest-population country, the one the surrounding prose names, or
  a hand-picked list per chart. Hand-picked is the most editorially honest and
  the least maintainable; extremes are automatic but often obscure countries.
- **Which charts get it at all.** The five proxy scatters carry the argument, so
  they matter most. Maps (`AmplitudeMap`, `ConflictMap`,
  `SubnationalChoroplethMap`) have a different problem — polygons are large
  enough to tap, so they may just need touch handlers, not zone selection.
- **Zone geometry.** A fixed grid, a Voronoi over the chosen representatives, or
  bands along the x-axis (which for a scatter arguing "amplitude vs. latitude"
  is the axis that carries the point).
- **Whether a tapped tooltip is dismissible and how.** The current tooltip has
  no dismiss path — `hideTooltip()` is called on pointer-out, which touch does
  not produce.
- **Whether desktop behaviour changes.** Ideally not: hover stays exact,
  touch gets the curated subset. That means two code paths and a
  `matchMedia("(hover: none)")` branch, which is a maintenance cost worth naming
  up front.
- **Whether the honest answer is a legend instead.** If only a dozen points per
  chart are worth naming, labelling them directly on the chart may beat any
  tooltip scheme — and would help desktop readers too.

`docs/mobile-parity-report.md` is the existing survey of what the phone loses;
start there.
