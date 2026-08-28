---
phase: 2
plan: 02-01
title: Add social preview metadata and image
type: implementation
wave: 1
depends_on: []
files_modified:
  - public/index.html
  - public/social-preview.png
autonomous: true
requirements:
  - SHARE-01
  - SHARE-02
  - SHARE-03
---

<objective>
Add accurate social preview metadata and a committed preview image so shared home-page links describe the project without overstating real-time precision or individual identity.
</objective>

<tasks>

1. **Home page metadata**
   - type: implementation
   - files: `public/index.html`
   - action: Add description, canonical, Open Graph, and Twitter card metadata to the app shell.
   - verify: Inspect `<head>` for `og:title`, `og:description`, `og:image`, Twitter card fields, and safe non-surveillance wording.
   - acceptance_criteria:
     - `og:title` is `Watch People Die Live`.
     - Description says the visualization is statistical/representative.
     - Metadata avoids claims about identifiable real people or exact individual death records.

2. **Static preview image**
   - type: asset
   - files: `public/social-preview.png`
   - action: Generate a committed 1200x630 preview image using the app's dark globe/death-flash visual language.
   - verify: Check the file exists, is PNG, and has share-card dimensions.
   - acceptance_criteria:
     - Preview image is served from `public/`.
     - Metadata references the preview image path.

</tasks>

<verification>

- Inspect `public/index.html` metadata.
- `file public/social-preview.png`
- Local HTTP smoke for `/` and `/social-preview.png`.

</verification>

<success_criteria>

- The home page has accurate social preview metadata and a usable preview image.
- Shared links do not overstate real-time precision or individual identity.

</success_criteria>
