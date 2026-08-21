---
created: 2026-08-21T10:56:28.783Z
title: Unstick the proxy card as soon as the fold completes
priority: 7
area: story
discuss: true
files:
  - app/roadmap/proxy/useProxyFold.ts:9-13
  - app/roadmap/proxy/useProxyFold.ts:36-56
  - app/roadmap/proxy/ProxyRankingCard.tsx:12-15
  - app/roadmap/proxy/ProxyRankingCard.tsx:52-60
  - app/roadmap/roadmap.css:2672-2692
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
