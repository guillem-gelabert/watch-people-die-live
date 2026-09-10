---
created: 2026-09-10T08:00:00.000Z
title: Show a death's derivation in the island — the arithmetic that placed it
area: globe
resolved: >-
  2026-09-10 — shipped across four commits the same day, never captured as a pending todo, so this
  file is written after the fact. `aa6d538` (dev port), `4d5ebe4` (the card, the country-rate
  pipeline and three review fixes), `30eaa1c` (notebook path), `41a3b1f` (folded the panel into the
  card). Deployed; the first three went out as one build, the fourth on its own.
decisions:
  - >-
    The card reads the same tables through the same helpers as the draw. `causeWeights()` was
    factored out of `pickCause()` so `explainPersona()` calls it rather than re-deriving a
    distribution, which means the odds shown are the odds sampled by construction and cannot drift.
    This is the whole reason the feature is honest, and it is a constraint on anything added to the
    card later — a number the card computes for itself is a number that can disagree with the sim.
  - >-
    The rate was recovered by division, not refetched. `data/rate-grid.json` ships only the product
    `cellPop x r`, and the World Bank could have supplied r again — but a refetched r would agree
    with the bake only approximately, and the card claims an exact multiplication. Since r is
    uniform within a country, `SUM w / SUM cellPop` over that country's cells returns it exactly,
    and `cellPop = w / r` then reproduces GPWv4 to the digit including for countries whose gridded
    population differs from the World Bank headline figure — which is precisely the discrepancy r
    absorbs.
  - >-
    The uniformity premise is asserted, not trusted. Both the build script and
    `data/country-rate.test.ts` check `pop x r == w` per cell against two error terms — QUANTUM 1e-6
    for `w`'s six-decimal rounding, DRIFT 1e-8 x w for the uncertainty r carries into large cells.
    Worst case across the grid today is Iceland at 1.6e-9. A real change of model, a subnational
    rate replacing the country one, would show up percent-scale, six orders of magnitude above
    this — so the check still catches what it is for, and the card's copy has to change with it.
  - >-
    Both halves are computed on open, not per death. The sim fires ~2 deaths a second and the card
    is open for a couple of seconds at a time, so the death carries only its inputs (m49, cellIndex,
    eventDate) and `explainDeath()` runs when a reader actually opens it.
  - >-
    The derivation started as a second panel at the bottom-right of the disc, on the reasoning that
    a card tall enough to hold it covered the globe it was explaining. That was reversed the same
    day: two surfaces to read and two to dismiss was the worse half of the trade. It now scrolls
    inside the card, which is capped at 520px so the globe stays on screen underneath.
  - >-
    `data/source/synthetic-cells.json` came out of the gitignore. It is 2 KB and it is not a fetched
    source but a pinned rejection-sampling draw — re-running `gen-synthetic-cells.ts` lands the
    cells elsewhere and they stop joining to the baked grid, so the draw the bake consumed has to be
    the one in the repo. `data/source/` is now globbed as `data/source/*` because a negation cannot
    re-include a file whose parent directory is excluded.
test_finding: >-
  A table that exists is not a table that can answer. `causeWeights()` returned any non-empty cell,
  so a band whose weights are all zero let `weightedPick()` fall through to its last entry while
  `normalise()` sent every probability to zero — the card would have named a cause and printed 0%
  beside it and every alternative. Found by review, not by a test, because every test served a table
  with real weights. The guard is now `total > 0 && Number.isFinite(total)`, and the regression test
  asserts both halves fall back together: no causes reported, and 200 draws that never return a
  label from the zeroed export.
files:
  - app/globe/Island.tsx
  - app/globe/Derivation.tsx
  - app/globe/explain.ts
  - app/globe/explain.test.ts
  - app/globe/persona.ts
  - app/globe/stageState.ts
  - app/globe/useGlobeData.ts
  - app/globe.css
  - scripts/build-country-rate.ts
  - data/country-rate.json
  - data/country-rate.test.ts
  - data/source/synthetic-cells.json
  - lib/i18n/en.ts
  - lib/i18n/ca.ts
  - lib/i18n/de.ts
  - lib/i18n/placeholders.test.ts
---

## Problem

The globe asserts. A dot appears over Malaysia and the island says "Man 61, ischaemic heart
disease" — and nothing on screen says why that cell, or how likely that person was. Every number
behind it exists at runtime and none of it was reachable.

The placement half was not merely hidden, it was **destroyed**. `notebooks/combine.ipynb` computes
`r(m49) = CDR x WBpop / 1000 / gridPop` and `w(cell) = cellPop x r`, then ships only `w`. So the
grid the globe samples cannot say how many people are in a cell or what rate applies to them; it
knows only the product. Showing "12,400 people x 9.53 per 1,000/yr" needed a factor the committed
data no longer carried.

The persona half was reachable but easy to get wrong. Age, sex and cause are each drawn from real
distributions, and a card that recomputed those distributions to display them would be a second
implementation of the sampler — one that could disagree with the draw it claims to explain, and
would do so silently.

## Solution

**`data/country-rate.json`, derived rather than refetched.** `scripts/build-country-rate.ts`
divides the rate grid by the density grid per country: `r = SUM w / SUM cellPop`. Exact rather
than a fit, because r is uniform within a country and only `cellPop` varies. 169 countries, every
one the grid can fire a death in — enforced by a build throw, since a missing rate means the island
silently drops the population line for whoever is missing. `data/country-rate.test.ts` holds the
committed file to `pop x r == w` across all ~60k populated cells.

**`explainPersona()` and `explainDeath()`, reading the sampler's own helpers.** `causeWeights()`
was extracted from `pickCause()` so the two share one definition of "the weights in play for this
country, sex, band and month", seasonal reweighting included. The card shows sex, the nine age
bands and the top five causes as normalised bars with the drawn outcome flagged, plus the drawn
cause appended when it placed outside the top five — most causes in a band are rare, and that is
part of what the card is showing.

**Inside the expanded island**, under the headline and over the buttons, as the only part of the
card that scrolls. The card is one big `role="button"`, so both its click and keydown handlers now
bail on events from `#island-math`: without that, a click meant to select a cause label closes the
thing being read, and Space — the scroll key for the region's own tab stop — toggles the card.

## Review findings, and what they cost

Three, from a review of the working tree before it was committed. Two were fixed as found; the
third was fixed and then undone by the redesign.

1. **All-zero cause tables** (high) — see `test_finding` above.
2. **The generator failed on a clean checkout** (medium) — `build-country-rate.ts` required a
   gitignored file while its own comment said absence was supported. Fixed by committing the
   prerequisite rather than by tolerating its absence, because the file is a pinned draw and
   regenerating it produces one that no longer joins. It now fails in 0.5s naming the file, instead
   of dying several seconds later on the coverage check.
3. **Horizontal safe areas** (medium) — the panel used `right: 12px` and a viewport-only width, so
   in landscape on a notched iPhone its percentage column and scrollbar could enter
   `safe-area-inset-right`. Fixed on `#island-math-wrap` — and then `#island-math-wrap` was deleted
   the same day when the panel was folded into the card. **The fix went with it.** See the
   follow-up below.

## Follow-up left open

**The expanded card does not account for horizontal safe areas.** `#island.is-open` is
`width: min(360px, calc(100vw - 36px))` (`app/globe.css:134`) — 18px a side, centred in the full
viewport, against a landscape inset that is typically 44px. `--sa-left` and `--sa-right` are
defined at `:root` and are now used by nothing.

This was a pre-existing issue on the pill, flagged and not fixed because it was out of the
review's scope. Folding the derivation into the card makes it matter more: the card went from
224px tall to 520px, and the content that would sit under a rounded corner is now the bar
percentages rather than two lines of type. The vertical insets are handled — the card's height
subtracts `--sa-top` and `--sa-bottom` — so this is only the horizontal axis.

Not yet verified on a real device in landscape — the claim is from the stylesheet, not from a
measurement. Captured as `2026-09-10-island-card-horizontal-safe-areas.md`.
