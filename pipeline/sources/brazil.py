"""Brazil -- DATASUS SIM (Sistema de Informacao sobre Mortalidade) daily deaths by
state, 2015-2019. Tropical/near-equatorial, so most states are expected to be near-flat;
only the three southern states (RS/SC/PR) sit far enough from the equator to show a real
winter/summer swing.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from ..cache import verify_manual
from ..age_bands import BANDS as _PROJECT_BANDS
from ..age_bands import band_of, icd_chapter
from ..contract import AgeSexRow, Source

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


def _read(cache_dir: Path, extra: tuple[str, ...] = ()) -> pd.DataFrame:
    parts = []
    for year in _YEARS:
        d = pd.read_csv(
            _file(cache_dir, year), sep=";", encoding="latin-1",
            usecols=["DTOBITO", "CODMUNRES", *extra], dtype=str,
        )
        d["year"] = year
        parts.append(d)
    return pd.concat(parts, ignore_index=True)


def load(cache_dir: Path) -> list[dict]:
    br = _read(cache_dir)
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


# SIM codes IDADE as one unit digit plus a two-digit value: 4 = years, 5 = years past 100,
# and 0-3 are minutes/hours/days/months, i.e. all under one year old.
def _age_years(idade: str | float | None) -> int | None:
    if not isinstance(idade, str):
        return None
    v = idade.strip()
    if len(v) != 3 or not v.isdigit():
        return None
    unit, value = v[0], int(v[1:])
    if unit in "0123":
        return 0
    if unit == "4":
        return value
    if unit == "5":
        return 100 + value
    return None


_SEXO = {"1": "m", "2": "f"}


def load_age_sex(cache_dir: Path) -> tuple[list[AgeSexRow], list[str]]:
    """Deaths by state x age band x sex x ICD-10 chapter, from columns load() discards.

    SIM records an exact age and a full ICD-10 code per death, so unlike StatCan this folds
    straight onto the project's nine bands. Cause is reduced to the 21 ICD-10 chapters: the full
    code set is ~1,500 values, which multiplied by 27 states x 9 bands x 2 sexes is a fixture
    nobody would read, while the chapter is enough to cross-check a cause split.
    """
    br = _read(cache_dir, extra=("IDADE", "SEXO", "CAUSABAS"))
    br["uf"] = br.CODMUNRES.str.strip().str[:2]
    br["band"] = br.IDADE.map(_age_years).map(lambda a: band_of(a) if a is not None else None)
    br["sex"] = br.SEXO.str.strip().map(_SEXO)
    br["chapter"] = br.CAUSABAS.map(icd_chapter)

    total = len(br)
    usable = br[br.band.notna() & br.sex.notna()]
    rows: list[AgeSexRow] = []
    for (uf, band, sex, chapter), sub in usable.groupby(
        ["uf", "band", "sex", "chapter"], dropna=False
    ):
        iso = BR_UF2ISO.get(str(uf))
        if not iso:
            continue
        row: AgeSexRow = {
            "country": "BRA", "geo": "adm1", "iso_region": iso, "region_key": None,
            "region_name": iso, "band": int(band), "sex": str(sex), "deaths": float(len(sub)),
        }
        if isinstance(chapter, str):
            row["icd_chapter"] = chapter
        rows.append(row)

    dropped = total - len(usable)
    notes = [f"BRA: {dropped:,} of {total:,} records ({dropped / total:.2%}) lack a usable age or sex"]
    if dropped / total > 0.02:
        raise ValueError(
            f"Brazil: {dropped / total:.1%} of records have no usable age or sex, which is more "
            f"than SIM's known incompleteness -- check the IDADE/SEXO decoding"
        )
    return rows, notes


AGE_SEX_BANDS = _PROJECT_BANDS
