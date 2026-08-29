---
created: 2026-08-21T10:56:28.783Z
title: Group the weekly conflict stack by UN geoscheme above a 5% threshold
priority: 13
area: data
resolved: 2026-08-30 — shipped in 3a4b98ba. Floor is 5% and governs both halves: which countries are named, and how far a leftover coarsens before it can stand. Sub-floor countries group by M49 subregion, climb to the intermediary region where one exists (419 LAC, 202 Sub-Saharan Africa), then to the continent, stopping at the first level clearing 5% of that week. Elsewhere fell from 51.6% of the window to 6.4%, and every band drawn is at least 5% of its own bar. Membership is per week, not global — 2-6 countries clear 5% in any given week, so a global list would name a country in every bar on the strength of one bad week. That forced the payload shape (segments[] with a kind and its members, schema 2 -> 3) and colour keyed to place rather than slot. data/conflicts.json was migrated in place, not refetched: the v2 stack reconstructs its input map exactly.
decisions:
  - The rollup cannot bound the residual on its own. A group at the top of its chain that is still short has nowhere to go, and Elsewhere collects exactly those, so it was itself under 5% in eight of twelve weeks. It now absorbs the smallest surviving band until it clears — costing one band in eight of the twelve weeks. Without that step the "no band thinner than 5%" rule holds for most bands, not all.
  - Colour is a graph colouring, not a cycle. 12 country keys over 6 hues and 11 region keys over 8 shades put two identical fills in the same bar in ten of twelve bars, which with no legend reads as one band. Greedy over the "ever drawn in the same bar" graph needs exactly the 6 and the 8 available.
  - Rejected a 10% floor: it names the same five countries as today, so the change collapses to "make Others geographic", and Others stays at 15.6% of the window and 22% in its worst week — the complaint this todo opens with.
  - Countries with no M49 (ACLED's "Pacific Ocean" and friends) never get their own band. One cleared 5% in a week and would have spent a band and a colour on a non-place.
  - Region names are translated, unlike country and cause names: these are labels we mint, not wording arriving from the data files.
test_finding: The M49 coverage test — every ISO code i18n-iso-countries knows must resolve to a chain ending at a continent — caught two holes on its first run. Burkina Faso was missing from Western Africa outright and was silently losing 432 deaths in one week to the residual, which looks like working software. Kosovo has no M49 code at all; its user-assigned 983 is mapped to Southern Europe with a comment. Any hand-authored code table wants this test.
files:
  - lib/m49-geoscheme.ts
  - lib/m49-geoscheme.test.ts
  - lib/acled-weekly.ts
  - lib/acled-weekly.test.ts
  - lib/acled.ts
  - lib/conflict-snapshot.test.ts
  - app/roadmap/charts/ConflictEwmaWidget.tsx
  - app/roadmap/palette.ts
  - app/roadmap/palette.test.ts
  - app/roadmap/types.ts
  - lib/i18n/en.ts
  - lib/i18n/ca.ts
  - lib/i18n/de.ts
  - data/conflicts.json
---

## Problem

In **"Weekly fatalities, and the weighted mean the globe uses"**
(`en.ts:223`, rendered by `ConflictEwmaWidget`), the stacked segments are built
by `buildWeeklyStack` (`lib/acled-weekly.ts:352-391`). A country earns its own
segment if it ever clears `STACK_WEEKLY_SHARE = 0.1` — 10% of a single week's
total (`:363`) — and everything else is dumped into one `"Others"` band whose
`othersBreakdown` the tooltip prints, truncated to the top 8 with a
"+N more" tail (`ConflictEwmaWidget.tsx:257-263`).

Two problems with `"Others"` as a single bucket: it is often the largest segment
in the chart, and it is geographically meaningless — a band that mixes Myanmar,
Colombia and Mali tells the reader nothing about where the deaths were.

Wanted:

1. Threshold drops from 10% to **5%** of a given week's deaths for a country to
   be shown separately.
2. Everything below that is **not** flattened into one band but **rolled up
   through the UN geoscheme**, coarsening only as far as needed to clear 5%:
   - first the six **continental regions** (Africa, Americas, Asia, Europe,
     Oceania, Antarctica);
   - then the two **intermediary regions** called out explicitly — *Latin
     America and the Caribbean* and *Sub-Saharan Africa*;
   - then the **22 geographical subregions**.

## Solution

TBD, but the mechanics are mostly clear.

The rollup direction needs pinning down first — as written, the list reads
coarse→fine, which is the opposite of how a "roll up until you clear a
threshold" loop normally runs. Two readings, and the right one is a design call:

- **Coarsest first:** try the six continental regions; where a continent alone
  clears 5%, use it; where it does not, that is a small continent and it merges
  upward into... nothing. Ends with unattributed remainder.
- **Finest first (probable intent):** group sub-threshold countries into their
  22 subregions; any subregion still under 5% merges into its intermediary
  region (LAC, Sub-Saharan Africa) where one applies; anything still under
  merges into its continental region. This terminates cleanly and produces the
  fewest bands, which is what the chart needs.

Implementation notes:

- Needs a **country → UN M49 hierarchy table** (continent / intermediary /
  subregion). The project already carries M49 codes — `countryM49()` is used at
  `acled-weekly.ts:380` and `ConflictRegion.m49` exists — so this is a new
  lookup table keyed on M49, not new country matching. Check whether
  `lib/geo.ts` or the topojson already carries the subregion field before adding
  a table.
- **Per-week vs. global membership.** Today `named` is computed across *all*
  weeks and the segment list is fixed for the chart (`:357-368`), which is what
  keeps the stack's colours stable week to week. The request says "more than 5%
  of the deaths on a given week", which read literally means membership changes
  per week and segments would appear and vanish. Almost certainly the intent is
  the current semantics with a 5% trigger — a country gets a segment if it
  clears 5% in *any* week — but confirm, because per-week membership makes the
  stack unreadable.
- **Colour and legend.** More bands than today, of two different kinds (country
  and region). They should read as different kinds; `segmentLabels`
  (`ConflictEwmaWidget.tsx:44`) is currently a flat string list and would need
  to carry a kind.
- **Tooltip.** The `othersBreakdown` / `t.others` path
  (`ConflictEwmaWidget.tsx:250-265`) changes shape: a region band's tooltip
  should list its member countries, so the breakdown becomes per-segment rather
  than a single "Others" list.
- `lib/acled-weekly.test.ts` asserts on the stack; and the payload validator
  (`:580-590`) checks `weeklyStack.weeks.length`, so cached snapshots stay
  valid, but any change to the `countries` shape invalidates the on-disk
  snapshot format — bump or invalidate the cache.
- **Low priority**: the chart works today; this makes it more informative, not
  correct-vs-broken.
