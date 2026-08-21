---
created: 2026-08-21T15:40:00.000Z
title: Schedule the conflict-layer rebuild so a baked layer stays current
priority: 5
area: data
blocked_by: s13 (there is no offline job to schedule yet)
mandatory: true (no runtime source of current data exists — see s13)
files:
  - lib/acled-cache.ts
  - lib/acled.ts
  - app/api/conflicts/route.ts
  - package.json
---

## Problem

Once **s13** moves ACLED off the server, the conflict layer is only as fresh as the last
run of the offline job — and nothing in this project schedules anything. No
`.github/workflows`, no Railway cron, nothing in `package.json` beyond the
`predev`/`prebuild` chain.

That matters more here than for any other layer. The conflict model is a **rolling
twelve-week window** (`ACLED_WINDOW_WEEKS = 12`) feeding an EWMA prediction of current
weekly fatalities. Today it self-refreshes on a 24h TTL. A hand-run notebook turns that
into "as of whenever I last remembered", and the failure is silent: the globe keeps firing
conflict deaths at a rate that was true some unknown number of weeks ago, and the story's
prediction chart presents a stale forecast as a current one.

The same gap covers the cause data — see **s07**, which wants a schedule for the WHO
Mortality Database refresh and a vintage stated in the story. These two want one mechanism,
not two.

## Solution

TBD. Two decisions, and they are independent.

**Where the job runs.** Options, cheapest first:

- **Railway cron.** The app already deploys there, so credentials (`ACLED_USERNAME`,
  `ACLED_PASSWORD`) are already in that environment. But a cron that regenerates
  `data/conflicts.json` inside a container writes to an ephemeral filesystem — it would
  have to commit back to the repo or push to object storage, which is the real design
  question, not the cron itself.
- **GitHub Actions on a schedule**, committing the regenerated JSON. Fits the "derived
  data is committed" model the project already uses, gives a visible diff per refresh, and
  a failed run is a visible failed run. Needs the ACLED credentials as repo secrets — note
  the repo is public, so they must be secrets, never committed.
- ~~**Keep a runtime refresh but only for JSON.**~~ **Ruled out 2026-08-21.** The rule bans
  binary parsing on the server, not fetching, so calling ACLED's REST API at runtime would
  have satisfied it and kept the layer live — but probing with this project's credentials
  returned `data_query_restrictions.date_recency: 12 Months`, i.e. the account can only read
  events at least twelve months old. See s13 for the full finding. There is no runtime
  source of current conflict data, so **this todo is mandatory rather than optional**: the
  offline job is the only way the layer stays current, and a schedule is the only way the
  offline job runs.

**What the reader is told.** `ConflictsPayload.freshness` already carries
`{ status: "fresh" | "stale" | "unavailable", ageHours, refreshedAt }` and the story renders
it. Whatever the mechanism, that field has to keep meaning something — with a baked
artifact, `ageHours` is the age of the commit rather than of a fetch, and "stale" needs a
threshold someone chooses rather than the current 24h TTL. Getting this wrong is worse than
having no freshness field: it would tell the reader the data is fresh when it is not.

Acceptance criteria to agree on:

- The twelve-week window is never more than one refresh interval out of date, and the
  interval is written down somewhere the reader can see.
- A failed refresh is loud, not silent — the layer reports `stale`/`unavailable` rather
  than serving old numbers as current.
- Credentials never land in the repo.
