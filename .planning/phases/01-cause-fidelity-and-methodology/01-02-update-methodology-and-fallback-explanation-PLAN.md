---
phase: 1
plan: 01-02
title: Update methodology and fallback explanation
type: documentation
wave: 1
depends_on:
  - 01-01
files_modified:
  - public/methodology.html
  - README.md
  - public/persona.js
  - ACCURACY_STEPS.md
autonomous: true
requirements:
  - METH-01
  - METH-02
  - METH-03
  - DATA-04
---

<objective>
Make public and developer-facing documentation match the actual Phase 1 cause-data fidelity: IHME-derived, global, sex-specific, all-ages cause weights with clear fallbacks and representative-identity caveats.
</objective>

<tasks>

1. **Methodology states current cause fidelity**
   - type: documentation
   - files: `public/methodology.html`
   - action: Update cause-data copy to say causes are global, sex-specific, and all-ages rather than country- or age-specific.
   - verify: Search methodology copy for overclaims such as country-specific or age-stratified causes.
   - acceptance_criteria:
     - The page does not claim per-country or age-specific cause distributions are shipped.
     - It identifies IHME GBD 2023 Global + All ages as the current cause source.

2. **Methodology preserves representative-identity caveat**
   - type: documentation
   - files: `public/methodology.html`
   - action: Keep the explanation clear that personas are statistical representatives and not identifiable records.
   - verify: Inspect the methodology persona and caveat sections.
   - acceptance_criteria:
     - The page states identities are representative, never real individuals.
     - Cause limitations are framed as statistical caveats, not product failures.

3. **README documents repeatable source workflow**
   - type: documentation
   - files: `README.md`
   - action: Document supported IHME export shapes, source placement, and build command.
   - verify: Search README for `npm run build:causes -- --force`, `--src`, `Global`, and `All ages`.
   - acceptance_criteria:
     - Developers can regenerate `data/causes.json` from a local IHME CSV export.
     - The README explains that current MVP output is global and sex-specific when using Global + All ages.

4. **Accuracy ladder reflects shipped step**
   - type: documentation
   - files: `ACCURACY_STEPS.md`
   - action: Mark global causes as implemented and explicitly defer per-country/age causes.
   - verify: Inspect Step 5 and Step 6 wording.
   - acceptance_criteria:
     - Step 5 says `data/causes.json` is implemented.
     - Step 6 remains the next accuracy gap for per-country causes.

</tasks>

<verification>

- Inspect `public/methodology.html` for accurate cause-source language.
- Inspect `README.md` for repeatable build instructions.
- Inspect `ACCURACY_STEPS.md` for correct Step 5 status.
- Run the cause-data verification from plan `01-01` to ensure docs match the generated artifact.

</verification>

<success_criteria>

- `/methodology` accurately describes mortality, density, age/sex, cause, geolocation, and representative-identity caveats.
- Documentation no longer overstates cause precision.
- The fallback chain is clear and does not imply sample or hardcoded causes are authoritative.

</success_criteria>
