---
phase: 5
plan: 05-02
subsystem: story
tags:
  - roadmap-story
  - gesture
  - retro-recorded
key-files:
  - app/roadmap/PullToGlobe.tsx
---

# Plan 05-02 Summary: Reject scroll inertia in the pull-to-globe gesture

## One-liner

A trackpad's momentum tail can no longer fill the pull bar: deltas are only accepted once the wheel has been quiet at the end of the page, because momentum cannot survive its own silence.

## Completed Work

Shipped in commit `711e0020`, "fix(story): stop scroll momentum firing the pull-to-globe gesture", with `1c471fac` behind it. Recorded here retroactively after verifying every acceptance criterion against the current tree.

- `SETTLE_MS = 300` gate in `onWheel`: deltas are discarded until the wheel has gone quiet for longer than a momentum tail. `lastWheelAny` is updated on **every** event including discarded ones, so a thrown-away momentum stream cannot look like silence to the next delta.
- `settled` resets whenever `atEnd()` goes false, so leaving and returning re-arms the gate.
- `RELEASE_MS` left at 150 — the plan explicitly warned against "fixing" this by raising the release window, since that only requires a longer tail to reproduce.
- `THRESHOLD` raised 260 → 340 and `SOFTNESS` loosened `/2.2` → `/2.8`, with the reasoning recorded in the comment: the gate now carries the job of resisting a coast, so the threshold is raised for its own sake and the divisor rose with it rather than staying proportional, "a longer pull with the old curve would have been a longer *cheap* pull".

## Commits

| Task | Commit | Description |
| ---- | ------ | ----------- |
| Momentum gate, threshold and spring | `711e0020` | fix(story): stop scroll momentum firing the pull-to-globe gesture |
| Release-on-stop precursor | `1c471fac` | fix(story): fire the pull on release, and hold the proxy title until the box stops |

## Verification

Re-run 2026-08-23 against the current tree:

| Criterion | Result |
| --------- | ------ |
| No `fire()` path from wheel input that skipped the gate | confirmed by reading `onWheel` — every branch either returns or sets `settled` first |
| Momentum clock updated on discarded events | `lastWheelAny = now` before the gate, not after |
| Gate re-arms on leaving the end | `settled = false` when `!atEnd()` |
| `RELEASE_MS` unchanged at 150 | confirmed |
| Threshold change justified in the comment, not silently tuned | confirmed — the comment records both raises and why this one differs |
| Touch path unchanged | `touchstart`/`touchmove`/`touchend` listeners intact and independent of the wheel gate |
| Keyboard path intact | `#pull-button` still `scrollTo({ top: 0 })` on click |
| typecheck / lint / test | clean, 132 passed |

## Deviations

- **Recorded retroactively**, as with 05-01.
- **Manual trackpad and iOS verification not re-run here.** The plan's verification includes a hard flick × 5 on a real trackpad and a thumb gesture over Tailscale on iOS. Those were the basis of the original fix; this retroactive pass verified the code paths, the constants and the recorded reasoning, not the feel. Worth one manual flick before the milestone audit.

## Self-Check

PASSED on code and criteria. The feel of the gesture is asserted from the original session, not re-measured.
