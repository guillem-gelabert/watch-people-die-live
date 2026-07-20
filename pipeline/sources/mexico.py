"""Mexico -- annual `registro_defunciones` per-death microdata (Secretaria de Salud, via
datos.gob.mx), 2015-2019. Month/year of occurrence come straight from `MES_OCURR`/`ANIO_OCUR`
-- no date-string parsing needed, unlike Brazil's SIM. Entity of residence (`ENT_RESID`) is
the join key; codes 33+/99 (abroad/not specified) are dropped, matching Brazil's approach of
processing raw per-death rows rather than a national aggregate table.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import requests

from ..cache import sha256_of, today
from ..contract import FetchedFile, Source

BASE_URL = "https://repodatos.atdt.gob.mx/all_data/secretaria_salud/6fecbbb3-afd9-44a1-8665-679a80ce4a15"

SOURCE = Source(
    key="mexico",
    country_iso3="MEX",
    geo="adm1",
    cadence="month",
    retrieval_mode="direct-download",
    measurement="crvs",
    urls=(f"{BASE_URL}/defunciones_registradas_{{year}}.csv",),
    license="Creative Commons Attribution 4.0 International (Secretaria de Salud)",
    expected_regions=32,
    min_annual=500,
    notes=(
        "Mexico: Secretaria de Salud registro_defunciones annual microdata, 2015-2019 -> "
        "Natural Earth admin-1 (32 federal entities; Distrito Federal keyed MX-DIF)"
    ),
)

ENT2ISO = {
    1: "MX-AGU", 2: "MX-BCN", 3: "MX-BCS", 4: "MX-CAM", 5: "MX-COA", 6: "MX-COL",
    7: "MX-CHP", 8: "MX-CHH", 9: "MX-DIF", 10: "MX-DUR", 11: "MX-GUA", 12: "MX-GRO",
    13: "MX-HID", 14: "MX-JAL", 15: "MX-MEX", 16: "MX-MIC", 17: "MX-MOR", 18: "MX-NAY",
    19: "MX-NLE", 20: "MX-OAX", 21: "MX-PUE", 22: "MX-QUE", 23: "MX-ROO", 24: "MX-SLP",
    25: "MX-SIN", 26: "MX-SON", 27: "MX-TAB", 28: "MX-TAM", 29: "MX-TLA", 30: "MX-VER",
    31: "MX-YUC", 32: "MX-ZAC",
}

_YEARS = (2015, 2016, 2017, 2018, 2019)


def _file(cache_dir: Path, year: int) -> Path:
    return cache_dir / f"mexico-defunciones-{year}.csv"


def fetch(cache_dir: Path) -> list[FetchedFile]:
    files = []
    for year in _YEARS:
        url = f"{BASE_URL}/defunciones_registradas_{year}.csv"
        response = requests.get(url, timeout=300)
        response.raise_for_status()
        _file(cache_dir, year).write_bytes(response.content)

        files.append(
            FetchedFile(
                path=_file(cache_dir, year), url=url,
                sha256=sha256_of(_file(cache_dir, year)), retrieved=today(),
            )
        )
    return files


def load(cache_dir: Path) -> list[dict]:
    parts = []
    for year in _YEARS:
        d = pd.read_csv(
            _file(cache_dir, year),
            usecols=["ENT_RESID", "MES_OCURR", "ANIO_OCUR"],
        )
        parts.append(d)
    mx = pd.concat(parts, ignore_index=True)
    mx["month"] = pd.to_numeric(mx["MES_OCURR"], errors="coerce")
    mx["year"] = pd.to_numeric(mx["ANIO_OCUR"], errors="coerce")
    mx["ent"] = pd.to_numeric(mx["ENT_RESID"], errors="coerce")
    # Each file is keyed by year of *registration* but holds deaths by year of *occurrence*, so
    # occurrence years outside the file range appear only as a thin, biased late-registration tail
    # (e.g. ~900 of ~28k real deaths for occurrence-year 2014). country_curve counts any year with
    # all 12 months present as "complete" and weights it equally, so those tails inflate amplitude
    # several-fold. Keep only the fully-observed occurrence years that match the downloaded files.
    mx = mx[
        mx["month"].between(1, 12)
        & mx["ent"].isin(ENT2ISO)
        & mx["year"].between(_YEARS[0], _YEARS[-1])
    ]
    mx["year"] = mx["year"].astype(int)
    mx["month"] = mx["month"].astype(int)
    mx["ent"] = mx["ent"].astype(int)

    rows: list[dict] = []
    for ent, iso in ENT2ISO.items():
        sub = mx[mx["ent"] == ent]
        if not len(sub):
            continue
        counts = sub.groupby(["year", "month"]).size()
        for (year, month), deaths in counts.items():
            rows.append({
                "country": "MEX", "geo": "adm1", "iso_region": iso, "region_key": None,
                "region_name": iso, "year": int(year), "period": int(month),
                "period_type": "month", "deaths": float(deaths),
            })
    return rows
