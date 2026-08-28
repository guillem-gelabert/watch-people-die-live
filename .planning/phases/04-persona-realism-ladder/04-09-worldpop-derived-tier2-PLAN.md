---
phase: 4
plan: 04-09
title: Rebuild tier 2 on WorldPop 1km population, replacing the CDR-gap proxy
type: implementation
wave: 6
depends_on:
  - 04-04
files_modified:
  - pipeline/sources/worldpop.py
  - pipeline/test_worldpop.py
  - pipeline/__main__.py
  - pipeline/sources.lock.json
  - data/worldpop-cell-age-sex.json
  - scripts/build-age-sex-cells.ts
  - data/age-sex-cells.json
autonomous: true
requirements:
  - PERS-02
---

<objective>
04-04 shipped tier 2 as a CDR-gap proxy after concluding WorldPop 2020 was infeasible. That
conclusion was wrong: it tested only the 100m product (~118 GB globally) and the global mosaic,
and never found the **1km per-country tree**, where one age-sex band for Nigeria is 5.1 MB.
Restore the locked source decision and rebuild tier 2 the way the original plan intended — a
population raster crossed with national age-specific death rates — then measure honestly whether
it beats the proxy it replaces.
</objective>

<notes>
**The paths, verified by HTTP probe on 2026-08-26.** Use:

```
https://data.worldpop.org/GIS/AgeSex_structures/Global_2000_2020_1km/unconstrained/2020/{ISO3}/{iso3}_{f|m}_{age}_2020_1km.tif
```

- `{age}` ∈ 0, 1, 5, 10, 15, … 80 (18 groups) × {f, m} = 36 files per country.
- Nigeria, one band: 5.1 MB. A whole country is therefore ~150–200 MB, fetched and discarded.
- **Do not** use `Global_2000_2020/` — that is the 100m product, 438 MB for one Nigerian band.
- **Do not** use `.../unconstrained/2020.zip` — 30 GB for the world.
- **Range requests do not work.** `Accept-Ranges: bytes` is advertised but `curl -r 0-1023`
  returns 200 with the full body, and GDAL's `/vsicurl/` reports "Range downloading not
  supported". Fetch whole files; at 1km they are small enough that this does not matter.
- `sedac.ciesin.columbia.edu` (GPWv4 BDC) times out at the TCP layer from this environment. Do
  not spend time on it.

**Raster work goes in Python.** `rasterio>=1.3` is already a project dependency (`pyproject.toml`,
resolves to 1.5.0 and imports cleanly). `pipeline/` is where Python lives and `pipeline/geo.py`
already does point sampling. Do not add a JS GeoTIFF dependency.

**Keep 04-04's resolver architecture.** `scripts/build-age-sex-cells.ts` already has the right
seams: `nationalPyramid()`, the tier-1 index, the archetype clustering that keeps the payload at
277 KB, and — most importantly — the task-4 validation harness that scores every tier against
`data/observed-regional-age-sex.json`. This plan swaps what feeds tier 2. It does not rewrite the
resolver, the clustering, or the harness.

**Tier 2's reach is larger than 11.85%.** Today tier 2 covers 11.85% of expected deaths and tier 3
(flat national pyramid) still covers 44.64%. A WorldPop-derived pyramid can answer for any cell in
any country fetched, so tier 3 should shrink to the countries WorldPop was not fetched for. Report
the new tier mix.
</notes>

<tasks>

1. **Fetch and reduce WorldPop 1km rasters to 0.5° cell population by band**

   New `pipeline/sources/worldpop.py`, reachable as `python -m pipeline fetch-worldpop` and
   `python -m pipeline worldpop` (its own CLI pair, following 04-06's eurostat precedent — it does
   **not** go in `registry.REGISTRY`, which feeds only the one-dimensional seasonality curve).

   - Order countries by their share of expected deaths in cells **not** already answered by tier 1,
     computed from `data/rate-grid.json` + `data/region-keys.json` + `data/subnational-age-sex.json`.
     Fetch in that order so the budget buys the most coverage.
   - **Download budget: 40 GB cumulative, and stop there.** Stream one country's 36 bands into
     gitignored `data/source/worldpop/`, reduce to the 0.5° grid, then **delete the rasters** before
     moving to the next country. Peak disk stays ~200 MB.
   - Reduce with rasterio: sum each band's population into the 0.5° cells of
     `data/rate-grid.json`'s own lattice. Cell order and count (59,954) must match the grid exactly,
     the way 04-05's `region-keys.json` does.
   - Fold WorldPop's 18 age groups onto the project's nine bands
     `[0,0] [1,4] [5,14] [15,29] [30,49] [50,64] [65,74] [75,84] [85,200]`. WorldPop's top group is
     **80+**, which straddles `[75,84]` and `[85,200]`: apportion it using the country's own
     75-84 vs 85+ split from `data/mortality-age-sex.json`, and record that this is an
     apportionment, not an observation, in the output's `meta`.
   - Write `data/worldpop-cell-age-sex.json`: per-cell population by band and sex, plus `meta` with
     the source URLs, retrieval date, the countries covered, the countries **skipped with their
     forgone death share**, and the 80+ apportionment note. Record provenance in
     `pipeline/sources.lock.json` like every other source.
   - This file is a build input, **not** browser data. Do not add it to `scripts/sync-data.ts`.

   Verification: cell count equals 59,954; per-country population totals are within 2% of the
   country's WorldPop national total (sum the rasters independently as a control); `ruff check
   pipeline/` clean; `pipeline/test_worldpop.py` covers the band fold, the 80+ apportionment and
   the grid reduction, using **absolute** imports (`from pipeline.sources.worldpop import …`) so
   `uv run python -m unittest discover pipeline` finds it.

2. **Feed tier 2 from population × national age-specific rates**

   In `scripts/build-age-sex-cells.ts`, replace the CDR-gap estimator:

   - National age-specific death rate per band = national deaths by band
     (`data/mortality-age-sex.json`) ÷ national population by band (sum the WorldPop cells for that
     country). No new external source — the rate closes over the two files already in hand.
   - Cell pyramid = cell population by band × that national rate by band, normalised so
     `m[] + f[]` sums to 1. That is 18 independently resolved numbers, against the single degree of
     freedom `shiftPyramid()` had.
   - Tier 2 answers for any cell with WorldPop coverage; tier 3 keeps answering where there is
     none. Keep `shiftPyramid()` and the `k` calibration **in the file but unused only if it is
     genuinely dead** — if the WorldPop tier loses on a country (task 3), the proxy stays as that
     country's estimator and both are documented.
   - Keep the archetype clustering. Payload must stay ≤ 400 KB raw.

   Verification: `pnpm run typecheck`, `pnpm run lint`, `pnpm test` green; `meta.tierMixByExpectedDeaths`
   reported for the new mix; payload size stated.

3. **Score it against the harness that already exists, and let the measurement decide**

   Re-run 04-04's task-4 validation. The instrument is
   `meta.validationAgainstObserved` in `data/age-sex-cells.json`, scored against
   `data/observed-regional-age-sex.json` (Brazil 27 regions, Mexico 32, Canada 13, Australia 7).

   Baseline to beat, measured from the shipped file:

   | Country | Tier today | MAE today | Flat-national baseline |
   | --- | --- | --- | --- |
   | Brazil | regional | 3.88pp | 11.24pp |
   | Canada | derived (proxy) | 10.67pp | 10.70pp |
   | Australia | derived (proxy) | 1.72pp | 1.82pp |
   | Mexico | regional | (report it) | (report it) |

   Canada is the decisive test: 13 regions, zero GBD coverage, a genuinely wide age spread, and the
   proxy currently gets Nunavut 44.06% wrong while beating the flat national pyramid by 0.03pp.

   **Pass condition — either of:**
   - Canada's `meanAbsErrorPct` drops by **≥ 2pp** (10.67 → ≤ 8.67), or
   - the tier-2 fit R² against the 417 regions that have a real tier-1 pyramid exceeds **0.20**
     (today: 0.0338).

   **Hard requirements regardless:**
   - No regression on Brazil or Mexico — tier 1 must still answer there and their MAE must not rise.
   - Australia must not get worse.
   - Both estimators' scores are written into `meta`, so the comparison is in the artifact and not
     just in the summary.

   **If neither pass condition is met:** that is a finding, not a failure to hide. Keep whichever
   estimator scores better per country, say so plainly in `meta` and the summary, and state what
   the population signal did and did not buy. Do not quietly ship the worse one, and do not
   overstate the better one.

4. **Correct the record in 04-04's summary**

   `04-04-SUMMARY.md` states WorldPop is infeasible at ~118 GB with no partial read. Half of that
   is true (no range requests) and half is not (that is the 100m product; 1km per-country is 5 MB a
   band). Add a short correction block pointing at this plan — do not rewrite the original text,
   since the reasoning at the time is part of the record.

</tasks>

<acceptance_criteria>
- [ ] `data/worldpop-cell-age-sex.json` is aligned to `rate-grid.json`'s 59,954 cells, with skipped
      countries and their forgone death share enumerated in `meta` — nothing dropped silently
- [ ] Tier 2 is population × national age-specific rate, resolving 18 numbers per cell
- [ ] `meta.validationAgainstObserved` carries **both** estimators' scores for CAN, AUS, BRA, MEX
- [ ] Canada MAE ≤ 8.67pp **or** tier-2 fit R² > 0.20 — or an explicit, measured statement of why
      neither was reached, with the better estimator kept per country
- [ ] No regression on Brazil or Mexico; Australia no worse
- [ ] `data/age-sex-cells.json` ≤ 400 KB raw, archetype clustering retained
- [ ] `pnpm run typecheck`, `pnpm run lint`, `pnpm test`, `ruff check pipeline/` and
      `uv run python -m unittest discover pipeline` all green
- [ ] `pipeline/test_worldpop.py` uses absolute imports so plain `discover pipeline` finds it
- [ ] 04-04-SUMMARY.md carries a correction block
</acceptance_criteria>
