---
phase: 999.1
plan: 999.1-01
status: backlog-draft
title: Opportunistic subnational cause and age sourcing
type: data
wave: null
depends_on:
  - 04-06
files_modified:
  - pipeline/sources/subnational.py
  - pipeline/sources.lock.json
  - data/subnational-cdr.json
autonomous: false
note: Not scheduled. Promote via /gsd:review-backlog before treating as a plan.
requirements:
  - PERS-01
  - PERS-02
---

<objective>
Cover selected admin-1 regions outside Eurostat's reach with observed cause and age x sex data. Deliberately scoped as opportunistic rather than a sweep: full subnational coverage is unreachable at any effort level.
</objective>

<tasks>

1. **Pick targets by a stated trigger, not by list**
   - type: data
   - files: `pipeline/sources/subnational.py`
   - action: Take a country only when one of three conditions holds: it is already half-done by another plan (Brazil/Mexico via 04-08, US via 04-07's CDC pull), it is large enough that a single national pyramid reads as visibly false in the feed, or it is needed as a 04-04 validation fixture.
   - verify: Record the trigger for each country taken and each deliberately skipped.
   - acceptance_criteria:
     - Every included country has a recorded trigger.
     - Skipped countries are listed rather than silently omitted.

2. **Label estimates as estimates**
   - type: data
   - files: `data/subnational-cdr.json`
   - action: Where no observed data exists, follow the precedent already set for India and China admin-1 rows: mark them `measurement: "climate-modeled"`-style estimates excluded from validation, rather than leaving gaps or presenting estimates as observed.
   - verify: Assert every region row carries a measurement provenance value.
   - acceptance_criteria:
     - No row presents an estimate as an observation.
     - Estimated rows are excluded from validation statistics.

3. **Document the ceiling**
   - type: documentation
   - files: `pipeline/sources/subnational.py`
   - action: Record that China, India, Indonesia, Pakistan, Ethiopia, Nigeria, DRC, Libya and Madagascar have weak or no public subnational access, per the existing sixteen-country survey in `seasonality-data-guide.md`, so this plan asymptotes well short of global coverage.
   - verify: Cross-check the claim against the guide's own section headings.
   - acceptance_criteria:
     - The unreachable set is named explicitly.
     - The derived approach in 04-04 is documented as the reason this is acceptable.

</tasks>

<verification>

- `pnpm run lint:notebooks`
- Provenance assertion over every region row.
- Trigger log for included and skipped countries.

</verification>

<success_criteria>

- Selected high-impact regions have observed cause and age data.
- Estimates are labelled, never presented as observations.
- The coverage ceiling is documented rather than implied to be temporary.

</success_criteria>

<notes>
Not autonomous and not a milestone goal: each country is a bespoke parser and the selection needs judgement. Kept as a plan only so its triggers and ceiling are recorded; may be moved to the 999.x backlog instead.
</notes>
