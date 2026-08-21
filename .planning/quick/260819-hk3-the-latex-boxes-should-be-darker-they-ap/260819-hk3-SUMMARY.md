---
phase: quick-260819-hk3
plan: 1
subsystem: ui
tags: [css, palette, roadmap, katex, design-tokens]
status: complete

# Dependency graph
requires: []
provides:
  - "Skin.inkTile palette field: guaranteed-dark tile background on every sky"
  - "--ink-tile CSS custom property, consumed by .roadmap-math and .roadmap-code"
affects: [roadmap-story, palette]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tile surfaces that must stay dark on every sky derive from Skin.inkTile (mix(sky, INK, 0.55) when dark, else the section's own ink), not from Skin.ink, which is a text colour that flips to white on dark skies."

key-files:
  created: []
  modified:
    - app/roadmap/palette.ts
    - app/roadmap/palette.test.ts
    - app/roadmap/roadmap.css

key-decisions:
  - "Fixed .roadmap-code alongside .roadmap-math (not just the reported math boxes) since both shared the identical --ink background defect and the plan's own diagnosis grouped them as one design family."
  - "Left .chat-avatar, .chart-toggle button.active, and .smoothing-control.active untouched even though they share the same background: var(--ink) pattern — out of scope per the plan, flagged below as a follow-up."

requirements-completed: [QUICK-260819-hk3]

# Metrics
duration: 8min
completed: 2026-08-19
---

# Quick Task 260819-hk3: Darken the LaTeX/code tiles on dark skies Summary

**Added a guaranteed-dark `--ink-tile` palette token so `.roadmap-math` and `.roadmap-code` no longer inherit the section's white text colour as their background on dark-sky sections.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-08-19T10:47:00Z (approx, first commit 12:47:16+02:00)
- **Completed:** 2026-08-19T10:50:17Z
- **Tasks:** 3 (2 code tasks + 1 verification-only task)
- **Files modified:** 3

## Accomplishments

- Root cause confirmed: `.roadmap-math`/`.roadmap-code` painted `background: var(--ink)`, but `--ink` is the section's *text* colour, which `skinFromSky` flips to `#ffffff` on any sky with relative luminance below 0.2 — exactly the two sections that contain block math (`first-light` #2b1c3a, `back-to-the-globe` #000000).
- Added `Skin.inkTile` to `app/roadmap/palette.ts`: `mix(sky, INK, 0.55)` on dark skies (always darker than that section's `--paper`), and identical to `skin.ink` on light skies (`"#1d1822"`, unchanged behavior).
- Exposed the new field via `skinToCssVars` as `--ink-tile`, requiring no change to `StoryClient.tsx` since it already spreads `skinToCssVars`'s full output onto the scroll container.
- Repointed `.roadmap-math` and `.roadmap-code` backgrounds at `--ink-tile`, added `.roadmap-math` to the palette cross-fade `:where()` list (it qualified by the list's own stated rule but was missing, so its background previously snapped instead of cross-fading), and corrected the stale comment above `.roadmap-math-title`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add a guaranteed-dark `--ink-tile` palette token** - `cb7a2a48` (fix)
2. **Task 2: Point the ink-tile CSS rules at the new token** - `13da08d9` (fix)
3. **Task 3: Full verification gate + in-browser confirmation** - no commit (verification only)

**Plan metadata:** not committed — `commit_docs` is false for this project; `.planning/` artifacts (this SUMMARY, the PLAN) are left uncommitted on disk per instructions.

## Files Created/Modified

- `app/roadmap/palette.ts` - Added `inkTile: string` to the `Skin` interface; computed in both branches of `skinFromSky`; exposed as `--ink-tile` in `skinToCssVars`.
- `app/roadmap/palette.test.ts` - New `it(...)` in `describe("skinFromSky", ...)` asserting `inkTile` is darker than `paper` on dark skies (`#2b1c3a`, `#000000`) and equals `ink` on a light sky (`#bcd8ee`); new `describe("skinToCssVars", ...)` asserting the `--ink-tile` key round-trips `skin.inkTile`.
- `app/roadmap/roadmap.css` - `.roadmap-code` and `.roadmap-math` backgrounds changed from `var(--ink)` to `var(--ink-tile)`; `.roadmap-math` added to the palette cross-fade `:where()` selector list; stale comment above `.roadmap-math-title` corrected to name `--ink-tile`. **This file also carried pre-existing, unrelated uncommitted changes** (`.proxy-card`/`.proxy-scrim`/`.proxy-overlay` Safari sticky-element fix, paired with the already-modified `ProxyRankingCard.tsx`) that were in the working tree before this task started and necessarily rode along in the same commit — see "Deviations" below.

## Decisions Made

- `.roadmap-code` was fixed in the same commit as `.roadmap-math` even though the user only reported the math boxes, because both rules shared the exact same `background: var(--ink)` defect and the CSS's own comment already treats them as one design family ("the design's one intentional dark pseudo-code/formula block").
- `.chat-avatar`, `.chart-toggle button.active`, and `.smoothing-control.active` were left untouched — same `background: var(--ink)` pattern, likely the same near-white-on-dark-sky defect, but out of scope for this plan. Flagged as a follow-up (see below).

## Deviations from Plan

### Pre-existing unrelated file changes carried by the commit

**Not a deviation from this plan's own instructions** (the plan explicitly anticipated and permitted this — see `commit_scope`), but worth recording plainly: `app/roadmap/roadmap.css` had unrelated, already-uncommitted changes at the start of this task (a Safari-sticky-element fix restructuring `.proxy-card` → `.proxy-card-rail`/`.proxy-card`, and `.proxy-scrim` → `.proxy-overlay`/`.proxy-scrim`, paired with modifications already present in `app/roadmap/proxy/ProxyRankingCard.tsx`). Staging `app/roadmap/roadmap.css` for Task 2's commit necessarily included those 36 unrelated insertion lines (diff: `1 file changed, 36 insertions(+), 6 deletions(-)`, of which 6 lines are this plan's actual change). Not split apart, per explicit instruction not to try. No other unrelated files were staged or committed.

No other deviations. Plan executed exactly as written otherwise.

## Issues Encountered

**Playwright MCP unavailable in this execution environment** — the plan's Task 3 called for an in-browser confirmation via `mcp__playwright__*` tools, but no Playwright MCP tools were exposed to this executor session (only `Read`/`Write`/`Edit`/`Bash`/`mcp__context7__*` were available). Per the plan's own documented fallback ("If Playwright MCP tools are unavailable... fall back to: run `pnpm run build`... and record in SUMMARY.md that the live browser check could not run"), the browser check was **not performed**. What was done instead:

- `pnpm run build` completed successfully (`✓ Compiled successfully`, `✓ Generating static pages using 9 workers (14/14)`) — no compile-time regression from the CSS-token change.
- Also discovered while preparing the browser check: the plan's Task 3 instructions reference navigating to `http://localhost:3000/roadmap`, but the story actually renders at the site root `/` (there is no `app/roadmap/page.tsx` — `app/page.tsx` imports and renders `StoryClient` directly). `/roadmap` 404s; `/` returns 200. This is a documentation note for future plans/verification steps referencing this story, not a code change.

**Manual verification still needed:** open `http://localhost:3000/` (an existing dev server was already running on port 3000 during this session — do not need to start a new one), scroll to the `first-light` section (sky `#2b1c3a`, the first section past the hero, containing four block-math tiles), and confirm the tiles render as dark boxes with legible light-grey KaTeX text, then scroll to `back-to-the-globe` (sky `#000000`, last section) and confirm the same for its one block-math tile.

## Known Stubs

None.

## Threat Flags

None — this plan only changes a derived colour computation and two `background` declarations plus a `:where()` selector list; no new network surface, auth path, or trust boundary introduced. Matches the plan's own threat model (`T-quick260819hk3-01`, disposition `accept`).

## User Setup Required

None - no external service configuration required.

## Follow-ups (out of scope, flagged not fixed)

The following three sites share the exact same `background: var(--ink)` pattern as `.roadmap-math`/`.roadmap-code` and likely have the identical near-white-on-dark-sky defect, but were explicitly out of scope for this plan (per plan disposition D-06) and were **not modified**:

- `.chat-avatar` — `app/roadmap/roadmap.css` line 538 (line numbers shifted +1 after this plan's edits; was line 537 before)
- `.chart-toggle button.active` — `app/roadmap/roadmap.css` line 976 (was 975)
- `.smoothing-control.active` — `app/roadmap/roadmap.css` line 1056 (was 1055)

If these also render as unintended white/near-white surfaces on dark-sky sections, the same `--ink-tile` token (already available) should fix them the same way — likely a follow-up quick task.

## Next Phase Readiness

Fix is complete and committed. No blockers. The three flagged follow-up sites above are candidates for a subsequent quick task if the user notices the same defect there. Manual/live browser confirmation of the visual fix is still recommended (see "Issues Encountered") since Playwright MCP was unavailable in this session.

---
*Phase: quick-260819-hk3*
*Completed: 2026-08-19*

## Self-Check: PASSED

- FOUND: app/roadmap/palette.ts
- FOUND: app/roadmap/palette.test.ts
- FOUND: app/roadmap/roadmap.css
- FOUND: .planning/quick/260819-hk3-the-latex-boxes-should-be-darker-they-ap/260819-hk3-SUMMARY.md
- FOUND commit: cb7a2a48
- FOUND commit: 13da08d9
- Confirmed 4 `inkTile` occurrences in palette.ts, 5 in palette.test.ts
- Confirmed exactly 2 `var(--ink-tile)` occurrences in roadmap.css
