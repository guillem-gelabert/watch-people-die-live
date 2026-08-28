---
phase: 4
plan: 04-07
title: Make persona composition seasonal
type: implementation
wave: 5
depends_on:
  - 04-02
  - 04-04
  - 04-06
files_modified:
  - app/globe/persona.ts
  - app/globe/Globe.tsx
  - lib/spatial-seasonality.ts
  - data/seasonal-composition.json
autonomous: true
requirements:
  - PERS-03
  - REAL-03
---

<objective>
The seasonality stack controls only when deaths fire, never who dies — `makePersona()` takes no date at all, so a January and a July death in Sweden draw identical distributions. Add a month-conditioned reweighting of cause and age, normalised so it changes shape without changing annual totals.
</objective>

<tasks>

1. **Measure a cause x month and age x month tensor**
   - type: data
   - files: `data/seasonal-composition.json`
   - action: Measure from the well-instrumented sources rather than hunting country by country: Eurostat `demo_r_mweek3` from 04-06 for age x month across ~35 countries, and the cause-bearing Brazil and Mexico microdata unlocked by 04-08 for tropical and southern references.
   - verify: Assert each month's reweighting is mean-1 normalised per cause and per band.
   - acceptance_criteria:
     - Annual totals are unchanged by the reweighting.
     - COVID years 2020-2022 are excluded, matching the existing seasonality method.
     - Respiratory and circulatory winter excess is visible in the measured tensor.

2. **Transfer by climate zone, not by guesswork**
   - type: implementation
   - files: `lib/spatial-seasonality.ts`
   - action: Reuse the already-LOO-validated donor machinery (Koppen class and family blends, applied-fallback resolution, southern-hemisphere re-phasing) to transfer the tensor to countries with no measured composition, instead of building a second transfer model.
   - verify: Leave-one-out error against the measured countries.
   - acceptance_criteria:
     - Transferred tensors beat a flat no-seasonality baseline under LOO.
     - Southern-hemisphere targets are re-phased.
     - Estimated rather than measured tensors are labelled as such.

3. **Persona takes a date**
   - type: implementation
   - files: `app/globe/persona.ts`, `app/globe/Globe.tsx`
   - action: Extend `makePersona()` to accept the simulated event date, which `Globe.tsx` already knows, and apply the month's reweighting to cause and age selection.
   - verify: Node smoke comparing January vs July composition for a strongly seasonal country.
   - acceptance_criteria:
     - Winter personas skew older and more respiratory/circulatory.
     - Summer shows the drowning and heat-exposure shift where measured.
     - Tropical countries stay near-flat.
     - `makePersona()` still never throws.

</tasks>

<verification>

- `pnpm run typecheck`
- `pnpm test`
- LOO report for transferred tensors.
- Node smoke on January vs July composition.

</verification>

<success_criteria>

- Persona composition shifts with the season the globe is already simulating.
- Transfer reuses the existing validated donor model.
- Estimated tensors are distinguishable from measured ones.

</success_criteria>
