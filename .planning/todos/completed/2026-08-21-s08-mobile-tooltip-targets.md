---
created: 2026-08-21T10:56:28.783Z
title: Make a chosen subset of chart tooltips reachable on touch
priority: 14
area: story
resolved: >-
  2026-09-01 — shipped in 81de1b0. Measuring first collapsed the six open questions in this file
  into one answer. Per series rather than per chart, the country series run 76-87 points at a mean
  of 5-14 rivals inside a 44px target and the region series run 221-229 at a mean of 28-82, and
  every chart has both — so the rules layer per candidate, not per chart. A country dot keeps a
  thumb's radius; a region is reachable only through one labelled representative per country the
  story names, at any distance, which is a Voronoi over the representatives without drawing one.
  Whichever is picked is ringed as the tooltip opens. Verified with 25 taps spread over each plot:
  the four curated charts reach a labelled point 25 of 25, the two uncurated ones 12 and 13, which
  is the radius working rather than a gap. Hover is untouched — the picker never attaches where
  "(hover: none)" is false.
decisions:
  - >-
    "Representative" means a country the story's own prose names. There are twelve, and they are
    labelled on the chart on every device — which is what separates this from a lottery, since the
    targets are visible before aiming, and why the set must stay small. labelRepresentatives drops
    any label that will not fit and returns only those placed, so the picker cannot offer a target
    the reader cannot see.
  - >-
    Rejected the zone-partition geometry this file proposed. Nearest-representative is the same
    partition without the chrome: drawing zone boundaries on five figures would add a grid the data
    does not have, and the labels already show where the cells are.
  - >-
    Rejected "make every tooltip tap-triggered" on measurement, not taste. The worst clump in the
    region series puts 135 points inside one 44px target.
  - >-
    Dismissal is tapping the shown point again. A finger never produces the pointerleave that
    hideTooltip hangs off, so without this there is no way to close one.
  - >-
    The list carries ISO3 codes as well as names, and the charts stay free of i18n-iso-countries:
    they are client components, and the library would follow the whole ISO table into the bundle for
    a twelve-row lookup. A test carries the cost instead.
  - >-
    Checked against the English prose only. Unlike the data's country names, the story's prose
    translates them — ca "Alemanya", de "Deutschland" — so the English file, already the schema the
    other two are checked against, is the only one that can answer whether the story names a
    country. The consequence is that ca/de labels read "Germany" beside a paragraph saying
    "Alemanya", consistent with the tooltips, which have always shown the data's own names.
  - >-
    ConflictMap's 780 centroids are not covered, and the remainder is captured separately. "The
    countries the prose names" does not fit a conflict map: the story names Mexico and Brazil, the
    map is Ukraine, Sudan and Myanmar. It needs its own rule.
test_finding: >-
  Three measurements each corrected a design assumption that would otherwise have shipped as a quiet
  defect. The smoothing demo looked like the one already-tappable chart; its dots are aria-hidden
  and carry no tooltip, and it was only in the survey because the probe counted circles rather than
  tooltips. NeighbourScatter looked like a 297-point chart needing curation; 221 of those are
  context rings and its filled series is 76 countries, so the curation belonged on the other series.
  And the region series key on ISO3, so matching representatives by display name silently matched
  nothing — the failure looked exactly like "no country here is named in the prose". Survey per
  series, not per chart, and never trust a probe's notion of what a point is.
files:
  - app/roadmap/charts/touchPick.ts
  - app/roadmap/charts/touchPick.test.ts
  - app/roadmap/charts/representatives.ts
  - app/roadmap/charts/representatives.test.ts
  - app/roadmap/charts/AmplitudeScatter.tsx
  - app/roadmap/charts/NeighbourScatter.tsx
  - app/roadmap/charts/LatitudeScatter.tsx
  - app/roadmap/charts/KoppenGeigerScatter.tsx
  - app/roadmap/charts/RegionNeighbourScatter.tsx
  - app/roadmap/roadmap.css
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
