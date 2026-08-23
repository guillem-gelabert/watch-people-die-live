"""Canada -- Statistics Canada table 13-10-0768-01 "Provisional weekly death counts, by
age group and sex", weekly deaths by province/territory since 2010-01-09. Fetched via the
WDS (Web Data Service) full-table-download broker, which resolves to a temporary ZIP URL.
"""

from __future__ import annotations

import io
import math
import zipfile
from pathlib import Path

import pandas as pd
import requests

from ..cache import sha256_of, today
from ..contract import AgeSexRow, FetchedFile, Source

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

# StatCan 13-10-0768 publishes exactly these four age groups and nothing finer, so they are the
# bands this source can speak to. They do not line up with the project's nine -- 0-44 spans four
# of them -- which is why AgeSexRow carries a per-source `bands` array instead of assuming one
# shared set: a consumer rolls its own estimate up to these, not the reverse.
BANDS: tuple[tuple[int, int], ...] = ((0, 44), (45, 64), (65, 84), (85, 200))

_AGE_BAND = {
    "Age at time of death, 0 to 44 years": 0,
    "Age at time of death, 45 to 64 years": 1,
    "Age at time of death, 65 to 84 years": 2,
    "Age at time of death, 85 years and over": 3,
}

_SEX = {"Males": "m", "Females": "f"}

_ALL_AGES = "Age at time of death, all ages"


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


def _read(cache_dir: Path) -> pd.DataFrame:
    """The whole table, with the age and sex columns that load() used to throw away."""
    df = pd.read_csv(
        _file(cache_dir),
        usecols=["REF_DATE", "GEO", "Age at time of death", "Sex", "Characteristics", "VALUE"],
    )
    df = df[df["Characteristics"] == "Number of deaths"]
    df["province"] = df["GEO"].str.replace(", place of occurrence", "", regex=False).str.strip()
    df = df[df["province"] != "Canada"]
    df["deaths"] = pd.to_numeric(df["VALUE"], errors="coerce").fillna(0)
    return df


def load(cache_dir: Path) -> list[dict]:
    df = _read(cache_dir)
    df = df[(df["Age at time of death"] == _ALL_AGES) & (df["Sex"] == "Both sexes")]
    df["date"] = pd.to_datetime(df["REF_DATE"])
    df["year"] = df["date"].dt.isocalendar().year.astype(int)
    df["period"] = df["date"].dt.isocalendar().week.astype(int)

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


def load_age_sex(cache_dir: Path) -> tuple[list[AgeSexRow], list[str]]:
    """Deaths by province x age band x sex, and the provinces that had to be skipped.

    The same file load() reads; it filtered these rows out at parse time. StatCan suppresses
    small weekly cells, and it suppresses them independently per age x sex combination, so the
    banded rows and the all-ages row do not cover the same weeks -- Northwest Territories' all-ages
    column sums to 3,625 while its banded cells sum to 1,885, purely because more of its banded
    weeks are blank. Summing whatever is present would therefore bias the age shares towards
    whichever cells happen to be published.

    So both sides are restricted to *complete* province-weeks: weeks where the all-ages control and
    all eight banded cells are present. Shares are then internally consistent, and a province
    without enough complete weeks is skipped and named rather than silently half-counted.
    """
    df = _read(cache_dir)
    df["week"] = df["REF_DATE"]
    df["value"] = pd.to_numeric(df["VALUE"], errors="coerce")

    banded = df[df["Age at time of death"].isin(_AGE_BAND) & df["Sex"].isin(_SEX)]
    control = df[(df["Age at time of death"] == _ALL_AGES) & (df["Sex"] == "Both sexes")]

    rows: list[AgeSexRow] = []
    skipped: list[str] = []
    cells_per_week = len(_AGE_BAND) * len(_SEX)

    for province, sub in banded.groupby("province"):
        iso = CA_NAME2ISO.get(str(province))
        if not iso:
            continue
        present = sub[sub["value"].notna()]
        complete = {
            week
            for week, wk in present.groupby("week")
            if len(wk) == cells_per_week
        }
        ctrl = control[(control["province"] == province) & control["value"].notna()]
        complete &= set(ctrl["week"])
        if len(complete) < 52:
            skipped.append(f"{province} ({len(complete)} complete weeks)")
            continue

        usable = present[present["week"].isin(complete)]
        want = float(ctrl[ctrl["week"].isin(complete)]["value"].sum())
        got = float(usable["value"].sum())
        # StatCan rounds every published cell to the nearest 5, so the two sides cannot match
        # exactly and a flat percentage is the wrong bound: on Northwest Territories, ~4,200
        # rounded cells carry more noise than 0.5% of a 1,880-death total. Allow the rounding
        # instead. A genuine category misread moves the total by a large fraction, which this
        # still catches -- losing half of NWT would be ~900 against a ~160 bound.
        slack = max(0.005 * want, 2.5 * math.sqrt(len(usable)))
        if want > 0 and abs(got - want) > slack:
            raise ValueError(
                f"Canada {province}: over {len(complete)} complete weeks the age x sex cells sum "
                f"to {got:,.0f} but the all-ages total is {want:,.0f} (slack {slack:,.0f}) -- "
                f"StatCan's categories are not what this parser assumes"
            )
        for (age_label, sex_label), cell in usable.groupby(["Age at time of death", "Sex"]):
            rows.append({
                "country": "CAN", "geo": "adm1", "iso_region": iso, "region_key": None,
                "region_name": str(province), "band": _AGE_BAND[str(age_label)],
                "sex": _SEX[str(sex_label)], "deaths": float(cell["value"].sum()),
            })
    return rows, skipped


AGE_SEX_BANDS = BANDS
