# Codebase Structure

**Analysis Date:** 2026-06-28

## Directory Layout

```text
watch-people-die-live/
├── data/                 # Committed runtime data and fallback JSON
├── public/               # Browser app, static pages, CSS, shaders, earth textures
│   └── earth/            # Earth texture images used by three.js
├── scripts/              # Data-generation and verification scripts
├── server.js             # Express server and runtime API implementation
├── package.json          # npm scripts, dependencies, Node engine
├── package-lock.json     # npm dependency lockfile
├── railway.json          # Railway build/deploy config
├── README.md             # Developer/user documentation
├── CLAUDE.md             # Project context and working agreements
├── requirements.md       # Current product requirements and roadmap notes
└── notes.md              # Scratch log
```

## Directory Purposes

**`data/`:**
- Purpose: Runtime JSON artifacts loaded by server and browser.
- Contains: Prebuilt density grid, age/sex mortality, sample mortality, sample personas.
- Key files: `data/density-grid.json`, `data/mortality-age-sex.json`, `data/sample-cdr.json`, `data/sample-personas.json`.
- Expected but absent until generated: `data/causes.json`.
- Special source directory: `data/source/` is referenced by scripts for raw GPWv4 and GBD CSV inputs and should remain gitignored.

**`public/`:**
- Purpose: All browser-facing app code and static content.
- Contains: App shell, rendering code, shader module, persona module, styles, methodology page, texture assets.
- Key files: `public/index.html`, `public/app.js`, `public/shaders.js`, `public/persona.js`, `public/styles.css`, `public/methodology.html`.
- Subdirectories: `public/earth/` stores `earth_day_4096.jpg`, `earth_night_4096.jpg`, and `earth_bump_roughness_clouds_4096.jpg`.

**`scripts/`:**
- Purpose: Offline/build-time data generation and validation.
- Contains: Node ESM scripts run through npm.
- Key files: `scripts/build-density.mjs`, `scripts/build-mortality.mjs`, `scripts/build-causes.mjs`, `scripts/verify-globe-alignment.mjs`.

**Project root:**
- Purpose: Runtime entry, package/deployment config, and project documentation.
- Key files: `server.js`, `package.json`, `railway.json`, `README.md`, `CLAUDE.md`, `requirements.md`.

## Key File Locations

**Entry Points:**
- `server.js` - Node/Express startup, HTTP routes, external API integrations, in-memory caches.
- `public/index.html` - Browser app shell and import map.
- `public/app.js` - Main frontend module and animation loop.

**Configuration:**
- `package.json` - npm scripts, dependency versions, Node engine.
- `package-lock.json` - Locked dependency tree.
- `railway.json` - Railway Nixpacks build/start commands and restart policy.
- `.gitignore` - Local/generated exclusions.

**Core Logic:**
- `server.js` - `/api/mortality`, `/api/geo`, `/api/debug`, static data/vendor routes.
- `public/app.js` - Mortality timing, density placement, scene setup, controls, feed updates.
- `public/shaders.js` - Earth material and shockwave shader logic.
- `public/persona.js` - Age/sex/cause persona sampling and fallback tables.
- `scripts/build-density.mjs` - GPWv4 aggregation into a compact placement grid.
- `scripts/build-mortality.mjs` - UN WPP age/sex death distribution builder.
- `scripts/build-causes.mjs` - IHME GBD cause-of-death CSV aggregator.

**Testing/Verification:**
- `scripts/verify-globe-alignment.mjs` - Checks coordinate mapping between texture UVs and `lonLatToVec3()`.
- No `test/`, `__tests__/`, or `*.test.*` files are present.

**Documentation:**
- `README.md` - System explanation, local run instructions, data rebuild instructions, Railway deploy notes.
- `requirements.md` - Product state, MVP scope, realism roadmap, open questions.
- `CLAUDE.md` - Short project context and working agreements.
- `public/methodology.html` - User-facing data and methodology explanation.

## Naming Conventions

**Files:**
- Root project docs use uppercase or lowercase markdown names based on convention: `README.md`, `CLAUDE.md`, `requirements.md`.
- Runtime browser modules use short lowercase names: `app.js`, `shaders.js`, `persona.js`.
- Build scripts use kebab-case with `.mjs`: `build-density.mjs`, `build-mortality.mjs`, `build-causes.mjs`.
- Data files use kebab-case JSON names: `density-grid.json`, `mortality-age-sex.json`, `sample-cdr.json`.

**Directories:**
- Simple lowercase directory names: `data/`, `public/`, `scripts/`.
- Static texture collection uses `public/earth/`.

**Special Patterns:**
- Browser import aliases are declared in `public/index.html`, not a bundler config.
- Query string version placeholder `__V__` is injected by `server.js` before serving the app shell.
- M49 numeric ids are the cross-file country key.

## Where to Add New Code

**New frontend feature:**
- Primary code: `public/app.js` if it affects globe behavior or UI state.
- Supporting module: Add a new `public/*.js` module and import it through the import map in `public/index.html` if the feature becomes large enough.
- Styles: `public/styles.css`.
- User-facing explanatory content: `public/methodology.html` or a new static HTML page served from `server.js`.

**New API route:**
- Definition and handler: `server.js`.
- External service helpers: Keep near related helpers in `server.js` unless the file becomes unwieldy enough to justify module extraction.
- Runtime data file serving: Add explicit route in `server.js` if the file should be exposed under `/data/...`.

**New data artifact:**
- Generated file: `data/*.json`.
- Builder: `scripts/build-*.mjs`.
- Documentation: Update `README.md`, `requirements.md`, and `public/methodology.html` if it changes data interpretation.

**New deployment behavior:**
- Railway-specific changes: `railway.json`.
- npm command: `package.json`.

**New tests/checks:**
- For focused scripts, follow `scripts/verify-globe-alignment.mjs`.
- For broader regression tests, add a test runner and document it in `package.json` and `.planning/codebase/TESTING.md`.

## Special Directories

**`node_modules/`:**
- Purpose: Installed dependencies and vendored browser library files served by `server.js`.
- Source: `npm install`.
- Committed: No.

**`data/source/`:**
- Purpose: Raw source datasets for density and cause builders.
- Source: GPWv4 CSV download and manual IHME GBD export.
- Committed: No, per README guidance.

**`.planning/codebase/`:**
- Purpose: Generated GSD codebase map.
- Source: `$gsd-map-codebase`.
- Committed: Yes when GSD planning docs are tracked.

---
*Structure analysis: 2026-06-28*
*Update when directory structure changes*
