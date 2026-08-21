# Phase 3: Publish and Portfolio Handoff - Context

**Gathered:** 2026-06-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 verifies the MVP surfaces and prepares a portfolio handoff. It should confirm local app health, verify the configured Railway deployment if available, document any deployment-access limitation, and produce concise portfolio entry guidance. It should not add product features unless verification exposes a blocker.

</domain>

<decisions>
## Implementation Decisions

### Deployment Verification

- Verify the configured Railway deployment if available, while also running local smoke checks as the fallback verification source.
- Smoke checks must cover `/`, `/methodology`, `/roadmap`, `/social-preview.png`, and home-page metadata.
- Publish blockers are missing routes, absent metadata, app startup failure, or roadmap/methodology inconsistency.
- If Railway access or deployment URL is unavailable, record it as a verification limitation and provide portfolio handoff guidance from local checks.

### Portfolio Handoff

- Produce a concise local artifact with verified app status, what the piece demonstrates, and remaining deferred realism layers.
- Position the piece as experiential data visualization showing real-time statistical mortality modeling, density placement, and representative identity generation.
- If no deployed URL is discoverable, provide local verification status and a placeholder for the Railway URL, clearly marked as needing final URL insertion.
- Do not claim individual records, exact live certainty, or completed advanced realism layers.

### Final Scope and Lifecycle

- Phase 3 should not change product code unless smoke checks reveal a blocker.
- MVP complete means local/deployment smoke checks pass or a deployment limitation is documented, portfolio handoff exists, and advanced realism layers are explicitly deferred.
- Autonomous should run milestone lifecycle after Phase 3 verification passes.
- Report uncommitted changes clearly and avoid destructive cleanup; do not revert unrelated or pre-existing edits.

### the agent's Discretion

Verification command details, portfolio artifact filename, and local smoke implementation are at the agent's discretion when they stay within the accepted verification and handoff scope.

</decisions>

<code_context>

## Existing Code Insights

### Reusable Assets

- `server.js` serves `/`, `/methodology`, `/roadmap`, static assets, data files, and API routes.
- `public/index.html` contains social metadata and the app shell.
- `public/methodology.html` and `public/roadmap.html` are the public explanatory pages.
- `public/social-preview.png` is the committed preview image for share cards.
- `railway.json` defines Nixpacks build and `npm start` deployment behavior.

### Established Patterns

- Local smoke checks can start the Express app on an alternate `PORT` and probe routes with `curl`.
- Railway is the production platform, but read-only CLI status may depend on local link/auth.
- GSD artifacts capture verification status even when `commit_docs=false` prevents automatic commits.

### Integration Points

- Railway CLI status/domain lookup if the project is linked.
- `PORT=<port> npm start` for local verification.
- `PORTFOLIO-HANDOFF.md` for final local handoff guidance.

</code_context>

<specifics>
## Specific Ideas

Use route-level smoke checks and metadata grep checks as final MVP verification. If Railway status or a deployed URL is not discoverable, state that limitation plainly in the handoff instead of blocking local completion.

</specifics>

<deferred>
## Deferred Ideas

- Subnational rates.
- Time-of-day patterns.
- Seasonal patterns.
- Climate/biome modifiers.
- Live weather modifiers.
- Conflict/disaster overlays.
- Epidemic/pandemic modes.

</deferred>
