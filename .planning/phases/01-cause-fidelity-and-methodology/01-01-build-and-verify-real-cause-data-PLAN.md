---
phase: 1
plan: 01-01
title: Build and verify real cause data
type: implementation
wave: 1
depends_on: []
files_modified:
  - scripts/build-causes.mjs
  - data/causes.json
  - public/persona.js
  - README.md
  - ACCURACY_STEPS.md
autonomous: true
requirements:
  - DATA-01
  - DATA-02
  - DATA-03
  - DATA-04
---

<objective>
Generate and verify `data/causes.json` from the available IHME GBD CSV export, preserving the existing persona data shape and honest coverage metadata.
</objective>

<tasks>

1. **Cause builder supports current IHME export**
   - type: implementation
   - files: `scripts/build-causes.mjs`
   - action: Ensure the builder accepts `Global` + `All ages` GBD rows and writes a global, sex-specific cause distribution compatible with nine persona age bands.
   - verify: `npm run build:causes -- --force`
   - acceptance_criteria:
     - The build auto-discovers the local IHME export folder or accepts `--src=...`.
     - `data/causes.json` includes `coverage.location`, `coverage.age`, and `coverage.sex`.
     - The output has male and female arrays with nine band cells each.

2. **Generated data is committed-compatible runtime JSON**
   - type: data
   - files: `data/causes.json`
   - action: Generate the cause JSON from the local IHME GBD 2023 CSV export.
   - verify: Inspect JSON for year, coverage, cause count, country count, and band count.
   - acceptance_criteria:
     - `year` is `2023`.
     - `coverage.location` is `global`.
     - `coverage.age` is `all_ages_repeated_across_bands`.
     - `causes.length` is greater than 100.

3. **Persona pipeline consumes real cause data**
   - type: integration
   - files: `public/persona.js`
   - action: Verify `initPersona()` can load `data/causes.json` and `makePersona()` can produce cause-bearing feed text without falling back to hardcoded tables.
   - verify: Run a Node module smoke with mocked `fetch` reading `/data/mortality-age-sex.json` and `/data/causes.json`.
   - acceptance_criteria:
     - Persona generation returns text containing a sex/age/cause/country line.
     - Missing country-specific causes fall back to `CAUSE.global`.

4. **Fallback behavior remains safe**
   - type: verification
   - files: `public/persona.js`, `data/sample-personas.json`
   - action: Confirm the existing fallback chain still handles missing `data/causes.json`.
   - verify: Inspect `initPersona()` and `pickCause()` fallback paths.
   - acceptance_criteria:
     - Missing cause JSON does not throw during initialization.
     - Cause selection can use bundled sample data or hardcoded cause tables.

</tasks>

<verification>

- `npm run build:causes -- --force`
- `node --check scripts/build-causes.mjs`
- Node module smoke for `initPersona()` and `makePersona()`.
- Optional local server smoke for `GET /data/causes.json` when a port is available.

</verification>

<success_criteria>

- `data/causes.json` exists and is generated from the IHME GBD CSV export.
- The build workflow is repeatable with `npm run build:causes -- --force` or `--src=...`.
- The output shape is compatible with `public/persona.js`.
- Missing or incomplete cause data still falls back without breaking persona generation.

</success_criteria>
