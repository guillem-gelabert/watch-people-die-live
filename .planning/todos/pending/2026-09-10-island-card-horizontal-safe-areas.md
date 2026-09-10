---
created: 2026-09-10T11:00:00.000Z
title: The expanded island card ignores horizontal safe areas
area: globe
prio: low
files:
  - app/globe.css
---

## Problem

`#island.is-open` is `width: min(360px, calc(100vw - 36px))` (`app/globe.css:134`) — 18px a side,
centred in the full viewport by `#island-wrap`'s `left: 0; right: 0`. A landscape inset on a
notched iPhone is typically 44px, so both edges of the card can sit under the rounded corner or the
camera housing. `--sa-left` and `--sa-right` are defined at `:root` (`app/globe.css:13-15`) and are
currently used by nothing.

The vertical axis is already handled: `#island-wrap` offsets by `--sa-top`, and
`#island.is-open.has-math` subtracts `--sa-top` and `--sa-bottom` from its height.

This is pre-existing — it was flagged during the 2026-09-10 review and left alone as out of scope,
which was right for a 224px card holding two lines of type. It matters more now. The derivation
lives inside the card, so the card is 520px tall and the content nearest the edges is the bar
percentage column and the scroll region, not prose with slack in it.

There is a fixed version in the history to copy: the standalone panel briefly carried
`right: calc(var(--sa-right, 0px) + 12px)` and
`width: min(304px, calc(100vw - var(--sa-left, 0px) - var(--sa-right, 0px) - 24px))` before the
panel itself was folded into the card and deleted (`4d5ebe4` added it, `41a3b1f` removed it).

## Solution

TBD, and the question is whether the card should stay centred.

- The straightforward version is `width: min(360px, calc(100vw - var(--sa-left) - var(--sa-right)
  - 36px))`. That keeps the card inside the safe box on both edges.
- Centring is doing the work of an inset today, and it is not equivalent: it protects the card only
  when the two insets are equal. Worth checking whether iOS reports them symmetrically in both
  landscape orientations, because if it does not, a centred card is off-centre relative to the safe
  box and one edge is tighter than the other.
- The collapsed pill is 242px wide and has slack at any realistic viewport, so this is only about
  the open state.

**Measure before deciding.** The claim above is read off the stylesheet, not off a device — nothing
here has been seen in landscape on hardware. Serve the tailnet URL to a real iPhone and rotate it;
a simulator's insets are not always the device's.
