---
phase: 1
status: passed
verified_at: 2026-06-29
plans:
  - 01-01
  - 01-02
---

# Phase 1 Verification: Cause Fidelity and Methodology

## Status

passed

## Criteria

| Criterion                                                                                                                 | Result | Evidence                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `data/causes.json` exists and can be loaded by the existing persona pipeline.                                             | passed | JSON shape check passed; persona smoke generated feed lines after `initPersona()`.                                                               |
| The cause build workflow is documented and repeatable from a GBD CSV source.                                              | passed | `npm run build:causes -- --force` regenerated `data/causes.json`; README documents `--force`, `--src`, `Global`, and `All ages` support.         |
| Missing or incomplete cause data still falls back without breaking the globe or feed.                                     | passed | `public/persona.js` keeps the fallback chain: cause JSON, sample personas, hardcoded cause table.                                                |
| `/methodology` accurately describes mortality, density, age/sex, cause, geolocation, and representative-identity caveats. | passed | Methodology stale-phrase check passed; route smoke for `/methodology` returned HTTP 200 and includes global sex-specific all-ages cause wording. |

## Commands Run

```bash
npm run build:causes -- --force
node --check scripts/build-causes.mjs
node -e "<JSON shape check>"
node --input-type=module -e "<persona smoke>"
node -e "<methodology stale-phrase check>"
PORT=3002 npm start
curl http://localhost:3002/methodology
curl http://localhost:3002/data/causes.json
```

## Human Verification

None required.

## Gaps

None for Phase 1 MVP scope. Per-country causes, cause-by-age, and uncertainty UI remain deferred.
