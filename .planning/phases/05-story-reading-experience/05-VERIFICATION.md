---
phase: 5
status: passed
verified_at: 2026-08-28
verified_by: 06-01
plans:
  - 05-01
  - 05-02
  - 05-03
---

# Phase 5 Verification: Story Reading Experience

## Status

passed

Backfilled by plan 06-01. Phase 5 shipped on 2026-08-23 with SUMMARYs only and no verification
record, which the v2.0 milestone audit scored as three unsatisfied requirements even though the
integration checker traced all three wired. The evidence below was re-measured on 2026-08-28, not
copied from the original sessions — except where a criterion is inherently manual, which is stated.

## Criteria

| Criterion                                                                                                                                                              | Result     | Evidence                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. The `who` section ends on the deaths-by-age chart; no `[what the clock got wrong]` slot remains in any of the three story markdown files, and `storyTranslations.test.ts` still passes. | passed     | `grep -rn "what the clock got wrong" docs/ROADMAP*.md app/ lib/` returns nothing. No concept-tile component remains in `app/roadmap/`. `pnpm exec vitest run app/roadmap/storyTranslations.test.ts` passes, so EN/CA/DE still carry identical section keys, skies and `[slot]` placeholders. |
| 2. Coasting into the bottom of the page with a hard trackpad flick never returns the reader to the top, and a deliberate sustained pull still does.                       | passed     | `app/roadmap/PullToGlobe.tsx:31` `SETTLE_MS = 300`; the gate at `:176-183` computes `quiet = now - lastWheelAny` and returns before accumulating pull when `quiet < SETTLE_MS`, with `lastWheelAny` assigned *before* the gate (`:177`) so a continuous inertia stream can never satisfy it. |
| 3. The five proxy strip colours are fixed values that do not change when the story's sky changes, and each still clears its contrast floor against every sky the seasonality chapter passes through. | **partial** | First half passed: `proxyColors()` returns the `PROXY_COLORS` constant and ignores `sky`, pinned by `app/roadmap/palette.test.ts` (40 tests pass), which also asserts `proxyMarks` still differs by sky. Second half is a **recorded decision, not a pass** — see Gaps.                    |

## Commands Run

```bash
pnpm exec vitest run app/roadmap/storyTranslations.test.ts app/roadmap/palette.test.ts   # 2 files, 40 tests, pass
grep -rn "what the clock got wrong" docs/ROADMAP*.md app/ lib/                            # no matches
ls app/roadmap/ | grep -i "concept\|tile"                                                 # no matches
grep -n "SETTLE_MS\|lastWheelAny" app/roadmap/PullToGlobe.tsx
```

## Human Verification

Criterion 2's *feel* — that a hard flick coasting into the page bottom does not fire, while a
deliberate sustained pull does — was verified by hand on a trackpad and on a real iPhone over
Tailscale during 05-02's own session, and has **not** been re-measured here. The code-level gate is
re-verified above; the tactile threshold is not machine-checkable and remains asserted from that
session. Anyone changing `SETTLE_MS` should re-test by hand.

## Gaps

- **Criterion 3, second half: an accepted WCAG AA failure, by decision.** White ink on three of the
  five frozen proxy fills is below the 4.5:1 AA floor — measured ratios `[3.37, 8.51, 1.61, 6.82,
  1.44]`, so p0 (3.37), p2 (1.61) and p4 (1.44) fail; p2 and p4 are also below 3:1. 05-03 chose to
  freeze the current look rather than repaint the chapter: both alternatives were evaluated and
  rejected (a hue-shifted set reaching 4.51 changed the seasonality chapter's colour identity; a
  near-black ink reaching 5.83/12.25/13.63 broke the transparent-canvas compositing). The reasoning
  and both rejected options are recorded in `app/roadmap/palette.ts`, and the ratios are pinned by
  `palette.test.ts` so the failure cannot drift unnoticed. The *marks* pass their own 3:1 pass
  (`proxyMarks` stays sky-aware, deliberately) — it is the white text on the fills that fails.
  Carried forward as tech debt, not resolved.
- Stale prose reference to the removed concept tiles remains in `docs/mobile-parity-report.md:46`.
  Out of scope for both 05-01 and 06-01; documentation-only, reader-invisible.
