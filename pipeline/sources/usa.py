"""United States -- CDC NVSS weekly all-cause deaths by jurisdiction (states + DC).

NYC is folded into New York; jurisdictions outside the 50 states + DC (the national
"United States" total, Puerto Rico) never match `US_NAME2ISO` and are dropped.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from ..cache import verify_manual
from ..contract import Source

SOURCE = Source(
    key="usa",
    country_iso3="USA",
    geo="adm1",
    cadence="week",
    retrieval_mode="manual",
    measurement="crvs",
    urls=("https://data.cdc.gov/NCHS/Weekly-Counts-of-Deaths-by-Jurisdiction-and-Cause-/u6jv-9ijr",),
    license="CDC NVSS public domain",
    expected_regions=51,
    min_annual=500,
    notes=(
        "United States: CDC NVSS weekly all-cause deaths by jurisdiction, 2014-2025 -> "
        "Natural Earth admin-1 (states + DC)"
    ),
)

US_NAME2ISO = {
    "Alabama": "US-AL", "Alaska": "US-AK", "Arizona": "US-AZ", "Arkansas": "US-AR",
    "California": "US-CA", "Colorado": "US-CO", "Connecticut": "US-CT", "Delaware": "US-DE",
    "District of Columbia": "US-DC", "Florida": "US-FL", "Georgia": "US-GA", "Hawaii": "US-HI",
    "Idaho": "US-ID", "Illinois": "US-IL", "Indiana": "US-IN", "Iowa": "US-IA", "Kansas": "US-KS",
    "Kentucky": "US-KY", "Louisiana": "US-LA", "Maine": "US-ME", "Maryland": "US-MD",
    "Massachusetts": "US-MA", "Michigan": "US-MI", "Minnesota": "US-MN", "Mississippi": "US-MS",
    "Missouri": "US-MO", "Montana": "US-MT", "Nebraska": "US-NE", "Nevada": "US-NV",
    "New Hampshire": "US-NH", "New Jersey": "US-NJ", "New Mexico": "US-NM", "New York": "US-NY",
    "North Carolina": "US-NC", "North Dakota": "US-ND", "Ohio": "US-OH", "Oklahoma": "US-OK",
    "Oregon": "US-OR", "Pennsylvania": "US-PA", "Rhode Island": "US-RI",
    "South Carolina": "US-SC", "South Dakota": "US-SD", "Tennessee": "US-TN", "Texas": "US-TX",
    "Utah": "US-UT", "Vermont": "US-VT", "Virginia": "US-VA", "Washington": "US-WA",
    "West Virginia": "US-WV", "Wisconsin": "US-WI", "Wyoming": "US-WY",
}

_FILES = (
    ("us-cdc-weekly-jurisdiction-cause-2014-2019.csv", "allcause"),
    ("us-cdc-weekly-jurisdiction-cause-2020on.csv", "all_cause"),
)


def fetch(cache_dir: Path) -> list:
    return verify_manual(
        cache_dir,
        [name for name, _ in _FILES],
        url=SOURCE.urls[0],
        instructions=(
            "Download CDC NVSS 'Weekly Counts of Deaths by Jurisdiction and Cause of Death' "
            f"(both the 2014-2019 and 2020-present exports) from data.cdc.gov into {cache_dir}."
        ),
    )


def load(cache_dir: Path) -> list[dict]:
    frames = []
    for name, deaths_col in _FILES:
        df = pd.read_csv(
            cache_dir / name,
            usecols=["jurisdiction_of_occurrence", "mmwryear", "mmwrweek", deaths_col],
        ).rename(columns={
            deaths_col: "deaths",
            "mmwryear": "year",
            "mmwrweek": "period",
            "jurisdiction_of_occurrence": "juris",
        })
        frames.append(df)
    us = pd.concat(frames, ignore_index=True)
    us["year"] = pd.to_numeric(us.year, errors="coerce")
    us["period"] = pd.to_numeric(us.period, errors="coerce")
    us["deaths"] = pd.to_numeric(us.deaths, errors="coerce").fillna(0)
    us = us.dropna(subset=["year", "period"])
    us["year"] = us.year.astype(int)
    us["period"] = us.period.astype(int)
    us["juris"] = us.juris.replace({"New York City": "New York"})

    rows: list[dict] = []
    for juris, sub in us.groupby("juris"):
        iso = US_NAME2ISO.get(juris)
        if not iso:
            continue
        grp = sub.groupby(["year", "period"], as_index=False)["deaths"].sum()
        for r in grp.itertuples():
            rows.append({
                "country": "USA", "geo": "adm1", "iso_region": iso, "region_key": None,
                "region_name": juris, "year": int(r.year), "period": int(r.period),
                "period_type": "week", "deaths": float(r.deaths),
            })
    return rows
