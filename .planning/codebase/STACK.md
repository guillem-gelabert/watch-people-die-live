# Technology Stack

**Analysis Date:** 2026-06-28

## Languages

**Primary:**
- JavaScript ES modules - All server, browser, and build-script code uses ESM (`"type": "module"` in `package.json`).
- HTML/CSS - Static app shell and methodology page in `public/index.html`, `public/methodology.html`, and `public/styles.css`.

**Secondary:**
- JSON - Committed data artifacts in `data/` and deployment config in `railway.json`.

## Runtime

**Environment:**
- Node.js >=20 - Required by `package.json` engines and used for `fetch`, ESM, Express server, and build scripts.
- Browser with WebGPU/WebGL2-capable three.js runtime - `public/app.js` uses `THREE.WebGPURenderer` from `three.webgpu.min.js`, which falls back internally where supported.

**Package Manager:**
- npm - `package-lock.json` is present and should remain the authoritative lockfile.
- Run commands are defined in `package.json`: `npm start`, `npm run build:density`, `npm run build:mortality`, and `npm run build:causes`.

## Frameworks

**Core:**
- Express 4.21.2 - HTTP server, static file serving, API routes, and clean-page routes in `server.js`.
- three 0.184.0 - 3D globe rendering, WebGPU renderer, node materials, orbit controls, textures, and geometry.
- D3 7.9.0 - Browser-side TopoJSON processing helpers and geographic utilities; build scripts also use D3 geo helpers.
- topojson-client 3.1.0 - Converts `world-atlas` TopoJSON into GeoJSON features.

**Testing:**
- No general test runner is configured.
- `scripts/verify-globe-alignment.mjs` is a focused Node verification script for globe coordinate alignment.

**Build/Dev:**
- No bundler is used. Browser modules are served directly from `public/` and vendored npm package files through Express.
- `railway.json` runs `npm run build:mortality -- --force` during Railway builds, tolerating failure with a fallback message.

## Key Dependencies

**Critical:**
- `express` - Hosts the app shell, data files, vendor assets, `/api/mortality`, `/api/geo`, and `/api/debug`.
- `three` - Core visual experience: realistic earth, atmosphere, death flashes, shockwave shader, and controls.
- `d3` - Geographic operations for country containment, bounds, centroid fallback, JSON loading, and build-time synthetic grid generation.
- `topojson-client` - Translates bundled world map geometry for rendering and country lookup.
- `world-atlas` - Provides `countries-110m.json`, the shared country geometry and M49 ids used by both API joins and frontend placement.
- `i18n-iso-countries` - Maps ISO3 country codes from data sources to numeric M49 ids.

**Infrastructure:**
- Node built-ins (`fs`, `path`, `dns`, `zlib`) - File serving, build artifact generation, gzip input support, and IPv4-first DNS behavior.

## Configuration

**Environment:**
- `PORT` - Server port; Railway injects it in production, otherwise defaults to `3000`.
- `RAILWAY_GIT_COMMIT_SHA` - Optional deploy version used to bust browser asset cache query strings.
- `UN_API_KEY` or `un_api_key` - Required only for `scripts/build-mortality.mjs`; used at Railway build time for UN Data Portal auth.
- No runtime API keys are required for the live app; World Bank and ip-api calls are no-key.

**Build:**
- `railway.json` - Nixpacks build/start settings and deploy retry policy.
- `package.json` - Scripts, Node engine, dependency versions.
- There is no TypeScript, Babel, Vite, Webpack, ESLint, or Prettier config.

## Platform Requirements

**Development:**
- Node.js 20 or newer.
- npm install must have populated `node_modules/` because `server.js` serves vendor files from installed packages.
- Network access is optional for basic local rendering: committed JSON and samples let the app run, but live World Bank and IP geolocation improve fidelity.

**Production:**
- Railway with Nixpacks, via `railway.json`.
- Production serves static assets and APIs from the single Node process in `server.js`.
- Railway should provide `un_api_key` or `UN_API_KEY` if fresh UN age/sex build data is desired during deployment.

---
*Stack analysis: 2026-06-28*
*Update after major dependency or deployment changes*
