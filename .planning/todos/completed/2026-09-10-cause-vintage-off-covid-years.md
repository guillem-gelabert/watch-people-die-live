---
created: 2026-09-10T12:30:00.000Z
title: Move the cause table off the pandemic years
area: data
resolved: >-
  2026-09-10 — shipped in `be91179` and deployed, verified live at watchpeopledie.live: release
  2021, reference year 2019, 87 causes, no covid-19. Captured and closed the same afternoon, out
  of a question about whether the cause data excluded covid years. It did not.
decisions:
  - >-
    2019, the last pre-pandemic reference year the release carries — not an older GHE *release*.
    WHO's xMart GHE_FULL endpoint is one release (the 2021 vintage) serving a back-series of every
    reference year from 2000 to 2021, so reading 2019 out of it keeps the current modelling and
    drops only the pandemic. The GHE 2019 release exists and uses superseded methods; it is not
    what this is.
  - >-
    Release and reference year became two fields. One number cannot honestly stand for both, and
    "WHO Global Health Estimates 2019" would have named that other release. The output now carries
    `release: 2021` and `year: 2019`, the citation says "Reference year 2019", and the story's
    prose states both in all three languages — with storyTranslations.test.ts requiring both, which
    extends a forcing function that already existed for exactly this failure.
  - >-
    The argument that settled it was consistency, not that 2021 was wrong. The rest of the model
    already drops pandemic years: pipeline/seasonal_composition.py has COVID_YEARS = [2020, 2021,
    2022] and a test named test_country_curve_records_drops_covid_years. The cause table was the
    one layer that did not follow the rule the project had already written down.
  - >-
    resolveSource() stopped taking whichever filename sorts highest. That heuristic reads as "use
    the newest data" and was silently the wrong rule from the moment the project chose an older
    year deliberately — ghe-2021-deaths.csv is still on disk and would have won every rebuild,
    reverting the change with no error. The year is now named once in REFERENCE_YEAR, the fetcher
    imports it rather than repeating it, and --src still overrides for a deliberate one-off.
  - >-
    The vocabulary is data-driven and moved on its own. causes.json ships only the strongest eight
    causes per country, sex and band, so which labels appear is a property of the year: 90 labels
    became 87. Out went covid-19, appendicitis, inflammatory bowel disease, otitis media and
    thyroid cancer; in came multiple sclerosis and other nutritional deficiencies.
  - >-
    seasonal-composition.json was regenerated rather than left stale, and the rebuild turned out to
    be metadata-only — every measured curve is byte-identical, because it builds from the cached
    sources and is deterministic. Only its coverage claim moved: vocabulary 90 to 87, withCurve 56
    to 55, flat 34 to 32. Coverage as a fraction improved slightly, 62.2% to 63.2%.
test_finding: >-
  A green TypeScript suite said nothing about the Python build. Dropping thyroid cancer from the
  vocabulary left `C73` stranded in the Eurostat ICD map, and seasonal_composition.build() raises
  when chapter_of_cause_label() is not a subset of causes.json — so `python -m pipeline
  seasonal-composition` was broken while all 337 vitest tests passed. Nothing in the repo runs both
  suites over one change; the break was found by hand, by asking what else reads the vocabulary.
  The two-language build is a seam that tests do not cross.
files:
  - data/causes.json
  - data/seasonal-composition.json
  - scripts/build-causes.ts
  - scripts/fetch-who-ghe.ts
  - pipeline/sources/eurostat.py
  - lib/i18n/ca.causes.ts
  - lib/i18n/de.causes.ts
  - lib/i18n/causes.test.ts
  - app/roadmap/storyTranslations.test.ts
  - docs/ROADMAP.md
  - docs/ROADMAP.ca.md
  - docs/ROADMAP.de.md
---

## Problem

The cause table was WHO GHE at reference year **2021**, the peak pandemic year, and `covid-19` was
one of its 90 labels. Nothing filtered it. Measured share of male cause weight:

| | 30–49 | 50–64 | 65–74 | 85+ |
| --- | --- | --- | --- | --- |
| India | 29.7% | 28.7% | 31.7% | 35.2% |
| Brazil | 29.8% | 31.1% | 27.3% | 18.0% |
| USA | 13.1% | 16.0% | 14.5% | 10.3% |
| Spain | 5.8% | 8.2% | 11.0% | 10.1% |
| Japan, China | 0% | 0% | 0% | 0% |

So roughly a third of mid-life deaths in India and Brazil were drawn as covid, none in Japan or
China, and the feed presented that as a standing fact about how people die — in a present-tense
visualisation with no year on the screen.

It also broke a rule the project had already written down and tested. `COVID_YEARS = [2020, 2021,
2022]` is dropped from every measured seasonality curve. The cause table was the exception, and
nobody had noticed because the two layers are built by different toolchains.

## Solution

`fetch-who-ghe.ts --year=2019`, then rebuild. One flag, because the endpoint was already
year-parameterised — the work was everything around it: splitting release from reference year so
the citation stays true, making the source resolution explicit so the old file cannot win a
rebuild, moving the ca/de dictionaries with the vocabulary, and taking `C73` out of the ICD map.

Also worth recording: `other covid-19 pandemic-related outcomes` was already folded into `other
causes` by the builder, so pandemic *excess* mortality beyond the disease was in the residual
before this change and still is. Moving to 2019 removes the labelled disease; it does not claim to
remove every pandemic effect from the numbers.

## What this did not fix

The cause layer is now internally consistent with the seasonality layer and inconsistent with
everything else in a new way — see `2026-09-10-mixed-vintages-unstated.md`. The model spans 2015
to 2024 across six layers, and today's change moved one of them further from the others on purpose.
