---
created: 2026-08-21T10:56:28.783Z
title: Stop the proxy modal opening on reload, and fix the scroll jump on close
priority: 6
area: story
discuss: true
files:
  - app/roadmap/proxy/useProxyFold.ts:36-56
  - app/roadmap/proxy/useProxyFold.ts:58-75
  - app/roadmap/proxy/ProxyRankingCard.tsx:43-48
  - app/roadmap/proxy/ProxyRankingCard.tsx:155-200
  - app/roadmap/proxy/useProxyFold.ts:8-9
---

## Problem

**Needs discussion — two coupled bugs, and the second one has no obviously
correct fix.**

### 1. The modal opens by itself after a reload

`useProxyFold` fires `onComplete()` the first time it sees every strip folded
(`useProxyFold.ts:51-55`), and `ProxyRankingCard.tsx:43-48` wires that straight
to `openModal`. The effect at `useProxyFold.ts:58-75` calls `handler()`
**immediately on mount**, before attaching the scroll listener. So reloading the
page anywhere at or past the end of the proxy stack measures a completed fold on
the very first frame and opens the ranking modal unprompted — no scroll, no
button press.

Wanted: the modal opens only when the reader **scrolls down into completion**,
or when the **Reorder** button (`ProxyRankingCard.tsx:189-197`) is pressed.

### 2. Closing the modal leaves the reader somewhere else

While the modal is up, the real `.proxy-boxes` is swapped for
`.proxy-boxes-placeholder` with a fixed height of `FOLDED_HEIGHT * 5` = 230px
(`ProxyRankingCard.tsx:172-177`). `FOLDED_HEIGHT` is 46 (`useProxyFold.ts:9`),
so that placeholder matches the real stack **only when the fold is complete** —
every strip at exactly `FOLDED_HEIGHT`, no interpolated padding or margin from
`stripStyle`.

When bug 1 fires, the modal can open with the fold *not* complete, so the card
shrinks to the placeholder height on open and grows back on close. Reported
symptom: "when the modal is closed the height of the card has shrunk and the
paragraph in the viewport is one which is further down below."

Two mechanisms feed this, and they are worth separating in the discussion:

- The placeholder/real height mismatch itself, which changes the card's height
  under a sticky element.
- `suspended: modalOpen || dragging` (`ProxyRankingCard.tsx:45`) freezes the
  fold while the modal is up, so on close `measure()` resumes from the current
  scroll position — which may be a different point in the fold than where the
  modal opened. The `.proxy-stack` comment (`ProxyRankingCard.tsx:157-160`)
  shows the container height was already deliberately preserved to stop the
  browser clamping the scroll position; the card's *inner* height was not.

## Solution

TBD.

Bug 1 has a clear direction: make `onComplete` fire only on a genuine
incomplete→complete transition caused by scrolling. E.g. treat the first
`measure()` as calibration — record the initial `complete` value and set
`completedRef` to it without invoking `onComplete`, so a page that loads already
past the fold starts in the "already seen" state. Needs a decision on what that
state means for `spent` / the Reorder button: a reader who reloads past the card
has never ranked anything, so the button (rendered only when `spent`) would not
be there to let them in. Options: always render Reorder once the fold is
complete, or arm the auto-open for the next upward-then-downward pass.

Bug 2 needs the placeholder to match the card's real height in every fold state
— measure the live `.proxy-boxes` height before swapping it out and use that,
rather than the folded-height constant. Whether the fold should also stay live
(unsuspended) while the modal is open is a separate question: suspending it is
what keeps the page from moving under the reader, so unsuspending trades one
jump for another.

Acceptance criteria to agree on:

- Reloading at any scroll position inside or past the proxy stack never opens
  the modal.
- Scrolling down through the fold for the first time opens it exactly once.
- Reorder always reachable for a reader who has not yet submitted.
- Closing the modal (submit or dismiss) leaves the same paragraph in the
  viewport that was there when it opened, measured to within a few pixels.
