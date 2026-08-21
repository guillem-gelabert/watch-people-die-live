---
phase: 3
plan: 03-01
subsystem: publish-handoff
tags:
  - verification
  - railway
  - portfolio
key-files:
  - PORTFOLIO-HANDOFF.md
  - server.js
  - public/index.html
  - public/methodology.html
  - public/roadmap.html
  - public/social-preview.png
---

# Plan 03-01 Summary: Verify deployment and prepare portfolio handoff

## One-liner

Verified the MVP locally, checked Railway CLI context, and created a portfolio handoff artifact with explicit deployment follow-up.

## Completed Work

- Re-ran local syntax, metadata, route, and asset smoke checks for the MVP public surfaces.
- Verified the Railway CLI is installed and authenticated.
- Confirmed this checkout is not linked to a Railway project, so production URL verification is unavailable from local context.
- Created `PORTFOLIO-HANDOFF.md` with portfolio positioning, verified surfaces, deferred realism layers, link placeholder, and claim boundaries.
- Updated a lingering `public/persona.js` comment so it no longer implies current cause data is country/age-specific.

## Commits

| Task                               | Commit       | Description                                                                                                        |
| ---------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------ |
| Portfolio handoff and verification | working tree | Changes are present but not committed because `commit_docs=false` and the repository already has uncommitted work. |

## Verification

Passed:

```bash
node --check server.js
rg -n "og:title|og:description|og:image|twitter:card|summary_large_image|individual death records|identifiable" public/index.html
rg -n "Shipped realism layers|Planned realism layers|National death rates|Population-density placement|Age and sex personas|Cause personas|Subnational rates|Time-of-day patterns|Seasonal patterns|Climate and biome|Live weather|Conflict and disaster|Epidemic and pandemic" public/roadmap.html
rg -n "global, sex-specific|representative|not individual" public/methodology.html
file public/social-preview.png
PORT=3004 npm start
curl http://localhost:3004/
curl http://localhost:3004/methodology
curl http://localhost:3004/roadmap
curl http://localhost:3004/social-preview.png
railway --version
railway whoami --json
railway status --json
```

HTTP smoke results:

| Route                 | Status |
| --------------------- | ------ |
| `/`                   | 200    |
| `/methodology`        | 200    |
| `/roadmap`            | 200    |
| `/social-preview.png` | 200    |

Railway status result:

| Check                | Result                                               |
| -------------------- | ---------------------------------------------------- |
| CLI installed        | passed (`railway 5.23.1`)                            |
| Authenticated        | passed                                               |
| Linked project       | not available in this checkout                       |
| Production URL smoke | deferred until Railway project URL/link is available |

## Deviations

- Production Railway route verification could not be completed because `railway status --json` reported no linked project for this checkout.
- The limitation is documented in `PORTFOLIO-HANDOFF.md` and does not block the local MVP handoff.

## Self-Check

PASSED. The MVP public surfaces work locally, the deployment verification limitation is explicit, and the handoff avoids individual-record or exact-live-certainty claims.
