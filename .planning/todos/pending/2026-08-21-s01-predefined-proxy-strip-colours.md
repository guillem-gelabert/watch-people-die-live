---
created: 2026-08-21T10:56:28.783Z
title: Give the proxy strips predefined colours, not sky-derived ones
priority: 1
area: story
files:
  - app/roadmap/palette.ts:273-276
  - app/roadmap/palette.ts:413-421
  - app/roadmap/proxy/ProxyRankingCard.tsx:39-41
  - app/roadmap/proxy/ProxyScorecard.tsx:54
  - app/roadmap/proxy/ProxyStrip.tsx:94
---

## Problem

The five proxy strips in **Potential seasonality proxies** are painted from
`var(--proxy-color-0..4)`, which `palette.ts:414-416` writes out of
`proxyColors(sky)` — and that is `schemes(sky, true).analogous`
(`palette.ts:274`), i.e. five hues *derived from the section's sky colour*.

`ProxyRankingCard.tsx:39-40` already took care of the reordering half of the
problem: colour is keyed to a proxy's `data-proxy` identity, not its position,
so dragging rows never repaints a strip. But the colours are still dynamic in
the other axis — they are a function of the sky, so they shift as the story's
sky transitions, and the five proxies have no stable identity colour a reader
can carry from the card down into the five charts that answer it.

That matters more here than for a generic chart palette, because the whole
device depends on recognition: `proxyMarks(idx, n, sky)` (`palette.ts:285`)
draws each proxy's own charts in that proxy's colour. If the anchor hue moves,
the link between "the strip I ranked first" and "the chart that scores it" is
weaker than it looks in a single screenshot.

## Solution

Replace the derived anchors with five fixed, hand-picked hues:

1. Define a literal five-colour constant (one per `PROXY_INDICES` entry) and
   have `proxyColors()` return it, ignoring `sky` — or keep the signature and
   return the constant, so `proxyHarmony`/`proxyMarks` need no change.
2. Keep the `--proxy-color-${index}` custom-property names so
   `ProxyRankingCard`, `ProxyScorecard` and `SortableProxyList` are untouched.
3. Decide what happens to `proxyMarks`: the marks still run through the
   `marks()` 3:1 legibility pass against the sky, and probably should stay
   sky-aware even with a fixed anchor, since the figures are transparent and
   composite over whatever sky is up. Fixing the *anchor* while keeping the
   *legibility correction* dynamic is likely the right split.
4. Check `palette.test.ts` — it may assert on the derived scheme.

Colour choice is a design decision, not a mechanical one: the five need to be
distinguishable from each other, and each needs to clear contrast against every
sky the seasonality chapter passes through.
