# Architecture

**Analysis Date:** 2026-06-28

## Pattern Overview

**Overall:** Single-process Express web app with static frontend, runtime data APIs, and offline build-data scripts.

**Key Characteristics:**
- One Node server (`server.js`) serves the app shell, vendor assets, static data, static pages, and JSON APIs.
- Browser frontend is vanilla ES modules plus global D3/TopoJSON scripts; there is no client build step.
- Most domain data is precomputed into committed JSON; live APIs fill only mortality rates and viewer geolocation.
- Visualization state is client-side and frame-loop driven; server state is limited to in-memory caches.

## Layers

**HTTP Serving Layer:**
- Purpose: Route requests, serve app files, serve vendor packages, expose data endpoints.
- Contains: Express app setup, route handlers, static middleware, cache-control headers.
- Location: `server.js`.
- Depends on: Node filesystem/path APIs, `express`, `world-atlas`, `i18n-iso-countries`, remote HTTP APIs.
- Used by: Browser clients and Railway runtime.

**Runtime Data Layer:**
- Purpose: Convert external mortality/geolocation data into simple frontend JSON.
- Contains: `fetchJson()`, `fetchIndicatorLatest()`, `indexByM49()`, `getMortality()`, `geolocate()`.
- Location: `server.js`.
- Depends on: World Bank, ip-api.com, committed sample JSON, M49 ids from `world-atlas`.
- Used by: `/api/mortality`, `/api/debug`, `/api/geo`.

**Visualization Layer:**
- Purpose: Render the globe, schedule death events, position flashes, manage controls, and update the feed.
- Contains: Main application loop and helper functions in `public/app.js`.
- Depends on: `three`, `OrbitControls`, D3, TopoJSON globals, `/api/mortality`, `/api/geo`, `/data/*.json`, `public/shaders.js`, `public/persona.js`.
- Used by: `public/index.html`.

**Shader/Material Layer:**
- Purpose: Encapsulate realistic earth material, atmosphere material, day/night blend, clouds, bump mapping, and shockwave UV ripple.
- Contains: `createEarth()` in `public/shaders.js`.
- Depends on: `three` and `three/tsl` node-material APIs.
- Used by: `public/app.js`.

**Persona Layer:**
- Purpose: Generate statistically representative feed lines for synthetic deaths.
- Contains: `initPersona()`, `makePersona()`, age/sex/cause sampling helpers, fallback tables.
- Location: `public/persona.js`.
- Depends on: Static JSON from `/data/mortality-age-sex.json`, `/data/causes.json`, `/data/sample-personas.json`.
- Used by: `public/app.js`.

**Build Data Layer:**
- Purpose: Precompute compact JSON artifacts for the runtime app.
- Contains: `scripts/build-density.mjs`, `scripts/build-mortality.mjs`, `scripts/build-causes.mjs`.
- Depends on: source CSVs/APIs, `world-atlas`, `d3`, `topojson-client`, `i18n-iso-countries`.
- Used by: Developer commands and Railway build.

## Data Flow

**Initial Page Load:**

1. Browser requests `/`; `server.js` returns `public/index.html` with `__V__` replaced by deploy version.
2. Browser loads `public/styles.css`, global vendor scripts, import map, and `public/app.js`.
3. `public/app.js` starts `/api/geo` in parallel with data loading.
4. Browser loads map TopoJSON, density grid, `/api/mortality`, persona data, and earth textures.
5. Once textures and data are ready, `THREE.WebGPURenderer` renders the first frame and hides the loader.

**Mortality API:**

1. Client requests `/api/mortality`.
2. `getMortality()` returns cached payload if fresh.
3. Otherwise server fetches World Bank CDR and population indicators in parallel.
4. Rows are mapped from ISO3 to numeric M49 and filtered to countries present in `world-atlas`.
5. Response contains country id, ISO3, name, CDR, source year, and population.
6. On failure, server returns `data/sample-cdr.json` with `source: "sample"`.

**Death Event Loop:**

1. `public/app.js` computes deaths/year from CDR and population for each country.
2. Each country gets a Poisson process with exponentially distributed next-event gaps.
3. When a death fires, a location is sampled from `data/density-grid.json` weighted by cell population.
4. A tangent flash mesh is added and a shockwave center/progress is passed into shader uniforms.
5. A persona line is sampled from age/sex/cause distributions and appended to the feed.

**Build Data Generation:**

1. `npm run build:density` aggregates GPWv4 CSV rows into `data/density-grid.json`, with synthetic fallback.
2. `npm run build:mortality` fetches UN age/sex death data and writes `data/mortality-age-sex.json`.
3. `npm run build:causes` aggregates a manually exported IHME GBD CSV into `data/causes.json`.

**State Management:**
- Server state: in-memory mortality and geolocation caches only; lost on restart.
- Client state: Three.js scene graph, active blasts, feed DOM, camera target, loaded data, and per-country timers.
- Persistent state: committed data JSON and static assets in the repository.

## Key Abstractions

**M49 Country Id:**
- Purpose: Shared join key across World Bank rows, world map geometry, density cells, and persona distributions.
- Examples: `indexByM49()` in `server.js`, `grid.cells` entries in `data/density-grid.json`, `nameById` in `public/app.js`.
- Pattern: Numeric id normalized at source boundaries.

**Poisson Death Process:**
- Purpose: Converts annual death totals into realistic irregular event timing.
- Examples: `expGap()`, `blinkById`, `state.next` in `public/app.js`.
- Pattern: Independent stochastic process per country.

**Density Cell Sampler:**
- Purpose: Preserve country totals while placing deaths where people live.
- Examples: `cellsByCountry`, cumulative arrays, `densityLonLat()` in `public/app.js`.
- Pattern: Weighted random sampling with cumulative distribution and binary search.

**Fallback Data Chain:**
- Purpose: Keep the app rendering when remote sources or build outputs are unavailable.
- Examples: `sampleFallback()` in `server.js`, `initPersona()` and fallback tables in `public/persona.js`, synthetic grid in `scripts/build-density.mjs`.
- Pattern: Progressive degradation from real data to sample/synthetic data.

## Entry Points

**Server Runtime:**
- Location: `server.js`.
- Triggers: `npm start` or Railway start command.
- Responsibilities: Serve HTML/assets/data, fetch live APIs, cache responses, and listen on `PORT`.

**Browser App:**
- Location: `public/app.js`.
- Triggers: `<script type="module" src="/app.js?v=__V__">` in `public/index.html`.
- Responsibilities: Load data/textures, create scene, schedule death events, render frames, manage feed.

**Shader Module:**
- Location: `public/shaders.js`.
- Triggers: Imported by `public/app.js` through the import map alias `shaders`.
- Responsibilities: Create earth and atmosphere materials and expose uniforms.

**Persona Module:**
- Location: `public/persona.js`.
- Triggers: Imported by `public/app.js` through the import map alias `persona`.
- Responsibilities: Load persona distributions and generate feed text.

**Build Scripts:**
- Locations: `scripts/build-density.mjs`, `scripts/build-mortality.mjs`, `scripts/build-causes.mjs`.
- Triggers: npm scripts or Railway build.
- Responsibilities: Generate committed/runtime JSON data artifacts.

## Error Handling

**Strategy:** Fail soft for runtime data and visual load where possible; fail fast for build scripts when required source/auth is missing.

**Patterns:**
- Server external fetches use timeout/retry and return fallback data for mortality/geolocation.
- Browser data or texture load failure logs to console and hides the loader instead of leaving an infinite spinner.
- Persona generation never throws after initialization; it falls back to sample and hardcoded tables.
- Build scripts `console.error()` and `process.exit(1)` on unrecoverable input problems.

## Cross-Cutting Concerns

**Logging:**
- Plain `console.log`/`console.error`; no structured logger.
- `/api/debug` provides targeted visibility into the World Bank upstream.

**Validation:**
- Mostly manual guards at source boundaries: response shape checks, numeric checks, id filters, CSV column checks, token presence checks.
- No schema library is used.

**Authentication:**
- No user authentication.
- UN API auth is a build-time bearer token only.

**Caching:**
- `server.js` caches API-derived payloads in memory.
- Static assets use `no-cache` plus deploy version query strings.

---
*Architecture analysis: 2026-06-28*
*Update when major patterns change*
