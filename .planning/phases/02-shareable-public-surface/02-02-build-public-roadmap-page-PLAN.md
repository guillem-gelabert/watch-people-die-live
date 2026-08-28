---
phase: 2
plan: 02-02
title: Build public roadmap page
type: implementation
wave: 1
depends_on:
  - 02-01
files_modified:
  - server.js
  - public/roadmap.html
  - public/styles.css
autonomous: true
requirements:
  - ROAD-01
  - ROAD-02
  - ROAD-03
  - ROAD-04
---

<objective>
Add a public `/roadmap` page that clearly separates shipped realism layers from planned future layers and stays consistent with methodology and requirements.
</objective>

<tasks>

1. **Roadmap route**
   - type: implementation
   - files: `server.js`
   - action: Add an explicit `/roadmap` route that serves `public/roadmap.html`, matching the `/methodology` route pattern.
   - verify: Local HTTP smoke returns 200 for `/roadmap`.
   - acceptance_criteria:
     - `/roadmap` is available as a clean URL.
     - The route uses no runtime markdown generation.

2. **Roadmap page**
   - type: implementation
   - files: `public/roadmap.html`, `public/styles.css`
   - action: Build a restrained app-native static roadmap page with shipped and planned realism sections.
   - verify: Inspect page content for implemented and planned layers listed in Phase 2 context.
   - acceptance_criteria:
     - Shipped layers include World Bank rates, density placement, UN age/sex personas, global sex-specific IHME causes, fallbacks, and methodology caveats.
     - Planned layers include subnational rates, time-of-day, seasonal, climate/biome, weather, conflict, and epidemic/pandemic modes.
     - The page does not imply planned layers are already shipped.

3. **Consistency checks**
   - type: verification
   - files: `public/roadmap.html`, `public/methodology.html`, `.planning/REQUIREMENTS.md`
   - action: Compare roadmap wording against methodology and requirements.
   - verify: Search for required layer names and overclaiming language.
   - acceptance_criteria:
     - Roadmap content is consistent with methodology caveats.
     - Phase 3 deployment/portfolio work is not included in Phase 2 implementation.

</tasks>

<verification>

- Local HTTP smoke for `/roadmap`.
- Search `public/roadmap.html` for shipped and planned realism layers.
- Inspect page text for "planned" vs "shipped" separation.

</verification>

<success_criteria>

- `/roadmap` loads in the app.
- Roadmap content separates implemented realism layers from planned layers.
- Roadmap content stays consistent with requirements and methodology.

</success_criteria>
