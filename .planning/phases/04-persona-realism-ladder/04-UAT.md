---
status: complete
phase_complete: false
phase: 04-persona-realism-ladder
source:
  - 04-01-SUMMARY.md
  - 04-02-SUMMARY.md
  - 04-03-SUMMARY.md
  - 04-05-SUMMARY.md
  - 04-06-SUMMARY.md
  - 04-08-SUMMARY.md
started: 2026-08-26T08:45:00Z
updated: 2026-08-26T09:05:00Z
verification: automated
note: |
  Phase 04 is 6/8. Plans 04-04 (per-cell age/sex from regional estimates) and
  04-07 (seasonal persona composition) have not been executed, so this UAT
  covers only what shipped. The phase cannot be marked complete from here.

  Tests 1-9 were verified automatically: the browser-observable ones by driving
  the real persona logic over the committed data files (160,000 samples across
  eight countries) plus a Playwright pass on the dev server in ca and de; the
  data ones by reading the built artifacts' declared invariants back out of the
  files. Test 10 ran the full quality gate.
---

## Current Test

[testing complete]

## Tests

### 1. Persona causes are age-appropriate
expected: In the globe's death feed, infants and children never draw adult/old-age causes. Infants draw perinatal causes; young children draw childhood causes.
result: pass
evidence: |
  160,000 personas sampled through the real initPersona()/makePersona() over the
  committed data/causes.json and data/mortality-age-sex.json:
    - 2,082 infants (age 0) — 0 drew an old-age cause; 49.9% drew a perinatal
      cause (04-02's amended test asserts >= 25%)
    - 8,917 children aged 1-14 — 0 drew an old-age cause
  Browser feed confirms the same shape: "Nen de 5, altres causes – Nigeria".

### 2. Causes vary by country, not one global table
expected: Deaths in different countries show visibly different cause mixes.
result: pass
evidence: |
  Top causes per country over 20,000 samples each:
    Nigeria  lower respiratory infection 9.6%, malaria 8.3%, tuberculosis 8.2%
    Japan    ischaemic heart disease 13.4%, stroke 9.1%
    China    stroke 22.1%, ischaemic heart disease 16.8%, COPD 10.5%
    Spain    ischaemic heart disease 11.0%, covid-19 9.6%, Alzheimer's 7.9%
  26-34 distinct causes reach the feed per country. No pair of the eight
  countries had a top-10 Jaccard overlap above 0.85, so the mixes are genuinely
  country-specific rather than one table repeated.

### 3. Cause names are translated in Catalan and German
expected: ?lang=ca and ?lang=de show cause names in that language, no English leaking, no missing-translation placeholders, no console errors.
result: pass
evidence: |
  Playwright on the dev server, 18 seconds of feed per language.
    ca — 33 distinct personas: "MPOC", "un ictus", "cardiopatia isquèmica",
         "una infecció respiratòria de vies baixes", "alzheimer i demència",
         "altres causes"
    de — 36 distinct personas: "Nierenerkrankung", "Brustkrebs",
         "koronare Herzkrankheit", "Infektion der unteren Atemwege",
         "Krieg und Terrorismus", "andere Ursachen"
  0 English cause strings, 0 placeholder/undefined markers, 0 console errors in
  either language. Country names stay untranslated, per the project rule.
  The only console warning is a pre-existing THREE.Clock deprecation.

### 4. Story prose credits WHO, in all three languages
expected: The story no longer says causes come from IHME GBD hand-exports; all three ROADMAP files name WHO Global Health Estimates.
result: pass
evidence: |
  docs/ROADMAP.md:261, ROADMAP.ca.md:261 ("Estimacions Sanitàries Mundials de
  l'Organització Mundial de la Salut") and ROADMAP.de.md:262 all name WHO GHE.
  The one remaining IHME mention in each file is the deliberate "used to come
  from" history sentence, not a stale claim.
  app/roadmap/storyTranslations.test.ts — 7 passed, so section keys, skies and
  slots stayed in parity across the edit.

### 5. causes.json payload stays inside budget
expected: ~259-265 KB raw / ~84 KB gzipped, coverage.location "country", coverage.age "age_bands", WHO citation, 90 labels none unreferenced.
result: pass
evidence: |
  265,452 B raw / 81,326 B gzipped — inside the ~700 KB budget from 04-CONTEXT
  trap 4. coverage = {location: "country", age: "age_bands", sex: "male_female"},
  which is what satisfies 04-01's guard. 90 labels, 183 countries, and 0 of the
  90 labels are unreferenced by any cell. source and citation both present.

### 6. Every populated grid cell carries a region key
expected: Aligned to rate-grid cell order, 59,328 of 59,954 assigned across 2,755 regions, 626 unassigned marked -1, keys in subnational-cdr.json's key space.
result: pass
evidence: |
  data/region-keys.json cells array is 59,954 long — exactly rate-grid.json's
  cell count. 59,328 assigned, 626 explicit -1 (declared deathShare 0.0812%),
  2,755 distinct regions across the adm1 and nuts2 namespaces, 789 of them also
  present in subnational-cdr.json's 981 keys. Sudan is the largest remainder at
  117 cells / 0.0731%, enumerated per country in meta.

### 7. GBD subnational age/sex weights join to the committed key space
expected: 474 rows over 444 matched leaf units at 98.44% of subnational deaths, m[]+f[] summing to 1, every key valid geometry, measurement on every row, skips enumerated.
result: pass
evidence: |
  474 rows, 444 of 508 leaf units, matchedDeathShare 0.9844, skippedDeathShare
  0.0156. Every row sums to 1 within 4e-8 (0 rows outside 1e-6). Every row
  carries measurement "gbd-modeled" — no other value appears. 64 skipped units
  enumerated in meta.skipped with per-unit reasons, summing to 1.562%, matching
  the declared skip share. 417 of the 474 keys win at least one grid cell; the
  57 that win none (Delhi, Jakarta, Osaka, Mexico City and other small or urban
  regions) are a property of 04-05's area-majority vote and noted in meta.

### 8. Eurostat regional tables land with a fully explained join
expected: 291 NUTS-2 regions with age x sex, weekly and under-65/65+ cause distributions; meta.unmappedIcd10 empty; every failing code explained; not synced to public/.
result: pass
evidence: |
  291 of 334 committed NUTS-2 keys carry age x sex (4,896 rows); 285 of those
  also carry a subnational-cdr row. Weekly 41,472 rows, causes 60,444 rows over
  58 project labels. All 292 keys in the file's vocabulary exist in the
  committed data/nuts2-20m.json geometry. meta.unmappedIcd10 is empty and 0 of
  the 58 cause labels escape data/causes.json's 90-label vocabulary, so a second
  divergent vocabulary has not appeared. 51 joinNotes entries cover 8 unmatched
  Eurostat codes and 43 committed keys with no data — nothing unexplained. The
  weekly pull is four 13-week chunks, as the 413 workaround requires. Not
  present in public/data/, as intended.
  Minor bookkeeping note: meta.matchedNuts2Keys is 291 while the keys array is
  292, because one region has cause and/or weekly rows but no age x sex row. The
  counter is age x sex-scoped; not a defect, just a narrower label than it reads.

### 9. Observed age/sex fixture exists and seasonality output did not move
expected: 16,434 region x band x sex cells over 15,907,933 deaths for CAN/BRA/MEX/AUS; seasonality-subnational.json still md5 44c8f494b8e380c3adb0879a131c2da7.
result: pass
evidence: |
  16,434 rows totalling exactly 15,907,933 deaths — BRA 7,689 rows / 6,536,970
  deaths / 9 bands, MEX 8,625 / 3,442,541 / 9, CAN 104 / 4,596,400 / 4, AUS 16 /
  1,332,022 / 1 band (the declared single (0,200) band, since the ABS snapshot
  publishes only the TT age code). data/seasonality-subnational.json md5 is
  44c8f494b8e380c3adb0879a131c2da7 — unchanged, so the second readers moved no
  existing output. 1.93 MB, not synced to public/.

### 10. Quality gate is green
expected: pnpm run typecheck, pnpm run lint, pnpm test and ruff check pipeline/ all pass, including the new persona, causes and eurostat tests.
result: pass
first_run: issue
reported: "`uv run python -m unittest discover pipeline` — the invocation 04-08's own summary documents — errored out, and silently ran only 7 of the 14 pipeline tests. pipeline/test_eurostat.py could not be imported."
severity: major
fixed_in_session: true
evidence: |
  Green on the first run: pnpm run typecheck, pnpm run lint, pnpm test
  (18 files / 133 tests), app/roadmap/storyTranslations.test.ts (7).
  ruff check pipeline/ reports 1 error, B905 at pipeline/geo.py:57 — pre-existing
  and declared out of scope in 04-08's summary. Not counted against this test.
  Failed on the first run: uv run python -m unittest discover pipeline
    ImportError: attempted relative import with no known parent package
    pipeline/test_eurostat.py:12  from .sources.eurostat import (...)
  Ran 8 tests, 1 error — i.e. the 7 eurostat tests never executed. The sibling
  pipeline/test_curve.py uses an absolute import (`from pipeline.curve import`),
  so 04-06's claim that the new file "matches test_curve.py's convention" did
  not hold for its import style.
  Fixed in this session: the import is now
  `from pipeline.sources.eurostat import (...)`, matching test_curve.py.
  Re-run: uv run python -m unittest discover pipeline -> Ran 14 tests, OK.
  ruff check pipeline/test_eurostat.py -> All checks passed.

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0
blocked: 0

## Observations

Not test failures — judgment calls surfaced for the record.

- **"other causes" is the commonest line in the feed.** Across the eight
  countries sampled it takes 25.0% (China) to 43.6% (Spain) of all personas,
  more than any named cause. That is the direct consequence of 04-02's
  truncate-to-the-strongest-eight-per-cell choice, and the story prose does
  disclose it. Whether roughly a third of feed lines reading "…, other causes"
  is acceptable is a reading-experience call, not a data defect.
- **04-03 and 04-06 are not committed.** Their code, data and summaries are
  working-tree only: scripts/build-subnational-age-sex.ts, data/subnational-age-sex.json,
  pipeline/sources/eurostat.py, pipeline/test_eurostat.py, data/eurostat-regional.json,
  plus modified pipeline/__main__.py and pipeline/sources.lock.json. STATE.md
  records both as shipped. Everything above was verified against that
  working tree, so a clean checkout would not reproduce tests 7 and 8.
- **region-keys.json is not in scripts/sync-data.ts's allowlist**, so it does not
  reach the browser yet. Correct for now — 04-04 is its consumer — but it means
  04-05's output is unexercised at runtime until 04-04 lands.

## Gaps

- truth: "pipeline's test suite runs under the project's documented invocation"
  status: fixed
  reason: "pipeline/test_eurostat.py used a relative import (`from .sources.eurostat import`) while its sibling test_curve.py uses an absolute one. `uv run python -m unittest discover pipeline` therefore raised ImportError and ran only 7 of 14 tests, leaving the new eurostat module with no coverage under the command the phase documents."
  severity: major
  test: 10
  root_cause: "Relative import in a test module that unittest's default discovery loads as a top-level module, not as part of the `pipeline` package — so there is no parent package for the leading dot to resolve against."
  artifacts:
    - path: "pipeline/test_eurostat.py"
      issue: "line 12 imported via `from .sources.eurostat import`"
  missing: []
  fix: "Changed to `from pipeline.sources.eurostat import`, matching pipeline/test_curve.py. `uv run python -m unittest discover pipeline` now runs 14 tests, OK."
  debug_session: ""
