"""Australia -- ABS Data API (SDMX 2.1) dataflow PROV_MORTALITY_WK, "Provisional Mortality
Statistics: Number of deaths by Sex, Age and State of registration, by week of occurrence".
The dataflow is frozen at 2015-2022 (it is an ABS "NonProductionDataflow" snapshot, not
live-updated past that), but 2015-2019 alone gives five complete non-COVID years -- plenty
for a seasonal curve.
"""

from __future__ import annotations

import json
from pathlib import Path

import requests

from ..cache import sha256_of, today
from ..contract import FetchedFile, Source

DATA_URL = (
    "https://data.api.abs.gov.au/rest/data/ABS,PROV_MORTALITY_WK,1.0.0/"
    "1.3.TT.1+2+3+4+5+6+7+8.."
)

SOURCE = Source(
    key="australia",
    country_iso3="AUS",
    geo="adm1",
    cadence="week",
    retrieval_mode="api",
    measurement="crvs",
    urls=(DATA_URL,),
    license="Creative Commons Attribution 4.0 International (ABS)",
    expected_regions=8,
    min_annual=500,
    notes=(
        "Australia: ABS Data API dataflow PROV_MORTALITY_WK, weekly deaths by state/"
        "territory, 2015-2022 -> Natural Earth admin-1"
    ),
)

AU_CODE2ISO = {
    "1": "AU-NSW", "2": "AU-VIC", "3": "AU-QLD", "4": "AU-SA",
    "5": "AU-WA", "6": "AU-TAS", "7": "AU-NT", "8": "AU-ACT",
}

_FILE = "australia-prov-mortality-wk.json"


def _file(cache_dir: Path) -> Path:
    return cache_dir / _FILE


def fetch(cache_dir: Path) -> list[FetchedFile]:
    response = requests.get(
        DATA_URL, timeout=120, headers={"Accept": "application/vnd.sdmx.data+json"}
    )
    response.raise_for_status()
    _file(cache_dir).write_bytes(response.content)

    return [
        FetchedFile(
            path=_file(cache_dir), url=DATA_URL, sha256=sha256_of(_file(cache_dir)), retrieved=today()
        )
    ]


def load(cache_dir: Path) -> list[dict]:
    payload = json.loads(_file(cache_dir).read_text())
    structure = payload["data"]["structures"][0]["dimensions"]
    region_values = next(d["values"] for d in structure["series"] if d["id"] == "REGION")
    week_values = next(d["values"] for d in structure["series"] if d["id"] == "WEEK_OCCUR")
    time_values = next(d["values"] for d in structure["observation"] if d["id"] == "TIME_PERIOD")

    rows: list[dict] = []
    for key, series in payload["data"]["dataSets"][0]["series"].items():
        indexes = [int(x) for x in key.split(":")]
        region_code = region_values[indexes[3]]["id"]
        week_code = week_values[indexes[4]]["id"]
        iso = AU_CODE2ISO.get(region_code)
        if not iso or not week_code.startswith("W"):
            continue
        week = int(week_code[1:])
        for obs_index, obs_value in series["observations"].items():
            year = int(time_values[int(obs_index)]["id"])
            rows.append({
                "country": "AUS", "geo": "adm1", "iso_region": iso, "region_key": None,
                "region_name": iso, "year": year, "period": week,
                "period_type": "week", "deaths": float(obs_value[0]),
            })
    return rows
