---
phase: 5
plan: 05-03
title: Freeze the proxy identity colours
type: implementation
wave: 1
depends_on: []
files_modified:
  - app/roadmap/palette.ts
  - app/roadmap/palette.test.ts
autonomous: false
requirements:
  - STORY-03
---

<objective>
`proxyColors(sky)` returns `schemes(sky, true).analogous` — five hues derived from whichever sky is currently up — so the five seasonality proxies have no stable identity colour. Reordering was already solved (colour is keyed to `data-proxy` index, not position); the sky axis was not. Replace the derived anchors with fixed values without breaking the legibility pass that keeps the transparent figures readable.
</objective>

<tasks>

1. **CHECKPOINT — pick the five colours**
   - type: decision
   - files: `app/roadmap/palette.ts`
   - action: Produce two or three candidate five-colour sets with a contrast report, and stop for a decision. Sensible default to offer: freeze the *current* look by evaluating `schemes(sky, true).analogous` at the seasonality chapter's own sky (`#bcd8ee`, `when-seasonality`) and hardcoding that result — nothing changes visually where the reader meets the proxies, and the drift elsewhere stops. Offer at least one alternative with wider hue separation, since analogous schemes are by construction the hardest five to tell apart.
   - verify: For each candidate, report the contrast ratio of all five colours against every sky declared in `docs/ROADMAP.md`, and the pairwise separation between the five.
   - acceptance_criteria:
     - Each candidate set is five concrete colour values.
     - A contrast table exists covering every story sky, not just the seasonality one.
     - Execution stops here for a human choice — do not pick one and proceed.

2. **`proxyColors` returns the constant**
   - type: implementation
   - files: `app/roadmap/palette.ts`
   - action: Define the chosen five as a module-level constant and have `proxyColors()` return it. Keep the existing signature so `proxyHarmony` (`:278`), `proxyMarks` (`:285`) and the `--proxy-color-${index}` emitter (`:414-416`) need no change — which also means `ProxyRankingCard`, `ProxyScorecard`, `SortableProxyList` and `ProxyStrip` are untouched by this plan.
   - verify: `pnpm run typecheck`; confirm the five custom properties still appear in `skinToCssVars` output.
   - acceptance_criteria:
     - `proxyColors` ignores `sky` and returns the constant.
     - `--proxy-color-0..4` are still emitted, same names.
     - No consumer file is modified.

3. **The legibility pass stays sky-aware**
   - type: implementation
   - files: `app/roadmap/palette.ts`
   - action: Deliberately keep `proxyMarks` running its `marks()` 3:1 pass against the live sky. The *anchor* is what should be fixed; the *correction* must stay dynamic because the proxy figures are transparent canvases compositing over whatever sky is up. Freezing both would make the charts illegible on some skies.
   - verify: Compare `proxyMarks(i, 4, sky)` output across two different skies and confirm it still differs.
   - acceptance_criteria:
     - A fixed anchor still produces sky-corrected marks.
     - The distinction between fixed anchor and dynamic correction is recorded in a comment, since the next reader will otherwise "finish the job" and freeze the marks too.

4. **Tests reflect the new contract**
   - type: implementation
   - files: `app/roadmap/palette.test.ts`
   - action: Check whether the existing tests assert on the derived analogous scheme; update any that do. Add a test asserting `proxyColors` returns identical values for two different skies — the regression that would otherwise silently reappear.
   - verify: `pnpm test`
   - acceptance_criteria:
     - A test fails if `proxyColors` becomes sky-dependent again.
     - A test still covers `proxyMarks` differing by sky.

</tasks>

<verification>

- `pnpm run typecheck && pnpm run lint && pnpm test`
- Load `/roadmap`, scroll the whole seasonality chapter, and confirm no proxy strip changes hue as the sky transitions.
- Confirm each of the five proxy charts still reads against its section's sky.

</verification>

<success_criteria>

- The five proxy colours are fixed values, stable across every sky.
- The transparent proxy figures are still legible on every sky.
- A test guards the regression.

</success_criteria>

<findings>

**Task 1 ran on 2026-08-21 and the acceptance criterion in it was wrong.** It asked for contrast
against every story sky. The proxy colours do not sit on the sky: `ProxyStrip.tsx:94` paints the
raw `--proxy-color-N` as a strip background inside the card, with `STRIP_INK = "#ffffff"` on top.
The correct metric is contrast against **white**. (Chart marks are a separate path and self-correct
through `marks()`.)

Measured against white, every candidate fails, including the shipped one:

| Freeze at        |   p0 |   p1 |   p2 |   p3 |   p4 |  min | spread |
| ---------------- | ---- | ---- | ---- | ---- | ---- | ---- | ------ |
| when-seasonality | 3.37 | 8.51 | 1.61 | 6.82 | 1.44 | 1.44 |   7.07 |
| first-light      | 6.37 | 3.32 | 9.72 | 3.96 | 3.86 | 3.32 |   6.41 |
| who              | 3.90 | 8.79 | 1.59 | 6.37 | 1.44 | 1.44 |   7.36 |
| where-region     | 1.34 | 1.46 | 1.60 | 1.45 | 3.03 | 1.34 |   1.68 |

No sky's analogous set reaches 4.5:1 on all five, and none reaches even 3:1 on all five except
`first-light` (3.32). White text on p2 and p4 at the seasonality sky is at 1.61 and 1.44 — that is
a pre-existing legibility defect, not something freezing introduces.

The cause is in the comment at `ProxyStrip.tsx:28-30`, which says the fills are "all vivid
analogous members at one lightness, so they read as a set". They are at one *HSL* lightness, which
is not one *luminance*: at L=50 a yellow and a blue differ by a factor of five in relative
luminance. The note also records that an earlier attempt to switch some rows to dark ink "by
measured luminance" was reverted for looking different from the design — so this trade-off has
already been hit once and resolved in favour of the design.

An even hue spread makes it strictly worse, which is why the analogous scheme is not arbitrary:
a pentadic set from the same recipe scores 3.37 / 5.39 / 4.81 / **1.17** / **1.46** against white.
Wider separation and white ink are in direct conflict.

**Task 3's premise is not yet verified.** The check run compared `proxyMarks` across two skies and
saw it differ, but with `proxyColors` still sky-derived that difference could come from the anchor
rather than from `marks()`. It has to be re-run after task 2 to mean anything.

</findings>

<notes>
`autonomous: false` — task 1 is a design decision, not a derivation. The plan can produce candidates and a contrast table automatically, but choosing among them is taste and belongs to a human.

The mechanical part of this plan is small; nearly all of its value and risk is in task 1. Do not let the small diff tempt a shortcut past the contrast table — analogous schemes are the hardest five colours to keep distinguishable, and the current set was never checked against anything but the sky that generated it.
</notes>
