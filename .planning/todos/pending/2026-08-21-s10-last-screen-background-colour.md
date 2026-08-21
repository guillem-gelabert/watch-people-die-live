---
created: 2026-08-21T11:42:00.000Z
title: Give the last screen a background colour instead of black
priority: 10
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

- **The pull-to-globe chrome is drawn in white.** `roadmap.css:2577` sets
  `#pull-hint` to `rgb(255 255 255 / …)` and `:2634-2635` gives the track a
  white wash. Those are hardcoded rather than palette tokens, so a light
  background breaks the closing control's contrast. Either pick a dark colour,
  or move `#pull-hint`'s colours onto `--ink`/`--paper` tokens as part of this.
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
