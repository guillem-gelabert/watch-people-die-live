"""Argentina, Buenos Aires province -- monthly deaths by partido (finer than admin-1,
roadmap-only), from the provincial Registro de las Personas.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from ..cache import verify_manual
from ..contract import Source

SOURCE = Source(
    key="argentina_partido",
    country_iso3="ARG",
    geo="partido",
    cadence="month",
    retrieval_mode="manual",
    measurement="crvs",
    urls=("https://catalogo.datos.gba.gob.ar/dataset/defunciones-mensuales",),
    license="PBA Registro Provincial open reuse",
    expected_regions=1,
    min_annual=0,
    notes=(
        "Argentina: Buenos Aires province from the Registro Provincial de las Personas "
        "(2018-present), all 135 partidos unified into one province-wide curve (geo='partido', "
        "roadmap-only); partial calendar years are dropped so the current truncated year does "
        "not shift the seasonal peak"
    ),
)

_FILES = (
    ("pba-registro-mensual-defunciones-2018-2019.csv", "cantidad"),
    ("pba-registro-mensual-defunciones-2020-2026.csv", "total"),
)


def fetch(cache_dir: Path) -> list:
    return verify_manual(
        cache_dir,
        [name for name, _ in _FILES],
        url=SOURCE.urls[0],
        instructions=(
            "Download the PBA monthly deaths-by-partido registry from "
            f"catalogo.datos.gba.gob.ar into {cache_dir}."
        ),
    )


def load(cache_dir: Path) -> list[dict]:
    frames = []
    for name, deaths_col in _FILES:
        df = pd.read_csv(
            cache_dir / name,
            usecols=["anio", "mes", "municipio_id", deaths_col],
        ).rename(columns={deaths_col: "deaths"})
        frames.append(df)
    pba = pd.concat(frames, ignore_index=True)
    pba["mid"] = pd.to_numeric(pba.municipio_id, errors="coerce")
    pba["year"] = pd.to_numeric(pba.anio, errors="coerce")
    pba["period"] = pd.to_numeric(pba.mes, errors="coerce")
    pba["deaths"] = pd.to_numeric(pba.deaths, errors="coerce").fillna(0)
    pba = pba.dropna(subset=["mid", "year", "period"])
    pba[["mid", "year", "period"]] = pba[["mid", "year", "period"]].astype(int)

    # Unify all 135 partidos into one Buenos Aires province curve. Per-partido, single-digit
    # monthly counts are Poisson noise; province-wide totals (~130k deaths/year) are robust.
    monthly = pba.groupby(["year", "period"], as_index=False)["deaths"].sum()

    rows: list[dict] = []
    for year, year_data in monthly.groupby("year"):
        months = year_data.set_index("period")["deaths"]
        # Drop partial calendar years. The 2020-present file carries the current year with rows
        # for months that haven't happened yet, so a truncated year technically has 12 months
        # present but its trailing months sit near zero, which would drag the seasonal peak off
        # its true winter position. A full year's lightest month (southern-hemisphere summer) is
        # never close to zero, so require the min month to be a real fraction of the max.
        if len(months) < 12 or months.min() < 0.3 * months.max():
            continue
        for period, deaths in months.items():
            rows.append({
                "country": "ARG", "geo": "partido", "iso_region": None,
                "region_key": "AR-B-partidos", "region_name": "Buenos Aires (partidos)",
                "year": int(year), "period": int(period),
                "period_type": "month", "deaths": float(deaths),
            })
    return rows
