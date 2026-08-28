---
phase: 3
plan: 03-01
title: Verify deployment and prepare portfolio handoff
type: verification
wave: 1
depends_on:
  - 02-02
files_modified:
  - PORTFOLIO-HANDOFF.md
autonomous: true
requirements:
  - PUB-01
  - PUB-02
  - PUB-03
---

<objective>
Verify the MVP app surfaces locally and on Railway where available, then create portfolio handoff guidance that accurately describes the visualizer and remaining deferred realism layers.
</objective>

<tasks>

1. **Local MVP smoke**
   - type: verification
   - files: `server.js`, `public/index.html`, `public/methodology.html`, `public/roadmap.html`, `public/social-preview.png`
   - action: Start the app on an alternate local port and probe `/`, `/methodology`, `/roadmap`, and `/social-preview.png`.
   - verify: HTTP status codes and metadata/content greps.
   - acceptance_criteria:
     - All required local routes return HTTP 200.
     - Home-page metadata includes title, description, and preview image.
     - Roadmap and methodology content remain consistent.

2. **Railway read-only verification**
   - type: verification
   - files: `railway.json`
   - action: Use Railway CLI read-only status/context checks where available, and record whether a deployed URL can be verified.
   - verify: `railway status --json` and any available domain/status output.
   - acceptance_criteria:
     - If Railway context is available, deployment target/status is recorded.
     - If unavailable, the limitation is documented without blocking local handoff.

3. **Portfolio handoff**
   - type: documentation
   - files: `PORTFOLIO-HANDOFF.md`
   - action: Create concise portfolio guidance with verification status, positioning copy, link placeholder if needed, and deferred realism layers.
   - verify: Inspect handoff for no individual-record or exact-live-certainty claims.
   - acceptance_criteria:
     - Handoff identifies the visualizer's portfolio role.
     - Handoff lists verified surfaces.
     - Handoff names deferred advanced realism layers.

</tasks>

<verification>

- `node --check server.js`
- `PORT=<port> npm start`
- `curl` route checks for `/`, `/methodology`, `/roadmap`, `/social-preview.png`
- Metadata/content grep checks.
- Railway CLI read-only status if available.

</verification>

<success_criteria>

- The MVP surfaces pass local smoke checks.
- Railway deployment status is verified or the access/URL limitation is documented.
- A portfolio-ready handoff artifact exists.
- Remaining advanced realism layers are explicitly deferred.

</success_criteria>
