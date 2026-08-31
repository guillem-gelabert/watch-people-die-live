---
gsd_state_version: 1.0
milestone: null
milestone_name: null
status: milestone-complete
last_updated: "2026-08-31T00:00:00.000Z"
last_activity: 2026-08-31
shipped_milestones:
  - version: v1.0
    name: MVP
    shipped: 2026-06-29
  - version: v2.0
    name: Persona Realism
    shipped: 2026-08-28
progress:
  total_phases: 6
  completed_phases: 6
  total_plans: 18
  completed_plans: 18
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-28)

**Core value:** Make the reality of global mortality feel immediate while staying statistically honest about timing, placement, and representative identity.
**Current focus:** Planning the next milestone. Run `/gsd:new-milestone`.

## Current Position

**No active milestone.** v2.0 Persona Realism shipped 2026-08-28 and is archived.

Progress: [██████████] 100% — 6 phases, 18 plans, across two milestones.

| Milestone | Phases | Plans | Shipped    | Archive |
| --------- | ------ | ----- | ---------- | ------- |
| v1.0 MVP  | 1-3    | 5     | 2026-06-29 | [`milestones/v1.0-ROADMAP.md`](milestones/v1.0-ROADMAP.md) |
| v2.0 Persona Realism | 4-6 | 13 | 2026-08-28 | [`milestones/v2.0-ROADMAP.md`](milestones/v2.0-ROADMAP.md) |

Backlog 999.1 is unsequenced and excluded from the count.

**Next:** `/gsd:new-milestone` — questioning → research → requirements → roadmap. `REQUIREMENTS.md`
was archived and removed at close; the new milestone creates a fresh one.

## Deferred Items

Items acknowledged and deferred at milestone close on 2026-08-28.

### Open todos — `.planning/todos/pending/` (2)

| # | Item | Prio | Area | Note |
|---|------|------|------|------|
| s08 | Reachable chart tooltips on touch | low | story | deepest design work |
| p09 | Subnational cause and age hunting beyond Eurostat | — | data | parked as **backlog 999.1**, not a loose todo |

Seven of this table's original nine closed after the milestone close and are in
`.planning/todos/completed/`: s05, s07 and s14 during the week of 2026-08-21, **s06, s02 and s03
on 2026-08-29** and **s09 on 2026-08-30**. Only s08 and p09 remain, and neither is high priority —
the table's two "needs discussion" items are done.

s06 made the amplitude map a per-cell excess-deaths map with a month slider, shipped in nine
commits and deployed. Its file records a spike finding worth not re-litigating: batching the
cells into nine paths is **thirty times slower** than filling them one at a time.

s09 regrouped the weekly conflict stack (`3a4b98ba`): the 5% floor now governs both which
countries are named and how far a leftover coarsens through the UN M49 geoscheme, and the
residual fell from **51.6% of the window to 6.4%** with no band thinner than 5% of its own bar.
Two findings in its file are the ones worth keeping. Coarsening alone cannot bound the residual —
a group at the top of its chain with nowhere left to go lands there, so it was itself a sliver in
eight of twelve weeks until it started absorbing the smallest surviving band. And a hand-authored
code table wants a coverage test: the M49 one caught Burkina Faso missing outright, silently
losing 432 deaths in a week to the residual, which looks exactly like working software.

s02 and s03 were fixed together in one commit (`3de66476`), which is what their shared
`useProxyFold` mechanic implied. The proxy modal no longer opens on reload, because a completion
only fires when it is continuous with the previous frame — a calibration-frame rule was tried and
rejected, since Next restores scroll asynchronously relative to first effects and the restore can
land as the second or third measure in one giant jump. Closing the modal no longer moves the page
(scroll delta **0** on both round trips, folded and mid-fold), because the placeholder takes the
boxes' live height instead of a `FOLDED_HEIGHT * 5` constant that was never right at any point in
the fold. And the card releases when the fold ends rather than after `RUN_OUT`: **7px** of dead
scroll where there were 115. One loose end recorded in s03's file — the ca and de wordings of
`proxy.rank` are drafts and want a review.

14 todos were moved to `.planning/todos/completed/` at close itself: p01–p08 and s01/s04/s11 (all
promoted to shipped plans), plus s10 (closed as a no-op), s12 and s13 (both resolved 2026-08-21).
With the seven above, `completed/` now holds 21.

### Accepted audit warnings from v2.0 (4 open, 1 closed)

Each is a deliberate deferral with a recorded reason — see `milestones/v2.0-MILESTONE-AUDIT.md`.

| ID | Summary | Why left |
|----|---------|----------|
| ~~INT-03~~ | ~~`region-keys.json` synced to `public/` with no runtime fetcher — 392 KB dead browser payload~~ | **Closed 2026-08-29, the other way round.** The proposed fix was to drop the sync; s06 added the fetcher instead, so the payload now does work — it is what lets a cell take its curve from a measured region rather than its country's average. |
| INT-04 | 20-archetype quantisation flattens 19.43% of expected deaths; ETH, JPN, ZAF collapse to one archetype | Payload-versus-fidelity trade-off with no forcing function |
| INT-05 | No runtime alignment guard between rate-grid and age-sex-cells (`persona.ts:261`) | Latent — needs a lone `rate-grid.json` rebuild, which only happens in a notebook. **The warning with a real failure mode.** |
| INT-06 | Coverage guard not mirrored on the story side (`usePersonaTables.ts`) | Only bites on a future export regression |
| INT-07 | `m49ForIso3` duplicated byte-identically in two libs | Pure refactor, no failing test behind it |

### Other open follow-ups

- ~~**PUB-01**~~ (open since v1.0) — **closed 2026-08-29.** The checkout was already linked (project
  `Watch People Die`, service `watch-people-die-live`), so the "never linked" half was stale. The
  original ask — a smoke check of the live URL itself — was done that evening against
  `watchpeopledie.live` after the s06 deploy: `/data/region-keys.json` and `/data/rate-grid.json`
  both 200, the story prose serving in all three languages, the figure mounting with its 383
  provenance outlines, 55.4% of its drawn pixels changing between January and July, and no console
  errors. That last check is the one worth keeping as a habit — the new `region-keys.json` fetch
  degrades *silently* to country-tier curves, so a 404 there would have looked like working
  software.
- ~~**`lib/acled-weekly.test.ts` flake**~~ — **resolved 2026-08-21, verified 2026-08-29.** Fixed by `e20575fd` about seven hours after this note was written, which is why later commits passed the hook. The diagnosis here was also wrong: not fixture ZIP entry order but the streaming reader spooling each sheet to a temp file, stalling the unzip stream until it fired `end` mid-archive, so every text cell surfaced as `{sharedString: n}`. `e20575fd` reads the ZIP's metadata parts up front instead. Measured 40/40 green on 2026-08-29; at the reported 1-in-3 rate that has probability ~1e-7.
- **`pipeline/` has no lint script**; `ruff check pipeline/` reports pre-existing B905 at `geo.py:57`.
- **`public/data/temperature-curves.json`** stale from 2026-07-17 — not in the sync-data allowlist, not fetched.
- **Stale prose** reference to concept tiles in `docs/mobile-parity-report.md:46`.

## Accumulated Context

### Decisions

The full decision log now lives in `PROJECT.md` § Key Decisions, with outcomes marked. Per-plan
decisions are preserved in the phase SUMMARY files under `.planning/phases/`, which were kept in
place rather than archived.

The decisions that most constrain future work:

- **A key space must express every key space a consumer joins against** — not mirror whichever upstream file it was derived from. This is what the UK join defect (INT-01) cost v2.0; now enforced by a build throw.
- **Cell-keyed files ship aligned to `rate-grid.json`'s cell order**, never a wider grid row, and the tier resolved is part of the output.
- **The server parses JSON or CSV only at runtime.** No outstanding violations as of v2.0.
- **Phase waves come from pairwise `files_modified` overlap**, not priority order.
- **Source selection is an investigation.** Two of Phase 4's named sources turned out to be unusable and were replaced mid-phase.
- **Continuity across frames, not the first frame, tells a reader's scroll from the browser's.** Any scroll-driven effect that fires a one-shot on the roadmap page has to arm on the previous frame's state — s02/s03 showed that "treat the first measure as calibration" cannot hold, because Next's scroll restore arrives asynchronously relative to first effects and a 0px-tall container makes it land as one giant jump.
- **A schema bump is the cache's invalidation mechanism.** `resolveCachePath` namespaces the build cache by `ACLED_SCHEMA_VERSION`, so changing a payload's shape must bump it — s09 took conflicts to v3. The committed snapshot can then be migrated in place rather than refetched when the old payload still carries everything the new one is built from, which is what keeps a shape change off ACLED's rate limit.

### Open blockers

None. Both v2.0 blockers (INT-01, INT-02) were closed by Phase 6 and are guarded by tests that
were watched to fail before they were trusted to pass.

### Resolved this milestone

- The UK's 41 GBD region keys joined nothing; now 99.96% of UK expected death weight resolves tier 0.
- `data/eurostat-regional.json` was a 1.77 MB committed artifact with no reader; now the European validation set.
- Both v2.0 phases lacked a VERIFICATION.md; all three phases now have one.
- Two false SUMMARY claims and one false code comment corrected in place.
- ACLED xlsx parsing moved off the request path into `prebuild` (s13).

---

_Reset at the v2.0 milestone close, 2026-08-28. Pre-close state is recoverable from git history._
