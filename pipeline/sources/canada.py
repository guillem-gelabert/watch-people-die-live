"""Canada -- Statistics Canada table 13-10-0768-01 "Provisional weekly death counts, by
age group and sex", weekly deaths by province/territory since 2010-01-09. Fetched via the
WDS (Web Data Service) full-table-download broker, which resolves to a temporary ZIP URL.
"""

from __future__ import annotations

import io
import zipfile
from pathlib import Path

import pandas as pd
import requests

from ..cache import sha256_of, today
from ..contract import FetchedFile, Source

SOURCE = Source(
    key="canada",
    country_iso3="CAN",
    geo="adm1",
    cadence="week",
    retrieval_mode="api",
    measurement="crvs",
    urls=("https://www150.statcan.gc.ca/t1/wds/rest/getFullTableDownloadCSV/13100768/en",),
    license="Statistics Canada Open Government Licence",
    expected_regions=10,
    min_annual=500,
    notes=(
        "Canada: Statistics Canada table 13-10-0768-01, weekly deaths by province/territory, "
        "2010-present -> Natural Earth admin-1 (10 provinces; Yukon, Northwest Territories and "
        "Nunavut fall below the 500 annual-deaths quality bar)"
    ),
)

CA_NAME2ISO = {
    "Newfoundland and Labrador": "CA-NL", "Prince Edward Island": "CA-PE", "Nova Scotia": "CA-NS",
    "New Brunswick": "CA-NB", "Quebec": "CA-QC", "Ontario": "CA-ON", "Manitoba": "CA-MB",
    "Saskatchewan": "CA-SK", "Alberta": "CA-AB", "British Columbia": "CA-BC", "Yukon": "CA-YT",
    "Northwest Territories": "CA-NT", "Nunavut": "CA-NU",
}

_FILE = "canada-13100768.csv"


def _file(cache_dir: Path) -> Path:
    return cache_dir / _FILE


def fetch(cache_dir: Path) -> list[FetchedFile]:
    broker = requests.get(SOURCE.urls[0], timeout=120)
    broker.raise_for_status()
    zip_url = broker.json()["object"]

    zip_response = requests.get(zip_url, timeout=120)
    zip_response.raise_for_status()
    with zipfile.ZipFile(io.BytesIO(zip_response.content)) as zf:
        with zf.open("13100768.csv") as member:
            _file(cache_dir).write_bytes(member.read())

    return [
        FetchedFile(path=_file(cache_dir), url=zip_url, sha256=sha256_of(_file(cache_dir)), retrieved=today())
    ]


def load(cache_dir: Path) -> list[dict]:
    df = pd.read_csv(
        _file(cache_dir),
        usecols=["REF_DATE", "GEO", "Age at time of death", "Sex", "Characteristics", "VALUE"],
    )
    df = df[
        (df["Age at time of death"] == "Age at time of death, all ages")
        & (df["Sex"] == "Both sexes")
        & (df["Characteristics"] == "Number of deaths")
    ]
    df["province"] = df["GEO"].str.replace(", place of occurrence", "", regex=False).str.strip()
    df = df[df["province"] != "Canada"]
    df["date"] = pd.to_datetime(df["REF_DATE"])
    df["year"] = df["date"].dt.isocalendar().year.astype(int)
    df["period"] = df["date"].dt.isocalendar().week.astype(int)
    df["deaths"] = pd.to_numeric(df["VALUE"], errors="coerce").fillna(0)

    rows: list[dict] = []
    for province, sub in df.groupby("province"):
        iso = CA_NAME2ISO.get(province)
        if not iso:
            continue
        for r in sub.itertuples():
            rows.append({
                "country": "CAN", "geo": "adm1", "iso_region": iso, "region_key": None,
                "region_name": province, "year": int(r.year), "period": int(r.period),
                "period_type": "week", "deaths": float(r.deaths),
            })
    return rows
