"""Russia -- HSE RusSTMF weekly standardized death rate (SDR), both sexes, by region.

Raw files are manual-mode: RusSTMF requires research registration, so `fetch` only
verifies the two cached files exist. A region's raw weekly SDR series is imputed from
its 3 nearest good neighbours (great-circle) when it has zero-rate weeks (registration
gaps) or excessive spike noise, rather than shown as-is or silently dropped.
"""

from __future__ import annotations

import math
import re
import unicodedata
from pathlib import Path

import numpy as np
import pandas as pd

from ..cache import verify_manual
from ..contract import Source

SOURCE = Source(
    key="russia",
    country_iso3="RUS",
    geo="adm1",
    cadence="rate",
    retrieval_mode="manual",
    measurement="rate",
    urls=("https://www.mortality.org/Data/STMF",),
    license="HSE RusSTMF (research use, cite RusSTMF)",
    expected_regions=80,
    notes=(
        "Russia: HSE RusSTMF weekly standardized death rate (SDR), both sexes, 2000-2021 -> "
        "Natural Earth admin-1"
    ),
)

RU_MAX_SPIKE_FRAC = 0.02  # regions with zero-SDR weeks or >2% of weeks above 3x median are bad data

_LAT2CYR = str.maketrans({
    "A": "А", "B": "В", "E": "Е", "K": "К", "M": "М", "H": "Н", "O": "О",
    "P": "Р", "C": "С", "T": "Т", "X": "Х", "Y": "У", "a": "а", "e": "е",
    "k": "к", "m": "м", "o": "о", "p": "р", "c": "с", "t": "т", "x": "х", "y": "у",
})


def ru_norm(s):
    s = unicodedata.normalize("NFKC", str(s)).strip().lower().translate(_LAT2CYR)
    s = re.sub(r"^г\.?\s*", "", s)  # drop city prefix "г."
    s = re.sub(r"[—–]", "-", s)  # normalize dashes
    return re.sub(r"\s+", " ", s)


RU_NAME2ISO = {ru_norm(k): v for k, v in {
    "Белгородская область": "RU-BEL", "Брянская область": "RU-BRY", "Владимирская область": "RU-VLA",
    "Воронежская область": "RU-VOR", "Ивановская область": "RU-IVA", "Калужская область": "RU-KLU",
    "Костромская область": "RU-KOS", "Курская область": "RU-KRS", "Липецкая область": "RU-LIP",
    "Московская область": "RU-MOW", "Орловская область": "RU-ORL", "Рязанская область": "RU-RYA",
    "Смоленская область": "RU-SMO", "Тамбовская область": "RU-TAM", "Тверская область": "RU-TVE",
    "Тульская область": "RU-TUL", "Ярославская область": "RU-YAR", "Москва": "RU-MOS",
    "Республика Карелия": "RU-KR", "Республика Коми": "RU-KO",
    "Архангельская область без автономии": "RU-ARK", "Ненецкий автономный округ": "RU-NEN",
    "Вологодская область": "RU-VLG", "Калининградская область": "RU-KGD",
    "Ленинградская область": "RU-LEN", "Мурманская область": "RU-MUR",
    "Новгородская область": "RU-NGR", "Псковская область": "RU-PSK", "Санкт-Петербург": "RU-SPE",
    "Республика Адыгея": "RU-AD", "Республика Калмыкия": "RU-KL", "Краснодарский край": "RU-KDA",
    "Астраханская область": "RU-AST", "Волгоградская область": "RU-VGG", "Ростовская область": "RU-ROS",
    "Республика Дагестан": "RU-DA", "Республика Ингушетия": "RU-IN",
    "Кабардино-Балкарская Республика": "RU-KB", "Карачаево-Черкесская Республика": "RU-KC",
    "Республика Северная Осетия-Алания": "RU-SE", "Чеченская Республика": "RU-CE",
    "Ставропольский край": "RU-STA", "Республика Башкортостан": "RU-BA", "Республика Марий Эл": "RU-ME",
    "Республика Мордовия": "RU-MO", "Республика Татарстан": "RU-TA", "Удмуртская Республика": "RU-UD",
    "Чувашская Республика": "RU-CU", "Пермский край": "RU-PER", "Кировская область": "RU-KIR",
    "Нижегородская область": "RU-NIZ", "Оренбургская область": "RU-ORE", "Пензенская область": "RU-PNZ",
    "Самарская область": "RU-SAM", "Саратовская область": "RU-SAR", "Ульяновская область": "RU-ULY",
    "Курганская область": "RU-KGN", "Свердловская область": "RU-SVE",
    "Тюменская область без автономий": "RU-TYU", "Ханты-Мансийский автономный округ - Югра": "RU-KHM",
    "Ямало-Ненецкий автономный округ": "RU-YAN", "Челябинская область": "RU-CHE",
    "Республика Алтай": "RU-AL", "Республика Тыва": "RU-TY", "Республика Хакасия": "RU-KK",
    "Алтайский край": "RU-ALT", "Красноярский край": "RU-KYA", "Иркутская область": "RU-IRK",
    "Кемеровская область": "RU-KEM", "Новосибирская область": "RU-NVS", "Омская область": "RU-OMS",
    "Томская область": "RU-TOM", "Республика Бурятия": "RU-BU", "Республика Саха (Якутия)": "RU-SA",
    "Забайкальский край": "RU-ZAB", "Камчатский край": "RU-KAM", "Приморский край": "RU-PRI",
    "Хабаровский край": "RU-KHA", "Амурская область": "RU-AMU", "Магаданская область": "RU-MAG",
    "Сахалинская область": "RU-SAK", "Еврейская автономная область": "RU-YEV",
    "Чукотский автономный округ": "RU-CHU",
}.items()}

# RusSTMF names use plain oblast forms where RU_NAME2ISO carries the Rosstat
# "без автономии"/full forms.
RU_ALIAS = {ru_norm(k): v for k, v in {
    "Архангельская область": "RU-ARK",  # RusSTMF aggregate incl. Nenets AO
    "Ингушская республика": "RU-IN",
    "Тюменская область": "RU-TYU",  # RusSTMF aggregate incl. Khanty-Mansi + Yamalo-Nenets AO
    "Республика Северная Осетия": "RU-SE",
}.items()}

_TERRITORY_CODES = "russia-russtmf-territory-codes.xlsx"
_WEEKLY = "russia-russtmf-weekly.csv"


def fetch(cache_dir: Path) -> list:
    return verify_manual(
        cache_dir,
        [_TERRITORY_CODES, _WEEKLY],
        url="https://www.mortality.org/Data/STMF",
        instructions=(
            "RusSTMF requires research registration at https://www.mortality.org/Data/STMF; "
            f"download the weekly SDR export as {_WEEKLY} and the territory-code lookup as "
            f"{_TERRITORY_CODES}."
        ),
    )


def _popcode2name(codes_path: Path) -> dict[int, str]:
    tc = pd.read_excel(codes_path, header=None)
    return {
        int(tc.iloc[i, 0]): str(tc.iloc[i, 1])
        for i in range(2, tc.shape[0])
        if pd.notna(tc.iloc[i, 0])
        and pd.notna(tc.iloc[i, 1])
        and str(tc.iloc[i, 0]).replace(".0", "").isdigit()
    }


def _weekly(cache_dir: Path) -> pd.DataFrame:
    ru = pd.read_csv(cache_dir / _WEEKLY)
    ru = ru[ru.Sex == "b"].copy()
    ru["year"] = ru.Year.astype(int)
    ru["period"] = ru.Week.astype(int)
    ru["rate"] = pd.to_numeric(ru.SDR, errors="coerce")
    return ru.dropna(subset=["rate"])


def _iso_for_popcode(popcode2name: dict[int, str], popcode) -> str | None:
    name = popcode2name.get(int(popcode))
    key = ru_norm(name) if name else None
    return (RU_NAME2ISO.get(key) or RU_ALIAS.get(key)) if key else None


def bad_regions(cache_dir: Path) -> dict[str, dict]:
    """iso_region -> {zeros, spikeFrac} for RusSTMF series unusable as direct data:
    zero-SDR weeks (registration gaps), or >2% of non-COVID weeks above 3x the median
    (small-population spike noise)."""
    popcode2name = _popcode2name(cache_dir / _TERRITORY_CODES)
    ru = _weekly(cache_dir)

    bad: dict[str, dict] = {}
    for popcode, sub in ru.groupby("PopCode"):
        iso = _iso_for_popcode(popcode2name, popcode)
        if not iso:
            continue
        s = sub.loc[~sub.year.isin([2020, 2021, 2022]), "rate"]  # same non-COVID weeks rate_curve uses
        med = s.median()
        zeros = int((s == 0).sum())
        spike_frac = float((s > 3 * med).mean()) if med and med > 0 else 1.0
        if zeros >= 1 or spike_frac > RU_MAX_SPIKE_FRAC:
            bad[iso] = {"zeros": zeros, "spikeFrac": round(spike_frac, 4)}
    return bad


def load(cache_dir: Path) -> list[dict]:
    popcode2name = _popcode2name(cache_dir / _TERRITORY_CODES)
    ru = _weekly(cache_dir)
    bad = bad_regions(cache_dir)  # excluded here; imputed separately via impute()

    rows: list[dict] = []
    for popcode, sub in ru.groupby("PopCode"):
        iso = _iso_for_popcode(popcode2name, popcode)
        if not iso or iso in bad:
            continue
        for r in sub.itertuples():
            rows.append({
                "country": "RUS", "geo": "adm1", "iso_region": iso, "region_key": None,
                "region_name": iso, "year": int(r.year), "period": int(r.period),
                "period_type": "week", "rate": float(r.rate),
            })
    return rows


def _haversine(a, b):
    (la1, lo1), (la2, lo2) = a, b
    p = math.pi / 180
    return 0.5 - math.cos((la2 - la1) * p) / 2 + math.cos(la1 * p) * math.cos(la2 * p) * (
        1 - math.cos((lo2 - lo1) * p)
    ) / 2


def impute(cache_dir: Path, iso_geo: dict, good_region_rows: list[dict]) -> list[dict]:
    """Impute bad-data Russian regions from the average of their 3 nearest GOOD regions
    (same country, great-circle distance)."""
    bad = bad_regions(cache_dir)
    cent_by_adm1 = {g["adm1_code"]: (g["latitude"], g["longitude"]) for g in iso_geo.values()}

    imputed_rows: list[dict] = []
    for iso, why in bad.items():
        if iso not in iso_geo:
            continue
        g = iso_geo[iso]
        c0 = cent_by_adm1.get(g["adm1_code"])
        if c0 and None not in c0:
            donors = sorted(
                (
                    (_haversine(c0, cent_by_adm1[r["key"]]), r)
                    for r in good_region_rows
                    if cent_by_adm1.get(r["key"]) and None not in cent_by_adm1[r["key"]]
                ),
                key=lambda t: t[0],
            )[:3]
        else:
            donors = [(0, r) for r in good_region_rows[:3]]
        avg = np.mean([np.array(r["curve"]) for _, r in donors], axis=0)
        avg = avg / avg.mean()
        imputed_rows.append({
            "country": "RUS", "geo": "adm1", "key": g["adm1_code"], "name": g["name"],
            "isoRegion": iso, "interval": "week", "curve": [round(float(x), 4) for x in avg],
            "nYears": None, "annualDeaths": None, "measurement": "rate",
            "imputed": "nearest-region-average", "imputedFrom": [r["name"] for _, r in donors],
        })
    return imputed_rows
