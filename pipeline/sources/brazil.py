"""Brazil -- DATASUS SIM (Sistema de Informacao sobre Mortalidade) daily deaths by
state, 2015-2019. Tropical/near-equatorial, so most states are expected to be near-flat;
only the three southern states (RS/SC/PR) sit far enough from the equator to show a real
winter/summer swing.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from ..cache import verify_manual
from ..contract import Source

SOURCE = Source(
    key="brazil",
    country_iso3="BRA",
    geo="adm1",
    cadence="month",
    retrieval_mode="manual",
    measurement="crvs",
    urls=("https://opendatasus.saude.gov.br/dataset/sim-1996-a-2019",),
    license="DATASUS open data",
    expected_regions=27,
    min_annual=500,
    notes=(
        "Brazil: DATASUS SIM daily deaths by state, 2015-2019 -> Natural Earth admin-1 (27 "
        "states + DF). Tropical/near-equatorial: expect near-flat curves outside RS/SC/PR."
    ),
)

BR_UF2ISO = {
    "11": "BR-RO", "12": "BR-AC", "13": "BR-AM", "14": "BR-RR", "15": "BR-PA", "16": "BR-AP",
    "17": "BR-TO", "21": "BR-MA", "22": "BR-PI", "23": "BR-CE", "24": "BR-RN", "25": "BR-PB",
    "26": "BR-PE", "27": "BR-AL", "28": "BR-SE", "29": "BR-BA", "31": "BR-MG", "32": "BR-ES",
    "33": "BR-RJ", "35": "BR-SP", "41": "BR-PR", "42": "BR-SC", "43": "BR-RS", "50": "BR-MS",
    "51": "BR-MT", "52": "BR-GO", "53": "BR-DF",
}

_YEARS = (2015, 2016, 2017, 2018, 2019)


def _file(cache_dir: Path, year: int) -> Path:
    return cache_dir / f"brazil-sim-mortalidade-geral-{year}.csv"


def fetch(cache_dir: Path) -> list:
    return verify_manual(
        cache_dir,
        [f"brazil-sim-mortalidade-geral-{year}.csv" for year in _YEARS],
        url=SOURCE.urls[0],
        instructions=(
            "Download DATASUS SIM 'Mortalidade Geral' microdata for each year 2015-2019 from "
            f"opendatasus.saude.gov.br into {cache_dir}."
        ),
    )


def load(cache_dir: Path) -> list[dict]:
    parts = []
    for year in _YEARS:
        d = pd.read_csv(
            _file(cache_dir, year), sep=";", encoding="latin-1",
            usecols=["DTOBITO", "CODMUNRES"], dtype=str,
        )
        d["year"] = year
        parts.append(d)
    br = pd.concat(parts, ignore_index=True)
    br["dtobito"] = br.DTOBITO.str.strip()
    br = br[br.dtobito.str.fullmatch(r"\d{8}", na=False)]
    br["period"] = br.dtobito.str[2:4].astype(int)  # DTOBITO is ddmmyyyy
    br["uf"] = br.CODMUNRES.str.strip().str[:2]

    rows: list[dict] = []
    for uf, iso in BR_UF2ISO.items():
        sub = br[br.uf == uf]
        if not len(sub):
            continue
        counts = sub.groupby(["year", "period"]).size()
        for (year, period), deaths in counts.items():
            rows.append({
                "country": "BRA", "geo": "adm1", "iso_region": iso, "region_key": None,
                "region_name": iso, "year": int(year), "period": int(period),
                "period_type": "month", "deaths": float(deaths),
            })
    return rows
