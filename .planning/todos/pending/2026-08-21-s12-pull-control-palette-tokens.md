---
created: 2026-08-21T12:05:00.000Z
title: Move the pull-to-top control off hardcoded white onto palette tokens
priority: 5
area: story
related: s10 (blocks it whenever the chosen sky is light)
files:
  - app/roadmap/roadmap.css:2577
  - app/roadmap/roadmap.css:2617
  - app/roadmap/roadmap.css:2626-2628
  - app/roadmap/roadmap.css:2635
  - app/roadmap/palette.ts:413-421
---

## Problem

Split out of s10 on 2026-08-21. Every colour in the pull-to-globe control is a
literal white, not a palette token:

| Line   | Rule                       | Value                                           |
| ------ | -------------------------- | ----------------------------------------------- |
| `2577` | `#pull-hint` colour        | `rgb(255 255 255 / calc(60% + 40% * …))`         |
| `2617` | `#pull-track` background   | `rgb(255 255 255 / 16%)`                         |
| `2628` | `#pull-bar` fill           | `#fff` — commented "solid white, not the hint's own faded colour" |
| `2635` | ready-state track          | `rgb(255 255 255 / 34%)`                         |

This works today only because the closing section's sky is `#000000`. Every
other section of the story runs its chrome off the per-section custom properties
`palette.ts` writes (`--ink`, `--paper`, `--mute`, …), and this one control opted
out. So the moment the last screen gets a real background colour (s10), the
control either keeps enough contrast by luck or becomes unreadable — and there
is no way to tell from the CSS which.

The `#pull-bar` comment is worth preserving as intent rather than as a hex: the
fill is a progress readout and needs to stay brighter than the faded hint text
around it, which is a *relationship* between two tokens, not a literal white.

## Solution

TBD, small. Re-express the four rules against palette tokens so the control
follows the sky the way the rest of the story's chrome does:

- The hint text is the faded one — some mix of `--ink` toward the section's sky,
  keeping the existing `--pull-strength` interpolation from 60% to 100%.
- The track is the quietest surface — a low-alpha `--ink`, or `--tile`.
- The bar is the loud one, and must stay clearly brighter than the hint at
  `--pull-strength: 0`. If tokens make that relationship awkward to express, a
  dedicated token (the way `--ink-tile` was added for the KaTeX boxes — see
  `.planning/quick/260819-hk3-…`) is the established precedent here.

Verify against **both** ends: the current black closing sky must look unchanged,
and whatever s10 picks must be legible. Since s10's colour is not decided yet,
the honest test is to temporarily set the closing sky to a light value and check
the control survives it.

Do this **before s10** if the chosen colour is light. Skip it entirely if the
closing sky stays dark — in that case this is cleanup with no user-visible
effect, and drops to the bottom of the list.
