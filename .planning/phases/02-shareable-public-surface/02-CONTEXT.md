# Phase 2: Shareable Public Surface - Context

**Gathered:** 2026-06-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 makes the app shareable and publicly explainable. It adds accurate social preview metadata and image assets for the home page, plus a public `/roadmap` page that separates shipped realism layers from planned future layers. Deployment verification and portfolio wiring remain Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Social Preview Metadata

- Shared links should emphasize a real-time statistical mortality globe, representative personas, and clear non-surveillance framing.
- Social preview title should be `Watch People Die Live`.
- `og:description` should avoid implying individual death records, exact real-time certainty, or identifiable people.
- The MVP should ship a committed static preview image generated from the app's visual language and served from `public/`.

### Public Roadmap Page

- `/roadmap` should emphasize a clear split between shipped realism layers and planned future layers.
- "Shipped" means only implemented layers: World Bank rates, density placement, UN age/sex personas, global sex-specific IHME causes, fallbacks, and methodology caveats.
- Planned layers should include subnational rates, time-of-day, seasonal, climate/biome, weather, conflict, and epidemic/pandemic modes.
- The page should feel app-native and restrained: a public product surface, not a marketing landing page.

### Routing and Verification

- Serve `/roadmap` as a static `public/roadmap.html` page through an explicit Express route, matching `/methodology`.
- Verify HTTP 200 for `/`, `/roadmap`, and the preview image; verify metadata in `public/index.html`; verify roadmap content stays consistent with methodology and requirements.
- Use relative/absolute-safe metadata where possible, with canonical path and preview image path served by the app.
- Keep Railway deployment verification and portfolio link wiring out of Phase 2.

### the agent's Discretion

Implementation details are at the agent's discretion when they preserve the accepted public positioning, existing static-page style, and MVP scope.

</decisions>

<code_context>

## Existing Code Insights

### Reusable Assets

- `public/index.html` owns the app shell `<head>` and is the right place for social metadata.
- `server.js` already serves `/methodology` by sending `public/methodology.html`; `/roadmap` should follow that pattern.
- `public/methodology.html` already has app-native public-page structure and restrained styling that can inform the roadmap page.
- `public/styles.css` contains global page and visualization styles; add page-specific roadmap styles there if needed.
- `.planning/REQUIREMENTS.md`, `requirements.md`, `ACCURACY_STEPS.md`, and `public/methodology.html` define the current shipped/planned realism layers.

### Established Patterns

- Static HTML pages live under `public/` and are served by explicit Express routes.
- Cache-busting uses `?v=__V__` placeholders replaced by `server.js` for the index shell; static pages can reference `/styles.css` directly.
- The app avoids overclaiming real-time or individual-level precision.

### Integration Points

- `server.js` route table for `/roadmap`.
- `public/index.html` metadata for Open Graph, Twitter cards, canonical URL, and preview image.
- `public/roadmap.html` for the public roadmap page.
- `public/social-preview.png` for shared preview media.

</code_context>

<specifics>
## Specific Ideas

Use a dark app-native preview image with an earth/globe signal, a few death-flash points, and concise brand text. Roadmap copy should explicitly list shipped layers and planned future layers without implying planned realism is already implemented.

</specifics>

<deferred>
## Deferred Ideas

- Railway deployment verification.
- Portfolio entry/link wiring.
- Live or dynamic roadmap generation from markdown.
- In-app SPA route integration for the roadmap.

</deferred>
