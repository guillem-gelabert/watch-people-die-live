---
phase: 1
plan: 01-02
subsystem: methodology
tags:
  - methodology
  - documentation
  - fallback
key-files:
  - public/methodology.html
  - README.md
  - public/persona.js
  - ACCURACY_STEPS.md
metrics:
  route_smoke: 2
---

# Plan 01-02 Summary: Update methodology and fallback explanation

## One-liner

Updated methodology and developer documentation so public claims match the shipped global, sex-specific all-ages IHME cause layer.

## Completed Work

- Updated `public/methodology.html` to state that cause data is IHME-derived, global, sex-specific, and all-ages.
- Removed stale public language implying the cause table is age-stratified or country-specific.
- Kept representative-identity caveats clear: personas are statistical and not identifiable real people.
- Updated `README.md` to document the supported IHME export shapes and repeatable `npm run build:causes -- --force` workflow.
- Updated `ACCURACY_STEPS.md` to mark global causes as implemented and keep per-country causes as the next gap.
- Updated `public/persona.js` comments to avoid overclaiming country/age cause fidelity.

## Commits

| Task                     | Commit       | Description                                                                                                        |
| ------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------ |
| Methodology/docs updates | working tree | Changes are present but not committed because `commit_docs=false` and the repository already has uncommitted work. |

## Verification

Passed:

```bash
rg -n "sex- and age-specific|sex/age|fits the persona's sex and age|age-stratified cause" public/methodology.html
node -e "<methodology stale-phrase check>"
PORT=3002 npm start
curl http://localhost:3002/methodology
curl http://localhost:3002/data/causes.json
```

Route smoke results:

| Route               | Status |
| ------------------- | ------ |
| `/methodology`      | 200    |
| `/data/causes.json` | 200    |

## Deviations

- The methodology now describes a narrower shipped fidelity than the original roadmap wording: global sex-specific cause weights, not country/age-specific cause weights.
- No commit was created during execution.

## Self-Check

PASSED. The public methodology and README match the generated cause-data coverage and fallback behavior.
