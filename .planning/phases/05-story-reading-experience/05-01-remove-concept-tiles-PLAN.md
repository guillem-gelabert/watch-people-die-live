---
phase: 5
plan: 05-01
title: Remove the concept tiles from the who section
type: implementation
wave: 1
depends_on: []
files_modified:
  - app/roadmap/storySlots.tsx
  - app/roadmap/ConceptTiles.tsx
  - app/roadmap/conceptTileDefs.ts
  - app/roadmap/roadmap.css
  - docs/ROADMAP.md
  - docs/ROADMAP.ca.md
  - docs/ROADMAP.de.md
  - lib/i18n/en.ts
  - lib/i18n/ca.ts
  - lib/i18n/de.ts
autonomous: true
requirements:
  - STORY-01
---

<objective>
The `who` section ends with three expandable "bento" asides — `[what the clock got wrong]` → `<ConceptTiles set="clock" />` — sitting under the deaths-by-age chart. They restate caveats the section has already made. Remove the slot, and remove the machinery behind it, which has no other call site.
</objective>

<tasks>

1. **The slot is gone from the story**
   - type: implementation
   - files: `app/roadmap/storySlots.tsx`, `docs/ROADMAP.md`, `docs/ROADMAP.ca.md`, `docs/ROADMAP.de.md`
   - action: Delete the `"[what the clock got wrong]"` entry from the `who` group in `storySlots.tsx:254`, and delete the matching `[what the clock got wrong]` placeholder line from all three story markdown files (`ROADMAP.md:271` and its two translations).
   - verify: `pnpm test` — `app/roadmap/storyTranslations.test.ts` enforces identical section keys and `[slot]` placeholders across the three languages, so an edit to one file and not the others fails here.
   - acceptance_criteria:
     - No `[what the clock got wrong]` string remains anywhere under `docs/` or `app/`.
     - `storyTranslations.test.ts` passes.
     - The `who` section still renders `[sampling order]` and `[deaths by age and cause]` in that order.

2. **The component and its defs are deleted, not orphaned**
   - type: implementation
   - files: `app/roadmap/ConceptTiles.tsx`, `app/roadmap/conceptTileDefs.ts`
   - action: `conceptTileDefs.ts:25` returns `null` for any set other than `clock`, and `clock` is the only set defined, so removing the slot leaves `ConceptTiles` with zero call sites. Delete both files and the `import ConceptTiles` line in `storySlots.tsx:5`.
   - verify: `pnpm run typecheck` and `pnpm run lint`
   - acceptance_criteria:
     - Neither file exists.
     - No dangling import; typecheck and lint are clean.
     - `grep -r ConceptTiles app/ lib/` returns nothing.

3. **The i18n entries go with it**
   - type: implementation
   - files: `lib/i18n/en.ts`, `lib/i18n/ca.ts`, `lib/i18n/de.ts`
   - action: Remove the `concept: { clock: [...] }` block (`en.ts:189-214` and its two translations). `en.ts` is the schema, so it must go first or last consistently — removing it from `en.ts` makes the `ca`/`de` entries a type error until they are removed too, which is the intended forcing function.
   - verify: `pnpm run typecheck`
   - acceptance_criteria:
     - No `concept` key in any of the three dictionaries.
     - Typecheck is clean, meaning all three were edited.

4. **The CSS goes too**
   - type: implementation
   - files: `app/roadmap/roadmap.css`
   - action: Remove the `.concept-tiles` / `.concept-tile*` rules — the block at `:2424` onwards, plus the four selectors listed in the reduced-motion group at `:45-48`. There are 17 references in total.
   - verify: `pnpm run stylelint`, then `grep -c concept-tile app/roadmap/roadmap.css` returns 0.
   - acceptance_criteria:
     - No `concept-tile` selector remains.
     - Stylelint passes.
     - The reduced-motion group at `:45-48` is still syntactically valid after the four selectors are pulled out of it.

</tasks>

<verification>

- `pnpm run typecheck && pnpm run lint && pnpm run stylelint && pnpm test`
- Load `/roadmap`, scroll to the `who` chapter, confirm it ends on the deaths-by-age chart with no empty gap where the tiles were.
- `grep -rn "concept" app/ lib/ docs/` returns only unrelated prose.

</verification>

<success_criteria>

- The `who` section ends on its chart, not on three asides.
- No orphaned component, defs, i18n entries or CSS left behind.
- All four gates green.

</success_criteria>

<notes>
Mechanical, no design decisions. The only trap is partial editing across the three language files — `storyTranslations.test.ts` and the `en.ts`-as-schema typing both exist to catch exactly that, so run the gates rather than eyeballing it.

Task 4 is the one with a real chance of collateral damage: the reduced-motion group at `roadmap.css:45-48` is a shared selector list, so the four `concept-tile` entries must be removed from it without breaking the rules for the other selectors sharing that block.
</notes>
