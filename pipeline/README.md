# Subnational seasonality pipeline

Builds `data/seasonality-subnational.json` — per-region continuous order-4 Fourier mortality-
seasonality curves — from raw files cached under `data/source/subnational/` (gitignored). One module per
source in `pipeline/sources/`, a declarative registry (`pipeline/registry.py`), and a
deterministic builder (`pipeline/build.py`) that folds every source through the same canonical
curve math (`pipeline/curve.py`, shared with `notebooks/seasonality.ipynb` via a re-export shim
at `notebooks/lib/seasonality_curve.py`).

Every complete non-COVID year is normalized independently before observations are pooled into
one regression. Count inputs are first divided by their actual calendar exposure (including leap
years and quarterly month lengths); standardized rates remain intensive. Complete weekly series
retain all 52/53 observations. The serialized nine coefficients evaluate a mean-1 multiplier at
any day-of-year phase, so neither the pipeline nor the globe reduces the result to month buckets.

## CLI

```bash
uv run python -m pipeline status               # registry: mode, enabled, expected region count
uv run python -m pipeline fetch [source...]     # download/verify raw files (all sources if omitted)
uv run python -m pipeline build [source...]     # fold + join -> data/seasonality-subnational.json
uv run python -m pipeline argentina-latitudes   # rebuild data/argentina-partido-latitudes.json
```

`build` is also runnable as `pnpm run build:seasonality-subnational`.

After rebuilding national or subnational curves, run `pnpm run build:seasonality-fallbacks`
and `pnpm run build:seasonality-validation`. The latter regenerates both country and region
leave-one-out payloads from the harmonic coefficients; its twelve month-midpoint values are
chart samples, not the production curve contract.

## Sources

| key                 | country | geo     | cadence           | mode            | measurement           |
| ------------------- | ------- | ------- | ----------------- | --------------- | --------------------- |
| `russia`            | RUS     | adm1    | rate (weekly SDR) | manual          | rate                  |
| `usa`               | USA     | adm1    | week              | manual          | crvs                  |
| `brazil`            | BRA     | adm1    | month             | manual          | crvs                  |
| `argentina_adm1`    | ARG     | adm1    | month             | manual          | crvs                  |
| `argentina_partido` | ARG     | partido | month             | manual          | crvs                  |
| `canada`            | CAN     | adm1    | week              | api             | crvs                  |
| `australia`         | AUS     | adm1    | week              | api             | crvs                  |
| `mexico`            | MEX     | adm1    | month             | direct-download | crvs                  |
| `south_africa`      | ZAF     | adm1    | week              | direct-download | surveillance-estimate |

`manual` sources require registration or a large portal download that can't be scripted; `fetch`
verifies the expected file(s) exist under `data/source/subnational/` and prints acquisition
instructions if not. `api`/`direct-download` sources fetch automatically.

**Manual-source acquisition notes:**

- **Russia** (RusSTMF): register at https://www.mortality.org/Data/STMF, download the weekly SDR
  export and the territory-code lookup.
- **USA** (CDC NVSS): "Weekly Counts of Deaths by Jurisdiction and Cause of Death" from
  data.cdc.gov, both the 2014-2019 and 2020-present exports.
- **Brazil** (DATASUS SIM): "Mortalidade Geral" microdata per year (2015-2019) from
  opendatasus.saude.gov.br.
- **Argentina** (DEIS / PBA Registro Provincial): monthly national file from datos.gob.ar, plus
  the Buenos Aires partido-level monthly file from catalogo.datos.gba.gob.ar.

**Country notes:**

- **Canada** — StatCan table 13-10-0768-01 ("Provisional weekly death counts, by age group and
  sex"), fetched via the WDS full-table-download broker. 13 provinces/territories exist in the
  data; Yukon, Northwest Territories and Nunavut fall below the 500-annual-deaths quality bar
  used across all count-based sources, leaving 10 regions.
- **Australia** — ABS Data API (SDMX 2.1) dataflow `PROV_MORTALITY_WK`. That dataflow is frozen
  at 2015-2022 (an ABS "NonProductionDataflow" snapshot, not live-updated past that), but
  2015-2019 alone gives five complete non-COVID years.
- **Mexico** — Secretaria de Salud's annual `registro_defunciones` per-death microdata
  (2015-2019), processed like Brazil: month/year of occurrence come straight from the
  `MES_OCURR`/`ANIO_OCUR` columns. Entity 09 (Ciudad de Mexico) is keyed `MX-DIF`
  (Natural Earth's admin-1 layer still uses the old Distrito Federal code).
- **South Africa** — SAMRC "Report on Weekly Deaths", province-level. This is a National
  Population Register surveillance estimate, not raw CRVS (`measurement="surveillance-estimate"`).
  Only the workbook's ACTUAL column is used, not PREDICTED (already a smoothed model output).
  Data starts 2019w52, so only ~2023 onward survives the COVID-year exclusion (~3 usable years).
  The download URL embeds a dated path and version suffix that change every report cycle, so
  `fetch` scrapes the report hub page for the current link rather than using a pinned URL.

## Provenance

`pipeline/sources.lock.json` (committed) records each raw file's source URL, retrieval date, and
sha256 — `data/source/subnational/` itself is gitignored, so this is the only tracked record of
what was fetched and when.

## Dropped sources

Chile (DEIS weekly deaths) and the Eurostat `demo_r_mwk2_ts` NUTS-2 layer (formerly fetched by a
since-deleted `scripts/fetch-nuts2-seasonality.py`) are intentionally not part of this pipeline —
both are outside the approved country list for subnational seasonal curves. Dropped countries
still get national-level seasonality via `data/seasonality.json` (built by
`notebooks/seasonality.ipynb`, unaffected by this package).
