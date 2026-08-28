# Roadmap: Watch People Die Live

## Features

The project is two features, each with its own goal and its own forward-looking roadmap (see "Future Roadmaps" below):

- **Globe** — the 3D map of death events. Goal: the most statistically accurate _temporal_ (when) and _spatial_ (where) generation of simulated deaths.
- **Personas** — the "last deaths" feed text. Goal: the most statistically accurate representative _persona_ (age, sex, cause) for a death, given the country the Globe's logic already picked.

## Milestones

- ✅ **v1.0 MVP** — Phases 1-3 (shipped 2026-06-29) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 Persona Realism** — Phases 4-6 (shipped 2026-08-28) — [archive](milestones/v2.0-ROADMAP.md)
- 📋 **v2.1 / next** — not yet defined. Start with `/gsd:new-milestone`.

Full history and stats: [`MILESTONES.md`](MILESTONES.md).

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)
- 999.x phases: Unsequenced backlog parking lot (marked with BACKLOG), see `## Backlog`

Phase numbering continues across milestones and never restarts.

<details>
<summary>✅ v1.0 MVP (Phases 1-3) — SHIPPED 2026-06-29</summary>

- [x] Phase 1: Cause Fidelity and Methodology (2/2 plans) — completed 2026-06-29
- [x] Phase 2: Shareable Public Surface (2/2 plans) — completed 2026-06-29
- [x] Phase 3: Publish and Portfolio Handoff (1/1 plan) — completed 2026-06-29

A shared foundation touching both features: real IHME cause data and an honest methodology for
Personas; social sharing, the public `/roadmap` route, and publishing as Shared product surfaces.

Full phase details: [`milestones/v1.0-ROADMAP.md`](milestones/v1.0-ROADMAP.md)

</details>

<details>
<summary>✅ v2.0 Persona Realism (Phases 4-6) — SHIPPED 2026-08-28</summary>

- [x] Phase 4: Persona Realism Ladder (9/9 plans) — completed 2026-08-27
- [x] Phase 5: Story Reading Experience (3/3 plans) — completed 2026-08-23
- [x] Phase 6: v2.0 Audit Closure (1/1 plan, INSERTED 2026-08-28) — completed 2026-08-28

Persona age, sex and cause stopped being one global table — 183 country-specific age-banded cause
tables, a three-tier per-cell age/sex resolver over 59,954 grid cells, and a measured seasonal
composition tensor. Phase 5 fixed three story defects concurrently; Phase 6 was inserted from the
milestone audit so the milestone closed on measurement rather than assertion.

Full phase details: [`milestones/v2.0-ROADMAP.md`](milestones/v2.0-ROADMAP.md)

</details>

### 📋 Next milestone — not yet defined

No phases planned. Run `/gsd:new-milestone` to scope the next version (questioning → research →
requirements → roadmap).

Backlog (unsequenced, see `## Backlog`): 999.1.

## Progress

| Milestone | Phase                             | Plans Complete | Status   | Completed  |
| --------- | --------------------------------- | -------------- | -------- | ---------- |
| v1.0      | 1. Cause Fidelity and Methodology | 2/2            | Complete | 2026-06-29 |
| v1.0      | 2. Shareable Public Surface       | 2/2            | Complete | 2026-06-29 |
| v1.0      | 3. Publish and Portfolio Handoff  | 1/1            | Complete | 2026-06-29 |
| v2.0      | 4. Persona Realism Ladder         | 9/9            | Complete | 2026-08-27 |
| v2.0      | 5. Story Reading Experience       | 3/3            | Complete | 2026-08-23 |
| v2.0      | 6. v2.0 Audit Closure             | 1/1            | Complete | 2026-08-28 |
| —         | 999.1 (BACKLOG)                   | 0/0            | Backlog  | —          |

**Shipped to date:** 6 phases, 18 plans, across two milestones.

## Future Roadmaps

Work forks into two independent roadmaps. Each can progress at its own pace and does not block the other.

### Globe Roadmap — Temporal & Spatial Accuracy

**Goal**: The most statistically accurate generation of _when_ and _where_ a simulated death occurs.

Backlog (see `REQUIREMENTS.md` v2 `REAL-01..07`, not yet phased):

- Sub-national mortality-rate placement (`REAL-01`) — **partially done in v2.0.** The region key is baked and correct for every tier-1 country, but sub-national data still does not feed the globe's placement or rates; the rate grid remains national plus density.
- Time-of-day modulation for circadian-sensitive causes (`REAL-02`)
- Seasonal mortality modulation (`REAL-03`) — **partially done in v2.0.** Timing modulation already existed; Phase 4 added composition. Shares `PERS-03`'s unmapped-label limitation.
- Climate/biome-weighted rates (`REAL-04`)
- Real-time weather modulation (`REAL-05`)
- Conflict/excess-mortality overlays (`REAL-06`)
- Epidemic/pandemic event modes (`REAL-07`)

### Personas Roadmap — Representative Identity Accuracy

**Goal**: The most statistically accurate persona (age, sex, cause) for a death, given the country the Globe already picked.

Delivered in v2.0 as **Phase 4: Persona Realism Ladder** — `PERS-01` and `PERS-02` satisfied,
`PERS-03` partial. What remains on this roadmap:

- `PERS-03`'s coverage gap: 34 of 90 cause labels resolve no seasonal curve. A mapping limit, not a measurement one — `chapter_of_cause_label()` derives from Eurostat's European cause list and cannot name tropical causes. The "other causes" residual is aseasonal by decision as of 2026-08-28.
- Deeper subnational coverage beyond Eurostat and GBD — parked as backlog 999.1.
- Raising `ARCHETYPE_COUNT` above 20, which currently flattens the regional signal for 19.43% of expected deaths (audit warning INT-04). A payload-versus-fidelity trade-off with no forcing function behind it.

## Backlog

Unsequenced ideas that are not ready for active planning. Promote with `/gsd:review-backlog`.

### Phase 999.1: Subnational cause and age sourcing beyond Eurostat (BACKLOG)

**Goal:** Cover selected admin-1 regions outside Eurostat's reach with observed cause and
age x sex data, taken opportunistically rather than as a sweep.
**Requirements:** PERS-01, PERS-02 (partial)
**Plans:** 0 plans

Plans:

- [ ] TBD (promote with /gsd:review-backlog when ready)

**Why it is backlog, not a phase:** full subnational coverage is unreachable at any effort level.
`seasonality-data-guide.md` documents China, India, Indonesia, Pakistan, Ethiopia, Nigeria, DRC,
Libya and Madagascar as having weak or no public subnational access, and those hold a large share
of global deaths. Each remaining country is a bespoke parser. Phase 4's plans 04-04 and 04-09 cover
the same ground by derivation (gridded population x national age-specific rates) for all 981
regions, which is why leaving this unsequenced is acceptable rather than a gap.

**Take a country only when** it is already half-done by another plan (Brazil/Mexico via 04-08),
it is large enough that a single national pyramid reads as visibly false in the feed, or it is
needed as a 04-04 validation fixture.

A drafted task breakdown is preserved at
`.planning/phases/999.1-subnational-cause-and-age-sourcing-beyond-eurostat/DRAFT-PLAN.md`
and the source narrative at `.planning/todos/pending/2026-07-31-p09-*.md`.

---

_Last updated: 2026-08-28 after the v2.0 milestone close._
