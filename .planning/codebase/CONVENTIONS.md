# Coding Conventions

**Analysis Date:** 2026-06-28

## Naming Patterns

**Files:**
- Lowercase concise names for browser modules: `public/app.js`, `public/persona.js`, `public/shaders.js`.
- Kebab-case for build scripts and generated data: `scripts/build-density.mjs`, `data/mortality-age-sex.json`.
- Uppercase markdown for prominent project docs where conventional: `README.md`, `CLAUDE.md`.

**Functions:**
- camelCase for functions: `fetchJson`, `indexByM49`, `densityLonLat`, `makePersona`, `build-causes` helpers like `resolveSource`.
- Async functions have descriptive verb names but no special prefix: `getMortality`, `initPersona`, `geolocate`.
- Small local helpers are declared close to their consumers.

**Variables:**
- camelCase for ordinary mutable/local values: `countryIds`, `blinkById`, `geoCache`, `camTarget`.
- UPPER_SNAKE_CASE for important constants: `CACHE_TTL_MS`, `REQUEST_TIMEOUT_MS`, `MS_PER_YEAR_REAL`, `FLASH_MS`, `BANDS`, `TOP`.
- Leading underscores are not used for privacy.

**Types:**
- No TypeScript types, interfaces, or enums are present.
- Shape documentation is handled with comments and README prose.

## Code Style

**Formatting:**
- 2-space indentation in JavaScript, HTML, CSS, and JSON.
- Double quotes for strings in JavaScript and HTML attributes.
- Semicolons are used consistently in JavaScript.
- Long expressions are manually wrapped; no formatter config is present.

**Linting:**
- No ESLint or Prettier configuration exists.
- No lint npm script exists.
- Match the current style manually when editing.

## Import Organization

**Server/scripts order:**
1. External packages and Node built-ins at top of file.
2. Constants/config.
3. App or script helper functions.
4. Route registration or `main()` execution.

**Browser order:**
1. Global comments for D3/TopoJSON where needed.
2. External imports (`three`, `OrbitControls`).
3. Internal module imports (`shaders`, `persona` aliases).
4. Constants, helpers, then `main()`.

**Path Aliases:**
- Browser aliases are defined in `public/index.html` import map:
  - `three`
  - `three/webgpu`
  - `three/tsl`
  - `shaders`
  - `persona`
- Server-side code uses relative paths and Node `path.join()`.

## Error Handling

**Patterns:**
- Server runtime external calls use `try/catch`, log errors, and return fallback payloads where possible.
- Build scripts fail fast with clear messages and `process.exit(1)` when required source/auth is missing.
- Browser startup logs fatal data/texture load errors, hides the loader, and returns from `main()`.
- Persona sampling is designed not to throw after initialization; missing data flows into fallbacks.

**Error Types:**
- Plain `Error` instances are used.
- No custom error classes or Result objects.

**Logging:**
- `console.log` for normal script/server startup progress.
- `console.warn` for degraded build behavior such as synthetic density fallback.
- `console.error` for failed upstream calls, build failures, and unexpected API errors.

## Comments

**When to Comment:**
- Comments are used heavily for domain math, data provenance, visualization behavior, and edge cases.
- Good examples: Poisson process explanation in `public/app.js`, GPWv4 aggregation notes in `scripts/build-density.mjs`, UN API pagination/auth notes in `scripts/build-mortality.mjs`.
- Keep this pattern: explain why the data/math/visual behavior works, not obvious syntax.

**JSDoc/TSDoc:**
- Not used.

**TODO Comments:**
- No formal TODO pattern exists.
- Product gaps are tracked in `requirements.md` rather than inline TODOs.

## Function Design

**Size:**
- `public/app.js` has a large `main()` function that owns the full frontend lifecycle.
- Helpers are extracted for repeated/math-heavy logic (`lonLatToVec3`, `expGap`, `flashIntensity`, `densityLonLat`, `pushDeath`).
- Build scripts are linear and organized by helper sections.

**Parameters:**
- Small positional parameter lists are common.
- Object parameter destructuring is used where a function has many related inputs, e.g. `createEarth({ ... })` in `public/shaders.js`.

**Return Values:**
- Functions return plain objects and arrays.
- Guards often return `null` for unavailable optional data, e.g. `densityLonLat()` and `loadJson()`.

## Module Design

**Exports:**
- Browser modules use named exports for public functions: `createEarth`, `initPersona`, `makePersona`.
- Most server/script helpers are module-local and unexported.

**Barrel Files:**
- None.

**State Location:**
- Server caches are file-level variables in `server.js`.
- Frontend visual/feed state is local to `main()` in `public/app.js`.
- Persona data caches are module-level variables in `public/persona.js`.

## UI/CSS Conventions

**Layout:**
- Full-screen globe is fixed to the viewport.
- Portrait feed is a bottom band; landscape feed becomes a left split panel and shifts the globe right.
- Use viewport/dynamic viewport units carefully because the app is fullscreen and mobile browser chrome matters.

**Colors and Typography:**
- CSS variables in `public/styles.css`: `--bg`, `--fg`, `--muted`, `--accent`, `--list-w`.
- System font stack is used everywhere.

**Interaction:**
- OrbitControls own drag/pinch gestures on the canvas.
- Feed scrolling pauses auto-follow until user returns to the newest line.

---
*Convention analysis: 2026-06-28*
*Update when patterns change*
