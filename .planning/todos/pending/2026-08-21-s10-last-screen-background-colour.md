---
created: 2026-08-21T11:42:00.000Z
title: Give the last screen a background colour instead of black
related: s12 (pull control is hardcoded white)
priority: 6
resolved: closed 2026-08-21 - reverted to #000000 on request; net no-op
area: story
files:
  - docs/ROADMAP.md:295
  - docs/ROADMAP.ca.md
  - docs/ROADMAP.de.md
  - app/roadmap/Section.tsx:17
  - app/roadmap/StoryClient.tsx:133-155
  - app/roadmap/roadmap.css:2570-2583
---

## Problem

The bottom of the story reads as an unstyled black void. The closing section
declares its sky as pure black:

    ### back-to-the-globe · Back to the globe · #000000 · hidden

(`docs/ROADMAP.md:295`). `hidden` only suppresses the heading —
`storySections.ts:9-11` treats it as a `SectionHeadingKind`, nothing more — so
`Section.tsx:17` still emits `data-sky="#000000"` and `StoryClient` still
commits that palette when the section crosses the sky line. The last screen is
therefore deliberately black, and it looks like a page that ran out rather than
a page that ended.

It should have a real background colour. Every other section carries a hue
(`#bcd8ee` for seasonality, `#eeb87d` for conflicts, `#d9dbdd` for who,
`#cf7a68` for still-missing); the closing screen is the only one that opted out.

## Solution

TBD — the colour is a design choice, but the mechanism is a one-line change per
language file, so the work is deciding what it should be.

Constraints the choice has to satisfy:

- **The pull-to-globe chrome is drawn in hardcoded white**, so a light
  background breaks the closing control's contrast. Split out as **s12** — do
  that first if the chosen colour is light, or skip it entirely if the colour
  stays dark. This todo is now only the colour decision.
- **It is the handoff back to the globe**, which is black space with a lit
  earth. A colour that reads as continuous with the globe is probably better
  than one that contrasts with it — though the argument for contrast is that
  the transition should feel like arriving somewhere.
- **Three files, one value.** `docs/ROADMAP.md`, `.ca.md`, `.de.md` — the sky is
  part of the section declaration line, and `storyTranslations.test.ts` enforces
  identical section keys and skies across the three, so all three change or the
  test fails.

Worth checking against the iOS sticky/Safari-bar behaviour before settling: the
body deliberately tracks the section sky so the fallback band under the collapsed
URL bar reads as page rather than as chrome (see the note at
`roadmap.css:2677-2686`). A black final sky currently makes that band invisible
for free; a colour has to keep that property.

## Outcome

Closed 2026-08-21 without a colour change. `#0c223f` shipped briefly (1b6af761) and was reverted
to `#000000` on request, so the closing sky is back where it started and this todo nets out as a
no-op.

What did come out of it is **s12**, which was split off and kept: the pull control's four literal
whites now derive from `--ink`. That is real and independent of the colour — it means whoever
revisits this can change the closing sky to anything without stranding the control, which was the
blocker before.

Worth recording in case the original report meant something else: the last screen *is* painted.
`.story` carries `background-color: var(--sky, #001)` (roadmap.css:1849) and `StoryClient:225`
mirrors the active sky onto `document.body` for the iOS Safari-bar band. There is no unpainted
region at the bottom, so "should have a background colour" could only have meant the hue. If the
visual complaint persists with black, it is a different bug — look at the `.end-block` region and
the 0.55s `background-color` transition rather than at the declared sky.
