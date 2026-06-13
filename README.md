# watch-people-die-live

A real-time world map where **each flash is one real death**. Death rates come from the
[World Bank API](https://data.worldbank.org/indicator/SP.DYN.CDRT.IN) (Crude Death Rate,
indicator `SP.DYN.CDRT.IN`), but instead of flashing whole countries, deaths are placed on a
**population-density grid** — so they land where people actually live and denser regions die
far more often, while each country's real total deaths/year is preserved exactly.

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

- **Frontend** (`public/`): vanilla **D3 v7** + **topojson-client**. Two stacked
  `<canvas>` layers under a `geoNaturalEarth1` projection: a static background drawing the
  density field (cell brightness = log population) plus faint coastlines, and a foreground
  where each cell runs its own Poisson process and **only the few currently-flashing cells
  are redrawn per frame**. Each cell's mean interval is
  `MS_PER_YEAR / (countryDeaths/yr × cellPop / countryPop)`. Hover any cell for its local
  rate. D3, topojson-client, and the [`world-atlas`](https://github.com/topojson/world-atlas)
  TopoJSON are vendored from npm and served by the backend (no CDN dependency).

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

> Note: some sandboxed/CI networks block outbound hosts. There, `/api/mortality` returns
> `source: "sample"`. On a normal network (including Railway) it returns `source: "worldbank"`
> with real data for ~190 countries.

## Deploy on Railway

1. Push this repo to GitHub.
2. In Railway: **New Project → Deploy from GitHub repo** and select it.
3. Railway builds with Nixpacks and runs `npm start` (see `railway.json`). The `PORT`
   environment variable is injected automatically and the server honors it.
4. Open the generated domain — Railway's egress reaches the World Bank API, so the map shows
   live data.

No environment variables or API keys are required — the World Bank API is public.
