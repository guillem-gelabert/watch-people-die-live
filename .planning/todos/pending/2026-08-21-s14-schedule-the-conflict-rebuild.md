---
created: 2026-08-21T15:40:00.000Z
title: Keep the build-time conflict layer current, and honest about its age
priority: 5
area: data
blocked_by: s13 (nothing to schedule until the build script exists)
mandatory: true (freshness is now deploy cadence — see below)
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

**s13 decided 2026-08-21 to fetch and parse at build time.** That changes this todo's shape
rather than removing it: **the conflict layer is now exactly as fresh as the last deploy.**
Go a month without deploying and the globe fires conflict deaths at a month-old rate while
the story presents a month-old EWMA as a current forecast.

So this is no longer "schedule a job". It is two smaller things.

**1. Make deploys happen on a cadence.** Railway can redeploy on a schedule, which is a much
smaller ask than a cron that commits data — the build script already does the work, it just
needs to run. Weekly matches the source: ACLED publishes the aggregated workbooks weekly, and
the current one is dated `up_to_week_of-2026-08-08` against a 2026-08-21 probe, so the
upstream file already lags around two weeks. There is no point refreshing faster than that.

**2. Make the age visible and truthful.** `ConflictsPayload.freshness` already carries
`{ status: "fresh" | "stale" | "unavailable", ageHours, refreshedAt }` and the story renders
it. With a build-time artifact those fields change meaning: `refreshedAt` becomes the build
timestamp, and `ageHours` the age of the build rather than of a fetch. Two traps:

- The `status` threshold was the 24h runtime TTL. Against a weekly upstream and a weekly
  deploy, 24h would report `stale` almost always. It needs a threshold chosen for the new
  cadence.
- Worse than a wrong threshold: `refreshedAt` reads as "when this data was gathered". If it
  becomes the build time, a rebuild with no new upstream file would refresh the timestamp
  without refreshing the data — telling the reader it is current when it is not. The honest
  field is the workbook's own `latestThrough`, which the pipeline already parses per region
  (`DiscoveredWorkbook.latestThrough`) and reduces via `commonCutoff`. Surface **that**, not
  the build time.

Acceptance criteria:

- The reader can see how old the underlying ACLED data is, sourced from the workbook date and
  not from the build clock.
- A deploy that fetched nothing new does not present itself as fresh.
- The redeploy cadence is written down somewhere, and is no faster than ACLED publishes.
- Credentials never land in the repo (it is public).
