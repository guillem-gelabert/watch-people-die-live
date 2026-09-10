---
created: 2026-09-10T15:30:00.000Z
title: Subnational cause of death — IHME request sent, depth-2 fallback ready to run
area: data
prio: medium
blocked_by: awaiting IHME response to a bulk-data request sent 2026-09-10
files:
  - scripts/gbd-cause-permalinks.ts
  - .planning/phases/04-persona-realism-ladder/gbd-export-spec.md
---

## Problem

Cause of death is the last layer still national-only. Every death drawn inside a country shares one
cause distribution, while age and sex already resolve to 474 subnational regions through
`data/subnational-age-sex.json`. The derivation card makes the asymmetry visible: it labels the
pyramid "regional pyramid" and then lists causes that are the same for the whole country.

GBD is the only source with subnational cause detail, and the full cube does not fit through the
public tool. At 309 most-detailed causes it is ~9.8M rows against a **row budget per release that
never refills** — see the 2026-09-10 amendment in `gbd-export-spec.md`, which corrects the earlier
belief that the limit was a daily or weekly rate. Chunking does not evade it.

## Where this stands

**A bulk-data request was sent to IHME on 2026-09-10** via `myrequests.healthdata.org/request/`,
the route the `CAP_EXCEEDED` message itself names. It asks for Deaths / Number / 2023 / male+female
/ the 22 disjoint age groups / 204 countries plus 519 subnational units / most-detailed causes, and
states the non-commercial academic purpose and the derived-weights-only handling the age/sex
extract already follows. The submitted text is kept out of the repo; its substance is the table
above.

No reply yet. Nothing in the repo depended on this before now, which is why it is captured here —
the only prior record that this layer was blocked on IHME was a conversation.

## The fallback, which does not wait on them

`scripts/gbd-cause-permalinks.ts` builds and verifies the depth-2 export: GBD's 22 chapter-level
groups instead of 309 specific causes, over the same proven geometry.

```
node --import tsx scripts/gbd-cause-permalinks.ts            # plan, no network writes
node --import tsx scripts/gbd-cause-permalinks.ts --create   # store the queries, print URLs
node --import tsx scripts/gbd-cause-permalinks.ts --check    # validate the downloaded CSVs
```

Measured by the planner against the live endpoints on 2026-09-10: 723 locations x 22 ages x 2 sexes
= **31,812 rows per cause**, 3 causes per download (95,436 of the 100,000 cap), **8 downloads**,
**699,864 rows total**. Note 8, not the 7 a naive 0.70M / 100k suggests — 22 causes do not pack
evenly into chunks of 3.

The script takes every parameter except `cause` from the permalink that actually delivered the
age/sex export, so the 723 location ids and `version: 8016` are observed facts rather than literals
that can rot, and it round-trips each stored query through `get_permalink_settings.php` before a
human spends a download on it. Neither endpoint needs a token or spends quota.

**Not yet run with `--create`.** That is the decision point: it stores 8 queries on IHME's server,
and then someone signs in and presses Download 8 times, spending ~700k rows of the release
allowance. Worth doing before IHME answers only if the chapter-level layer is wanted on its own
terms — if they grant the full cube, this data is superseded rather than built upon.

## What a depth-2 export would actually be

Not a replacement for `data/causes.json`. Twenty-two groups like "Cardiovascular diseases" cannot
carry 87 specific WHO labels, and swapping the vocabulary would take out the ca/de dictionaries,
`causes.test.ts` and the ICD chapter map with it.

It is a **reweighting layer**: keep the national WHO labels and shift weight between chapters per
region, exactly the shape `pipeline/seasonal_composition.py` already applies for the month. That
machinery existing is the reason the coarse export is usable at all, and it is also the design work
this todo has not done — where the regional multiplier composes with the seasonal one, and what
happens to the 32 labels that reach no chapter today.

## Open questions

- Run `--create` now, or wait for IHME? Waiting costs nothing but time; running costs ~700k rows of
  an allowance whose size is unknown.
- If both land eventually, does the depth-2 layer stay as a fallback for regions the detailed cube
  misses, or get deleted?
- The reweighting design above, which is a real piece of modelling and not covered here.
