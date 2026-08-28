---
phase: 4
plan: 04-02
title: Source country age/sex causes from WHO Global Health Estimates
type: implementation
wave: 2
depends_on:
  - 04-01
files_modified:
  - scripts/build-causes.ts
  - data/causes.json
  - lib/i18n/ca.causes.ts
  - lib/i18n/de.causes.ts
autonomous: true
requirements:
  - PERS-01
---

<objective>
Give every country its own cause-of-death distribution by age band and sex, from WHO's Global Health
Estimates: one keyless API, all 183 countries including the ~117 with no usable death registration,
19 disjoint five-year age bands, both sexes, 175 specific causes. This replaces the WHO Mortality
Database this plan originally targeted — that is raw registration data and has **zero rows** for
Nigeria, Ethiopia, DR Congo and India, so it could not do the job it was written for.
</objective>

<notes>
Endpoint, verified 2026-08-22 by direct call, no account and no token:

```
https://xmart-api-public.who.int/DEX_CMS/GHE_FULL
```

Keyless OData. Supports `$filter`, `$select`, `$orderby`, `$top` and `$format=csv`. `$top=100000`
returns 100k rows as a 5 MB CSV; `$top=200000` is rejected. `/$count` returns `-1` and is unusable.
Product is GHE 2021 (published 2024), series 2000–2021.

Licence is the reason this beats IHME here: `data.who.int` publishes under **CC BY 4.0**, which
permits derivation and redistribution, so the baked `data/causes.json` can ship in `public/data/`
without the redistribution problem IHME's non-commercial agreement creates. The sharpest evidence:
Our World in Data serves its WHO-sourced chart CSVs at HTTP 200 but returns HTTP 403 on its
IHME-sourced ones with *"contains non-redistributable data that we are not allowed to re-share"*.
The CC BY 4.0 link is inferred from `data.who.int` rather than stated on the API host, so confirm
in writing with `gho_info@who.int` before publishing, and carry WHO's citation format.

Honest limitation to record in methodology copy, not to hide: for the ~117 countries without
qualifying registration data WHO uses **IHME GBD cause fractions as the prior**, rescaled to WHO's
own all-cause envelope. So this is not an independent second opinion versus GBD — it is the same
underlying cause split with a WHO total and a workable licence.
</notes>

<tasks>

1. **Fetch the cube, paging by country**
   - type: implementation
   - files: `scripts/build-causes.ts`
   - action: Add a WHO source path that pulls deaths per country into a cache under
     `data/source/who-ghe/` (already gitignored by `data/source/`). Page **one request per country**
     — 183 requests of ~6,650 rows — rather than `$skip` over 1.2M rows, so a failure resumes at a
     country boundary instead of restarting. Select only what is needed:
     `DIM_COUNTRY_CODE, DIM_AGEGROUP_CODE, DIM_SEX_CODE, DIM_GHECAUSE_TITLE, VAL_DTHS_COUNT_NUMERIC`
     with `$filter` pinning `DIM_YEAR_CODE eq 2021`, `FLAG_SINGLE_CAUSE eq 1`,
     `DIM_SEX_CODE ne 'TOTAL'`, and excluding age codes `TOTAL`, `D0T27`, `M1T11` (see task 2).
   - verify: Row count per country ≈ 19 × 2 × 175; assert 183 distinct `DIM_COUNTRY_CODE`.
   - acceptance_criteria:
     - The fetch is resumable and re-runnable without duplicating rows.
     - Raw responses land under `data/source/` and are never committed.
     - A sequential delay keeps the loop polite; no key or token is required anywhere.

2. **Nineteen disjoint age bands, folded onto the shared nine**
   - type: implementation
   - files: `scripts/build-causes.ts`
   - action: WHO ships 22 age codes and **three of them overlap**: measured on Nigeria 2021 male
     all-causes, `Y0T1` (279,531.29) is exactly `D0T27` (142,010.37) + `M1T11` (137,520.91).
     Taking all three double-counts infancy. Use exactly these 19, which sum to the `TOTAL` row to
     within 0.01, and map them onto the nine-band array shared with `build-mortality.ts` and
     `persona.ts`:

     | band | range | WHO codes |
     | --- | --- | --- |
     | 0 | 0 | `Y0T1` |
     | 1 | 1–4 | `Y1T4` |
     | 2 | 5–14 | `Y5T9` `Y10T14` |
     | 3 | 15–29 | `Y15T19` `Y20T24` `Y25T29` |
     | 4 | 30–49 | `Y30T34` `Y35T39` `Y40T44` `Y45T49` |
     | 5 | 50–64 | `Y50T54` `Y55T59` `Y60T64` |
     | 6 | 65–74 | `Y65T69` `Y70T74` |
     | 7 | 75–84 | `Y75T79` `Y80T84` |
     | 8 | 85+ | `YGE_85` |

     Reject any unrecognised age code loudly rather than binning it — an aggregate silently folded
     into one band is the failure mode this table exists to prevent.
   - verify: Unit test on a fixture asserting `D0T27`/`M1T11`/`TOTAL` are refused and that the 19
     bands reconcile to the all-causes total per country.
   - acceptance_criteria:
     - No age code is counted twice.
     - An unknown or aggregate code fails the build.
     - Every one of the nine bands is populated for every country.

3. **175 leaf causes plus an honest residual**
   - type: implementation
   - files: `scripts/build-causes.ts`
   - action: No WHO flag is a perfect partition — measured on Nigeria 2021 male,
     `FLAG_SINGLE_CAUSE eq 1` gives 175 causes at **97.58%** of all deaths, level 3 alone 97.10%,
     level 4 only 22.27%. Take `FLAG_SINGLE_CAUSE eq 1` (175 specific causes, near-identical
     granularity to GBD level-3's 176) and assign the remaining ~2.4% to `other causes`, which
     `trim()` already emits. Keep `TOP` truncation **per country × sex × band** — pooling before
     truncating is the original sin that erased malaria, HIV/AIDS, tuberculosis and suicide.
   - verify: Assert per cell that summed weights plus the residual equal the all-causes total;
     assert malaria is reachable in Nigeria's top 8 and HIV/AIDS in South Africa's.
   - acceptance_criteria:
     - The residual is explicit, not dropped, and never negative.
     - Low-income-profile causes are reachable in the countries where they dominate.
     - Infant and elderly cells within one country differ.

4. **Labels reconcile with the shipped vocabulary**
   - type: implementation
   - files: `scripts/build-causes.ts`, `lib/i18n/ca.causes.ts`, `lib/i18n/de.causes.ts`
   - action: GHE ships cause labels directly, so the ICD-10 crosswalk this plan originally needed is
     gone. What remains is presentation: WHO says "Self-harm" where the feed says "suicide", and
     "Alzheimer disease and other dementias" where it says "Alzheimer's & dementia". Normalise WHO
     labels to the project's existing wording where an equivalent already exists — which preserves
     the Catalan and German translations already written — and adopt WHO's label verbatim otherwise.
   - verify: `pnpm test` — `lib/i18n/causes.test.ts` asserts the ca/de dictionaries have no missing
     and no stale labels against `data/causes.json` plus the persona fallback table.
   - acceptance_criteria:
     - Every emitted label has a Catalan and German translation in the same commit.
     - The normalisation map is data, not scattered conditionals, and each entry is justified.
     - No raw WHO code reaches the feed.

5. **Coverage reports what the file can answer**
   - type: implementation
   - files: `data/causes.json`, `scripts/build-causes.ts`
   - action: Emit `coverage.location: "country"` and `coverage.age: "age_bands"`, and record the
     source as WHO GHE 2021 with its citation string. This is what finally lets 04-01's guard admit
     real data: until now the guard has been rejecting the global all-ages export and falling through
     to the age-gated table. Extend `Coverage` with per-country markers so a later GBD or subnational
     merge has a declared precedence rule.
   - verify: Node smoke through `initPersona()` + `makePersona()` asserting country cells are read.
   - acceptance_criteria:
     - `coverage` truthfully describes the file; `persona.ts` consumes it with no code change.
     - `app/roadmap/charts/usePersonaTables.ts` — the second reader of this file — still works.
     - Payload measured raw and gzipped; `TOP` lowered if it exceeds ~700 KB raw.

</tasks>

<verification>

- `pnpm run build:causes -- --force`
- `pnpm run typecheck && pnpm run lint && pnpm test`
- Reconciliation report: per-country summed weights + residual == WHO all-causes total.
- Byte-size report for `data/causes.json`, raw and gzipped.
- Node smoke: a Nigerian and a Japanese persona of the same age draw visibly different causes.

</verification>

<success_criteria>

- All 183 countries have age-banded, sex-specific cause distributions, including every country
  without vital registration.
- Age codes are disjoint and the nine bands reconcile to WHO's own totals.
- The 2.4% the leaf set does not cover is carried as `other causes`, not silently lost.
- Catalan and German translations ship in the same commit as any new label.
- The licence position is recorded, with WHO's citation string, and confirmation sought in writing.

</success_criteria>
