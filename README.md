# watch-people-die-live

A real-time 3D globe where **each dot is one real death**. Death rates come from the
[World Bank API](https://data.worldbank.org/indicator/SP.DYN.CDRT.IN) (Crude Death Rate,
indicator `SP.DYN.CDRT.IN`), but instead of dropping each death at a random point in its
country, deaths are placed on a **population-density grid** — so they land where people
actually live and denser regions die far more often, while each country's real total
deaths/year is preserved exactly.

> The World Bank's crude death rate is itself derived from the UN World Population Prospects.
> The UN Data Portal API was the original source, but its data endpoint now requires a Bearer
> token, so this uses the equivalent open World Bank indicator (no token / registration needed).

## How it works

- **Backend** (`server.js`, Express): a `/api/mortality` endpoint that fetches the most recent
  non-empty CDR value per economy from the World Bank (`?mrnev=1`), maps each country's
  **ISO3 code → numeric M49 id** (via `i18n-iso-countries`), drops aggregates/regions, and
  caches the result in memory (~24h). Returns
  `{ indicator, year, source, values: [{ id, iso3, name, value, year }] }`, where `id` is the
  numeric **M49 code** — the same key used by the map geometry, so the join is direct.

- **Density grid** (`data/density-grid.json`, built by `scripts/build-density.mjs`): a
  0.5° (30 arc-min) grid of cells, each `[lon, lat, population, M49]`, derived from
  **GPWv4** (Gridded Population of the World, v4 — population count adjusted to 2015 UN
  totals) via the [`openaddresses/population`](https://github.com/openaddresses/population)
  CSV. The build aggregates the high-res 0.1° rows to 0.5° and maps each cell's ISO3 to the
  numeric **M49** id. Because a cell's *count* already equals density × area, splitting a
  country's deaths in proportion to cell count both preserves the country total and
  concentrates deaths in dense cells. Run with `npm run build:density` (pass `--force` to
  rebuild); the multi-MB raw CSV lives in `data/source/` (git-ignored) — only the ~1 MB
  derived grid is committed.

- **Frontend** (`public/`): a **three.js** globe (realistic day/night earth, clouds, and
  atmosphere, lit from the real-time subsolar point) with `OrbitControls` for drag/zoom.
  Each country runs its own Poisson process (mean interval `MS_PER_YEAR / deathsPerYear`,
  so the country total is preserved); when a death fires, its **location** is chosen by
  sampling one of the country's density-grid cells with probability proportional to the
  people living there, then jittering within that 0.5° cell — so dots cluster where
  population is dense. Each death appears as a growing/fading red dot on the surface. D3,
  topojson-client, three.js, and the [`world-atlas`](https://github.com/topojson/world-atlas)
  TopoJSON are vendored from npm and served by the backend (no CDN dependency). Load with
  `?calibrate` to drop fixed city markers for visually checking globe alignment.

- **Deaths feed** (`public/persona.js`): a panel at the bottom lists the last ~6 deaths as
  short personas, e.g. *"Woman 78, breast cancer – Spain"*. Since the dots are synthetic
  Poisson events, each persona is **statistically generated**, but from **real, per-country
  distributions** so it matches where the death fired:
  - **Age + sex** are drawn from that country's real age × sex distribution of deaths
    (**UN World Population Prospects**, "Deaths by age and sex", via the
    [UN Data Portal API](https://population.un.org/dataportal/about/dataapi)) — so a death in
    Japan skews old and one in Nigeria skews young, with a realistic (non-50/50) sex split.
  - **Cause** is drawn from that country's real cause-of-death mix for that sex and age band
    (**IHME Global Burden of Disease**), collapsed to recognisable labels.

  Both distributions are pre-built into committed JSON (`data/mortality-age-sex.json`,
  `data/causes.json`) and fetched once by the client; if either is missing it falls back to a
  bundled sample (`data/sample-personas.json`) and finally to an illustrative WHO-style table,
  so the feed always reads sensibly. The feed is explicitly representative, not real people.

- **Persona data build**: see *Building the persona data* below for the `npm run build:mortality`
  / `build:causes` commands and the inputs they need.

- **Fallback**: if the World Bank API is unreachable, the server serves `data/sample-cdr.json`
  (clearly marked as sample data) so the UI still renders, and the client shows a banner. If
  the raw population CSV can't be fetched at build time, `build-density.mjs` emits a coarse
  synthetic grid from the bundled `world-atlas` geometry so the app still builds offline.

- **`/api/debug`**: probes the live World Bank endpoint and reports the HTTP status + a body
  snippet — handy for diagnosing a deployment-only fetch issue.

## Run locally

```bash
npm install
npm start
# open http://localhost:3000
```

The density grid (`data/density-grid.json`) is committed, so no build step is needed to run.
To regenerate it from the source raster: `npm run build:density -- --force`.

## Building the persona data

The per-country age/sex/cause distributions behind the deaths feed are committed JSON, so
the app runs without rebuilding them. To regenerate from source:

**Age × sex (UN World Population Prospects)** — `data/mortality-age-sex.json`:

```bash
# UN_API_KEY = your UN Data Portal Bearer token (on Railway: the un_api_key variable).
UN_API_KEY=eyJ... npm run build:mortality -- --force
```

This calls the [UN Data Portal API](https://population.un.org/dataportalapi/api/v1), finds the
"Deaths by age and sex" indicator, and fetches it for every mapped country. The host
`population.un.org` must be reachable — some sandboxed/CI networks block it via an egress
allowlist; add it there (or run where it's reachable) before building.

**Cause of death (IHME GBD)** — `data/causes.json`:

The UN portal has no cause-of-death data, and IHME GBD has no tokened API, so the cause data
is built from a CSV you export once from the
[GBD Results Tool](https://vizhub.healthdata.org/gbd-results/) (free account; ≤100k rows per
request):

- **Measure** Deaths · **Metric** Number · **Sex** Male, Female
- **Cause** All causes expanded to **Level 3** (recognisable causes)
- **Age** `<1`, `1-4`, `5-9`, … 5-year groups · **Location** all countries · **Year** most recent

Save it under `data/source/` (git-ignored, like the GPWv4 raster), then:

```bash
npm run build:causes -- --force          # auto-discovers the CSV in data/source/
# or: npm run build:causes -- --src=path/to/gbd.csv --top=8 --force
```

GBD cause names are mapped to short labels and the strongest `--top` (default 8) causes per
country/sex/age band are kept, the rest folded into "other causes".

> Note: some sandboxed/CI networks block outbound hosts. There, `/api/mortality` returns
> `source: "sample"`. On a normal network (including Railway) it returns `source: "worldbank"`
> with real data for ~190 countries.

## Deploy on Railway

1. Push this repo to GitHub.
2. In Railway: **New Project → Deploy from GitHub repo** and select it.
3. Railway builds with Nixpacks. Its build command runs `npm run build:mortality` (see
   `railway.json`) so the UN age/sex distribution (`data/mortality-age-sex.json`) is fetched
   fresh at deploy time — Railway's egress reaches `population.un.org`. Set the Data Portal
   token as the `un_api_key` (or `UN_API_KEY`) service variable; if it's missing or the fetch
   fails the build still succeeds and the app falls back to the bundled persona sample. Then
   `npm start` runs the server (`PORT` is injected automatically).
4. Open the generated domain — Railway's egress reaches the World Bank API too, so the map
   shows live data.

Runtime needs no keys (the World Bank API is public). `un_api_key`/`UN_API_KEY` is used only by
the **build** to fetch the UN data. Cause data (`data/causes.json`) is *not* fetched on build —
IHME GBD has no API — so until it's built and committed (see *Building the persona data*),
causes come from the bundled sample.
