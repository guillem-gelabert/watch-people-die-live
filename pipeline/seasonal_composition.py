"""Builds data/seasonal-composition.json: a month-conditioned age x band and cause x chapter
reweighting tensor for persona sampling (04-07).

`makePersona()` draws age and cause from a country's *annual* distribution -- a January and a
July death draw byte-identical distributions, even though the timing curve elsewhere in this
pipeline already knows winter concentrates deaths among the old and respiratory/circulatory. This
measures *who* shifts with the month, on top of the existing *when* machinery, from two sources
already cached in this repo:

  * Age: Eurostat's demo_r_mwk2_05 weekly table (04-06's NUTS-2 source), rolled up to country and
    pooled over five non-COVID years. 04-06 pinned this table to YEAR = 2022, which sits inside
    pipeline.curve.COVID_YEARS -- fine for the annual layers it built, wrong for a month-shape
    measurement, so eurostat.py's SEASONAL_YEARS re-pulls the same table for 2015-2019 instead,
    the exact window brazil.py/mexico.py/australia.py already pool. See eurostat.py's own comment
    for why this is a parameter change to an existing fetch, not new machinery.
  * Cause: the Brazilian SIM and Mexican Secretaria de Salud microdata 04-08 already unlocked
    age/sex from. Both carry an exact date and a full ICD-10 code per death -- two columns
    load_age_sex() doesn't read -- so brazil.py/mexico.py each grow one more "second reader beside
    load()", 04-08's own pattern, rather than a new source.

Every curve is fit with pipeline.curve.country_curve_records: the exact pooled order-4 harmonic
regression the main seasonality curve already uses, over the same COVID exclusion. This is
deliberate -- 04-07's task 2 says to reuse the already-LOO-validated donor machinery "instead of
building a second transfer model", and that starts with not building a second *fitting* method
either. A curve here is directly a lib/seasonal-curve.ts HarmonicCurve: {order, coefficients},
mean-1 normalised, so it composes with the same evaluate/blend/shift primitives the timing curve
uses.

Coverage is intentionally partial and disclosed, not padded: age is measured for whichever
Eurostat countries have every one of the 9 project bands above eurostat.age_month_curves()'s
min_annual floor (~30-35 of them); cause is measured for exactly two countries (Brazil, Mexico).
04-07's task 2 (lib/spatial-seasonality.ts's climate/border donor cascade, reused unmodified from
the browser) is what extends this to the rest of the world -- this module ships the measured
inputs to that cascade, not a guessed global table.
"""

from __future__ import annotations

import json
from pathlib import Path

from .curve import COVID_YEARS
from .sources import brazil, eurostat, mexico

CAUSE_COUNTRIES: tuple[tuple[str, object], ...] = (("BRA", brazil), ("MEX", mexico))

# Every ICD-10 chapter numeral icd_chapter() can emit, so the shipped file always declares the
# same fixed axis regardless of which chapters Brazil/Mexico happen to have enough deaths for.
ALL_CHAPTERS: tuple[str, ...] = (
    "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV",
    "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI",
)
LEAF_GROUPS: tuple[str, ...] = ("drowning", "exposure to forces of nature")

CAUSE_MIN_ANNUAL_CHAPTER = 100.0
CAUSE_MIN_ANNUAL_LEAF = 50.0
AGE_MIN_ANNUAL = 200.0


def _cause_curves_for(cache_dir: Path, module) -> dict:
    from .curve import country_curve_records

    chapter_rows, leaf_rows = module.load_cause_by_month(cache_dir)
    chapters = {}
    for chapter in ALL_CHAPTERS:
        rows = chapter_rows.get(chapter)
        if not rows:
            continue
        result = country_curve_records(rows, min_years=1, min_annual=CAUSE_MIN_ANNUAL_CHAPTER)
        if result:
            chapters[chapter] = result["harmonic"]
    leaf = {}
    for label in LEAF_GROUPS:
        rows = leaf_rows.get(label)
        if not rows:
            continue
        result = country_curve_records(rows, min_years=1, min_annual=CAUSE_MIN_ANNUAL_LEAF)
        if result:
            leaf[label] = result["harmonic"]
    return {"chapters": chapters, "leaf": leaf}


def build(root: Path, cache_dir: Path) -> Path:
    age_countries = eurostat.age_month_curves(root, cache_dir, min_annual=AGE_MIN_ANNUAL)
    cause_countries = {
        iso3: _cause_curves_for(cache_dir, module) for iso3, module in CAUSE_COUNTRIES
    }
    chapter_of_label = eurostat.chapter_of_cause_label()

    vocabulary = set(json.loads((root / "data" / "causes.json").read_text())["causes"])
    stray_labels = sorted(set(chapter_of_label) - vocabulary)
    if stray_labels:
        raise ValueError(
            f"cause labels outside data/causes.json vocabulary: {stray_labels}. "
            "chapter_of_cause_label() must stay a subset of the project's cause vocabulary."
        )
    stray_leaf = sorted(set(LEAF_GROUPS) - vocabulary)
    if stray_leaf:
        raise ValueError(f"leaf cause groups outside data/causes.json vocabulary: {stray_leaf}")

    payload = {
        "meta": {
            "note": (
                "Month-conditioned reweighting of persona age and cause, on top of the existing "
                "timing (when) curves. Each curve is mean-1 normalised across the year, so it "
                "reweights composition without changing the annual total -- multiply a band or "
                "cause's flat weight by evaluateHarmonicCurve(curve, yearPhase) at sample time."
            ),
            "ageYears": list(eurostat.SEASONAL_YEARS),
            "causeYears": [2015, 2016, 2017, 2018, 2019],
            "covidExcluded": sorted(COVID_YEARS),
            "harmonicOrder": 4,
            "ageBands": [list(b) for b in eurostat.BANDS],
            "ageBandNote": (
                "Bands 0 ([0,0]) and 1 ([1,4]) share one measured curve -- demo_r_mwk2_05's "
                "youngest group (Y_LT5) cannot be split further, the same limitation "
                "data/eurostat-regional.json's WEEKLY_BANDS already documents."
            ),
            "causeChapters": list(ALL_CHAPTERS),
            "causeLeafGroups": list(LEAF_GROUPS),
            "causeLeafGroupRanges": {
                "drowning": "ICD-10 W65-W74 (accidental drowning)",
                "exposure to forces of nature": "ICD-10 X30-X39 (X30 = excessive natural heat)",
            },
            "chapterOfCauseLabel": chapter_of_label,
            "ageCountriesMeasured": sorted(age_countries),
            "causeCountriesMeasured": sorted(cause_countries),
            "measurement": {
                "age": "crvs, Eurostat demo_r_mwk2_05 rolled from NUTS-2 to country",
                "cause": "crvs, Brazil DATASUS SIM + Mexico Secretaria de Salud microdata",
            },
            "transfer": (
                "Countries absent from ageCountriesMeasured/causeCountriesMeasured have no curve "
                "here. lib/spatial-seasonality.ts's donor cascade (own-region mean, bordering-"
                "country mean, Koppen climate blend, latitude) transfers coverage to the rest of "
                "the world at runtime -- see lib/seasonal-composition.ts."
            ),
        },
        "age": {"countries": age_countries},
        "cause": {"countries": cause_countries},
    }

    out = root / "data" / "seasonal-composition.json"
    out.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=False) + "\n"
    )
    return out
