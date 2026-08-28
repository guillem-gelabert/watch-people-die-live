---
phase: 5
plan: 05-02
title: Reject scroll inertia in the pull-to-globe gesture
type: implementation
wave: 1
depends_on: []
files_modified:
  - app/roadmap/PullToGlobe.tsx
autonomous: true
requirements:
  - STORY-02
---

<objective>
`onWheel` accepts any downward delta while at the end of the document, so a trackpad's momentum tail feeds the pull, fills the bar, and then — because "momentum stopped" is indistinguishable from "the reader let go" — fires. The reader is thrown to the top of a hundred-screen story without asking. Gate the input on deliberateness, then reconsider the threshold.
</objective>

<tasks>

1. **Momentum cannot arm the gesture**
   - type: implementation
   - files: `app/roadmap/PullToGlobe.tsx`
   - action: Gate `onWheel` (`:155-160`) on the page having come to rest at the bottom before any delta is accepted. Record the timestamp at which `atEnd()` first became true and ignore deltas until a quiet interval longer than a momentum tail has elapsed (start at ~300ms; a real pull survives its own silence, momentum cannot). Reset the gate whenever `atEnd()` goes false so leaving and returning re-arms it.
   - verify: Manual, in the browser — flick hard into the bottom of `/roadmap` on a trackpad and confirm the bar does not fill. Then pull deliberately and confirm it does.
   - acceptance_criteria:
     - A hard trackpad flick into the end of the page never fills the bar, at any momentum.
     - A deliberate sustained pull at the bottom still fills and fires.
     - Leaving the bottom and coming back does not carry stale progress.

2. **The release condition still means "stopped pulling"**
   - type: implementation
   - files: `app/roadmap/PullToGlobe.tsx`
   - action: `tick` fires when `armed && startY == null && now - lastWheel >= RELEASE_MS` (`:110-113`). With task 1 in place this is no longer reachable by momentum, but confirm the reasoning holds and that `RELEASE_MS` (150) is still the right value for a real wheel pause. Do **not** try to fix the bug by raising `RELEASE_MS` alone — that only requires a longer momentum tail to reproduce.
   - verify: Read the interaction between the new gate, `lastWheel` and `LEAK_PER_SECOND`; confirm no path fires without a rest-gated delta.
   - acceptance_criteria:
     - No code path reaches `fire()` from wheel input that did not pass the task-1 gate.
     - The touch path (`onTouchMove`/`onTouchEnd`) is unchanged — it requires a live finger and was never affected.

3. **The gesture costs more, if it still needs to**
   - type: implementation
   - files: `app/roadmap/PullToGlobe.tsx`
   - action: Re-evaluate `THRESHOLD` (260, `:10`) *after* tasks 1-2 land. The comment there records a previous raise from 104px for this same symptom, so the instinct to raise it again is really a workaround for the inertia bug. If overshoot is still reachable, prefer stiffening the spring — `SOFTNESS = THRESHOLD / 2.2` (`:15`) currently spends three-quarters of the bar on the first half of the travel — over lengthening the total pull, since the design's stated intent (`:11-14`) is that the *end* of the gesture feels like a decision.
   - verify: Manual — confirm a deliberate pull does not feel slower than before to someone who means it.
   - acceptance_criteria:
     - Either a documented reason `THRESHOLD` was left alone, or a change with the reasoning recorded in the comment.
     - The keyboard/screen-reader path (`#pull-button`, `:180`) is untouched and still scrolls to top on click.

</tasks>

<verification>

- `pnpm run typecheck && pnpm run lint && pnpm test`
- Manual, trackpad: hard flick into the bottom × 5, confirm zero fires.
- Manual, trackpad: deliberate sustained pull, confirm it fires.
- Manual, touch (iOS via `pnpm dev:ios`): confirm the thumb gesture is unchanged.
- Keyboard: tab to the pull button, Enter, confirm it returns to top.

</verification>

<success_criteria>

- Momentum never fires the gesture; deliberate pulls still do.
- The touch and keyboard paths are behaviourally unchanged.
- Any threshold change is justified in the comment, not silently tuned.

</success_criteria>

<notes>
The bug is wheel-only. iOS Safari emits no `wheel` for momentum scroll, and `onTouchMove` requires a live finger, so touch was never affected — do not "fix" the touch path.

Two alternatives to the rest-gate were considered and are worth knowing about if the gate proves too blunt: watching the delta envelope for decay (momentum decays monotonically, a real pull is flat or rising) is more precise but fragile across browsers that quantise deltas differently; requiring a direction change overlaps heavily with the rest-gate. Start with the rest-gate.

Verification here is mostly manual because the failure mode is a momentum tail no unit test reproduces faithfully. If a regression test is wanted, the honest one is a synthetic sequence of decaying `wheel` deltas asserted not to reach `fire()`.
</notes>
