---
created: 2026-08-21T10:56:28.783Z
title: Stop the proxy modal opening on reload, and fix the scroll jump on close
priority: 8
area: story
resolved: 2026-08-29 — shipped in 3de66476, together with s02, and every acceptance criterion in this file is met. Bug 1, the unprompted open. onComplete now fires only on a completion continuous with the previous frame — completionArmed arms only when the previous frame already had the last strip more than half folded, and lastPRef is null until the first unsuspended measure, so no first frame can fire. Any completion latches whether or not it fired, so a reader who arrived past the fold is in the same "already seen" state as one who scrolled through it; nothing resets the latch, and a dismissed modal never re-arms. Their way back in is the card's button, which now renders whenever the ranking is legible (fold.complete || spent) rather than only when spent, and reads proxy.rank until a ranking has been submitted, proxy.reorder after. Bug 2, the scroll jump. The placeholder takes the boxes' live height, captured in openModal before the state flip removes them from the DOM, with foldedBoxesHeight(5) = 254 as the fallback. FOLDED_HEIGHT * 5 = 230 was never right at any point in the fold, because folded strips keep stripStyle's 6px marginTop. Measured in a browser — folded 254/254, mid-fold 728/728, card height held, scroll delta 0 on both round trips.
decisions:
  - A calibration frame is not enough, which is why this file's own suggested fix was rejected. Next restores scroll asynchronously relative to first effects and the stack is 0px tall on frame one, so the restore can arrive as the second or third measure in one giant jump and fire anyway. Continuity across frames is the only reliable signal of a human scroll.
  - suspended stays as it was, and the fold still freezes while the modal is up. measure() returns before touching lastPRef when suspended, so the pre-modal p is still the frame the post-close measure is compared against. Unsuspending would have traded one jump for another, which this file already suspected.
  - The button fades in with the rails rather than mounting with them, because the card's chrome has to measure the same at every point in the fold — s02's stackHeightFor is built on exactly that.
  - Deleted as dead, grep-verified — paragraphStyle, isFolded and PARAGRAPH_GONE, since ProxyStrip inlines its own 0.55. The folded gap became FOLDED_GAP so stripStyle and foldedBoxesHeight cannot drift apart.
test_finding: 16 tests pin logic that has no component harness to catch it — the calibration frame never fires, an unarmed completion latches silently, a latched fold never refires across a suspended remount, completion precedes release, and foldedBoxesHeight(5) is 254. Each is a rule that reads as working software when broken, which is how bug 1 shipped in the first place.
follow_up: The ca and de wordings of proxy.rank are drafts and want a review. proxy.reorder was already translated; only rank is new.
files:
  - app/roadmap/proxy/ProxyRankingCard.tsx
  - app/roadmap/proxy/useProxyFold.ts
  - app/roadmap/proxy/useProxyFold.test.ts
  - app/roadmap/roadmap.css
  - lib/i18n/en.ts
  - lib/i18n/ca.ts
  - lib/i18n/de.ts
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
