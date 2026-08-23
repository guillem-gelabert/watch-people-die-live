---
phase: 4
plan: 04-01
subsystem: personas
tags:
  - cause-data
  - coverage-guard
  - i18n
key-files:
  - app/globe/persona.ts
  - app/globe/persona.test.ts
  - data/sample-personas.json
---

# Plan 04-01 Summary: Honour the cause coverage flag in pickCause

## One-liner

`pickCause` now reads the `coverage` flag the builder has always written, so a global all-ages cause export is rejected instead of handing infants a pensioner's cause.

## Completed Work

- Added `CauseCoverage` to `app/globe/persona.ts` and declared `coverage` on `CauseData`, which previously dropped it along with `bands`, `source` and `year`.
- `pickCause` uses a cause cell only when `coverage.age === "age_bands"`, and consults `countries` only when `coverage.location === "country"`. A future country x age x sex export is consumed with no further change.
- Declared `coverage` on `data/sample-personas.json`, whose bundled weights genuinely are per band. Undeclared, the bundled sample would have been rejected alongside the real file.
- Truthed up the file header, which claimed the committed export was used.
- Added `app/globe/persona.test.ts` (7 cases) driving the public API — `initPersona()` + `makePersona()` — over a stubbed fetch.

## Commits

| Task                       | Commit     | Description                                                       |
| -------------------------- | ---------- | ----------------------------------------------------------------- |
| Coverage guard + test      | `65708417` | fix(persona): honour the cause coverage flag in pickCause          |
| Bookkeeping + export spec  | `a3f88c09` | docs(planning): mark 04-01 done and add the GBD export spec        |

## Verification

```bash
pnpm run typecheck && pnpm run lint && pnpm test
pnpm exec vitest run app/globe/persona.test.ts
```

All green; suite went 131 -> 131 passing with the new file included.

Negative control: the guard was temporarily removed and the suite re-run, to prove the tests were not vacuous.

| Test                                                    | With guard | Guard removed |
| ------------------------------------------------------- | ---------- | ------------- |
| rejects an all-ages export rather than give an infant an adult cause | pass | **fail** |
| ignores country cells in a global-scoped export         | pass       | **fail**      |
| keeps children off adult causes (committed data files)   | pass       | **fail**      |
| uses an export that declares real age bands             | pass       | pass          |
| reads country cells in a country-scoped export          | pass       | pass          |

Browser check on the dev server, English and Catalan, 0 console errors. Causes that were unreachable before this change now appear: malaria in a 2-year-old, tuberculosis, suicide, a diarrhoeal disease.

## Deviations

- The plan's task 2 verification asked for a Node smoke script. Implemented as a committed vitest file instead, so the guard stays protected against regression rather than being checked once.
- `data/sample-personas.json` was not in `files_modified`. It had to change: without a `coverage` block the new guard would have rejected a bundled sample whose weights are correct, which would have been a silent regression in the offline path.

## Follow-ups discovered

- `lib/acled-weekly.test.ts` was found flaking at roughly 50%, blocking every other commit. Root-caused to ExcelJS's streaming reader spooling worksheets that arrive before `sharedStrings.xml` and the unzip stream firing `end` mid-archive. Fixed out-of-plan in `e20575fd`.

## Self-Check

PASSED. Infant and child personas draw age-appropriate causes, the flag is read rather than only written, and a later age-banded export is consumed without code change — verified when 04-02 landed exactly such an export.
