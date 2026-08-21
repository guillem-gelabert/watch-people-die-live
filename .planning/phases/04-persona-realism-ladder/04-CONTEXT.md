# Phase 04 Context — Persona Realism Ladder

**Milestone:** v2.0 (Persona Realism) · **Feature:** Personas · **Plans:** 8 across 5 waves
**Requirements:** PERS-01, PERS-02, PERS-03 (partially touches REAL-01, REAL-03)
**Investigated:** 2026-07-31 · **Executed:** not started

Read this before any plan in this phase. It holds the evidence the plans compress, the reason the
ladder is ordered the way it is, and the traps that will silently produce wrong data if missed.

---

## Why this phase exists

The deaths feed claims to draw statistically representative identities from real distributions.
For age and sex it does, at country resolution. For **cause it does not** — and the failure is
worse than "incomplete", because the shipped data actively overrides a correct fallback.

Measured on the committed `data/causes.json` (IHME GBD 2023, `coverage.location: "global"`,
`coverage.age: "all_ages_repeated_across_bands"`, `countries: {}`):

| Persona: **female infant** |       | Persona: **male infant** |       |
| -------------------------- | ----: | ------------------------ | ----: |
| ischaemic heart disease    | 14.2% | ischaemic heart disease  | 15.4% |
| a stroke                   | 11.9% | a stroke                 | 10.8% |
| COPD                       |  5.7% | COPD                     |  5.7% |
| **Alzheimer's & dementia** |  5.4% | lung cancer              |  4.2% |
| **breast cancer**          |  2.8% | neonatal complications   |  2.9% |

`persona.ts:88` has an age- and sex-gated fallback table that would give these babies *neonatal
complications* or *birth asphyxia*. It is unreachable, because `if (CAUSE)` at `persona.ts:225`
always wins and `pickCause` never reads `coverage`. **The committed GBD file makes the feed less
realistic than shipping no GBD file at all.** That is plan 04-01, and it is ~10 lines.

### The truncation is the deeper bug

`build-causes.ts` keeps `TOP = 8` causes per cell. Applied to a *global* aggregate, the top 8 is
entirely cardiovascular, COPD and cancer — so of 140 cause labels shipped in the file, **only 12
are ever reachable**. These are all present in the vocabulary and unreachable in every country:

```
malaria                      idx  58      maternal complications       idx  96
HIV/AIDS                     idx 120      suicide                      idx  51
tuberculosis                 idx 119      interpersonal violence       idx  52
a diarrhoeal disease         idx 121      a congenital condition       idx  21
protein-energy malnutrition  idx  33
```

A death in Nigeria cannot surface as malaria. One in South Africa cannot surface as HIV/AIDS.
Nobody anywhere can die of suicide or violence — all folded into `other causes`, already ~50% of
every cell. Per-country top-8 fixes this by construction, because malaria *is* in Nigeria's top 8.

### Two more gaps, neither covered by PERS-01

- **Regional age/sex.** `data/mortality-age-sex.json` is 172 countries, no finer. A death in
  Chukotka draws Moscow's pyramid — even though `data/subnational-cdr.json`'s own `meta.note` says
  "most of the between-region gap reflects age structure". Now **PERS-02**.
- **Season.** `makePersona(m49, country)` takes **no date at all**. 89 measured country curves,
  296 measured admin-1 curves, Köppen donor blends, ERA5 climatology and a five-tier runtime
  resolver all control *when* deaths fire and *nothing* about who dies. A January and a July death
  in Sweden draw byte-identical distributions, though the winter excess is overwhelmingly
  respiratory and circulatory deaths among the very old. Now **PERS-03**.

---

## How the ladder is ordered

Ranked by **global reach first, then data-sourcing cost, then implementation cost.** Reach beats
cheapness deliberately: work that improves every country outranks work that improves one, even
when the one-country change is a single line.

That principle is what puts 04-08 near the end despite being the cheapest code in the phase
(`pipeline/sources/canada.py:70` throws away age and sex it has already downloaded — one filter).
It helps one country. It earns its place only as **the validation fixture for 04-04**.

### WHO and GBD are complements, not alternatives

The single most important sequencing fact in this phase:

| | WHO Mortality Database (04-02) | IHME GBD (04-03) |
| --- | --- | --- |
| Sourcing | one free bulk download, no account, no quota | ~13 chunked requests against a 100k-row cap, tight daily/weekly quotas |
| Coverage | ~120 vital-registration countries | all 204 |
| Misses | **India absent** (SRS-estimated, not registered), China a limited urban/rural sample | — |
| Nature | registered deaths | modelled estimates where no registration exists |

WHO is nearly free and covers most of Europe, the Americas, Japan, Korea and Australasia. But by
*death share* that is far less than it sounds — India and China alone are roughly a third of global
deaths. GBD's unique value is precisely the ~80 countries without registration, which is exactly
where the current global table is most wrong. **Do both.** Neither alone covers the world.

### 04-03 does not fit a wave

Its bottleneck is the portal quota — days of wall-clock across 13+ requests — not effort. GSD's
wave model assumes a plan completes within one dispatch. **Start its export requests during wave 1**
and let them trickle in; the fold-in step is what lives in wave 3.

Resist dropping to GBD level 2 (~22 causes, ~190k rows, 2 requests) to dodge the quota: level-2
labels read *"Woman 78, neoplasms – Spain"* instead of *"breast cancer"*, and specificity is the
entire appeal of the feed. A 2-request variant that keeps specific labels needs a hierarchical
sampler (country level-2 shares × global within-level-2 level-3 composition), which is no longer
the zero-code option.

---

## Waves come from file overlap, not priority

Plan numbers preserve the priority rank (p01–p08). Waves come from pairwise `files_modified`
intersection, which is the criterion `$gsd-execute-phase` actually enforces before spawning:
plans in a wave share no declared path, so they are safe to run concurrently.

| Wave | Plans               | Max parallel |
| ---- | ------------------- | ------------ |
| 1    | 04-01               | 1            |
| 2    | 04-02, 04-04, 04-08 | 3            |
| 3    | 04-03, 04-05        | 2            |
| 4    | 04-06               | 1            |
| 5    | 04-07               | 1            |

**`app/globe/persona.ts` is the chokepoint** — 04-01, 04-04 and 04-07 all modify it, so they can
never share a wave. Splitting it into a sampling half and a label/prose half would unlock more
parallelism than any other refactor available here.

04-08 sits in wave 2 rather than wave 1 on purpose: it has no dependencies, but a wave costs its
slowest member, so pairing it with the two substantial wave-2 plans beats pairing it with the
~10-minute 04-01.

**Declare exact filenames, not directories.** 04-06 and the 999.1 backlog draft both wanted
`pipeline/sources/`. GSD's overlap check normalises bidirectionally, so a directory declaration
intersects 04-08's individual `canada.py`/`brazil.py` and would force them sequential for no real
reason.

---

## Traps that produce silently wrong data

1. **04-01 first, always.** Without the `coverage` guard you cannot tell "the new export worked"
   from "the guard was never there". If 04-02/04-03 slip, the fallback table is strictly better
   than what ships today.
2. **Never pool before truncating.** Apply `TOP` per country × sex × band. Pooling first is the
   original sin that erased malaria, HIV/AIDS, TB and suicide.
3. **GBD export: disjoint five-year ages only.** `build-causes.ts:183` diverts all-ages rows away
   from the *global* accumulator, but the country loop at `:187` has **no such guard** — a mixed
   export silently doubles every country while `coverage.age` still reports `age_bands` (because
   `allAgesRows !== used`). Aggregate bands (`Under 5`, `5-14`, `50-69`, `70+`) resolve to one
   wrong band rather than being rejected. Exclude the `Global` location too, or the fallback table
   absorbs the country sum on top of itself.
4. **Measure payloads.** `causes.json` goes 5.9 KB → est. 400–700 KB; `rate-grid.json` has
   **59,954 cells**, so a naive 18-number pyramid per cell is ~1.08M numbers on a file already at
   1.7 MB, fetched on every globe load. 04-04 needs archetype clustering, not a naive bake.
   Lowering `TOP` to 6 is the cheap lever on the cause side.
5. **Rates average, counts sum.** `hlth_cd_asdr2` is a standardised rate — intensive. The existing
   Russia RusSTMF handling already makes this distinction; follow it.
6. **Label estimates as estimates.** The precedent is already set: India and China admin-1 rows in
   `seasonality-subnational.json` carry `measurement: "climate-modeled"` and are excluded from
   validation. 04-04 is derived (national rates × local population structure), so it captures who
   *lives* there, not local health differences. Say so in roadmap copy.
7. **The joint distribution stays inconsistent.** Age/sex from UN WPP, cause from GBD/WHO, which
   disagree on per-country totals. Persona draws a band then a cause conditional on it, so the
   pairing is plausible but not internally coherent. Acceptable for a feed; unavoidable without one
   source for both.

---

## Validated during investigation — do not redo

- **Dropped: "top up UN WPP from 172 to ~200 countries."** Not a work item. `build-mortality.ts:119`
  targets `atlasM49()` — the countries present in the world-atlas topology the globe renders from —
  so 172 is not an API limit. The 55 grid countries lacking age/sex data account for **0.0000%** of
  global expected deaths (Wallis & Futuna, Niue, Tokelau, Nauru…).
- **`build-causes.ts` already supports country × age × sex.** `isoOf` → `alpha3ToNumeric` keys by
  M49, `bandsOf()` parses every GBD five-year label including the neonatal subdivisions, and
  `coverage` self-reports the shape produced. 04-03 needs no new builder code beyond trap 3's guard.
- **`persona.ts:226` already prefers `CAUSE.countries[m49]`.** The consumer is ready.
- **No single global age-sex raster is confirmed.** WorldPop ships per-country GeoTIFFs; GHS-POP has
  no age/sex at all; GPWv4 BDC is one global product from the provider already used for
  `density-grid.json` but is 2010 vintage. 04-04 resolves this before building.

## Source material

- Narrative per plan: `.planning/todos/pending/2026-07-31-pNN-*.md` (each carries `promoted_to:`)
- Deferred sibling: backlog **999.1**, subnational sourcing beyond Eurostat — unreachable at any
  effort level (China, India, Indonesia, Pakistan, Ethiopia, Nigeria, DRC per
  `seasonality-data-guide.md`), which is why 04-04's derived approach is the answer instead
- Blocking open decision: `.planning/notes/2026-07-31-planning-sharing-across-parallel-agents.md`
  — parallel execution across worktrees is not yet possible
