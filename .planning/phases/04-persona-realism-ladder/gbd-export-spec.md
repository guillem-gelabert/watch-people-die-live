# GBD export spec — subnational age/sex deaths (for plan 04-03)

Rewritten 2026-08-22. The first version of this file specified a 12-to-16-chunk national **cause**
export. That is retired: WHO's Global Health Estimates supplies the national cause cube keylessly
under CC BY (see 04-02), and the chunked export was never really viable — at
`max_rows_per_download: 100000`, read from the tool's own open `php/app_settings.php`, the full
national cause cube is tens of thousands of requests.

What GBD is still needed for is the one thing WHO has at no resolution: **subnational**. That is a
single download, because dropping the cause dimension collapses the row count.

Tool: <https://vizhub.healthdata.org/gbd-results/> · **Sign-in required.** Every data endpoint
returns `401 {"error":"Unable to parse authentication token"}` without it — verified from inside a
browser that had already cleared Cloudflare, so it is genuine auth, not bot protection. Auth is
Azure AD B2C at `login.healthdata.org`; a free account is enough. No IHME credentials exist in this
repo's `.env`, so this is a human step.

## The one query

| Field | Value |
| --- | --- |
| Measure | **Deaths** |
| Metric | **Number** |
| Cause | **All causes** — one cause only; this is what keeps it to a single request |
| Sex | **Male** and **Female** (not Both) |
| Year | **2023** only |
| Age | the 21 disjoint five-year groups (below) |
| Location | all **204 countries** *plus* all **519 subnational units** |

Expected size: `723 locations × 21 ages × 2 sexes ≈ 30,400 rows` — comfortably under the 100,000 cap.
The tool shows a row count before download; trust it over this arithmetic.

The 21 age groups, exactly this set:

```
<1 year   1-4     5-9     10-14   15-19   20-24   25-29   30-34   35-39   40-44   45-49
50-54     55-59   60-64   65-69   70-74   75-79   80-84   85-89   90-94   95+
```

## What must NOT be selected

| Do not select | What happens |
| --- | --- |
| `All ages` | Expands to all nine of our bands — one value smeared across every band. |
| `Under 5` | First number is 5, so the whole 0–4 count lands in band `[5,14]`. |
| `5-14`, `50-69`, `70+` | Resolve to one band each and double-count against the five-year rows. |
| `10-19`, `20+`, `25+`, `80+`, `85+` | **GBD types these as `"specific"`, alongside genuine five-year bands.** Select by name from the list above; never trust the tool's own typing. |
| `Early/Late/Post Neonatal` | All resolve to band 0 alongside `<1 year`, counting infancy two or three times. |
| `Global`, super-regions, regions | Not wanted here; `isoOf` cannot resolve them, so they waste rows. |
| `Both` sexes | Sums on top of Male + Female. |
| `Percent` / `Rate` metric | Only `Number` rows are used. |
| More than one year | Rows are summed with no year filter while `year` is written as the max seen. |

## Where the file goes

```
data/source/gbd-subnational-age-sex/
```

Inside gitignored `data/source/`, so the raw export is never committed — which also keeps us on the
right side of IHME's agreement, whose §6 forbids providing third parties the ability to download
IHME data sets from our own hosting. Only the derived weight table `data/subnational-age-sex.json`
is committed, and it carries the required attribution:

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

```bash
python3 - "data/source/gbd-subnational-age-sex/"*.csv <<'PY'
import csv, sys, collections
BAD = ("all ages", "under 5", "5-14", "50-69", "70+", "neonatal", "age-standardized",
       "10-19", "20 plus", "25 plus", "80 plus", "85 plus")
locs, ages, years, sexes, causes, rows = set(), collections.Counter(), set(), set(), set(), 0
for path in sys.argv[1:]:
    for r in csv.DictReader(open(path)):
        rows += 1
        locs.add(r["location_name"]); ages[r["age_name"]] += 1
        years.add(r["year"]); sexes.add(r["sex_name"]); causes.add(r["cause_name"])
        assert r["measure_name"] == "Deaths", r["measure_name"]
        assert r["metric_name"] == "Number", r["metric_name"]
bad = [a for a in ages if any(b in a.lower() for b in BAD)]
print(f"{rows:,} rows · {len(locs)} locations · {len(ages)} ages · {len(causes)} causes · years {sorted(years)} · sexes {sorted(sexes)}")
print("REJECT — aggregate age labels:", bad) if bad else print("age labels OK")
print("REJECT — Global present") if "Global" in locs else print("no Global row")
print("REJECT — multiple years") if len(years) > 1 else None
print("REJECT — Both sexes present") if any("both" in s.lower() for s in sexes) else None
print("REJECT — more than one cause") if len(causes) > 1 else None
PY
```

A good download reports ~30,400 rows, ~723 locations, 21 ages, 1 cause, 1 year, 2 sexes.
