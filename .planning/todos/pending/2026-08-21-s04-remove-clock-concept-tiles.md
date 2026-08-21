---
created: 2026-08-21T10:56:28.783Z
title: Remove the concept tiles beneath the deaths-by-age chart
priority: 1
area: story
files:
  - app/roadmap/storySlots.tsx:254
  - app/roadmap/ConceptTiles.tsx
  - app/roadmap/conceptTileDefs.ts:22-27
  - docs/ROADMAP.md:271
  - docs/ROADMAP.ca.md
  - docs/ROADMAP.de.md
---

## Problem

The `who` section ends with three expandable "bento" tiles — `[what the clock
got wrong]` → `<ConceptTiles set="clock" />` (`storySlots.tsx:254`), whose three
cards are `one-global-clock`, `deaths-in-the-ocean`, `poisson-process`
(`conceptTileDefs.ts:22`). They sit directly under **"Deaths by age, and what
they die of"** (`AgeMix`, `storySlots.tsx:245-253`).

They should go. The section already lands its point with the sampling-order
chain and the age/cause chart; the three asides restate caveats the reader has
either absorbed or does not need at that moment.

## Solution

1. Drop the `"[what the clock got wrong]"` slot from `storySlots.tsx:254`.
2. Remove the `[what the clock got wrong]` placeholder line from all three
   story markdown files — `docs/ROADMAP.md:271`, `ROADMAP.ca.md`,
   `ROADMAP.de.md`. `app/roadmap/storyTranslations.test.ts` enforces identical
   `[slot]` placeholders across the three, so they must be edited together or
   the test fails.
3. Decide what happens to the machinery. `ConceptTiles` and `conceptTileDefs`
   are generic (`set` prop, `conceptTiles(d, set)`), and `clock` is the only set
   currently defined (`conceptTileDefs.ts:25` returns `null` for anything else)
   — so removing the slot leaves the component with no call site. Either delete
   `ConceptTiles.tsx` + `conceptTileDefs.ts` + the `.concept-tile*` CSS and the
   `d.concept.clock` entries in `lib/i18n/{en,ca,de}.ts`, or keep the component
   and only remove the `clock` set. Deleting is cleaner unless another section
   is expected to want tiles soon.
4. `en.ts` is the i18n schema, so removing `concept.clock` from it makes the
   `ca`/`de` entries a type error until they are removed too.
