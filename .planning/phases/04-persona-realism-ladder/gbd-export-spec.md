# GBD export spec — subnational age/sex deaths (for plan 04-03)

**Rewritten 2026-08-25 around GBD's HTTP API.** The previous version told a human to work the
Results Tool UI. That is no longer the shape: the tool's own endpoints are ordinary HTTP, the
dimension metadata is served with no auth at all, and only the request that *creates* a download
needs a bearer token. The one manual step is minting that token.

The version before that specified a 12-to-16-chunk national **cause** export. That is retired: WHO's
Global Health Estimates supplies the national cause cube keylessly under CC BY (see 04-02), and the
chunked export was never viable at `max_rows_per_download: 100000`. What GBD is still needed for is
the one thing WHO has at no resolution: **subnational**. That is a single query, because dropping the
cause dimension collapses the row count.

## The endpoints

Base: `https://vizhub.healthdata.org/gbd-results/`. Probed 2026-08-25.

| Endpoint | Auth | What it gives |
| --- | --- | --- |
| `php/app_settings.php` | none | `gbd_round: 2023`, `default_gbd_version: 8352`, `max_rows_per_download: 100000` |
| `php/hierarchy/` | none | location and cause trees; 519 subnational units at depth 4–5 |
| `php/metadata/?language=en` | none | ~273 KB — every dimension's ids and names, incl. all 152 age groups |
| `php/download.php` | **Bearer** | POST creates the export, returns a `taskID` |
| `php/get_download_result.php?taskID=` | none | poll for the finished file |
| `php/data.php` | Bearer **+ Turnstile** | the in-tool search / row counter — **do not use** |

Unauthenticated, `POST php/download.php` returns `401 {"error":"Unable to parse authentication
token"}`. A plain client hitting `php/data.php` gets `403` with `cf-mitigated: challenge`, which is
Cloudflare Turnstile on top of the auth — that is why the pre-download row counter is out of reach,
and why the checker below validates the delivered file instead of predicting its size.

Request bodies are `qs`-stringified form data, not JSON. The parameters are singular arrays:
`age`, `cause`, `context`, `measure`, `metric`, `location`, `sex`, `year`, `base`, `version`,
`language`. Capture one real request from DevTools rather than reconstructing it — the
`base`/`context`/`version` triple in particular should be an observed fact.

## What probing settled, and what it did not (2026-08-25)

Findings from driving the endpoint with a real token. These replace guesswork in the plan's task 2:

- **`version` is `8016`, not `8352`.** `app_settings.php` advertises `default_gbd_version: 8352`, but
  the tool's own traffic uses 8016. Read the version off a real task or permalink, never off
  `app_settings.php`.
- **The canonical parameter set, with defaults, is readable for free.** `POST php/permalink.php` is
  unauthenticated and accepts the same params; `GET php/get_permalink_settings.php?bucket_path=…`
  reads them back with every default filled in. That is how the full set below was recovered:
  `version, measure, metric, cause, location, age, sex, year, population_group, api_version,
  base, context, singleOrMult, idsOrNames, rows`. Use it as a free oracle instead of probing
  `download.php`.
- **Bodies are form-urlencoded with indexed keys** (`age[0]=28&age[1]=238`), matching `qs.stringify`.
  A JSON body is not parsed. Repeated bare keys (`age=28&age=238`) reach validation but fail it with
  `Invalid 'measure' parameter: expected a list of measure IDs.`
- **`Origin` and `Referer` headers are required.** Without them a well-formed request returns a bare
  Flask `500`, not a useful error. With them, the same body returns `409 {"message": "Duplicate
  request", "urlForUser": …}` — which is a *success* signal: it means the query was accepted and
  already exists.
- **Unresolved: `download.php` is not reliably drivable headlessly.** After roughly twenty requests
  the same body that had just returned 409 began returning 500 consistently, including the replay of
  a known-good query. That looks like throttling rather than a payload problem — the client code has
  `TOO_MANY_REQUESTS` and `CAP_EXCEEDED` error paths, so an account-level cap is real. Do not brute
  force this; see the permalink route below.

## Preferred route: build a permalink, download it once

Since `permalink.php` is unauthenticated and stores the exact query server-side, the whole selection
can be built and *verified* by script, leaving a human one click:

1. Script POSTs the full query to `php/permalink.php` and gets back a URL.
2. Script GETs `php/get_permalink_settings.php?bucket_path=…` and asserts the stored params — 22 age
   ids, 723 locations, one cause, one year, two sexes, `measure: [1]`, `metric: [1]`.
3. A signed-in human opens the URL and presses Download once.

This keeps the property that made the API attractive: the age and location selection is machine-built
and machine-checked, so the `80+`-typed-`specific` trap and the missing `1-4 years` group cannot bite.
It gives up only the unattended submission.

Verified 2026-08-25 — this permalink round-tripped 22 ages × 723 locations × 2 sexes = 31,812 rows:

```
http://vizhub.healthdata.org/gbd-results?params=gbd-api-2023-permalink/d0073be13a7f988f991b67040b9a27e0
```

## The token

MSAL against Azure AD B2C:

```
authority  https://login.healthdata.org/a07655f6-e482-42f3-8b30-6b7d009f813d/B2C_1A_SIGNUP_SIGNIN
clientId   9e66b6a3-5d2e-400f-b812-f60f441d5041
scope      https://ihmecsu.onmicrosoft.com/data-api/data.read
```

No client-credentials or API-key path is exposed, and the interactive sign-up/sign-in policy is the
only one the app knows. Do not go hunting for a password-grant policy: the account is where IHME's
non-commercial agreement is accepted, so the sign-in *is* the licence acceptance, and scripting
around it would be circumventing the terms rather than automating our own access.

Tokens last roughly an hour. A run must finish inside one; a re-run needs a fresh paste. Keep it in
gitignored `.env` as `GBD_TOKEN`, never in a committed file.

Polling is unauthenticated, so a token that expires mid-export does not lose the download — the
`taskID` is still collectable.

## The one query

| Field | Value |
| --- | --- |
| Measure | **Deaths** |
| Metric | **Number** |
| Cause | **All causes** — one cause only; this is what keeps it to a single request |
| Sex | **Male** and **Female** (not Both) |
| Year | **2023** only |
| Age | the 22 disjoint groups below |
| Location | all **204 countries** *plus* all **519 subnational units** |

Expected size: `723 locations × 22 ages × 2 sexes ≈ 31,800 rows` — comfortably under the 100,000 cap.

## The age set

**The previous spec's list was wrong.** It listed 21 five-year groups beginning `<1 year, 1-4,
5-9, …`. GBD 2023 has no `1-4 years` group at all; below five the disjoint set is `<1 year` +
`12-23 months` + `2-4 years`. That makes 22 groups, not 21. Ids resolved from `php/metadata/` on
2026-08-25:

| id | name | id | name | id | name |
| --- | --- | --- | --- | --- | --- |
| 28 | `<1 year` | 13 | `40-44 years` | 19 | `70-74 years` |
| 238 | `12-23 months` | 14 | `45-49 years` | 20 | `75-79 years` |
| 34 | `2-4 years` | 15 | `50-54 years` | 30 | `80-84 years` |
| 6 | `5-9 years` | 16 | `55-59 years` | 31 | `85-89 years` |
| 7 | `10-14 years` | 17 | `60-64 years` | 32 | `90-94 years` |
| 8 | `15-19 years` | 18 | `65-69 years` | 235 | `95+ years` |
| 9 | `20-24 years` | 11 | `30-34 years` | | |
| 10 | `25-29 years` | 12 | `35-39 years` | | |

Freeze these as a literal id array in `scripts/fetch-gbd-subnational.ts`, with this date in a
comment, and fail loudly if live metadata ever stops carrying one of them.

**GBD's `type` field is useless as a filter, in both directions.** Verified in the metadata:

| id | name | `type` | wanted? |
| --- | --- | --- | --- |
| 28 | `<1 year` | `aggregate` | **yes** |
| 235 | `95+ years` | `aggregate` | **yes** |
| 21 | `80+ years` | `specific` | no |
| 160 | `85+ years` | `specific` | no |
| 37 | `20+ years` | `specific` | no |
| 162 | `10-19 years` | `specific` | no |

Select by the id allowlist. Never by `type`.

## What must NOT be selected

| Do not select | What happens |
| --- | --- |
| `<5 years` (1), `All ages` | Smears one value across several of our nine bands. |
| `5-14` (23), `5-19` (188), `<20` (158), `<70` (420) | Aggregates that double-count against the disjoint rows. |
| `80+` (21), `85+` (160), `20+` (37), `10-19` (162) | Typed `specific`, still aggregates. |
| `<28 days` (42), `0-6 days` (2), `7-27 days` (3), `1-5 months` (388), `6-11 months` (389) | All inside `<1 year` (28); counting infancy two or three times. |
| `Global`, super-regions, regions | Not wanted; `isoOf` cannot resolve them, so they waste rows. |
| `Both` sexes | Sums on top of Male + Female. |
| `Percent` / `Rate` metric | Only `Number` rows are used. |
| More than one year | Rows are summed with no year filter while `year` is written as the max seen. |

## Fold to the project's nine bands

Every one of the 22 groups falls wholly inside one band — nothing straddles a boundary, so the fold
is a lookup, not an apportioning.

| Band | `BANDS` entry | GBD groups |
| --- | --- | --- |
| 0 | `[0, 0]` | `<1 year` |
| 1 | `[1, 4]` | `12-23 months`, `2-4 years` |
| 2 | `[5, 14]` | `5-9`, `10-14` |
| 3 | `[15, 29]` | `15-19`, `20-24`, `25-29` |
| 4 | `[30, 49]` | `30-34`, `35-39`, `40-44`, `45-49` |
| 5 | `[50, 64]` | `50-54`, `55-59`, `60-64` |
| 6 | `[65, 74]` | `65-69`, `70-74` |
| 7 | `[75, 84]` | `75-79`, `80-84` |
| 8 | `[85, 200]` | `85-89`, `90-94`, `95+` |

## Where the file goes

```
data/source/gbd-subnational-age-sex/
```

Inside gitignored `data/source/`, so the raw export is never committed — which also keeps us on the
right side of IHME's agreement, whose §6 forbids providing third parties the ability to download IHME
data sets from our own hosting. Only the derived weight table `data/subnational-age-sex.json` is
committed, and it carries the required attribution:

```
Source: Institute for Health Metrics and Evaluation. Used with permission. All rights reserved.
```

## Which locations to expect

519 subnational units across 17 countries, from the open `php/hierarchy/` endpoint:

| | units | | units | | units |
| --- | --- | --- | --- | --- | --- |
| Philippines | 82 | Mexico | 32 | UK | 13 |
| USA | 51 | Brazil | 32 | Ethiopia | 13 |
| Japan | 47 | Iran | 31 | Norway | 11 |
| Kenya | 47 | India | 31 | South Africa | 9 |
| Nigeria | 37 | Italy | 26 | Pakistan | 7 |
| Indonesia | 34 | Poland | 16 | | |

China and DR Congo have no subnational units in GBD 2023. Provincial China data exists in GBD 2019
research extracts, so if China's absence ever becomes the blocking gap, that is the thread to pull.

## Checking the download before building on it

There is no pre-download row counter on this path, so this is the row count check. Confirm the
delivered column names against the file first — the API result is expected to be the same CSV the UI
serves, but that is worth one look rather than an assumption.

```bash
python3 - "data/source/gbd-subnational-age-sex/"*.csv <<'PY'
import csv, sys, collections
WANT = {"<1 year","12-23 months","2-4 years","5-9 years","10-14 years","15-19 years",
        "20-24 years","25-29 years","30-34 years","35-39 years","40-44 years","45-49 years",
        "50-54 years","55-59 years","60-64 years","65-69 years","70-74 years","75-79 years",
        "80-84 years","85-89 years","90-94 years","95+ years"}
locs, ages, years, sexes, causes, rows = set(), collections.Counter(), set(), set(), set(), 0
for path in sys.argv[1:]:
    for r in csv.DictReader(open(path)):
        rows += 1
        locs.add(r["location_name"]); ages[r["age_name"]] += 1
        years.add(r["year"]); sexes.add(r["sex_name"]); causes.add(r["cause_name"])
        assert r["measure_name"] == "Deaths", r["measure_name"]
        assert r["metric_name"] == "Number", r["metric_name"]
extra, missing = set(ages) - WANT, WANT - set(ages)
print(f"{rows:,} rows · {len(locs)} locations · {len(ages)} ages · {len(causes)} causes · years {sorted(years)} · sexes {sorted(sexes)}")
print("REJECT — age groups outside the allowlist:", sorted(extra)) if extra else print("age labels OK")
print("REJECT — allowlisted age groups absent:", sorted(missing)) if missing else None
print("REJECT — Global present") if "Global" in locs else print("no Global row")
print("REJECT — multiple years") if len(years) > 1 else None
print("REJECT — Both sexes present") if any("both" in s.lower() for s in sexes) else None
print("REJECT — more than one cause") if len(causes) > 1 else None
PY
```

A good download reports ~31,800 rows, ~723 locations, 22 ages, 1 cause, 1 year, 2 sexes.
