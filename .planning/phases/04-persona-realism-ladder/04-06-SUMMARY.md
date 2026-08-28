---
phase: 4
plan: 04-06
subsystem: pipeline
tags:
  - eurostat
  - age-sex
  - causes
  - nuts2
key-files:
  - pipeline/sources/eurostat.py
  - pipeline/test_eurostat.py
  - pipeline/__main__.py
  - pipeline/sources.lock.json
  - data/eurostat-regional.json
requirements-completed: [PERS-02]
---

# Plan 04-06 Summary: Add Eurostat regional age/sex and cause tables

## One-liner

291 NUTS-2 regions now have observed age × sex, weekly and cause distributions from three
Eurostat tables — one request each, as the plan expected — but two of the three tables the plan
named were the wrong ones, and the cause layer is a coarser age split than the plan implied.

## Completed Work

- **`pipeline/sources/eurostat.py`** pulls `demo_r_magec` (annual deaths by single year of age ×
  sex), `demo_r_mwk2_05` (weekly by 5-year group × sex) and `hlth_cd_asdr2` (standardised death
  rate by cause × sex), folds them onto band arrays and writes `data/eurostat-regional.json`.
- **`python -m pipeline fetch-eurostat` / `eurostat`** are its own CLI pair. It is deliberately
  **not** in `registry.REGISTRY`: every module there feeds the one-dimensional curve machinery in
  `build.py`, and adding a 35-country source would have changed committed seasonality output —
  the thing 04-08 went to some trouble to keep byte-identical.
- **`pipeline/test_eurostat.py`** — 7 stdlib-`unittest` tests, matching `test_curve.py`'s
  convention rather than introducing pytest (which is not installed).

## Deviations from the plan

- **`demo_r_mweek3` is NUTS-3, not NUTS-2.** Its Eurostat title is "Deaths by week, sex, 5-year
  age group and NUTS 3 region". `demo_r_mwk2_05` is the NUTS-2 table of the same shape and is
  used instead.
- **`hlth_cd_asdr2` has no fine age dimension.** Its `age` is exactly TOTAL / Y_LT65 / Y_GE65, so
  the cause layer is an under-65 / 65-and-over split and nothing finer. The plan's "causes by
  region x age x sex" overstated it.
- **The join target is the committed geometry, not the 287 CDR keys.** `data/nuts2-20m.json` has
  334 NUTS-2 regions; `data/subnational-cdr.json` has 287. NL31, NL33, PT16–PT18 and NO0B are in
  the geometry and absent from the CDR, so joining to the CDR would have thrown away Eurostat
  rows for regions the globe can already draw. Result: 291 matched, of which 285 also carry a
  CDR row.
- **A whole year of weeks is one request too many** — 413 Request Entity Too Large. The weekly
  pull goes in four 13-week chunks; the two annual tables are single requests as planned.
- **`pipeline/__main__.py` was edited**, which the plan's `files_modified` did not list. It is the
  only way to reach a new pipeline module from the CLI, and nothing else in the phase touches it.

## Verification

- `pnpm run typecheck`, `pnpm run lint`, `pnpm test` (18 files / 133 tests) all pass.
- `ruff check pipeline/` is clean on both new files. The one error it reports is pre-existing in
  `pipeline/geo.py:57` and untouched here.
- Join report is in the artifact's `meta.joinNotes`, with a reason for **every** code that fails
  in either direction: 41 UK regions (the UK stopped reporting to Eurostat after leaving the EU),
  5 Portuguese and 2 Dutch codes from a NUTS revision newer than the committed geometry, ME00 and
  MK00 (candidate countries with no rows this year), and Eurostat's `EFTA` aggregate. Zero
  unexplained.
- `meta.unmappedIcd10` is empty: all 93 Eurostat cause groupings are either mapped onto the
  existing 90-label vocabulary or explicitly listed as roll-ups. The build raises if a label ever
  escapes `data/causes.json`'s vocabulary, so a second, divergent vocabulary cannot appear.
- Cross-check: BE10 gives 8,929 deaths against a ~1.2M population, a CDR of ~7.4/1000 next to the
  6.8/1000 `subnational-cdr.json` records for 2023.

## Notes for whoever picks this up

- **The rate-vs-count distinction has two halves and conflating them is the easy bug.** Across
  regions a standardised rate averages (`aggregate_regions(..., intensive=True)`); within one
  region, two disjoint ICD groupings landing on the same project label — influenza `J09-J11` and
  pneumonia `J12-J18` are both "lower respiratory infection" — describe different deaths and add.
  The first version of this averaged both, which is wrong for the second case. Both are tested.
- The artifact uses index vocabularies (`keys`, `sexes`, `causes.labels`) with positional rows,
  the way `data/causes.json` indexes its 90 labels. Spelling rows out as objects cost 7.3 MB
  against 1.7 MB, almost all of it one region key and one cause label repeated 60,000 times.
- It is **not** in `scripts/sync-data.ts`'s allowlist, so it never ships to the browser. It is a
  build-time validation input, like `observed-regional-age-sex.json`.

  > **Corrected 2026-08-28 by plan 06-01.** The sentence above was aspirational, not descriptive:
  > when it was written nothing read `data/eurostat-regional.json` at all, which the v2.0 milestone
  > audit found as blocker INT-02 (1.77 MB committed, zero readers — the only other occurrences in
  > the tree were three prose comments). 04-07 imports Python helpers from
  > `pipeline/sources/eurostat.py` but never the JSON. It is now true: 06-01 wired the `ageSex`
  > layer into `scripts/build-age-sex-cells.ts`'s validation harness, where it scores 271 NUTS-2
  > regions across 34 countries (3.79pp mean error vs 4.02pp for a flat national pyramid; ITA
  > 1.89pp vs 3.05pp and POL 1.51pp vs 3.62pp on the tier-0 join). The `weekly` and `causes`
  > layers still have no consumer.
- `YEAR = 2022` is pinned. Eurostat publishes NUTS-2 causes on a longer lag than deaths, so
  moving it forward needs both tables checked, not just `demo_r_magec`.
