---
phase: 5
plan: 05-01
subsystem: story
tags:
  - roadmap-story
  - cleanup
  - retro-recorded
key-files:
  - app/roadmap/storySlots.tsx
  - app/roadmap/roadmap.css
  - docs/ROADMAP.md
  - lib/i18n/en.ts
requirements-completed: [STORY-01]
---

# Plan 05-01 Summary: Remove the concept tiles from the who section

## One-liner

The three expandable asides under the deaths-by-age chart are gone, along with the component, defs, i18n entries and CSS behind them.

## Completed Work

Shipped in commit `ea3ba510`, "feat(story): drop the concept tiles from the who section", before this plan was formally executed. Recorded here retroactively after verifying every acceptance criterion against the current tree.

- `[what the clock got wrong]` slot removed from the `who` group in `storySlots.tsx` and from all three story markdown files.
- `app/roadmap/ConceptTiles.tsx` and `app/roadmap/conceptTileDefs.ts` deleted, not orphaned; no dangling import.
- `concept: { clock: [...] }` removed from all three dictionaries.
- `.concept-tile*` rules removed from `roadmap.css`, including the four selectors that shared the reduced-motion group.

## Commits

| Task | Commit | Description |
| ---- | ------ | ----------- |
| Slot, component, i18n, CSS | `ea3ba510` | feat(story): drop the concept tiles from the who section |

## Verification

Re-run 2026-08-23 against the current tree:

```bash
pnpm run typecheck && pnpm run lint && pnpm run stylelint && pnpm test
```

| Criterion | Check | Result |
| --------- | ----- | ------ |
| No `[what the clock got wrong]` anywhere | `grep -rn` over `docs/ app/ lib/` | 0 |
| No `ConceptTiles` call sites | `grep -rn` over `app/ lib/` | 0 |
| Both files deleted | `ls` | absent |
| No `concept` key in any dictionary | `grep -c` over en/ca/de | 0, 0, 0 |
| No `concept-tile` CSS selector | `grep -c` on `roadmap.css` | 0 |
| `who` section ends on its chart | last two slots are `[sampling order]`, `[deaths by age and cause]` | confirmed |
| `storyTranslations.test.ts` | `pnpm test` | 132 passed |
| typecheck / lint / stylelint | all four gates | clean |

## Deviations

- **Recorded retroactively.** The work was done and committed without a SUMMARY.md, so GSD counted the plan as unexecuted. Same bookkeeping gap that phase 04 had; found by `/gsd:autonomous` phase discovery, which listed this as runnable when it was already complete.

## Self-Check

PASSED. Verified against criteria rather than assumed from the commit message: nothing orphaned, all four gates green.
