---
phase: 5
plan: 05-03
subsystem: story
tags:
  - palette
  - accessibility
  - decision-recorded
key-files:
  - app/roadmap/palette.ts
  - app/roadmap/palette.test.ts
  - app/roadmap/proxy/ProxyStrip.tsx
requirements-completed: [STORY-03]
---

# Plan 05-03 Summary: Freeze the proxy identity colours

## One-liner

The five proxy colours were already frozen; what was outstanding was the checkpoint decision, and it resolved as "keep the design, record the accessibility cost" — now documented in both places someone would touch it, and pinned by a test.

## Completed Work

Tasks 2, 3 and 4 were already in the tree: `proxyColors()` takes no sky and returns a module constant, `proxyMarks` still runs its `marks()` pass against the live sky, and `palette.test.ts` already guarded against sky-dependence returning. This plan closed task 1 and the one verification the earlier run could not make.

- **Task 1 decision taken.** White ink on the five fills is below WCAG AA on three of them. Two alternatives were measured and both declined in favour of the design as drawn. Recorded in the `PROXY_COLORS` comment with the numbers and the rejected options.
- **`proxy/ProxyStrip.tsx` note extended** so the cost is stated where `STRIP_INK` is defined — the place someone would change it back without seeing the palette comment.
- **Contrast pinned by test.** A new case asserts the measured ratio of all five against white, plus that p2 and p4 are under 3:1. Changing a fill now fails the suite, forcing whoever does it to look at the contrast rather than discover it later.
- **Task 3's premise verified for real.** The earlier check compared `proxyMarks` across skies while the anchor was still sky-derived, so it proved nothing. Re-run with the anchor genuinely fixed: 3 distinct mark sets across 3 skies for p0, p2 and p4 — the fixed anchor does still produce sky-corrected marks.

## Commits

| Task | Commit | Description |
| ---- | ------ | ----------- |
| Decision, documentation, contrast pin | (this change) | docs(palette): record the proxy-colour contrast decision |

## The decision

Measured against `#ffffff`, which is what `STRIP_INK` paints on every fill:

| | fill | white contrast | verdict |
| --- | --- | --- | --- |
| p0 | `#088ef7` | 3.37 | below 4.5 |
| p1 | `#0816f7` | 8.51 | passes |
| p2 | `#07e4d6` | **1.61** | far below |
| p3 | `#7108f7` | 6.82 | passes |
| p4 | `#08f771` | **1.44** | far below |

4.5:1 is the applicable bar, not the large-text 3:1: `.proxy-strip-body` is 14.5px, so the 24px title's exemption does not carry the strip.

Root cause, worth keeping because it explains why no re-pick fixes it: the design's "all at one lightness" is one *HSL* lightness, which is not one luminance. A cyan and a deep blue at L=50 differ ninefold in relative luminance. Widening hue separation makes it strictly worse — a pentadic set from the same recipe scores 1.17 and 1.46 on two members.

Declined alternatives, both measured:

| Option | Result | Why declined |
| ------ | ------ | ------------ |
| Darken p0/p2/p4 to `#0778d2`/`#04857d`/`#04893f` | all five at 4.51; luminance spread tightens 9.3x → 2.5x | turns the cyan teal and the green forest — a visible change to the design |
| Keep fills, near-black ink on p0/p2/p4 | 5.83 / 12.25 / 13.63; every hue preserved exactly | flips three of five rows; this is the change already tried and reverted for breaking the set apart |

Chosen: keep the design, document the cost. Recorded as a deliberate trade-off rather than left implicit.

## Verification

```bash
pnpm run typecheck && pnpm run lint && pnpm run stylelint && pnpm test
```

All four gates green; 133 tests (up one — the contrast pin).

| Criterion | Result |
| --------- | ------ |
| `proxyColors` ignores sky, returns the constant | already true; guarded by two existing tests |
| `--proxy-color-0..4` still emitted, same names | unchanged; no consumer file modified |
| Fixed anchor still yields sky-corrected marks | verified: 3 distinct mark sets across 3 skies |
| Distinction between fixed anchor and dynamic correction recorded | in the `proxyMarks` comment, and now reinforced in the `PROXY_COLORS` block |
| A test fails if `proxyColors` becomes sky-dependent again | yes, pre-existing |

## Deviations

- **The plan's own task-1 acceptance criterion was wrong and stayed wrong.** It asked for contrast against every story sky. The fills are not composited over the sky — `ProxyStrip` paints them as an opaque background with white ink on top, so the metric is contrast against white. The plan's `<findings>` block had already caught this; this pass acted on the corrected metric.
- **Not a code fix.** The chosen resolution changes no colour. The deliverable is a recorded decision plus a regression pin, which is a legitimate outcome for a checkpoint plan but means STORY-03's original framing — "each proxy keeps one identity colour regardless of the section sky" — was satisfied by earlier work, not by this plan.
- **Stale path corrected**: the palette comment referenced `ProxyStrip` at its old location; it now lives at `app/roadmap/proxy/ProxyStrip.tsx`.

## Self-Check

PASSED with a caveat worth stating plainly: the strip is measurably below WCAG AA for three of five proxies, by choice. That is now visible in the palette comment, in the `STRIP_INK` note, and in a test that fails if the numbers move — but it is a known accessibility debt, not a resolved issue.
