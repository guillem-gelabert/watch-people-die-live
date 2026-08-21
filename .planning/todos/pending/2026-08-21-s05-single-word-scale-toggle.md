---
created: 2026-08-21T10:56:28.783Z
title: Make the scale toggle one word that morphs between straight and curved
priority: 10
area: story
files:
  - app/roadmap/charts/ScaleDiagonalToggle.tsx:34-58
  - app/roadmap/charts/DensityMap.tsx:458
  - app/roadmap/roadmap.css:592-620
  - lib/i18n/en.charts.ts
---

## Problem

`ScaleDiagonalToggle` currently shows **both** options at once: one square split
along its anti-diagonal, "Logarithmic" bent along a curve in the top-left half
and "Linear" running straight across the bottom-right, the active half filled
with `var(--hi)` and the inactive one a 14% mix towards paper
(`ScaleDiagonalToggle.tsx:19-21`). Two words, two halves, two `<textPath>`
elements over two `<defs>` paths (`:37-40`).

It should be **one word**. The control shows the state it is in — "linear" or
"log", drawn straight or curved — and on click the text changes and the
curvature animates from one to the other, so the word visibly bends or
straightens as the scale does. Same idea the current design is reaching for
(the word drawn the way the scale behaves), one word instead of a diptych.

## Solution

Draw a single `<textPath>` against one path whose `d` is animated between the
two shapes. The two existing paths are already the right end states:

    log:    M6,80 C16,34 36,16 84,8
    linear: M36,96 L96,36

They are not interpolation-compatible as written — a 3-point cubic against a
2-point line. Reparameterise both as the same command sequence, e.g. express the
linear case as a cubic whose control points lie on the line
(`M6,80 C32,54 58,28 84,8`, control points at ⅓ and ⅔), so the `d` attribute can
be tweened attribute-by-attribute or via a CSS `d` transition. Straight and
curved then share a start and end point and the word only bends.

Points to settle while implementing:

- **Text**: new short i18n strings, one word each ("linear" / "log", or
  "straight" / "curved" — the user offered both pairings). `charts.densityMap`
  currently holds `scaleLog`, `scaleLinear`, `scaleSpoken`; adding to `en.charts.ts`
  makes `ca`/`de` type errors until translated.
- **Animation**: CSS `transition: d` is supported in current Safari/Chrome but
  needs the paths to be interpolation-compatible as above; a rAF tween on the
  attribute is the fallback. The word swap should land mid-animation, not at
  either end, so the reader sees the new word bend into place.
- **Halves**: with one word there is no anti-diagonal split to fill. Decide what
  carries state visually instead — a single fill, or the whole square tinted.
  `roadmap.css:606-620` (`.scale-diagonal-half`) is likely deletable.
- **A11y**: keep `aria-pressed` and the `.sr-only` `scaleSpoken` label; a
  one-word visible label makes the spoken label more load-bearing, not less.
- Only call site is `DensityMap.tsx:458`.
