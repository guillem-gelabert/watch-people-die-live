# Codebase Concerns

**Analysis Date:** 2026-06-28

## Tech Debt

**Single large frontend module:**
- Issue: `public/app.js` owns loading, data processing, rendering setup, controls, event scheduling, feed behavior, and animation lifecycle.
- Why: MVP-first implementation kept the interactive experience in one place.
- Impact: Feature additions such as `/roadmap`, social sharing overlays, or new realism layers can accidentally disturb rendering/feed behavior.
- Fix approach: Extract stable modules for data loading, death scheduler, feed controller, and camera/geolocation behavior only when a concrete change needs them.

**Single large server module:**
- Issue: `server.js` mixes app-shell serving, vendor routes, static data routes, World Bank integration, sample fallback, debug probe, geolocation, and startup.
- Why: Small app and one-process Railway deployment.
- Impact: API changes are easy to make but hard to test in isolation.
- Fix approach: Add tests first, then split external data helpers if server growth continues.

**No bundler or asset pipeline:**
- Issue: Browser imports depend on Express routes and the import map in `public/index.html`.
- Why: Keeps deployment simple and avoids build complexity.
- Impact: Upgrading three.js or changing vendor paths can break runtime imports without compile-time feedback.
- Fix approach: Keep import-map and `server.js` vendor routes in sync; consider a minimal bundler only if dependency/module complexity grows.

**Methodology text may lag code:**
- Issue: `public/methodology.html` says causes are informed by GBD/WHO global patterns, while `README.md` and `requirements.md` describe planned/actual `data/causes.json` per-country IHME distributions.
- Why: Cause pipeline evolved after methodology copy.
- Impact: User-facing methodology can misrepresent cause fidelity once `data/causes.json` is built and deployed.
- Fix approach: Update methodology alongside `data/causes.json` generation and roadmap work.

## Known Bugs

**Missing `data/causes.json`:**
- Symptoms: Personas use sample causes or hardcoded fallback tables rather than full IHME country/age/sex cause distributions.
- Trigger: Current repo inventory has no `data/causes.json`.
- Workaround: `public/persona.js` falls back gracefully.
- Root cause: Manual IHME GBD CSV export has not been completed.
- Blocked by: Exporting the GBD CSV and running `npm run build:causes -- --force`.

**No `/roadmap` page yet:**
- Symptoms: MVP requirement in `requirements.md` is not implemented.
- Trigger: Visiting `/roadmap` would fall through to static handling and likely 404.
- Workaround: Roadmap content exists in `requirements.md`.
- Root cause: Page has not been built.

**No social preview metadata:**
- Symptoms: Link shares likely use default title/no image because `public/index.html` lacks `og:image`, `og:description`, and related metadata.
- Trigger: Sharing the live Railway URL.
- Workaround: None in code.
- Root cause: MVP task not implemented yet.

## Security Considerations

**Build-time bearer token handling:**
- Risk: UN Data Portal bearer tokens could be pasted into docs, shell history, or logs.
- Current mitigation: Code reads `UN_API_KEY`/`un_api_key` from environment and does not commit it.
- Recommendations: Keep tokens in Railway variables or local secret storage; avoid putting example real tokens in README, `.planning`, or command transcripts.

**IP geolocation call:**
- Risk: Caller IP is sent to ip-api.com for non-private addresses.
- Current mitigation: No persistent storage; response contains only approximate lat/lon and place name; local/private IPs omit the IP path.
- Recommendations: Keep methodology/privacy copy current and consider a config toggle if this becomes a concern.

**Debug endpoint exposes upstream body snippets:**
- Risk: `/api/debug` returns World Bank response snippets and timing details publicly.
- Current mitigation: World Bank data is public and no secrets are used in that endpoint.
- Recommendations: Avoid adding secreted upstream probes to `/api/debug` without access control.

**No request rate limiting:**
- Risk: Public `/api/mortality`, `/api/geo`, and `/api/debug` can be called repeatedly.
- Current mitigation: In-memory caching for mortality and geolocation; World Bank fallback avoids infinite retries.
- Recommendations: Add lightweight rate limiting only if Railway logs show abuse or upstream pressure.

## Performance Bottlenecks

**Initial payload and texture load:**
- Problem: App loads multi-MB earth textures and `data/density-grid.json` before reveal.
- Measurement: Current checked file sizes include `data/density-grid.json` around 1.17 MB and earth texture files totaling roughly 2.25 MB.
- Cause: Full-screen realistic globe requires large assets; loader waits for textures to avoid blank reveal.
- Improvement path: Consider compressed texture formats, lower-resolution mobile textures, or progressive reveal if load time becomes an issue.

**Client-side per-country scheduler:**
- Problem: Frame loop checks all active countries every frame and can spawn events.
- Measurement: No runtime profiling is committed.
- Cause: Straightforward per-frame loop over country state.
- Improvement path: Profile before optimizing; a global priority queue of next events could reduce per-frame work if needed.

**Density cell memory:**
- Problem: Browser builds cumulative arrays per country from `data/density-grid.json`.
- Measurement: No heap profile is committed.
- Cause: Weighted sampling needs cumulative distributions for fast random picks.
- Improvement path: Keep the current compact grid unless profiling shows memory pressure; pre-grouped data could reduce startup work later.

## Fragile Areas

**Coordinate alignment:**
- Why fragile: `lonLatToVec3()`, texture UV math, D3 projection assumptions, and shader ripple UVs must agree.
- Common failures: Deaths or calibration markers appear shifted, mirrored, or seam-broken.
- Safe modification: Run `node scripts/verify-globe-alignment.mjs`; also check `?calibrate` in the browser after visual changes.
- Test coverage: One focused Node verification script, no browser visual regression test.

**Three.js WebGPU/TSL APIs:**
- Why fragile: `public/shaders.js` uses three node-material APIs that can change across three.js versions.
- Common failures: Blank globe, shader compile/runtime errors, missing atmosphere, broken shockwave uniform arrays.
- Safe modification: Test locally in browser after any three.js upgrade; keep `N_BLASTS` in `public/app.js` matching shader configuration.
- Test coverage: No automated renderer smoke test.

**Data source schemas:**
- Why fragile: World Bank, UN Data Portal, and GBD CSV field names/labels can drift.
- Common failures: Empty mortality values, build failures, missing age bands, unmapped countries.
- Safe modification: Keep source-boundary validation explicit; add tiny fixture tests before broad parser changes.
- Test coverage: Manual only.

**Fallback behavior:**
- Why fragile: The app intentionally degrades through multiple fallback layers.
- Common failures: Real data missing but UI looks authoritative, methodology text mismatches source fidelity, sample flags not visible enough.
- Safe modification: Test with unavailable upstreams and missing `data/causes.json`; keep source labels in payloads and UI clear.
- Test coverage: No automated fallback tests.

## Scaling Limits

**Single Node process:**
- Current capacity: Unknown; suitable for a portfolio visualization with static-heavy traffic.
- Limit: In-memory caches are per-process and reset on restart; no horizontal shared cache.
- Symptoms at limit: Higher upstream calls after restarts, slower first requests, Railway resource pressure.
- Scaling path: Add CDN/static hosting for assets or a shared cache only if traffic warrants it.

**External upstream availability:**
- Current capacity: Bound by World Bank, ip-api, UN Data Portal, GitHub raw, and manual GBD export availability.
- Limit: Upstream rate limits/outages or blocked egress.
- Symptoms at limit: Sample data, no geolocation, build falls back.
- Scaling path: Commit generated artifacts where appropriate and keep runtime fallbacks.

## Dependencies at Risk

**three.js WebGPU path:**
- Risk: Fast-moving APIs and browser support variability.
- Impact: Core visual experience may fail on some devices/browsers.
- Migration plan: Keep manual smoke testing across browsers; consider explicit WebGL fallback handling if needed.

**ip-api.com free endpoint:**
- Risk: HTTP-only service, free-tier limits, availability constraints.
- Impact: Viewer centering fails, but the app otherwise works.
- Migration plan: Treat as optional; replace with another no-key/paid geolocation service only if centering is essential.

**UN Data Portal API:**
- Risk: Token requirement, paginated response behavior, auth redirect behavior, and indicator naming can change.
- Impact: Railway build may not refresh `data/mortality-age-sex.json`.
- Migration plan: Keep committed fallback data and script retries; document token setup.

## Missing Critical Features

**Cause data artifact:**
- Problem: Full cause realism depends on `data/causes.json`.
- Current workaround: Sample/fallback causes.
- Blocks: Claiming fully per-country cause-of-death realism.
- Implementation complexity: Medium; requires manual GBD export then script run and verification.

**Roadmap page:**
- Problem: Public roadmap is part of the stated MVP but not implemented.
- Current workaround: Roadmap lives in `requirements.md`.
- Blocks: Publicly communicating implemented vs planned realism layers.
- Implementation complexity: Low to medium depending on whether roadmap is static HTML or data-driven.

**Social preview metadata/image:**
- Problem: Link sharing is under-specified.
- Current workaround: Browser default metadata.
- Blocks: Portfolio/share polish.
- Implementation complexity: Low if static image and meta tags are enough.

## Test Coverage Gaps

**API fallback behavior:**
- What's not tested: World Bank failure, malformed responses, sample payload source flag.
- Risk: App can silently break or mislabel data.
- Priority: High.
- Difficulty to test: Moderate without dependency injection; manageable with `fetch` mocking after modularization.

**Frontend rendering smoke:**
- What's not tested: Nonblank globe, loader hide, feed updates, imported vendor modules.
- Risk: Dependency/import changes break the primary experience.
- Priority: High.
- Difficulty to test: Moderate; Playwright plus screenshots/canvas checks would help.

**Build script parsers:**
- What's not tested: CSV parsing, GBD age band mapping, UN API pagination, ISO name fixes.
- Risk: Generated data becomes incomplete or wrong.
- Priority: Medium.
- Difficulty to test: Low with small fixture files.

---
*Concerns audit: 2026-06-28*
*Update as issues are fixed or new ones discovered*
