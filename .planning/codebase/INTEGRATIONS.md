# External Integrations

**Analysis Date:** 2026-06-28

## APIs & External Services

**World Bank Open Data:**
- Purpose: Runtime mortality and population values for `/api/mortality`.
- Integration method: Direct HTTP fetch from `https://api.worldbank.org/v2` in `server.js`.
- Indicators: `SP.DYN.CDRT.IN` for crude death rate and `SP.POP.TOTL` for total population.
- Auth: None.
- Shape handling: `fetchIndicatorLatest()` requests `?format=json&mrnev=1&per_page=400`, follows pages, and `indexByM49()` filters to real map countries by M49 id.
- Resilience: `fetchJson()` uses a 20s abort timeout and one retry; `getMortality()` falls back to `data/sample-cdr.json`.

**ip-api.com:**
- Purpose: Best-effort viewer geolocation for `/api/geo`, used by `public/app.js` to center the initial globe view.
- Integration method: Server-side HTTP call to `http://ip-api.com/json/...`.
- Auth: None.
- Input: Client IP from `X-Forwarded-For`, falling back to `req.socket.remoteAddress`.
- Privacy posture: Only approximate coordinates and a place name are returned; no persistent storage, only a short in-memory cache.
- Resilience: Failures return `{ lat: null, lon: null, name: null, source: "none" }`.

**UN Data Portal API:**
- Purpose: Build-time age/sex distribution of deaths for persona generation.
- Integration method: `scripts/build-mortality.mjs` calls `https://population.un.org/dataportalapi/api/v1`.
- Auth: Bearer token from `UN_API_KEY` or `un_api_key`.
- Output: `data/mortality-age-sex.json`.
- Resilience: The Railway build command tolerates failure and lets the app use `data/sample-personas.json`.

**IHME GBD Results Tool:**
- Purpose: Manual source for cause-of-death distributions.
- Integration method: No API. User exports a CSV from the GBD Results Tool and places it under `data/source/`, then runs `npm run build:causes -- --force`.
- Output: `data/causes.json`.
- Auth: Not represented in code; export happens outside the app.

**openaddresses/population GPWv4 CSV:**
- Purpose: Build-time source for population-density grid.
- Integration method: `scripts/build-density.mjs` downloads `https://raw.githubusercontent.com/openaddresses/population/master/data/gpwv4-2015.csv.gz` if no local source file exists.
- Output: `data/density-grid.json`.
- Resilience: If download/read fails, the script creates a coarse synthetic grid from bundled `world-atlas` land geometry.

## Data Storage

**Databases:**
- None. There is no persistent database.

**File Storage:**
- Committed static JSON files under `data/`:
  - `data/density-grid.json` - Population-weighted placement grid.
  - `data/mortality-age-sex.json` - UN age/sex deaths distribution.
  - `data/sample-cdr.json` - Offline CDR/population fallback.
  - `data/sample-personas.json` - Offline persona fallback.
- Optional source files under `data/source/` are expected to be gitignored per README, though the directory is not committed in the current inventory.

**Caching:**
- `server.js` keeps an in-memory mortality cache for roughly 24h.
- `server.js` keeps an in-memory geolocation cache for roughly 1h per IP.
- Browser asset cache is controlled by `Cache-Control: no-cache` and a deploy version query string.

## Authentication & Identity

**Auth Provider:**
- None. The app is public and unauthenticated.

**Secrets:**
- `UN_API_KEY` / `un_api_key` is the only secret expected by project code, and only for build-time UN data regeneration.
- No secret should be embedded in `README.md`, `requirements.md`, committed data, or generated docs.

## Monitoring & Observability

**Error Tracking:**
- No external error tracking service is integrated.

**Analytics:**
- No analytics integration exists.

**Logs:**
- Server logs use `console.log` and `console.error`.
- Railway captures stdout/stderr in production.
- `/api/debug` probes the World Bank API and returns status/body snippets for deployment diagnostics.

## CI/CD & Deployment

**Hosting:**
- Railway with Nixpacks, configured in `railway.json`.
- Build command: `npm run build:mortality -- --force || echo 'build:mortality failed - app will use bundled persona fallback'`.
- Start command: `npm start`.
- Restart policy: on failure, up to 5 retries.

**CI Pipeline:**
- No GitHub Actions or CI config is present.

## Environment Configuration

**Development:**
- Required: Node.js >=20 and npm dependencies.
- Optional: `UN_API_KEY`/`un_api_key` for rebuilding `data/mortality-age-sex.json`.
- Optional: manual GBD CSV under `data/source/` for `data/causes.json`.

**Production:**
- Railway sets `PORT`.
- Railway should set `un_api_key` or `UN_API_KEY` for build-time UN data refresh.
- Runtime remains functional without upstream availability because World Bank and persona fallbacks exist.

## Webhooks & Callbacks

**Incoming:**
- None.

**Outgoing:**
- Runtime outbound calls: World Bank API and ip-api.com.
- Build-time outbound calls: UN Data Portal API and optional GPWv4 CSV download.

---
*Integration audit: 2026-06-28*
*Update when adding/removing external services*
