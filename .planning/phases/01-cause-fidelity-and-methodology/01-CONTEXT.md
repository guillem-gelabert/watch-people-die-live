# Phase 1: Cause Fidelity and Methodology - Context

**Gathered:** 2026-06-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 completes the MVP cause-data and methodology accuracy layer. It should formalize the already-started IHME GBD wiring, verify that the generated cause table is usable by the existing persona pipeline, and make the public methodology describe the actual data fidelity without overstating country- or age-specific cause precision.

</domain>

<decisions>
## Implementation Decisions

### Cause Data Fidelity

- Ship the current IHME-derived cause fidelity as a global, sex-specific cause distribution built from the available GBD 2023 CSV export.
- Count `data/causes.json` as satisfying the MVP cause-data requirement when it includes explicit coverage metadata stating that the source is Global + All ages.
- Preserve the existing persona JSON shape with nine age-band cells so `public/persona.js` remains compatible; repeat all-ages global weights across those cells for this export.
- Defer per-country causes, cause-by-age, and uncertainty UI beyond this MVP phase.

### Methodology and Public Explanation

- Be direct in `/methodology`: current causes are IHME-derived, global, sex-specific, and all-ages; country/age cause specificity is not shipped yet.
- Briefly mention that IHME cause data is built offline from an exported CSV because there is no runtime API path in this project.
- Explain the fallback chain: `data/causes.json` first, then bundled sample personas, then hardcoded illustrative cause tables.
- Keep caveats statistically honest and plain-spoken, emphasizing representative identities and non-surveillance.

### Verification and Phase Boundary

- Verify `data/causes.json` loads, `public/persona.js` consumes it, `npm run build:causes -- --force` works, and `/methodology` matches the actual fidelity.
- Treat the existing IHME wiring as implementation already done and formalize it in the phase plan and summary instead of rebuilding from scratch unnecessarily.
- Protect fallback behavior: missing or malformed `data/causes.json` must not break the globe or feed.
- Keep Phase 1 focused: no visual redesign, no `/roadmap`, no social metadata, and no Railway deployment changes except documentation if needed.

### the agent's Discretion

Implementation details are at the agent's discretion when they preserve the accepted fidelity boundary, existing code style, and runtime fallback behavior.

</decisions>

<code_context>

## Existing Code Insights

### Reusable Assets

- `scripts/build-causes.mjs` builds `data/causes.json` from IHME GBD CSV exports.
- `public/persona.js` loads `data/mortality-age-sex.json`, `data/causes.json`, and `data/sample-personas.json`, then falls back to built-in cause tables.
- `server.js` serves `data/causes.json` through the static data route list.
- `public/methodology.html` is the public explanation page for sources, caveats, and representative identity.
- `README.md` documents build commands and source-data workflows.

### Established Patterns

- Data build scripts are plain Node ES modules under `scripts/`.
- Runtime JSON assets are committed under `data/`.
- The browser app prefers graceful degradation: missing upstream data or precomputed persona data should fall back rather than crash the visualization.
- Source caveats are documented in user-facing methodology copy and in README build sections.

### Integration Points

- `npm run build:causes` maps to `node scripts/build-causes.mjs`.
- `public/persona.js` expects cause data shaped as `{ causes, global, countries }` with `m` and `f` arrays aligned to the nine age bands.
- `/methodology` is served by `server.js` from `public/methodology.html`.

</code_context>

<specifics>
## Specific Ideas

Use the current IHME GBD CSV export and generated `data/causes.json` as the MVP cause layer, with explicit coverage metadata and clear caveats.

</specifics>

<deferred>
## Deferred Ideas

- Per-country cause distributions.
- Cause distributions by country, age, and sex.
- IHME lower/upper uncertainty display in the UI.
- Social preview metadata and public roadmap page, which belong to Phase 2.

</deferred>
