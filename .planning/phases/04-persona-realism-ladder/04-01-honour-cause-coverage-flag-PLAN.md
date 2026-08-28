---
phase: 4
plan: 04-01
title: Honour the cause coverage flag in pickCause
type: implementation
wave: 1
depends_on: []
files_modified:
  - app/globe/persona.ts
autonomous: true
requirements:
  - PERS-01
---

<objective>
`pickCause` ignores the `coverage` object that `build-causes.ts` writes into `data/causes.json`, so all-ages weights repeated across every age band always beat the age-gated fallback table. Read the flag and fall through when the data cannot support the requested band.
</objective>

<tasks>

1. **Coverage is part of the cause data contract**
   - type: implementation
   - files: `app/globe/persona.ts`
   - action: Add `coverage` to the `CauseData` interface so the flag the builder already emits is visible to the consumer.
   - verify: `pnpm run typecheck`
   - acceptance_criteria:
     - `CauseData` declares `coverage` with `location`, `age` and `sex`.
     - No other call site breaks under strict TypeScript.

2. **Age-repeated cause cells are rejected**
   - type: implementation
   - files: `app/globe/persona.ts`
   - action: In `pickCause`, treat a cell as unusable when `coverage.age === "all_ages_repeated_across_bands"` and fall through to the existing `CAUSES` fallback table.
   - verify: Node smoke: build 1000 personas at age 0 and assert no adult-only cause appears.
   - acceptance_criteria:
     - An infant persona never draws Alzheimer's & dementia, breast cancer, lung cancer or ischaemic heart disease.
     - Adult personas still read sensibly.
     - A future export with `coverage.age == "age_bands"` is used rather than rejected.

3. **Country lookups report honestly**
   - type: implementation
   - files: `app/globe/persona.ts`
   - action: Distinguish "no country data" from "country data identical to global" by honouring `coverage.location` when a country lookup was requested.
   - verify: Inspect `pickCause` and `mortFor` fallback order.
   - acceptance_criteria:
     - A global-only export does not masquerade as country-specific.
     - `makePersona()` still never throws.

</tasks>

<verification>

- `pnpm run typecheck`
- `pnpm run lint`
- `pnpm test`
- Node smoke over age bands 0-2 confirming no adult-only causes.

</verification>

<success_criteria>

- Infant and child personas draw age-appropriate causes.
- The `coverage` flag is read, not just written.
- A later age-banded export is consumed without further code change.

</success_criteria>
