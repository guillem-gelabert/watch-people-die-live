---
gsd_state_version: 1.0
milestone: null
milestone_name: null
status: milestone-complete
last_updated: "2026-08-28T00:00:00.000Z"
last_activity: 2026-08-28
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

### Open todos — `.planning/todos/pending/` (9)

| # | Item | Prio | Area | Note |
|---|------|------|------|------|
| s03 | Proxy modal opens on reload; scroll jump on close | high | story | needs discussion — same `useProxyFold` mechanic as s02 |
| s02 | Unstick the proxy card when the fold completes | high | story | needs discussion — same mechanic as s03 |
| s14 | Keep the built conflict layer current and honest about its age | high | data | **part done** — freshness removed; deploy cadence outstanding |
| s05 | One-word scale toggle with animated curvature | mid | story | |
| s06 | Amplitude map: recentre, per-cell, month slider | mid | story | enabled by 04-05 |
| s07 | Schedule cause refresh; state vintage in the Who chapter | mid | data | one mechanism with s14 |
| s09 | Weekly conflict stack: 5% + UN geoscheme rollup | low | data | easier now s13 is done |
| s08 | Reachable chart tooltips on touch | low | story | deepest design work |
| p09 | Subnational cause and age hunting beyond Eurostat | — | data | parked as **backlog 999.1**, not a loose todo |

14 todos were moved to `.planning/todos/completed/` at close: p01–p08 and s01/s04/s11 (all
promoted to shipped plans), plus s10 (closed as a no-op), s12 and s13 (both resolved 2026-08-21).

### Accepted audit warnings from v2.0 (5)

Each is a deliberate deferral with a recorded reason — see `milestones/v2.0-MILESTONE-AUDIT.md`.

| ID | Summary | Why left |
|----|---------|----------|
| INT-03 | `region-keys.json` synced to `public/` with no runtime fetcher — 392 KB dead browser payload | Cosmetic; the one-line removal deserves its own deliberate commit |
| INT-04 | 20-archetype quantisation flattens 19.43% of expected deaths; ETH, JPN, ZAF collapse to one archetype | Payload-versus-fidelity trade-off with no forcing function |
| INT-05 | No runtime alignment guard between rate-grid and age-sex-cells (`persona.ts:261`) | Latent — needs a lone `rate-grid.json` rebuild, which only happens in a notebook. **The warning with a real failure mode.** |
| INT-06 | Coverage guard not mirrored on the story side (`usePersonaTables.ts`) | Only bites on a future export regression |
| INT-07 | `m49ForIso3` duplicated byte-identically in two libs | Pure refactor, no failing test behind it |

### Other open follow-ups

- **PUB-01** (open since v1.0) — production Railway URL smoke check pending; the checkout was never linked to a Railway project.
- **`lib/acled-weekly.test.ts` flake** — reported 2026-08-21 as failing roughly 1 run in 3 on fixture ZIP entry order (not production). **Not re-verified since**, and `06-01`-era commits have passed the pre-commit hook, so it may already be resolved.
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
