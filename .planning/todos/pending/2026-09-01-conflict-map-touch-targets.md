---
created: 2026-09-01T14:00:00.000Z
title: Give the conflict centroid map its own touch representatives
area: story
discuss: true
files:
  - app/roadmap/charts/ConflictMap.tsx
  - app/roadmap/charts/touchPick.ts
  - app/roadmap/charts/representatives.ts
---

## Problem

s08 gave six point charts a touch path (`81de1b0`) and deliberately left one out:
**ConflictMap**, the approximate admin-1 centroid map of the last twelve weeks'
fatalities. It is the densest cloud in the story — **780 circles, a mean of 116
rivals inside a 44px target, worst clump 223** — so its tooltips are still
unreachable on a phone.

The mechanism it needs already exists. `attachTapPicker` takes candidates with a
per-candidate `reach`, so a curated set works here exactly as it does on the
scatters. What does not carry over is **which points are representative**.

s08's answer was "the countries the story's prose names", and that answer is
wrong for this chart. The prose names Mexico, Lithuania, Bulgaria, Germany,
Ireland, Sweden, Spain, Japan, India, Brazil, South Africa and Togo. The map is
Ukraine, Sudan, Myanmar, Nigeria and Palestine. Applying `NAMED_IN_PROSE` here
would label two or three irrelevant points and leave the subject of the figure
untappable, so it was left out rather than guessed at.

## Solution

TBD — the representative rule is the decision.

The obvious candidate is **the largest by fatalities**, which fits a figure whose
whole subject is magnitude and needs no editorial list: take the top N centroids,
label them, let a tap reach the nearest. It is also automatic, so it survives the
weekly ACLED rebuild without anyone revisiting a hand-authored list.

Open questions:

- How many? The stack beside it draws at most 7 bands, and the map is smaller on
  a phone than the scatters are. Somewhere between 5 and 10, decided by what fits
  once `labelRepresentatives` has dropped the collisions.
- Label with the country, the admin-1 name, or both? The tooltip already carries
  the full identity; `"Ukraine"` may be the useful label where
  `"Donetska (UKR)"` is not.
- Does the label want the number too? A map of magnitudes where the labelled
  points are the largest could read as a top-N list, which is arguably a better
  figure than the one that is there — and if so, this stops being a touch fix and
  becomes a design change.
- Should the top-N be per window or fixed? Per window is honest and automatic but
  means the labels move week to week, which is the instability `assignFills`
  avoids for the stack's colours.
