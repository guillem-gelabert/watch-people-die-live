---
created: 2026-08-21T10:56:28.783Z
title: Group the weekly conflict stack by UN geoscheme above a 5% threshold
priority: 9
area: data
files:
  - lib/acled-weekly.ts:10
  - lib/acled-weekly.ts:352-391
  - lib/acled-weekly.test.ts
  - app/roadmap/charts/ConflictEwmaWidget.tsx:44
  - app/roadmap/charts/ConflictEwmaWidget.tsx:250-265
  - lib/i18n/en.ts:223
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
