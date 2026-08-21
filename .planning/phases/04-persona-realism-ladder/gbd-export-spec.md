# GBD export spec — country × age × sex causes (for plan 04-03)

Written during wave 1 (2026-08-21) so the portal requests can run while the rest of phase 04
proceeds. The IHME GBD Results Tool is interactive and quota-limited, so this is wall-clock work,
not effort work: start it now, fold it in whenever the chunks arrive.

Tool: <https://vizhub.healthdata.org/gbd-results/>

**Sign in first.** Verified 2026-08-21: the tool loads and the whole selection panel is usable
anonymously, but the Search button reads "Sign in to search" — both querying and downloading are
gated on a (free) IHME account. No IHME credentials exist in this repo's `.env` (only ACLED's), so
the portal half of this plan cannot be automated; register or sign in at the link above with your
own account. The download landing directory `data/source/gbd-country-age-sex/` already exists.

## What to select

| Field | Value |
| --- | --- |
| Measure | **Deaths** |
| Metric | **Number** |
| Cause | **Level 3** of the cause hierarchy |
| Location | **Countries and territories only** (204) — chunked, see below |
| Age | **The 21 disjoint five-year groups only** (list below) |
| Sex | **Male** and **Female** (not Both) |
| Year | **2023 only** (one year) |

The 21 age groups, exactly this set and nothing else:

```
<1 year   1-4     5-9     10-14   15-19   20-24   25-29   30-34   35-39   40-44   45-49
50-54     55-59   60-64   65-69   70-74   75-79   80-84   85-89   90-94   95+
```

`scripts/build-causes.ts` maps each label onto one of its nine bands by the first number in the
label (`bandsOf`, `build-causes.ts:386`), so this set folds up cleanly: `5-9` and `10-14` both land
in band `[5,14]`, `85-89`/`90-94`/`95+` all land in `[85,200]`, and nothing is counted twice.

## What must NOT be selected, and what each one does if it is

These do not error — they silently corrupt the weights, which is why they are listed:

| Do not select | What happens |
| --- | --- |
| `All ages` | Expands to **all nine bands** — one set of weights repeated across every band. This is exactly the defect 04-01 now guards against, and mixing such rows in makes `coverage.age` report `age_bands` while some cells are smeared. |
| `Under 5` | First number is 5, so the whole 0–4 count lands in band `[5,14]`. |
| `5-14`, `50-69`, `70+` | Resolve to one band each (`[5,14]`, `[50,64]`, `[65,74]`) and double-count against the five-year rows. |
| `Early/Late/Post Neonatal` | All resolve to band 0 alongside `<1 year`, so infancy is counted two or three times. |
| `Global` location | The country loop skips it but the *global* accumulator takes it, so the fallback global cell absorbs the country sum on top of itself. |
| Regions / super-regions | Not countries; `isoOf` fails to resolve them, so they are dropped silently — wasted quota rather than wrong data. |
| More than one year | Rows are summed with no year filter while `year` is written as the **max** seen (`build-causes.ts:174`), so the file would claim 2023 and contain several years. |
| `Both` sexes | Sums on top of Male + Female. |
| `Percent` / `Rate` metric | Non-`Number` rows are skipped (`build-causes.ts:165`) — wasted quota. |
| `Age-standardized` | Rejected by `bandsOf`, also wasted quota. |

Do **not** drop to level 2 to dodge the quota. Level-2 labels read "Woman 78, neoplasms – Spain"
instead of "breast cancer", and specificity is the whole appeal of the feed. Level 3 also keeps the
label vocabulary aligned with the committed 140-label export, which matters because
`lib/i18n/causes.test.ts` fails on any cause label that has no Catalan and German translation.

## Chunking

The row cap is 100,000 per download. Per country, level 3 is

```
21 age groups × 2 sexes × ~140 level-3 causes ≈ 5,880 rows
```

so **17 countries per request, 12 requests** for 204 countries (~1.2M rows total). The tool shows
the row count for a selection before you download — trust that number over this arithmetic, and
drop to 15 countries per chunk if it comes out over.

Chunk however the tool makes easy (alphabetically, or region by region) as long as every country
appears in exactly one chunk. Note the daily/weekly quota: expect this to span several days.

## Where to put the files

Save each download unmodified as CSV into a new directory:

```
data/source/gbd-country-age-sex/
```

Keep the portal's own filenames (`IHME-GBD_2023_DATA-<hash>-1.csv`) — the hash distinguishes the
chunks. The directory is inside gitignored `data/source/`, so nothing large is committed; only the
built `data/causes.json` is.

Note that `resolveSource()` (`build-causes.ts:409`) currently picks a **single** file and does not
recurse into subdirectories. Teaching it to ingest a directory of chunks is part of 04-03, not
something to work around by flattening the files into `data/source/`.

## Checking a chunk before spending more quota

Run this on each download as it lands. It catches every corruption in the table above:

```bash
python3 - "data/source/gbd-country-age-sex/"*.csv <<'PY'
import csv, sys, collections
BAD_AGE = ("all ages", "under 5", "5-14", "50-69", "70+", "neonatal", "age-standardized")
locs, ages, years, rows = set(), collections.Counter(), set(), 0
for path in sys.argv[1:]:
    for r in csv.DictReader(open(path)):
        rows += 1
        locs.add(r["location_name"]); ages[r["age_name"]] += 1; years.add(r["year"])
        assert r["measure_name"] == "Deaths", r["measure_name"]
        assert r["metric_name"] == "Number", r["metric_name"]
        assert r["sex_name"] in ("Male", "Female"), r["sex_name"]
bad = [a for a in ages if any(b in a.lower() for b in BAD_AGE)]
print(f"{rows:,} rows · {len(locs)} locations · {len(ages)} age groups · years {sorted(years)}")
print("REJECT — aggregate age labels:", bad) if bad else print("age labels OK")
print("REJECT — Global present") if "Global" in locs else print("no Global row")
print("REJECT — multiple years") if len(years) > 1 else None
PY
```

When all chunks are in, the union should be **204 locations, 21 age groups, 2 sexes, one year**,
and no location may appear in two chunks. 04-03 turns that into `data/causes.json` and adds the
double-count guard the country accumulator is missing today.
