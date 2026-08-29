# watch-people-die-live

A real-time 3D globe where **each dot is one real death**. Death rates come from the
[World Bank API](https://data.worldbank.org/indicator/SP.DYN.CDRT.IN) (Crude Death Rate,
indicator `SP.DYN.CDRT.IN`), but instead of dropping each death at a random point in its
country, deaths are placed on a **combined population-density + country-rate grid** — so
they land where people actually live and denser/higher-mortality regions fire far more
often, while each country's real total deaths/year is preserved exactly.

> The World Bank's crude death rate is itself derived from the UN World Population Prospects.
> The UN Data Portal API was the original source, but its data endpoint now requires a Bearer
> token, so this uses the equivalent open World Bank indicator (no token / registration needed).

## How it works

- **Framework**: [Next.js 16](https://nextjs.org) (App Router, React 19), written in strict
  TypeScript. `app/api/*` route handlers replace the old Express server; `app/globe/*` is the
  globe itself (Three.js via `@react-three/fiber`/`drei`).

- **The combined rate grid** (`data/rate-grid.json`, baked offline by
  `notebooks/combine.ipynb`): one row per populated 0.5° cell, `[lon, lat, countryId, w]`,
  where `w` is that cell's expected deaths/year — population × that country's crude death
  rate relative to the global mean. There is no runtime WHEN/WHERE split anymore: the globe
  runs a single global Poisson process and samples one cell per death, which gives both the
  location and the country in one step. See `docs/DENSITY-MORTALITY-JOIN.md` for the full
  model, including how new realism layers (subnational rates, conflicts, time-of-day) plug
  in without changing this runtime shape.

- **Seasonality** (`data/seasonality.json`): a 12-month multiplier per country (mean 1),
  built from UN Demographic Yearbook monthly deaths, with a latitude-scaled fallback for
  countries that don't report monthly data. It's the one layer still recomputed in the
  browser (deaths speed up in winter, slow down in summer) rather than baked into the grid,
  since it's the only thing that changes _during_ a session.

- **Frontend** (`app/globe/`): a **three.js** globe (realistic day/night earth, clouds, and
  atmosphere, lit from the real-time subsolar point) with `OrbitControls` for drag/zoom. Each
  death is rendered as an **"atomic blast seen from space"**: a white **double flash** (a
  near-instant first pulse, a brief dark minimum, then a longer second pulse — the
  bhangmeter signature, slowed to be visible) followed by a single subtle **shockwave** that
  refracts the surface like one expanding water ripple (implemented in the earth fragment
  shader). The UI is otherwise minimal — the globe fills the screen, the north pole stays up
  while you drag, a small **last-deaths feed** scrolls generated personas at the bottom, and
  a `/roadmap` page walks through each layer of realism (implemented vs. planned). Load with
  `?calibrate` to drop fixed city markers for visually checking globe alignment.

- **Deaths feed** (`app/globe/persona.ts`): the bottom of the screen lists the last ~60
  deaths as short generated personas, e.g. _"Woman 78, breast cancer – Spain"_. Each is drawn
  from **real, per-country distributions** so it matches where the death fired — **age +
  sex** from the **UN World Population Prospects** ("Deaths by age and sex", via the
  [UN Data Portal API](https://population.un.org/dataportal/about/dataapi)) and **cause**
  from the **IHME Global Burden of Disease** — pre-built into committed JSON
  (`data/mortality-age-sex.json`, `data/causes.json`) with a bundled sample fallback
  (`data/sample-personas.json`), and an illustrative WHO-style table as a last resort, so the
  feed always reads sensibly. Identities are representative, not real people. See _Building
  the persona data_ for the `build:mortality` / `build:causes` commands.

- **Viewer location** (`/api/geo`): on load the globe gently rotates to centre on the
  viewer's approximate location. The server looks up the caller's IP via the free, no-key
  [ip-api.com](https://ip-api.com) (using the `X-Forwarded-For` client IP behind Railway's
  proxy) and returns only coordinates + a place name, cached briefly in memory — nothing is
  persisted. It's best-effort: if the lookup fails or the host is unreachable, the globe just
  keeps its default orientation.

- **Fallback**: if the World Bank API is unreachable, `/api/mortality` serves
  `data/sample-cdr.json` (clearly marked as sample data). If the raw population CSV can't be
  fetched at build time, `build-density.ts` emits a coarse synthetic grid from the bundled
  `world-atlas` geometry so the app still builds offline.

- **`/api/debug`**: probes the live World Bank endpoint and reports the HTTP status + a body
  snippet — handy for diagnosing a deployment-only fetch issue.

## Run locally

```bash
pnpm install
pnpm dev
# open http://localhost:3000
```

`data/density-grid.json` and `data/rate-grid.json` are committed, so no build/bake step is
needed to run. `predev`/`prebuild` sync `data/*.json` into `public/data/` automatically.

`pnpm dev:ios` does the same and then opens the page in Mobile Safari on the iOS Simulator —
the only place the mobile layout, the page running under the status bar and touch on the
charts behave like the real thing. It reuses a dev server already on the port if there is
one, boots a simulator if none is running (`SIM_DEVICE` picks which), and takes an optional
path: `pnpm dev:ios "/?lang=ca"`.

## Tooling

Strict TypeScript throughout (`tsconfig.json`). ESLint checks correctness only — Prettier
owns all formatting (JS/TS/CSS/JSON/MD), Stylelint checks CSS, and ruff + nbqa lint the
notebooks. Husky + lint-staged run all of this (plus `tsc --noEmit` and the Vitest suite) on
every commit; a commit with errors is rejected.

```bash
pnpm run lint          # eslint
pnpm run typecheck     # tsc --noEmit
pnpm run format        # prettier --write
pnpm run stylelint     # stylelint app/**/*.css
pnpm run lint:notebooks
pnpm test              # vitest
```

## Regenerating the combined rate grid

`data/rate-grid.json` is committed, so it's optional day to day. To rebuild it from a fresh
World Bank snapshot:

```bash
pnpm run dump:cdr              # writes data/source/cdr-snapshot.json
pnpm run gen:synthetic-cells   # writes data/source/synthetic-cells.json
```

Then, with the Jupyter server running (see `.mcp.json` / `CLAUDE.md`), re-execute
`notebooks/layers/country-rate.ipynb` and `notebooks/combine.ipynb` to re-bake
`data/layers/country-rate.json` and `data/rate-grid.json`.

To regenerate the underlying population density grid from the GPWv4 raster:
`pnpm run build:density -- --force` (the multi-MB raw CSV lives in `data/source/`,
git-ignored — only the ~1 MB derived grid is committed).

## Building the persona data

The per-country age/sex/cause distributions behind the deaths feed are committed JSON, so
the app runs without rebuilding them. To regenerate from source:

**Age × sex (UN World Population Prospects)** — `data/mortality-age-sex.json`:

```bash
# UN_API_KEY = your UN Data Portal Bearer token (on Railway: the un_api_key variable).
UN_API_KEY=eyJ... pnpm run build:mortality -- --force
```

This calls the [UN Data Portal API](https://population.un.org/dataportalapi/api/v1), finds
the "Deaths by age and sex" indicator, and fetches it for every mapped country. The host
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
pnpm run build:causes -- --force          # auto-discovers the CSV in data/source/
# or: pnpm run build:causes -- --src=path/to/gbd.csv --top=8 --force
```

GBD cause names are mapped to short labels and the strongest `--top` (default 8) causes per
country/sex/age band are kept, the rest folded into "other causes".

> Note: some sandboxed/CI networks block outbound hosts. There, `/api/mortality` returns
> `source: "sample"`. On a normal network (including Railway) it returns `source: "worldbank"`
> with real data for ~170 countries.

## Conflict data (ACLED, build time)

Step 6 ("Ongoing Conflicts") and the globe's conflict layer read `public/data/conflicts.json`,
baked at build time by `scripts/build-conflicts.ts`. There is no runtime route and no runtime
refresh: the layer is exactly as current as the last build that fetched. It authenticates to
ACLED's six regional aggregate landing pages, discovers the current XLSX files, and streams them
with ExcelJS. The oldest regional publication date becomes the globally complete cutoff
(`commonThrough`), and the snapshot retains the 12 complete weeks ending there.

The chart and map use the reported weekly country/Admin-1 aggregates. The map draws the supplied
Admin-1 centroids as an explicit spatial approximation. For the globe, a robust EWMA (four-week
half-life, P10-P90 damping) estimates the current weekly total. That total is distributed by each
Admin-1 region's 12-week fatality share, annualised, and placed on the nearest populated
rate-grid cell in the same country.

These are **build-time** secrets. Set a myACLED account's credentials locally in `.env` and as
Railway service variables:

```bash
ACLED_USERNAME=you@example.edu
ACLED_PASSWORD=your-myacled-password
```

ACLED uses OAuth2 (the old key+email scheme is gone); the build exchanges these for a bearer
token, reused for every request in that build.

### How often it refetches

ACLED publishes weekly and its workbooks already lag around two weeks, so contacting it on every
push bought nothing and cost a great deal — in August 2026 it got the Railway builder's IP blocked
by ACLED's Imunify360 bot protection. `lib/conflict-snapshot.ts` decides whether to make contact:

- The snapshot carries `generatedAt` (when its numbers were computed) and, on the confirm path,
  `verifiedAt` (when we last asked ACLED whether they were still current). If that timestamp is
  under **72 hours** old, the build does not contact ACLED at all.
- A copy is kept in the build cache (`node_modules/.cache/conflicts/v<schema>/`), so a later build
  on the same builder starts from it rather than from whatever `data/conflicts.json` was last
  committed. Railway does not guarantee cache hits; a miss simply falls back to the committed file,
  which is the behaviour without the cache at all. Railway volumes cannot serve this purpose —
  they are mounted at container start, never during a build.
- When the gate does open, the build first asks only for the six landing pages. If ACLED is still
  publishing the week we already hold, it stamps `verifiedAt` and skips the six workbook downloads
  (Africa's alone expands past 100 MB).

`commonThrough` is the honest number for a reader and is what `ConflictMap` shows. `verifiedAt` is
build metadata about our fetching and must not be rendered.

| Knob                           | Effect                                                                                                                                                                     |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm build:conflicts --force` | Rebuild regardless of the gate or the cutoff. Use after a modelling change that alters the numbers without moving `commonThrough`.                                         |
| `CONFLICTS_MAX_AGE_HOURS`      | Override the 72h gate. `0` checks upstream on this build. Set it as a Railway service variable — `railway.json` runs `npm run build`, so a CLI flag cannot be threaded in. |
| `CONFLICTS_CACHE_DIR`          | Override the build-cache location; empty string disables the layer.                                                                                                        |
| `SKIP_CONFLICTS_BUILD=1`       | Ship the snapshot as-is without touching the network. Outranks `--force`. For a hotfix during an ACLED outage, not as a habit.                                             |

A build that decides to contact ACLED and cannot will fail rather than ship a stale layer as
current. The gate narrows when that decision is taken, so a build during a short ACLED outage now
succeeds if the snapshot on hand is under 72 hours old.

## Deploy on Railway

1. Push this repo to GitHub.
2. In Railway: **New Project → Deploy from GitHub repo** and select it.
3. Railway builds with Nixpacks. Its build command runs `build:mortality` (see
   `railway.json`) so the UN age/sex distribution (`data/mortality-age-sex.json`) is fetched
   fresh at deploy time — Railway's egress reaches `population.un.org`. Set the Data Portal
   token as the `un_api_key` (or `UN_API_KEY`) service variable; if it's missing or the fetch
   fails the build still succeeds and the app falls back to the bundled persona sample. Then
   `next start` runs the server (`PORT` is injected automatically).
4. Open the generated domain — Railway's egress reaches the World Bank API too, so the globe
   shows live death rates.

The runtime is keyless — the World Bank API is public and `data/rate-grid.json` is baked offline
ahead of time. `ACLED_USERNAME` / `ACLED_PASSWORD` are needed by the **build** only (see _Conflict
data_ above); no volume is involved, and none can be.
`un_api_key`/`UN_API_KEY` is used only by the **build** to fetch the
UN age/sex data. Cause data (`data/causes.json`) is _not_ fetched on build — IHME GBD has no
API — so until it's rebuilt and committed (see _Building the persona data_), causes come from
the bundled sample.
