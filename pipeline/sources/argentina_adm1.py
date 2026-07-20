"""Argentina -- DEIS Defunciones Generales Mensuales, monthly deaths by jurisdiccion,
2015-2024 -> Natural Earth admin-1. Only the 11 jurisdictions the national file breaks
out individually; the rest are bucketed as "99.no identificado".
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from ..cache import verify_manual
from ..contract import Source

SOURCE = Source(
    key="argentina_adm1",
    country_iso3="ARG",
    geo="adm1",
    cadence="month",
    retrieval_mode="manual",
    measurement="crvs",
    urls=("https://datos.gob.ar/dataset/salud-defunciones-generales-mensuales",),
    license="Argentina DEIS open reuse",
    expected_regions=11,
    min_annual=500,
    notes=(
        "Argentina: DEIS Defunciones Generales Mensuales, monthly deaths by jurisdiccion, "
        "2015-2024 -> Natural Earth admin-1 (only the 11 jurisdictions the national file "
        "breaks out)"
    ),
)

AR_ID2ISO = {
    2: "AR-C", 6: "AR-B", 10: "AR-K", 14: "AR-X", 18: "AR-W", 22: "AR-H", 26: "AR-U",
    30: "AR-E", 34: "AR-P", 38: "AR-Y", 42: "AR-L", 46: "AR-F", 50: "AR-M", 54: "AR-N",
    58: "AR-Q", 62: "AR-R", 66: "AR-A", 70: "AR-J", 74: "AR-D", 78: "AR-Z", 82: "AR-S",
    86: "AR-G", 90: "AR-T", 94: "AR-V",
}

_FILES = (
    "argentina-def-mensual-2015-2022.csv",
    "argentina-def-mensual-2023.csv",
    "argentina-def-mensual-2024.csv",
)


def fetch(cache_dir: Path) -> list:
    return verify_manual(
        cache_dir,
        list(_FILES),
        url=SOURCE.urls[0],
        instructions=(
            f"Download DEIS 'Defunciones Generales Mensuales' from datos.gob.ar into {cache_dir}."
        ),
    )


def load(cache_dir: Path) -> list[dict]:
    ar = pd.concat(
        [
            pd.read_csv(cache_dir / f, usecols=["jurisdiccion", "anio_def", "mes_def", "cantidad"])
            for f in _FILES
        ],
        ignore_index=True,
    )
    ar["jid"] = ar.jurisdiccion.str.split(".").str[0]
    ar = ar[ar.jid.str.fullmatch(r"\d+", na=False)].copy()
    ar["jid"] = ar.jid.astype(int)
    ar["year"] = pd.to_numeric(ar.anio_def, errors="coerce")
    ar["period"] = pd.to_numeric(ar.mes_def, errors="coerce")
    ar["deaths"] = pd.to_numeric(ar.cantidad, errors="coerce").fillna(0)
    ar = ar.dropna(subset=["year", "period"])
    ar["year"] = ar.year.astype(int)
    ar["period"] = ar.period.astype(int)

    rows: list[dict] = []
    for jid, iso in AR_ID2ISO.items():
        sub = ar[ar.jid == jid]
        if not len(sub):
            continue
        grp = sub.groupby(["year", "period"], as_index=False)["deaths"].sum()
        for r in grp.itertuples():
            rows.append({
                "country": "ARG", "geo": "adm1", "iso_region": iso, "region_key": None,
                "region_name": iso, "year": int(r.year), "period": int(r.period),
                "period_type": "month", "deaths": float(r.deaths),
            })
    return rows
