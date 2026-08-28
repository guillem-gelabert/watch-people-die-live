---
phase: 4
plan: 04-02
subsystem: personas
tags:
  - cause-data
  - who-ghe
  - i18n
  - re-sourced
key-files:
  - scripts/fetch-who-ghe.ts
  - scripts/build-causes.ts
  - data/causes.json
  - lib/i18n/ca.causes.ts
  - lib/i18n/de.causes.ts
  - lib/i18n/causes.test.ts
requirements-completed: [PERS-01]
---

# Plan 04-02 Summary: Source country age/sex causes from WHO Global Health Estimates

## One-liner

Every one of 183 countries now has its own cause distribution per age band and sex, from WHO's keyless CC BY API, replacing a single global age-flat table.

## Completed Work

- Added `scripts/fetch-who-ghe.ts`, which pulls WHO GHE 2021 deaths from `xmart-api-public.who.int/DEX_CMS/GHE_FULL` one request per country (183 requests, ~6,650 rows each) into gitignored `data/source/who-ghe/`. Resumable at a country boundary rather than restarting a 1.2M-row page.
- Rewrote `scripts/build-causes.ts` around WHO. The IHME GBD CSV path is gone rather than left beside it, because two source paths for one output invite drift and git preserves the old one.
- `data/causes.json` now carries `coverage.location: "country"` and `coverage.age: "age_bands"`, which is what finally satisfies 04-01's guard, plus WHO's required citation string.
- Emitted only labels some cell actually references — 90, all reachable — where the file used to list 140 of which 12 were.
- Mapped WHO's 175 leaf labels onto the vocabulary already translated in `ca`/`de`, so this needed **no new medical translations**. Removed 49 translations for causes that no longer survive truncation.
- Added `build:causes` runner consistency and a `fetch:who-ghe` script.

## Commits

| Task                                  | Commit     | Description                                                        |
| ------------------------------------- | ---------- | ------------------------------------------------------------------ |
| Fetch, builder, data, i18n, tests     | `8fcb17e5` | feat(causes): source country age/sex causes from WHO Global Health Estimates |
| Reader-facing prose in three languages | `188471c6` | docs(story): say the causes come from WHO, in all three languages   |

## Verification

```bash
pnpm run fetch:who-ghe          # 183 countries, 1,223,904 rows, 63.5 MB
pnpm run build:causes -- --force
pnpm run typecheck && pnpm run lint && pnpm test
```

Build output: 582,990 leaf rows + 6,948 all-causes rows across 183 countries; residual folded into "other causes" 1.46%; 90 reachable causes; 259 KB.

Two traps measured rather than assumed:

| Trap | Measurement | Handling |
| ---- | ----------- | -------- |
| WHO age codes overlap | Nigeria 2021 male, all causes: `Y0T1` 279,531.29 = `D0T27` 142,010.37 + `M1T11` 137,520.91 | 19 disjoint codes only; they reconcile to WHO's `TOTAL` within 0.01. An unrecognised code fails the build. |
| No cause flag partitions cleanly | `FLAG_SINGLE_CAUSE` 97.58%, level 3 97.10%, level 4 22.27% of all deaths | Take `FLAG_SINGLE_CAUSE`; carry the remainder as "other causes". |

Payload: 5,897 B -> 265,452 B raw, 83,901 B gzipped. Inside the ~700 KB budget from 04-CONTEXT trap 4.

Per-cell plausibility, read straight out of the built file:

| Cell | Top causes |
| ---- | ---------- |
| Nigeria, infant, male | neonatal complications 22.2%, lower respiratory infection 17.9%, birth asphyxia 14.6%, diarrhoeal 14.4%, malaria 14.3% |
| Nigeria, 15-29, male | interpersonal violence 20.0%, road injury 12.6%, tuberculosis 9.9%, conflict 5.3%, suicide 3.5% |
| Spain, infant, male | neonatal complications 44.8%, congenital 27.9%, birth asphyxia 10.9%, SIDS 3.6% |
| Japan, 75-84, male | ischaemic heart disease 10.4%, lung cancer 9.6%, stroke 8.1%, stomach cancer 4.8% |
| India, 1-4, male | diarrhoeal 13.5%, lower respiratory infection 12.7%, drowning 11.2%, measles 4.6% |

Browser check on the dev server: 31 distinct personas sampled, 0 console errors.

## Deviations

- **The source is not the one the plan named.** The plan targeted the WHO Mortality Database. Investigation found it is raw registration data with **zero rows** for Nigeria, Ethiopia, DR Congo and India, so it could not do the job. GHE covers all 183 countries including the ~117 without usable registration. The plan file was rewritten before execution (`4cf86203`).
- **No ICD-10 crosswalk was built.** GHE ships cause labels directly, so the crosswalk task disappeared; what remained was a label-normalisation map onto existing project wording.
- **`lib/i18n/causes.test.ts` was amended.** Its `causes.length > 100` threshold was written for the old 140-label file. Lowered to 60 with the reason stated, and a stronger assertion added in its place: no shipped cause may go unreferenced by any cell.
- **`app/globe/persona.test.ts` was amended.** Its infant-cause whitelist was correct only while the fallback table answered. With real per-band country cells it now asserts that a quarter or more of infants draw a perinatal cause. The first attempt asserted which single cause was commonest, which was flaky — Nigeria's neonatal complications (22%) and lower respiratory infection (18%) are close enough that the mode flips between samples. Caught by the pre-commit hook and replaced; 0 failures in 8 consecutive runs since.
- Reader-facing prose in `docs/ROADMAP*.md` had to change: it told readers causes came from IHME GBD, hand-exported because GBD has no API. Both halves became false. Phase 04 was declared disjoint from those files, so this is a deliberate crossing, done with the parity test passing.

## Honest limitation

For the ~117 countries without qualifying registration, WHO uses IHME GBD cause fractions as the prior, rescaled to WHO's own envelope. This is therefore **not** an independent second opinion versus GBD — same underlying cause split, WHO total, workable licence. Not currently stated in the story; flagged for a methodology sentence.

## Self-Check

PASSED. 183 countries have age-banded, sex-specific distributions; age codes are disjoint and reconcile to WHO's totals; the uncovered 1.46% is carried rather than lost; ca/de translations ship in the same commit; the licence position and citation are recorded.
