# Architecture

**Analysis Date:** 2026-07-03

## Pattern Overview

**Overall:** Next.js 16 App Router app (strict TypeScript) with server-rendered API routes,
a client-only Three.js globe, and an offline Jupyter-notebook data pipeline that bakes a
single combined mortality grid consumed at runtime.

**Key Characteristics:**

- Next.js serves the app shell, API routes, and static data; there is no separate Express
  server (superseded a prior Express/vanilla-JS version — see `.planning/PROJECT.md`).
- The globe (`app/globe/`) is a client component tree; visualization state is client-side
  and frame-loop driven (react-three-fiber's `useFrame`).
- WHEN and WHERE a death fires used to be two independent runtime stages (a per-country
  Poisson process + population-weighted cell sampling). They are now unified: a single
  combined grid (`data/rate-grid.json`), baked offline by notebooks, carries each cell's
  expected deaths/year directly, and the runtime samples one global weighted process.
- Most domain data is precomputed into committed JSON; the only genuinely live runtime
  fetches are `/api/mortality` (for the roadmap page and as a name fallback) and
  `/api/geo` (viewer geolocation).
- Strict TypeScript, ESLint (correctness only), Prettier (all formatting), Stylelint (CSS),
  and ruff/nbqa (notebooks) are enforced on every commit via Husky + lint-staged.

## Layers

**HTTP / API Layer:**

- Purpose: Expose mortality and geolocation data to the client; serve the vendored
  countries TopoJSON.
- Contains: `app/api/mortality/route.ts`, `app/api/geo/route.ts`, `app/api/debug/route.ts`,
  `app/data/countries-110m.json/route.ts`.
- Location: `app/api/**/route.ts`, `app/data/countries-110m.json/route.ts`.
- Depends on: `lib/worldbank.ts`, `lib/geo.ts`, Next.js `Response`/`headers()`.
- Used by: `app/globe/useGlobeData.ts` (name fallback), `app/roadmap/useRoadmapData.ts`.

**Runtime Data Helpers:**

- Purpose: Convert external mortality/geolocation data into simple JSON payloads.
- Contains: `getMortality()`, `probeWorldBank()` (`lib/worldbank.ts`); `geolocate()`,
  `clientIpFromHeaders()` (`lib/geo.ts`).
- Depends on: World Bank API, ip-api.com, `data/sample-cdr.json` fallback, `world-atlas`
  ids via `i18n-iso-countries`.
- Used by: the API routes above.

**Globe Visualization Layer:**

- Purpose: Render the globe, run the single global death-event Poisson process, position
  flashes, manage camera/controls, and update the feed.
- Contains: `app/globe/Globe.tsx` (scene setup, feed state), `app/globe/Earth.tsx`
  (per-frame simulation), `app/globe/useGlobeData.ts` (data loading + the weighted
  sampler), `app/globe/helpers.ts` (pure math), `app/globe/constants.ts`.
- Depends on: `three`/`three/webgpu`, `@react-three/fiber`/`drei`, D3, TopoJSON,
  `/api/mortality`, `/api/geo`, `/data/rate-grid.json`, `/data/seasonality.json`,
  `/data/countries-110m.json`, `app/globe/shaders.ts`, `app/globe/persona.ts`.
- Used by: `app/page.tsx`.

**Shader/Material Layer:**

- Purpose: Encapsulate the realistic earth material, atmosphere material, day/night blend,
  clouds, bump mapping, and shockwave UV ripple.
- Contains: `createEarth()` in `app/globe/shaders.ts` (three/tsl node materials).
- Depends on: `three`, `three/tsl`.
- Used by: `app/globe/Earth.tsx`.

**Persona Layer:**

- Purpose: Generate statistically representative feed lines for synthetic deaths.
- Contains: `initPersona()`, `makePersona()`, age/sex/cause sampling helpers, fallback
  tables (`app/globe/persona.ts`).
- Depends on: Static JSON at `/data/mortality-age-sex.json`, `/data/causes.json`,
  `/data/sample-personas.json`.
- Used by: `app/globe/Globe.tsx` (`onPushDeath`).

**Roadmap Layer:**

- Purpose: A public `/roadmap` page visualizing each layer of realism (implemented vs.
  planned) for portfolio/storytelling purposes.
- Contains: `app/roadmap/page.tsx`, `app/roadmap/useRoadmapData.ts`,
  `app/roadmap/charts/*.tsx`, `app/roadmap/steps/*.tsx`.
- Depends on: `/api/mortality`, `/data/density-grid.json`, `/data/seasonality.json`,
  `/data/seasonality-unified.json`, `/data/countries-110m.json`. Independent of the live
  globe's rate grid — reads the base density grid directly for its own visualizations.
- Used by: Public visitors linked from the globe.

**Offline Data Pipeline (notebooks):**

- Purpose: Author relative-multiplier "layers" and combine them with the base population
  grid into the single committed `data/rate-grid.json` the globe samples at runtime.
- Contains: `notebooks/lib/grid.py` (shared helpers: `load_base`, `country_at`,
  `bake_layer`), `notebooks/layers/country-rate.ipynb` (bakes `data/layers/country-rate.json`),
  `notebooks/combine.ipynb` (bakes `data/rate-grid.json`), `notebooks/seasonality.ipynb`
  (bakes `data/seasonality-unified.json`, not yet wired into the live grid).
- Depends on: `data/density-grid.json`, `data/source/cdr-snapshot.json`,
  `data/source/synthetic-cells.json`.
- Used by: Developer runs via the Jupyter MCP server (see `CLAUDE.md`); output is committed.

**Build Data Layer (Node/TypeScript scripts):**

- Purpose: Precompute compact JSON artifacts and pipeline inputs from raw sources.
- Contains: `scripts/build-density.ts`, `scripts/build-mortality.ts`,
  `scripts/build-causes.ts`, `scripts/build-seasonality.ts`, `scripts/dump-cdr.ts`
  (snapshots live CDR for the notebooks), `scripts/gen-synthetic-cells.ts` (fills
  base-grid gaps for CDR countries with no raster cells), `scripts/sync-data.ts` (mirrors
  `data/*.json` into `public/data/`).
- Depends on: source CSVs/APIs, `world-atlas`, `d3`, `topojson-client`,
  `i18n-iso-countries`, `lib/worldbank.ts`. Run via `tsx`.
- Used by: Developer commands, `predev`/`prebuild` npm hooks, Railway build.

## Data Flow

**Initial Page Load:**

1. Browser requests `/`; Next.js renders `app/layout.tsx` + `app/page.tsx` (→ `Globe`).
2. `app/globe/useGlobeData.ts` fetches `/data/countries-110m.json`, `/data/rate-grid.json`,
   `/api/mortality`, `/data/seasonality.json`, and persona data (`initPersona()`) in
   parallel; `/api/geo` resolves independently and doesn't block the globe.
3. The rate grid's cells are indexed into typed arrays; a seasonally-reweighted cumulative
   distribution is built once (and rebuilt on UTC month change).
4. Once earth textures and data are ready, `THREE.WebGPURenderer` renders the first frame
   and hides the loader.

**Mortality API:**

1. Client requests `/api/mortality` (used by the roadmap page live, and by the globe only
   as a display-name fallback for any id the grid's own `names` map is missing).
2. `getMortality()` fetches World Bank CDR and population indicators in parallel (Next's
   fetch cache, ~24h revalidate).
3. Rows are mapped from ISO3 to numeric M49 and filtered to countries present in
   `world-atlas`.
4. Response contains country id, ISO3, name, CDR, source year, and population.
5. On failure, returns `data/sample-cdr.json` with `source: "sample"`.

**Death Event Loop (single global sampler):**

1. `app/globe/useGlobeData.ts` builds one cumulative-weight array over every rate-grid
   cell (`cellWeight × seasonalFactor(country, month)`) and exposes `sampleCell()`.
2. `app/globe/Earth.tsx` runs **one** Poisson process (`mean = msPerYear / total`, not per
   country) with exponentially distributed next-event gaps.
3. When it fires, `sampleCell()` binary-searches the cumulative array and returns
   `[lon, lat, countryId]` — jittered within the winning 0.5° cell — in a single step.
4. A flash mesh is added and a shockwave center/progress is passed into shader uniforms.
5. A persona line is sampled from age/sex/cause distributions (keyed by the sampled
   country id) and appended to the feed.
6. On UTC month change, the cumulative array (and the Poisson mean) is rebuilt so the
   seasonal reweighting takes effect without a page reload.

**Offline Grid Bake:**

1. `pnpm run dump:cdr` snapshots live World Bank data to `data/source/cdr-snapshot.json`.
2. `pnpm run gen:synthetic-cells` fills base-grid gaps for CDR countries with no raster
   cells (`data/source/synthetic-cells.json`).
3. `notebooks/layers/country-rate.ipynb` bakes `data/layers/country-rate.json` (a
   mean-1 relative multiplier per cell, from each cell's country's CDR vs. the global mean).
4. `notebooks/combine.ipynb` combines the base grid + country-rate layer + CDR into
   `data/rate-grid.json`, asserting per-country and global death totals match exactly.
5. `scripts/sync-data.ts` mirrors it (and the other `data/*.json`) into `public/data/`.

**State Management:**

- Server state: none persisted; in-memory fetch caches only (Next's fetch cache +
  `lib/geo.ts`'s short-lived geolocation cache).
- Client state: Three.js scene graph, active blasts, feed DOM, camera target, loaded data,
  and the single global sampler (no more per-country timers).
- Persistent state: committed data JSON (including the baked `data/rate-grid.json`) and
  static assets in the repository.

## Key Abstractions

**M49 Country Id:**

- Purpose: Shared join key across World Bank rows, map geometry, grid cells, and persona
  distributions.
- Examples: `indexByM49()` in `lib/worldbank.ts`, `grid.cells` entries in
  `data/rate-grid.json`, `nameById` in `app/globe/useGlobeData.ts`.
- Pattern: Numeric id normalized at source boundaries.

**Combined Rate Grid:**

- Purpose: Fold population density and country death rate into one per-cell expected
  deaths/year, so WHEN and WHERE fall out of a single weighted sample.
- Examples: `data/rate-grid.json`, `buildSampler()`/`sampleCell()` in
  `app/globe/useGlobeData.ts`.
- Pattern: Notebook-baked static grid, cumulative-array + binary-search sampling at
  runtime (replaces the old per-country Poisson + `densityLonLat()` split).

**Relative-Multiplier Layer:**

- Purpose: Let new realism dimensions (subnational rate, conflict, time-of-day) plug into
  the same grid without an absolute-probability trap (independent probabilities can't be
  multiplied directly; mean-1 relative multipliers can).
- Examples: `notebooks/lib/grid.py`'s `bake_layer()`, `data/layers/country-rate.json`,
  the precomputed/server/browser locus model in `docs/DENSITY-MORTALITY-JOIN.md`.
- Pattern: A layer is authored as `get_mortality_multiplier(lonlat)`, baked to a per-cell
  mean-1 array, then multiplied into the combined grid at bake time (or applied live for
  browser-locus layers like seasonality).

**Fallback Data Chain:**

- Purpose: Keep the app rendering when remote sources or build outputs are unavailable.
- Examples: `sampleFallback()` in `lib/worldbank.ts`, `initPersona()` and fallback tables
  in `app/globe/persona.ts`, synthetic grid in `scripts/build-density.ts`, synthetic cells
  in `scripts/gen-synthetic-cells.ts`.
- Pattern: Progressive degradation from real data to sample/synthetic data.

## Entry Points

**Next.js App:**

- Location: `app/layout.tsx`, `app/page.tsx`.
- Triggers: HTTP requests to `/`.
- Responsibilities: Render the root document and mount the globe.

**Globe Component:**

- Location: `app/globe/Globe.tsx`.
- Triggers: Mounted by `app/page.tsx`.
- Responsibilities: Own the R3F `Canvas`, camera controls, and death-feed DOM/state.

**API Routes:**

- Locations: `app/api/mortality/route.ts`, `app/api/geo/route.ts`,
  `app/api/debug/route.ts`, `app/data/countries-110m.json/route.ts`.
- Triggers: Client `fetch()` calls from `useGlobeData.ts`/`useRoadmapData.ts`.
- Responsibilities: Serve mortality data, viewer geolocation, debug probes, and the
  vendored countries TopoJSON.

**Build Scripts:**

- Locations: `scripts/build-density.ts`, `scripts/build-mortality.ts`,
  `scripts/build-causes.ts`, `scripts/build-seasonality.ts`, `scripts/dump-cdr.ts`,
  `scripts/gen-synthetic-cells.ts`, `scripts/sync-data.ts`.
- Triggers: npm scripts (via `tsx`) or Railway build (`predev`/`prebuild` hooks).
- Responsibilities: Generate committed/runtime JSON data artifacts and pipeline inputs.

**Notebooks:**

- Locations: `notebooks/layers/country-rate.ipynb`, `notebooks/combine.ipynb`,
  `notebooks/seasonality.ipynb`.
- Triggers: Manual developer runs against the local Jupyter server (see `CLAUDE.md`).
- Responsibilities: Author and bake the combined rate grid and its layers.

## Error Handling

**Strategy:** Fail soft for runtime data and visual load where possible; fail fast for
build scripts and notebook bakes when required source/auth is missing or a coverage
assertion doesn't hold.

**Patterns:**

- Server external fetches use timeout/retry and return fallback data for
  mortality/geolocation.
- Browser data or texture load failure logs to console and shows an error state instead
  of leaving an infinite spinner.
- Persona generation never throws after initialization; it falls back to sample and
  hardcoded tables.
- Build scripts `console.error()` and `process.exit(1)` on unrecoverable input problems.
- `notebooks/combine.ipynb` asserts per-country and global death totals match the source
  CDR exactly before writing `data/rate-grid.json`.

## Cross-Cutting Concerns

**Logging:**

- Plain `console.log`/`console.error`; no structured logger.
- `/api/debug` provides targeted visibility into the World Bank upstream.

**Validation:**

- Mostly manual guards at source boundaries: response shape checks, numeric checks, id
  filters, CSV column checks, token presence checks, notebook coverage assertions.
- No schema library is used at runtime; TypeScript's strict mode is the main static
  correctness net.

**Authentication:**

- No user authentication.
- UN API auth is a build-time bearer token only.

**Caching:**

- Next.js fetch cache for World Bank responses (~24h revalidate); a short-lived in-memory
  cache for geolocation lookups.
- Static data assets (`public/data/*.json`) regenerated at build/dev start by
  `scripts/sync-data.ts`.

**Code Quality Gates:**

- Strict TypeScript (`tsconfig.json`), ESLint (correctness only, `eslint.config.mjs`),
  Prettier (all formatting), Stylelint (CSS), ruff/nbqa (notebooks), Vitest (unit tests).
- Husky + lint-staged block commits that fail any of the above (`.husky/pre-commit`).

---

_Architecture analysis: 2026-07-03_
_Update when major patterns change_
