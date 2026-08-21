---
created: 2026-08-21T11:42:00.000Z
title: Stop scroll inertia arming the pull-to-top, and make the gesture cost more
priority: 2
area: story
files:
  - app/roadmap/PullToGlobe.tsx:155-160
  - app/roadmap/PullToGlobe.tsx:10-24
  - app/roadmap/PullToGlobe.tsx:96-117
---

## Problem

The pull-to-return-to-globe gesture fires on its own when the reader coasts into
the bottom of the page.

`onWheel` (`PullToGlobe.tsx:155-160`) accepts any downward delta while at the
end of the document:

```js
const onWheel = (e: WheelEvent) => {
  if (fired || !atEnd() || e.deltaY <= 0) return;
  pull = Math.min(THRESHOLD * 1.6, pull + e.deltaY);
  lastWheel = performance.now();
  run();
};
```

A macOS trackpad flick keeps emitting decaying `wheel` events for hundreds of
milliseconds after the fingers have left the surface, and a mouse wheel with
smooth-scrolling does much the same. Those momentum deltas are indistinguishable
here from a deliberate pull, so they accumulate into `pull`. `LEAK_PER_SECOND`
(520, `:22`) is meant to unwind an unfed pull, but momentum deltas arrive far
faster than they leak, so the bar fills. Then `tick` at `:110-113` sees
`armed && startY == null && now - lastWheel >= RELEASE_MS` — momentum stopping
*is* the release condition — and calls `fire()`. The reader is thrown back to
the top of a hundred-screen story without having asked.

Touch is not affected in the same way: `onTouchMove` requires a live finger, and
iOS emits no `wheel` for momentum scroll. This is a trackpad and smooth-wheel
bug.

Separately, the gesture should cost more than it does. `THRESHOLD` is 260px
(`:10`), and the comment there already records one raise from 104px for exactly
this reason — "the old 104px could be reached by overshooting the last
paragraph". It is still reachable by overshooting.

## Solution

TBD. Two changes, and the first is the real one.

**Reject inertia.** Options, roughly in order of how well they distinguish
intent from momentum:

- **Require a rest before arming.** Record when `atEnd()` first became true and
  ignore wheel deltas until the page has been quiet for longer than a momentum
  tail (~250-400ms). A reader who means it will still be pulling after the coast
  has died; momentum cannot survive its own silence. Cheapest and most robust.
- **Watch the delta envelope.** Momentum decays monotonically; a real pull is
  flat or rising. Track the last few deltas and only feed `pull` when the
  sequence is not decaying. More precise, more state, and fragile across
  browsers that quantise deltas differently.
- **Require a direction change.** Momentum arriving at the bottom is a
  continuation of the same scroll; a deliberate pull often starts after a pause
  or a reversal. Overlaps the rest-based option.

Note the interaction with `fire()`'s release condition: if inertia is filtered
at the input, "momentum stopped" is no longer a false release, but the
`now - lastWheel >= RELEASE_MS` check still needs to mean "the reader stopped
pulling". Raising `RELEASE_MS` (150) alone would not fix the bug — it would just
require a longer momentum tail.

**Raise the cost.** Increase `THRESHOLD`, and/or stiffen the spring — `SOFTNESS`
is `THRESHOLD / 2.2` (`:15`), so the first half of the travel currently fills
three-quarters of the bar. Making the last stretch cost proportionally more is
probably better than a longer total pull, since the point of the design (per the
comment at `:11-14`) is that the end of the gesture should feel like a decision.
Do this second: with inertia filtered, the existing 260px may already be enough,
and a longer pull is a real cost to the reader who does want it.

Acceptance criteria:

- Coasting into the bottom of the page with a hard trackpad flick never fires,
  no matter how much momentum.
- A deliberate sustained pull at the bottom still fires, and does not feel
  slower to the reader who means it.
- The keyboard/screen-reader path (`#pull-button`, `:180`) is unaffected.
