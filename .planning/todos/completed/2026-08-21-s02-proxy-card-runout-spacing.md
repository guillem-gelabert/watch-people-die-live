---
created: 2026-08-21T10:56:28.783Z
title: Unstick the proxy card as soon as the fold completes
priority: 9
area: story
resolved: 2026-08-29 — shipped in 3de66476, together with s03. The container is no longer viewport multiples plus a RUN_OUT constant. stackHeightFor is the folded card's measured chrome plus the deterministic folded boxes plus exactly one strip's travel per strip, so the stack ends where the fold ends. Measured at vh 819 — completion 1909px past the pin, release at 1916, so 7px of dead scroll where there were 115, and the next paragraph sits 14px below the card, one story rhythm gap. The modal's auto-open lands at 4.93 strips with the card still pinned at top 12, which is what makes the run-out unnecessary rather than merely shorter. Answering this file's open question, the card releases essentially at completion and does not hold for a beat; the gap is a measured constant, the same on phone and desktop.
decisions:
  - Measured chrome, not a measured card. Card-minus-boxes is constant at every point in the fold, and the existing natural-height layout effect already invalidates on the only two things that move it, width and language, so no ResizeObserver is needed. Measuring the whole card would have wanted one.
  - Fold progress reads the stack's top against the sticky pin (foldUnits), never rect.height. Deriving the pacing and the container height from the same number is what coupled them; splitting them is what lets the container be resized without changing the feel.
  - STRIP_TRAVEL = 0.47 preserves the shipped pacing exactly. The old geometry gave the fold (2.97 − 0.5)vh across an overshoot of 5.25 strips, i.e. 0.4705vh per strip. SCREENS_PER_STRIP = 0.55 was nominal and never what shipped.
  - The card releases ~0.04 strips after the fold completes, 4.96 against 5.0, a deliberate ~0.02vh lead so `complete` is robustly reachable while the card is still pinned. Releasing exactly at completion risks a frame where neither holds.
  - Rejected shrinking or dropping RUN_OUT, the cheap direction this file proposed. It couples the release point to OVERSHOOT, so any later change to the fold curve would move the spacing again.
files:
  - app/roadmap/proxy/ProxyRankingCard.tsx
  - app/roadmap/proxy/useProxyFold.ts
  - app/roadmap/proxy/useProxyFold.test.ts
  - app/roadmap/roadmap.css
---

## Problem

**Needs discussion before implementing — the fix changes the reading rhythm of
the section, and the desired end state is a design call.**

Once all five strips are fully folded, the reader keeps scrolling and the card
keeps sticking. `.proxy-card` is `position: sticky; top: 12px`
(`roadmap.css:2687-2692`) inside `.proxy-stack`, whose height is set in JS to

    vh * SCREENS_PER_STRIP(0.55) * 5 + vh * RUN_OUT(0.22)

(`ProxyRankingCard.tsx:56-58`). The fold itself finishes at `raw > 0.951`
(`OVERSHOOT = 5.25`, `useProxyFold.ts:11` and `:46-50`), so the last ~5% of the
stack's travel — the `RUN_OUT` — is scroll where nothing changes: the card is
finished, and it stays pinned while the remaining empty container scrolls past
underneath it.

Reported symptom: "when the proxies card is completely collapsed and the user
keeps scrolling down, the card stays stuck until all the space between it and
the next paragraph is collapsed."

Wanted: the paragraph that follows the card should always sit at a **constant
distance below the card's bottom margin**, so the card releases at the moment
the ranking becomes legible rather than after an extra stretch of dead scroll.

## Solution

TBD — to be decided in discussion. The tension is that `RUN_OUT` is not purely
dead space: it is also what stops the card unsticking mid-fold on a short
viewport, and it is the travel the modal's auto-open (see s03) currently lands
in.

Candidate directions:

- **Shrink or drop `RUN_OUT`** and let the stack end where the fold ends. Cheap,
  but couples the release point to `OVERSHOOT`, and any future change to the
  fold curve moves the spacing again.
- **Compute the stack height from the folded card's measured height** rather
  than from viewport multiples, so the container ends exactly one card-height
  plus the intended gap after the fold completes. More robust, needs the card
  measured (`boxesRef` already exists) and re-measured on resize.
- **Keep the container and pull the next paragraph up** with a negative margin
  driven off `fold.complete`. Simplest visually, worst structurally — the gap
  becomes a magic number tied to two viewport constants.

Open questions for the discussion:

- Should the card release *at* fold completion, or hold for a beat so the
  finished ranking is readable while pinned?
- Same constant gap on phone and desktop, or viewport-relative?
- What is the interaction with s03 — if the modal no longer opens automatically
  at the end of the fold, does the run-out have any remaining job?
