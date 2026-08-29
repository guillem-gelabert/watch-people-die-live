---
created: 2026-08-21T10:56:28.783Z
title: Schedule the cause-data refresh and state its vintage in the Who chapter
priority: 12
area: data
blocked_by: phase-04 plans 04-02, 04-03
resolved: 2026-08-29 — WHO GHE refresh stays manual by decision, now safely labelled (build-causes derives year/source/citation from the source filename, adds generatedAt); vintages stated in the who chapter in all three languages with a drift-guard test; README's IHME section rewritten to the WHO GHE workflow
files:
  - docs/ROADMAP.md:253-271
  - docs/ROADMAP.ca.md
  - docs/ROADMAP.de.md
  - lib/i18n/en.ts:218-219
  - lib/acled-cache.ts:5
  - lib/acled-weekly.ts:56-90
  - scripts/build-causes.ts
---

## Problem

**Deduplicated against Phase 04 on 2026-08-21 — most of the original capture was
already committed work. Read this section before planning anything.**

The original note was "setup IHME chronjob and add to the WHO section". Checking
it against the written Phase 04 plans, the *data* half is already covered:

- **04-02** ingests the WHO Mortality Database — the one cause source that
  genuinely is schedulable (single free bulk download, no account, no quota, no
  row cap) — and its task 3 already records, per country, "which source supplied
  it and for which year".
- **04-03** folds in the chunked GBD (IHME) export and records the WHO/GBD split
  in `coverage`. Its own notes state the constraint plainly: the GBD Results Tool
  "needs an interactive export and enforces daily/weekly quotas, so this plan is
  not autonomous". `autonomous: false`, wave 3.

So: **do not plan a GBD cron.** GBD has no API, 04-03 has already decided the
export is a human-in-the-loop step, and per-country vintage is already being
recorded. Two things remain that Phase 04 does *not* do — verified by grepping
the phase for cron/schedule/refresh/freshness/stale, which returns nothing, and
by its `files_modified` sets, which touch no story markdown and no i18n:

### 1. Nothing in the project is scheduled

There is no cron anywhere in the repo — no `.github/workflows`, no Railway cron,
nothing in `package.json` beyond the `prebuild`/`predev` chain. Once 04-02 lands,
the WHO MDB download is a script that could run on a schedule and never does, so
`data/causes.json` still drifts silently. The nearest existing pattern is
TTL-on-read rather than cron: `lib/acled-cache.ts:5` sets `SNAPSHOT_TTL_MS` to
24h with an atomic write, and `app/api/conflicts/route.ts` serves it.

### 2. The reader is told nothing about vintage or cadence

Phase 04 is `UI hint: no` and touches only scripts, data and `app/globe/*`. The
story's **Who** chapter (`### who · Who · #d9dbdd · chapter`,
`docs/ROADMAP.md:253`) explains where age, sex and cause come from but gives no
vintage and no cadence — and `ROADMAP.md:265` still asserts the GBD table "is
exported once by hand from the results tool and committed", which 04-03 keeps
true for GBD but 04-02 makes false for the ~120 WHO countries. That line becomes
wrong the moment 04-02 ships.

## Solution

TBD, and deliberately small. Two pieces, both of which want 04-02 and 04-03
landed first — the vintage cannot be reported before there is a per-source
vintage to report.

**Scheduling.** Decide the mechanism for the WHO MDB refresh only:

- A scheduled job that re-runs the 04-02 download and opens a PR / fails loudly
  when the committed snapshot is older than the latest WHO release. Fits the
  baked-data model the project already uses (derived JSON committed, synced to
  `public/data/` at build).
- Or TTL-on-read like ACLED. Almost certainly wrong here: cause data changes
  annually, not weekly, and `causes.json` is a build input, not a runtime fetch.
- For GBD, the honest version is a **staleness check, not a fetch**: compare the
  recorded export vintage against the latest GBD release and warn. Keeps
  04-03's manual step manual while making its age visible.

**Reader-facing.** Add a vintage + cadence line to the Who chapter, and correct
the "exported once by hand" sentence to distinguish the two sources. Must be
edited in all three story files — `docs/ROADMAP.md`, `ROADMAP.ca.md`,
`ROADMAP.de.md` — which `app/roadmap/storyTranslations.test.ts` enforces as
having identical section keys and `[slot]` placeholders. If it becomes a
freshness readout rather than prose, it needs new keys in `lib/i18n/en.ts`
(the schema) plus `ca`/`de`, and a `[slot]` in all three markdown files.

Open question worth settling before planning: whether the reader-facing half
should instead ride along inside 04-02/04-03 as an extra task, rather than
existing as separate later work. Argument for folding it in: the sentence at
`ROADMAP.md:265` is made *wrong* by 04-02, so leaving it for later ships a known
falsehood. Argument against: Phase 04 is deliberately `UI hint: no` and adding
story edits to it drags i18n and `storyTranslations.test.ts` into a data phase.
