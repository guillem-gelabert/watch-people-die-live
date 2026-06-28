# Testing Patterns

**Analysis Date:** 2026-06-28

## Test Framework

**Runner:**
- No general JavaScript test framework is configured.
- No `npm test` script exists in `package.json`.

**Assertion Library:**
- None configured.
- The only check script uses manual comparison and process exit status.

**Run Commands:**
```bash
node scripts/verify-globe-alignment.mjs
npm start
```

## Test File Organization

**Location:**
- No dedicated `test/`, `tests/`, `__tests__/`, or co-located `*.test.js` files are present.
- Verification scripts live under `scripts/`.

**Naming:**
- Existing verification script is named by behavior: `scripts/verify-globe-alignment.mjs`.
- Build/data scripts are not tests but can be run manually for data pipeline validation.

**Structure:**
```text
scripts/
  build-density.mjs
  build-mortality.mjs
  build-causes.mjs
  verify-globe-alignment.mjs
```

## Test Structure

**Existing Pattern:**
```javascript
// scripts/verify-globe-alignment.mjs
// 1. Construct deterministic geometry/projection inputs.
// 2. Compute maximum error across many vertices.
// 3. Print diagnostic details.
// 4. Exit 0 on pass and 1 on fail.
```

**Patterns:**
- Use deterministic numeric checks where possible.
- Print enough context to debug failures (`checked`, `max position error`, `worst vertex`).
- Exit with nonzero status on failure.

## Mocking

**Framework:**
- None.

**Patterns:**
- Runtime fallbacks substitute for mocks in manual verification:
  - `data/sample-cdr.json` when World Bank fetch fails.
  - `data/sample-personas.json` and hardcoded persona tables when full persona data is absent.
  - Synthetic grid fallback when GPWv4 source data cannot be fetched.

**What to Mock in Future Tests:**
- `fetch` calls to World Bank, ip-api.com, and UN Data Portal.
- Time/randomness in the Poisson event loop.
- DOM/Three.js renderer interactions for feed behavior and blast lifecycle.

## Fixtures and Factories

**Test Data:**
- Existing fixture-like data lives in `data/sample-cdr.json` and `data/sample-personas.json`.
- `data/density-grid.json` and `data/mortality-age-sex.json` are real generated artifacts rather than test fixtures.

**Location:**
- Use `data/` for runtime fallback fixtures.
- If a formal test suite is added, prefer `tests/fixtures/` for non-runtime-only fixtures to avoid confusing them with shipped data.

## Coverage

**Requirements:**
- No coverage target exists.
- No CI coverage enforcement exists.

**Configuration:**
- No coverage tool is configured.

**View Coverage:**
```bash
# Not available yet.
```

## Test Types

**Unit Tests:**
- Not present.
- Good candidates:
  - `server.js` functions `indexByM49()`, `sampleFallback()`, `clientIp()`, `isPrivateIp()`.
  - `public/persona.js` sampling helpers with deterministic randomness.
  - Script parsers such as `splitCsvLine()`, `bandOf()`, and `isoOf()` in `scripts/build-causes.mjs`.

**Integration Tests:**
- Not present.
- Good candidates:
  - Express route tests for `/api/mortality`, `/api/geo`, `/api/debug`, `/methodology`, and vendor/data routes.
  - Build script smoke tests with tiny fixture CSV/API responses.

**E2E / Visual Tests:**
- Not present.
- Good candidates:
  - Browser smoke test that `/` loads, hides the loader, creates a nonblank canvas, and displays feed lines.
  - `?calibrate` visual/regression check for city marker alignment.
  - Mobile/landscape layout checks for feed and globe split behavior.

## Common Manual Verification

**Local Run:**
```bash
npm install
npm start
# open http://localhost:3000
```

**Globe Alignment:**
```bash
node scripts/verify-globe-alignment.mjs
```

**Density Build:**
```bash
npm run build:density -- --force
```

**UN Age/Sex Build:**
```bash
UN_API_KEY=... npm run build:mortality -- --force
```

**GBD Cause Build:**
```bash
npm run build:causes -- --src=path/to/gbd.csv --top=8 --force
```

## Test Gaps

**High Priority:**
- No automated API tests for fallback behavior when World Bank or ip-api is unavailable.
- No automated browser rendering smoke test for the three.js/WebGPU path.
- No test for persona fallback ordering when `data/causes.json` is missing.

**Medium Priority:**
- No tests for CSV parsing and age-band mapping in data builders.
- No tests for cache-control/version injection behavior in `server.js`.
- No tests for feed pause/resume behavior.

**Low Priority:**
- No snapshot/content test for `public/methodology.html`.

---
*Testing analysis: 2026-06-28*
*Update when test patterns change*
