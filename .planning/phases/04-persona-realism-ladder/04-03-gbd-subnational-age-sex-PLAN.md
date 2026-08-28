---
phase: 4
plan: 04-03
title: Pull GBD subnational age/sex death weights
type: data
wave: 3
depends_on: []
files_modified:
  - scripts/fetch-gbd-subnational.ts
  - scripts/build-subnational-age-sex.ts
  - data/subnational-age-sex.json
autonomous: false
requirements:
  - PERS-02
  - REAL-01
---

<objective>
Get real age × sex death distributions for 519 admin-1 units across 17 countries — including India,
Nigeria, Indonesia, Pakistan and Ethiopia — from **one** GBD query of roughly 31,800 rows. This is
the whole of what GBD is still needed for: WHO now supplies the national cause cube (04-02), and WHO
has no subnational data at any resolution, while GBD's subnational estimates are the only public
source for the countries the roadmap had written off.

The export is driven by a script against GBD's own HTTP API, not by clicking through the Results
Tool. The one manual step is minting a bearer token.
</objective>

<notes>
**Rewritten 2026-08-25 around the API.** The previous version specified a human working the Results
Tool UI, because `download.php` returns 401 without a sign-in. That 401 is real, but it is the *only*
thing that needs a human: everything else the tool does is an ordinary HTTP call, and the dimension
metadata it selects against is served with no auth at all. Probed directly on 2026-08-25:

| Endpoint | Auth | Notes |
| --- | --- | --- |
| `php/app_settings.php` | none | `gbd_round: 2023`, `default_gbd_version: 8352`, `max_rows_per_download: 100000` |
| `php/hierarchy/` | none | location / cause trees; 519 subnational units at depth 4–5 |
| `php/metadata/?language=en` | none | ~273 KB; every dimension's ids and names, incl. all 152 age groups |
| `php/get_download_result.php?taskID=` | none | 404 `Task not found in S3 (empty)` for an unknown id |
| `php/download.php` | **Bearer** | POST → 401 `{"error":"Unable to parse authentication token"}` |
| `php/data.php` | Bearer **+ Turnstile** | 403 with `cf-mitigated: challenge` from a plain client |

So the shape is: resolve ids from open metadata → `POST php/download.php` with a token → get a
`taskID` → poll `php/get_download_result.php` (no token) → fetch the result. Only the middle step is
gated.

**Deliberately not using `php/data.php`.** That is the in-tool search that drives the pre-download
row counter, and it sits behind Cloudflare Turnstile as well as auth. The row count it would give us
is replaced by the checker in `gbd-export-spec.md`, which validates the delivered file instead of
predicting it. This also retires the old plan's instruction to "trust the tool's own pre-download row
counter" — there is no counter on this path.

**Why a human still mints the token.** Auth is MSAL against Azure AD B2C — authority
`https://login.healthdata.org/a07655f6-e482-42f3-8b30-6b7d009f813d/B2C_1A_SIGNUP_SIGNIN`, client
`9e66b6a3-5d2e-400f-b812-f60f441d5041`, scope `https://ihmecsu.onmicrosoft.com/data-api/data.read`.
There is no client-credentials or API-key path exposed, and the interactive policy is the only one
the app knows. Do not go looking for a password-grant policy: the account is where IHME's
non-commercial agreement is accepted, so the sign-in is the licence acceptance, and routing around it
would be circumventing the terms rather than automating our own access. Tokens are short-lived
(~1 h), so a run has to finish inside one token and a re-run needs a fresh paste.

**The age set in the previous spec was wrong.** It listed 21 five-year groups starting `<1 year,
1-4, 5-9, …`. GBD 2023 has no `1-4 years` group at all. The disjoint set is **22** groups, and below
five it is `<1 year` + `12-23 months` + `2-4 years`. Frozen ids, resolved from open metadata on
2026-08-25:

```
28  <1 year        238 12-23 months   34  2-4 years      6   5-9 years
7   10-14 years    8   15-19 years    9   20-24 years    10  25-29 years
11  30-34 years    12  35-39 years    13  40-44 years    14  45-49 years
15  50-54 years    16  55-59 years    17  60-64 years    18  65-69 years
19  70-74 years    20  75-79 years    30  80-84 years    31  85-89 years
32  90-94 years    235 95+ years
```

`723 locations × 22 ages × 2 sexes ≈ 31,800 rows` — well inside the 100,000 cap.

**GBD's `type` field cannot be used to pick that set, in either direction.** Verified in the
metadata: `<1 year` (28) and `95+ years` (235) are typed `aggregate` and we *want* both, while
`80+` (21), `85+` (160), `20+` (37) and `10-19` (162) are typed `specific` and we want none of them.
The allowlist above is the filter; `type` is noise.

Every one of the 22 groups falls wholly inside one of the project's nine bands — no group straddles a
boundary, so the fold is a lookup with no apportioning.

The geography is already proven in this repo: `data/source/IHME-GBD_2023_DATA-9789faec-1/` holds a
794-location export including Kerala, Punjab, Lagos, Kano, California, Sokoto and Oromia, and
`data/subnational-cdr.json` records its provenance as *"IHME GBD 2023 (all-cause, all-age, both-sex
crude death rate) → Natural Earth 10m Admin-1"*.

Licence: IHME's free non-commercial agreement permits publishing derived results on websites but
forbids providing third parties the ability to download IHME data sets from our own hosting. The
output here is a derived per-region age/sex weight table, not a re-hosted cube, which is the
permitted shape. Carry IHME's required attribution:
`Source: Institute for Health Metrics and Evaluation. Used with permission. All rights reserved.`
</notes>

<tasks>

1. **Mint a token and capture one real request** (the only manual step)
   - type: data
   - files: `.env`
   - action: Sign in once at <https://vizhub.healthdata.org/gbd-results/> with a free IHME account,
     accepting the non-commercial agreement. With DevTools open, run any small query and capture the
     `POST php/download.php` request: copy the `Authorization: Bearer …` value into `.env` as
     `GBD_TOKEN`, and save the request body verbatim to
     `data/source/gbd-subnational-age-sex/captured-request.txt`. The body is `qs`-stringified form
     data whose parameters are singular arrays — `age`, `cause`, `context`, `measure`, `metric`,
     `location`, `sex`, `year`, `base`, `version`, `language` — but capture the real thing rather
     than reconstructing it, so the encoding and the `base`/`context`/`version` triple are observed
     facts and not guesses.
   - verify: `curl` the captured body back with the token and confirm a `taskID` comes back instead
     of a 401.
   - acceptance_criteria:
     - `GBD_TOKEN` is in `.env`, which is gitignored, and never in a committed file.
     - The captured body is saved under gitignored `data/source/`.
     - A replay of the captured request returns a task id.

2. **Fetch script: resolve ids from open metadata, then submit one query**
   - type: implementation
   - files: `scripts/fetch-gbd-subnational.ts`
   - action: Mirror `scripts/fetch-who-ghe.ts` — a documented header, `data/source/` output,
     `--force` to re-fetch. Pull `php/metadata/?language=en` and `php/hierarchy/` unauthenticated to
     resolve the id arrays, take the request skeleton from the captured body, and substitute:
     Measure = Deaths, Metric = Number, Cause = All causes (one cause, which is what keeps this to a
     single request), Sex = Male and Female (not Both), Year = 2023 only, Age = the 22 frozen ids,
     Location = the 204 depth-3 countries plus their 519 subnational children. POST to
     `php/download.php` with `Authorization: Bearer ${GBD_TOKEN}`, then poll
     `php/get_download_result.php?taskID=…` — unauthenticated, so the poll cannot fail on an expired
     token — and write the result under `data/source/gbd-subnational-age-sex/` (gitignored).
   - verify: Run it end to end; then run the checker from `gbd-export-spec.md` on the downloaded file.
   - acceptance_criteria:
     - The 22 age ids are a literal frozen array in the source with the metadata date in a comment;
       the script fails loudly if any id is missing from live metadata rather than silently skipping.
     - Age selection never consults GBD's `type` field.
     - `Global`, super-regions and regions are excluded — only depth-3 countries and their children.
     - One year, one cause, two sexes, metric `Number`.
     - A 401 fails with a message naming `GBD_TOKEN` and its ~1 h lifetime, not a stack trace.
     - The delivered row count is reported and sanity-checked against ~31,800.

3. **Fold to the nine bands, keyed by GBD location id**
   - type: implementation
   - files: `scripts/build-subnational-age-sex.ts`
   - action: Parse the export into `{ m: number[9], f: number[9] }` per location, reusing the same
     nine-band array as `build-causes.ts` and `build-mortality.ts`. Store weights, not counts, so the
     output is a derived distribution rather than a re-publication of IHME's numbers. Record the
     location id, its name and its parent country m49.
   - verify: Assert every location has nine bands for both sexes and that band sums are positive.
   - acceptance_criteria:
     - The GBD-group → band map is exhaustive over the 22 ids and total, not partial; an unmapped age
       name fails the build the way `build-causes.ts` fails on an unknown WHO code.
     - 723 locations present, or each absentee listed with a reason.
     - Output is normalised weights plus the parent country, never raw death counts.

4. **Join to the committed region key space**
   - type: implementation
   - files: `scripts/build-subnational-age-sex.ts`
   - action: Map each GBD subnational unit onto the `{ geo, key }` identity already used by
     `data/subnational-cdr.json` (981 regions, keys like `BRA-1294`) and its `admin1-10m.json` /
     `nuts2-20m.json` layers. Exact-name matching gets 335 of 519 (65%), and it is strongest exactly
     where death share is highest — USA 100%, Japan 98%, Nigeria 95%, India 94%, Mexico 91%, South
     Africa 89%, Brazil 81%, Philippines 78%, Iran 74%. The failures are level mismatches, not naming
     chaos: GBD uses Kenya's 47 counties against Natural Earth's 8 provinces, Italy's regions against
     110 provinces, the UK's 13 against 231. Resolve with a small alias table plus an explicit
     per-country decision to roll up, roll down, or skip.
   - verify: Report matched, aliased and skipped units per country with their share of expected deaths.
   - acceptance_criteria:
     - Every unit is matched, aliased or explicitly skipped — none silently dropped.
     - Skipped countries are listed with the reason and the death share forgone.
     - Keys match `data/subnational-cdr.json`'s key space exactly.

5. **Label estimates as estimates**
   - type: data
   - files: `data/subnational-age-sex.json`
   - action: These are modelled estimates, not observed registrations. Follow the precedent already
     set by `seasonality-subnational.json`, whose India and China rows carry
     `measurement: "climate-modeled"` and are excluded from validation statistics. Record the source,
     GBD round (2023) and version (8352), the required attribution string, and a `measurement` value
     per region.
   - verify: Assert every region row carries a measurement provenance value.
   - acceptance_criteria:
     - Modelled and observed rows are distinguishable by any downstream consumer.
     - IHME's attribution string is present in the output `meta`.
     - Roadmap copy can state plainly that these are estimates.

</tasks>

<verification>

- `pnpm run typecheck && pnpm run lint && pnpm test`
- Checker from `gbd-export-spec.md` passes on the downloaded file.
- Join report: matched / aliased / skipped per country, with death shares.
- Cross-check: rolling the subnational weights up to national should approximate
  `data/mortality-age-sex.json` for the same country.
- Re-running `fetch-gbd-subnational.ts` with a fresh token reproduces the same file, so the export is
  a repeatable artifact rather than a one-off download.

</verification>

<success_criteria>

- 519 subnational units plus 204 countries have age × sex death weights from a single scripted query.
- The manual surface is one sign-in and one pasted token, not a UI session whose correctness depends
  on clicking the right age checkboxes.
- Every unit joins to the committed region key space or is explicitly accounted for.
- Estimates are labelled as estimates and excluded from validation statistics.
- 04-04 can resolve a real regional pyramid for the 17 countries this covers.

</success_criteria>
