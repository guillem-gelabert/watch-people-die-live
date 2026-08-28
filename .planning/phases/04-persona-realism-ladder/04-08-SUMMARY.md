---
phase: 4
plan: 04-08
subsystem: pipeline
tags:
  - age-sex
  - validation-fixture
  - python
key-files:
  - pipeline/age_sex.py
  - pipeline/age_bands.py
  - pipeline/contract.py
  - pipeline/sources/canada.py
  - pipeline/sources/brazil.py
  - pipeline/sources/mexico.py
  - pipeline/sources/australia.py
  - data/observed-regional-age-sex.json
requirements-completed: [PERS-02]
---

# Plan 04-08 Summary: Unfilter age/sex in pipelines that already download it

## One-liner

Four sources were fetching age, sex and (Brazil, Mexico) cause and discarding them at parse time; they now emit 16,434 observed region x band x sex cells over 15,907,933 deaths, with the seasonality output byte-identical.

## Completed Work

- Added `AgeSexRow` to `pipeline/contract.py` and `pipeline/age_bands.py` (the shared nine bands plus an ICD-10 chapter resolver), so nothing duplicates the band list that `build-causes.ts` and `persona.ts` also hold.
- `load_age_sex()` on canada, brazil, mexico and australia — a **second reader** beside `load()`, never a change to it, because the curve machinery is one-dimensional and threading a dimension through it would move committed output.
- `pipeline/age_sex.py` collects from any source exposing the loader and writes `data/observed-regional-age-sex.json`; new `python -m pipeline age-sex` subcommand and `pnpm run build:observed-age-sex`.
- Australia refetched with a widened SEX dimension; `load()` filters back to Persons.

## Commits

| Task | Commit | Description |
| ---- | ------ | ----------- |
| All four sources, aggregator, CLI, fixture | `aca39171` | feat(pipeline): keep the age, sex and cause these four sources already download |

## Verification

```bash
uv run python -m pipeline age-sex
uv run python -m pipeline build          # full rebuild, all sources
uv run ruff check pipeline/
uv run python -m unittest discover pipeline
pnpm run typecheck && pnpm run lint && pnpm run lint:notebooks && pnpm test
```

| Check | Result |
| ----- | ------ |
| `data/seasonality-subnational.json` after full rebuild | **byte-identical** (md5 `44c8f494b8e380c3adb0879a131c2da7` before and after) |
| `build-seasonality-fallbacks.ts` | 85 countries, 68 regions — unchanged |
| `build-seasonality-validation.ts` | 89 countries, 228 measured regions — unchanged |
| Australia `load()` across the refetch | identical row-for-row against a pre-refetch snapshot |
| `sources.lock.json` hashes vs disk | 22 match, 0 mismatch, 0 missing |
| Python tests | 7 passed |
| JS suite | 132 passed |

Fixture contents:

| Source | Regions | Bands | Observed deaths | Cause |
| ------ | ------- | ----- | --------------- | ----- |
| brazil | 27 | 9 | 6,536,970 | yes (19 ICD-10 chapters) |
| canada | 13 | 4 | 4,596,400 | no |
| mexico | 32 | 9 | 3,442,541 | yes |
| australia | 8 | 1 | 1,332,022 | no |

Regional age structure differs as expected, which is the whole point of the fixture: Ontario takes 37.1% of its deaths at 85+, Northwest Territories 15.6%.

Size 1.93 MB raw / 90 KB gzipped, after emitting counts as integers and dropping the always-null `region_key`. Not synced to `public/` — it is an offline validation fixture, not browser data.

## Deviations

- **Australia contributes sex but no age.** The plan said to "request the age and sex dimensions the ABS `PROV_MORTALITY_WK` dataflow publishes". The dataflow is titled *"Number of deaths by Sex, Age and State of registration"*, but wildcarding AGE against the live API returns exactly one code, `TT` (All ages) — the age detail the title advertises is not in this frozen NonProductionDataflow snapshot. Its SEX dimension is real and was being discarded, so that half is delivered and the band array is a single `(0, 200)`, declared rather than omitted so the absence is visible.
- **Bands are per source, not the project's nine.** StatCan publishes 0-44/45-64/65-84/85+ and nothing finer, so `AgeSexRow` carries a per-source `bands` array and a consumer aggregates its estimate up to it. Only Brazil and Mexico, which record an exact age, fold onto the nine.
- **StatCan's reconciliation is over complete weeks only.** The plan asked that "age x sex rows sum to the previously emitted totals". Taken literally that fails: StatCan suppresses small weekly cells independently per age x sex combination, so Northwest Territories' all-ages column sums to 3,625 against 1,885 for its banded cells purely because more banded weeks are blank. Both sides are therefore restricted to weeks where the control and all eight banded cells exist, and the tolerance models StatCan's rounding-to-5 rather than a flat percentage — on a 1,880-death territory, ~4,200 rounded cells carry more noise than 0.5% does.
- **Cause is ICD-10 chapters, not codes.** ~1,500 codes across 27 states x 9 bands x 2 sexes is a fixture nobody would read; 21 chapters is bounded and enough to cross-check a cause split.
- **`sources.lock.json` changed, as it must.** Australia's URL and sha256 are new because the query changed. The plan's "provenance still validates" is satisfied by all 22 hashes matching disk, not by the file being untouched.

## Follow-ups discovered

- `pipeline/` has never been linted: `pnpm run lint:notebooks` covers only `notebooks/`. Running `ruff check pipeline/` surfaced one pre-existing defect, `B905` (`zip()` without `strict=`) at `pipeline/geo.py:57`. Left alone as out of scope; worth either fixing or adding `pipeline/` to a lint script.

## Self-Check

PASSED. Regional age x sex counts exist for CAN, BRA and MEX and sex counts for AUS; cause is available for MEX and BRA; no existing seasonality output changed, verified by hash rather than by inspection.
