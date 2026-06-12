# watch-people-die-live

A world map of **Crude Death Rate** (deaths per 1,000 population) for the latest available
year, pulled from the [UN World Population Prospects Data Portal API](https://population.un.org/dataportal/about/dataapi)
and rendered as a D3 choropleth.

## How it works

- **Backend** (`server.js`, Express): a `/api/mortality` endpoint that
  1. resolves the *Crude Death Rate* indicator id from the API by name,
  2. lists country locations (filtered to those present in the map geometry),
  3. detects the latest year with an estimate value, and
  4. fetches the per-country values (both sexes), handling the API's pagination.

  The result is cached in memory (~24h). The endpoint returns
  `{ indicator, year, source, values: [{ id, iso3, name, value }] }`, where `id` is the
  numeric **M49 code** — the same key used by the map geometry, so the join is direct.

- **Frontend** (`public/`): vanilla **D3 v7** + **topojson-client** drawing a
  `geoNaturalEarth1` choropleth, with a color legend and hover tooltips. D3, topojson-client,
  and the [`world-atlas`](https://github.com/topojson/world-atlas) TopoJSON are vendored from
  npm and served by the backend (no CDN dependency).

- **Fallback**: if the UN API is unreachable, the server serves `data/sample-cdr.json`
  (clearly marked as sample data) so the UI still renders, and the client shows a banner.

## Run locally

```bash
npm install
npm start
# open http://localhost:3000
```

> Note: some sandboxed/CI networks block `population.un.org`. There, `/api/mortality` returns
> `source: "sample"`. On a normal network (including Railway) it returns `source: "un"` with
> real data for ~200 countries.

## Deploy on Railway

1. Push this repo to GitHub.
2. In Railway: **New Project → Deploy from GitHub repo** and select it.
3. Railway builds with Nixpacks and runs `npm start` (see `railway.json`). The `PORT`
   environment variable is injected automatically and the server honors it.
4. Open the generated domain. Railway's egress reaches the UN API, so the map shows live data.

No environment variables or API keys are required — the UN Data Portal API is public.
