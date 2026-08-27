"""Eurostat -- observed regional age x sex and cause tables at NUTS-2.

Three dissemination-API tables, one request each, joined onto the NUTS-2 keys already
committed in data/subnational-cdr.json:

  demo_r_magec    annual deaths by single year of age x sex x NUTS-2   (counts)
  demo_r_mwk2_05  weekly deaths by 5-year age group x sex x NUTS-2     (counts)
  hlth_cd_asdr2   standardised death rate by cause x sex x NUTS-2      (rate)

Deliberately NOT in registry.REGISTRY. Every module there feeds the one-dimensional curve
machinery in build.py, and adding a thirty-five-country source to it would change committed
seasonality output. This one writes its own artifact instead, the way
argentina_partido_latitudes does.

Two of the plan's three table choices did not survive contact with the API and are corrected
here:

  * `demo_r_mweek3` is NUTS-**3** ("Deaths by week, sex, 5-year age group and NUTS 3 region"),
    not NUTS-2. `demo_r_mwk2_05` is the NUTS-2 table of the same shape, so it is used instead.
  * `hlth_cd_asdr2` carries no fine age dimension. Its `age` is exactly TOTAL / Y_LT65 /
    Y_GE65, so the cause layer is an under-65 / 65-and-over split and nothing finer. The plan
    described it as "causes by region x age x sex", which overstates the age resolution.

Output: data/eurostat-regional.json
"""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

import requests

from ..age_bands import BANDS, icd_chapter
from ..cache import sha256_of, today
from ..contract import FetchedFile

API = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data"

# One reference year for the two annual tables. Eurostat publishes NUTS-2 causes on a longer
# lag than deaths, so this is the latest year both tables carry in full.
YEAR = 2022

# ISO weeks of the same reference year, fetched in one request rather than 52.
WEEKS = tuple(f"{YEAR}-W{w:02d}" for w in range(1, 53))

# Weeks go in quarter-sized chunks: a whole year of weeks in one request is refused with
# 413 Request Entity Too Large, and thirteen weeks is comfortably inside the limit. The two
# annual tables need no chunking -- each is a single request, as the plan expected.
_WEEK_CHUNKS = tuple(WEEKS[i:i + 13] for i in range(0, len(WEEKS), 13))

_TABLES: dict[str, tuple[str, ...]] = {
    "demo_r_magec": (f"{API}/demo_r_magec?format=JSON&time={YEAR}&sex=M&sex=F",),
    "hlth_cd_asdr2": (f"{API}/hlth_cd_asdr2?format=JSON&time={YEAR}&sex=M&sex=F",),
    "demo_r_mwk2_05": tuple(
        f"{API}/demo_r_mwk2_05?format=JSON&sex=M&sex=F"
        + "".join(f"&time={w}" for w in chunk)
        for chunk in _WEEK_CHUNKS
    ),
}

LICENSE = "Eurostat, reuse authorised with source acknowledged (CC BY 4.0 equivalent)"

# demo_r_magec ships one code per single year of age, so it folds onto the project's nine bands
# exactly. The weekly and cause tables do not, and declare their own bands below.
AGE_SEX_BANDS: tuple[tuple[int, int], ...] = BANDS

# demo_r_mwk2_05's youngest group is Y_LT5, which straddles band 0 ([0,0]) and band 1 ([1,4]).
# Splitting it would mean inventing an infant share, so the weekly layer declares a coarser set
# whose boundaries all fall on real Eurostat group edges.
WEEKLY_BANDS: tuple[tuple[int, int], ...] = (
    (0, 4), (5, 14), (15, 29), (30, 49), (50, 64), (65, 74), (75, 84), (85, 200),
)

# hlth_cd_asdr2 has exactly TOTAL / Y_LT65 / Y_GE65.
CAUSE_BANDS: tuple[tuple[int, int], ...] = ((0, 64), (65, 200))

_SEX = {"M": "m", "F": "f"}


def _weekly_band(code: str) -> int | None:
    """Band index for a demo_r_mwk2_05 age code, against WEEKLY_BANDS."""
    if code == "Y_LT5":
        return 0
    if code in ("Y_GE90", "Y90-94", "Y_GE95"):
        return 7
    if not code.startswith("Y"):
        return None
    lo = code[1:].split("-")[0]
    if not lo.isdigit():
        return None
    age = int(lo)
    for i, (band_lo, band_hi) in enumerate(WEEKLY_BANDS):
        if band_lo <= age <= band_hi:
            return i
    return None


def _single_year_band(code: str) -> int | None:
    """Band index for a demo_r_magec age code, against the project's nine BANDS.

    Codes are TOTAL, Y_LT1, Y1..Y99, Y_GE100 and (in some vintages) Y_OPEN. Only the ones
    carrying a single year resolve; aggregates return None and are dropped rather than being
    smeared across bands.
    """
    if code == "Y_LT1":
        return 0
    if code in ("Y_GE100", "Y_OPEN"):
        return len(BANDS) - 1
    if not code.startswith("Y") or not code[1:].isdigit():
        return None
    age = int(code[1:])
    for i, (lo, hi) in enumerate(BANDS):
        if lo <= age <= hi:
            return i
    return None


# Eurostat's icd10 groupings onto the 90-label vocabulary data/causes.json already publishes.
# Only leaf groupings are mapped: the chapter roll-ups (C00-D48, I, J, ...) and the "_OTH"
# remainders are deliberately absent, because emitting both a chapter and its children would
# double-count. Anything unmapped is dropped and counted in the join report, never invented as a
# new label -- the vocabulary here must stay a subset of the one 04-02 emits.
ICD10_TO_CAUSE: dict[str, str] = {
    "A15-A19_B90": "tuberculosis",
    "B20-B24": "sexually transmitted infections excluding hiv",
    "B15-B19_B942": "acute hepatitis",
    "B180-B182": "acute hepatitis",
    "C00-C14": "lip and oral cavity cancer",
    "C15": "esophageal cancer",
    "C16": "stomach cancer",
    "C18-C21": "colorectal cancer",
    "C22": "liver cancer",
    "C25": "pancreatic cancer",
    "C33_C34": "lung cancer",
    "C43": "malignant skin melanoma",
    "C50": "breast cancer",
    "C53": "cervical cancer",
    "C54_C55": "uterine cancer",
    "C56": "ovarian cancer",
    "C61": "prostate cancer",
    "C64": "kidney cancer",
    "C67": "bladder cancer",
    "C70-C72": "brain and central nervous system cancer",
    "C73": "thyroid cancer",
    "C81-C86": "non-hodgkin lymphoma",
    "C88_C90_C96": "multiple myeloma",
    "C91-C95": "leukaemia",
    "D00-D48": "other neoplasms",
    "D50-D89": "hemoglobinopathies and hemolytic anemias",
    "E10-E14": "diabetes",
    "F01_F03": "Alzheimer's & dementia",
    "F10": "alcohol use disorders",
    "G20": "parkinson's disease",
    "G30": "Alzheimer's & dementia",
    "I20-I25": "ischaemic heart disease",
    "I60-I69": "a stroke",
    "J09-J11": "lower respiratory infection",
    "J12-J18": "lower respiratory infection",
    "J45_J46": "asthma",
    "K70_K73_K74": "cirrhosis and other chronic liver diseases",
    "K25-K28": "upper digestive system diseases",
    "N00-N29": "kidney disease",
    "O": "neonatal complications",
    "P": "neonatal complications",
    "Q": "a congenital condition",
    "R95": "sudden infant death syndrome",
    "TOXICO": "drug use disorders",
    "U071": "covid-19",
    "U072": "covid-19",
    "V_Y85": "a road injury",
    "W00-W19": "falls",
    "W65-W74": "drowning",
    "X40-X49": "poisonings",
    "X60-X84_Y870": "suicide",
    "X85-Y09_Y871": "interpersonal violence",
    "RHEUM_ARTHRO": "other musculoskeletal disorders",
    # Remainders. Each "_OTH" code is the leftover of its chapter after the leaves above are
    # taken out, so it is disjoint from them and can carry the project's matching "other ..."
    # label without double-counting.
    "C32": "other malignant neoplasms",
    "C_OTH": "other malignant neoplasms",
    "A_B_OTH": "other unspecified infectious diseases",
    "E_OTH": "endocrine, metabolic, blood, and immune disorders",
    "G_H_OTH": "other neurological disorders",
    "I30-I51": "other cardiovascular and circulatory diseases",
    "I_OTH": "other cardiovascular and circulatory diseases",
    "J40-J44_J47": "COPD",
    "J_OTH": "other chronic respiratory diseases",
    "K_OTH": "other digestive diseases",
    "M_OTH": "other musculoskeletal disorders",
    "N_OTH": "urinary diseases and male infertility",
    "ACC_OTH": "other unintentional injuries",
}

# Codes knowingly skipped, so the join report can tell "unmapped because it is a roll-up" from
# "unmapped because nobody looked at it".
_ROLLUP_CODES = frozenset({
    # Chapter totals, whose children are mapped above.
    "TOTAL", "A-R_V-Y", "A_B", "C00-D48", "C", "E", "F", "G_H", "I", "J", "K", "L", "M", "N",
    "R", "V01-Y89", "ACC", "J40-J47",
    # Children of an already-mapped parent: I20-I25 and K70_K73_K74 are taken, so taking these
    # too would count the same deaths twice.
    "I21_I22", "I20_I23-I25", "K72-K75",
    # No counterpart in the project vocabulary that is not a guess. Reported, not invented.
    "F_OTH", "R_OTH", "R96-R99", "Y10-Y34_Y872", "V01-Y89_OTH", "U_COV19_OTH",
})


def _file(cache_dir: Path, table: str, part: int = 0) -> Path:
    suffix = "" if len(_TABLES[table]) == 1 else f"-{part + 1:02d}"
    return cache_dir / f"eurostat-{table}-{YEAR}{suffix}.json"


# --- Non-COVID weekly pull for 04-07's age x month tensor --------------------------------
#
# `demo_r_mwk2_05` above is pinned to YEAR = 2022, which is *inside* pipeline.curve.COVID_YEARS
# ({2020, 2021, 2022}) -- fine for the age x sex and cause layers built above (neither varies by
# month), wrong for a month-conditioned tensor, whose whole point is a normal-year shape. Rather
# than moving YEAR (04-06 already flagged that touches both annual tables and this file's own
# tests), this re-pulls the same table for five complete non-COVID years -- the exact window
# brazil.py/mexico.py/australia.py already pool (`_YEARS = (2015, ..., 2019)`), so it is a
# parameter change to the existing chunked fetch, not new machinery, and it never touches the
# YEAR-2022 cache files or data/eurostat-regional.json.
SEASONAL_YEARS: tuple[int, ...] = (2015, 2016, 2017, 2018, 2019)


def _seasonal_weeks(year: int) -> tuple[str, ...]:
    return tuple(f"{year}-W{w:02d}" for w in range(1, 53))


def _seasonal_urls(year: int) -> tuple[str, ...]:
    weeks = _seasonal_weeks(year)
    chunks = tuple(weeks[i : i + 13] for i in range(0, len(weeks), 13))
    return tuple(
        f"{API}/demo_r_mwk2_05?format=JSON&sex=M&sex=F" + "".join(f"&time={w}" for w in chunk)
        for chunk in chunks
    )


def _seasonal_file(cache_dir: Path, year: int, part: int) -> Path:
    return cache_dir / f"eurostat-demo_r_mwk2_05-{year}-{part + 1:02d}.json"


def fetch_seasonal(cache_dir: Path) -> list[FetchedFile]:
    """Fetch demo_r_mwk2_05 for SEASONAL_YEARS. Skips any chunk already cached, so a partial
    or repeated run only fetches what's missing -- mirrors worldpop.py's resume behaviour."""
    out: list[FetchedFile] = []
    for year in SEASONAL_YEARS:
        for part, url in enumerate(_seasonal_urls(year)):
            dest = _seasonal_file(cache_dir, year, part)
            if not dest.exists():
                response = requests.get(url, timeout=180, headers={"Accept": "application/json"})
                response.raise_for_status()
                dest.write_bytes(response.content)
            out.append(FetchedFile(path=dest, url=url, sha256=sha256_of(dest), retrieved=today()))
    return out


def read_seasonal_payloads(cache_dir: Path) -> list[dict]:
    """Every cached SEASONAL_YEARS chunk, parsed. Raises if fetch_seasonal() hasn't run."""
    payloads = []
    for year in SEASONAL_YEARS:
        for part in range(len(_seasonal_urls(year))):
            path = _seasonal_file(cache_dir, year, part)
            if not path.exists():
                raise FileNotFoundError(
                    f"{path} missing -- run `python -m pipeline fetch-seasonal-composition` first"
                )
            payloads.append(json.loads(path.read_text()))
    return payloads


def nuts2_country_iso2(root: Path) -> dict[str, str]:
    """NUTS_ID -> CNTR_CODE (ISO 3166-1 alpha-2), straight from the committed geometry."""
    topo = json.loads((root / "data" / "nuts2-20m.json").read_text())
    return {
        g["properties"]["NUTS_ID"]: g["properties"]["CNTR_CODE"]
        for g in topo["objects"]["nuts2_20m"]["geometries"]
    }


# ISO2 -> ISO3 for exactly the country codes demo_r_mwk2_05 can emit (EU + EFTA + candidates),
# matching the set already enumerated in _JOIN_REASONS above. Small and static like BR_UF2ISO /
# ENT2ISO in the Brazil/Mexico source modules, rather than a new runtime dependency for a ~35-row
# table that does not change.
NUTS2_ISO2_TO_ISO3: dict[str, str] = {
    "AT": "AUT", "BE": "BEL", "BG": "BGR", "CH": "CHE", "CY": "CYP", "CZ": "CZE", "DE": "DEU",
    "DK": "DNK", "EE": "EST", "EL": "GRC", "ES": "ESP", "FI": "FIN", "FR": "FRA", "HR": "HRV",
    "HU": "HUN", "IE": "IRL", "IS": "ISL", "IT": "ITA", "LI": "LIE", "LT": "LTU", "LU": "LUX",
    "LV": "LVA", "ME": "MNE", "MK": "MKD", "MT": "MLT", "NL": "NLD", "NO": "NOR", "PL": "POL",
    "PT": "PRT", "RO": "ROU", "SE": "SWE", "SI": "SVN", "SK": "SVK", "TR": "TUR", "UK": "GBR",
}


# The 8 project bands demo_r_mwk2_05's WEEKLY_BANDS resolve to, one weekly-band index per project
# band -- bands 0 ([0,0]) and 1 ([1,4]) share WEEKLY_BANDS[0] ([0,4]) because the source cannot
# split them (see WEEKLY_BANDS's own comment above), everything else is a 1:1 relabelling.
PROJECT_BAND_TO_WEEKLY_BAND: tuple[int, ...] = (0, 0, 1, 2, 3, 4, 5, 6, 7)


def age_month_curves(
    root: Path, cache_dir: Path, min_annual: float = 200.0, min_bands: int = 5
) -> dict[str, list]:
    """iso3 -> one harmonic-curve-or-None per project band, fit from demo_r_mwk2_05 pooled over
    SEASONAL_YEARS.

    Coverage is genuinely per-band, not all-or-nothing per country: band 1 ([5,14]) is the
    lowest-mortality age band across the whole life course, so ~40-120 deaths/year is normal for
    a mid-size European country and routinely falls under min_annual while every other band in
    the same country clears it comfortably (measured: AUT 7/8 bands pass, only band 1 fails).
    Requiring every band to pass would have thrown away seven perfectly good measured bands to
    exclude one noisy one. A country is included once at least `min_bands` of its 9 project bands
    resolve; the remainder stay None for 04-07's per-band transfer step (lib/spatial-
    seasonality.ts's donor cascade, called once per band) to fill from donors, exactly like a
    country with no measurement in that band at all.
    """
    from .. import curve as curve_module  # local import: avoids a cycle with pipeline.build

    iso2_by_nuts2 = nuts2_country_iso2(root)
    rows: dict[tuple[str, int], list[dict]] = defaultdict(list)
    for year in SEASONAL_YEARS:
        for part in range(len(_seasonal_urls(year))):
            payload = json.loads(_seasonal_file(cache_dir, year, part).read_text())
            for cell, value in _cells([payload]):
                geo, sex_code = cell["geo"], cell["sex"]
                if sex_code not in _SEX:
                    continue
                iso2 = iso2_by_nuts2.get(geo)
                iso3 = NUTS2_ISO2_TO_ISO3.get(iso2) if iso2 else None
                if not iso3:
                    continue
                band = _weekly_band(cell["age"])
                if band is None:
                    continue
                week = int(cell["time"].split("-W")[1])
                rows[(iso3, band)].append(
                    {"year": year, "period_type": "week", "period": week, "deaths": float(value)}
                )

    by_country_band: dict[str, dict[int, dict]] = defaultdict(dict)
    for (iso3, band), band_rows in rows.items():
        result = curve_module.country_curve_records(band_rows, min_years=1, min_annual=min_annual)
        if result:
            by_country_band[iso3][band] = result["harmonic"]

    countries: dict[str, list] = {}
    for iso3, by_band in by_country_band.items():
        curves = [by_band.get(wb) for wb in PROJECT_BAND_TO_WEEKLY_BAND]
        if sum(1 for c in curves if c) >= min_bands:
            countries[iso3] = curves
    return countries


# For each mapped ICD-10 grouping above, the chapter its leaf code falls in -- resolved
# mechanically via icd_chapter() rather than hand-typed, so it cannot drift from the chapter
# ranges above. A handful of keys are not literal ICD-10 codes (single-letter chapter markers
# "O"/"P"/"Q", or the compound external-cause marker "V_Y85") and need a small override.
_CHAPTER_LEAF_OVERRIDES: dict[str, str | None] = {
    "V_Y85": "V01",  # external causes (V01-Y89), not a real code on its own
    "TOXICO": None,  # not an ICD-10 code -- no chapter to resolve
}


def _chapter_leaf_code(compound: str) -> str | None:
    if compound in _CHAPTER_LEAF_OVERRIDES:
        return _CHAPTER_LEAF_OVERRIDES[compound]
    token = compound.replace("_", "-").split("-")[0]
    if len(token) == 1 and token.isalpha():
        token = f"{token}00"
    return token


def chapter_of_cause_label() -> dict[str, str]:
    """causes.json label -> ICD-10 chapter numeral, derived from ICD10_TO_CAUSE above.

    Some labels are reachable from more than one chapter (e.g. Alzheimer's & dementia from both
    F01_F03 and G30); the first occurrence in ICD10_TO_CAUSE's declaration order wins, since a
    month-conditioned reweight needs exactly one chapter per label, not a blend. This is a
    disclosed simplification, not a new vocabulary -- every label is already in data/causes.json.
    """
    result: dict[str, str] = {}
    for code, label in ICD10_TO_CAUSE.items():
        leaf = _chapter_leaf_code(code)
        chapter = icd_chapter(leaf) if leaf else None
        if chapter and label not in result:
            result[label] = chapter
    return result


def fetch(cache_dir: Path) -> list[FetchedFile]:
    out: list[FetchedFile] = []
    for table, urls in _TABLES.items():
        for part, url in enumerate(urls):
            response = requests.get(url, timeout=180, headers={"Accept": "application/json"})
            response.raise_for_status()
            dest = _file(cache_dir, table, part)
            dest.write_bytes(response.content)
            out.append(
                FetchedFile(path=dest, url=url, sha256=sha256_of(dest), retrieved=today())
            )
    return out


def _read(cache_dir: Path, table: str) -> list[dict]:
    """Every cached part of a table, as parsed JSON-stat payloads."""
    payloads = []
    for part in range(len(_TABLES[table])):
        path = _file(cache_dir, table, part)
        if not path.exists():
            raise FileNotFoundError(
                f"{path} missing -- run `python -m pipeline fetch-eurostat` first"
            )
        payloads.append(json.loads(path.read_text()))
    return payloads


def _axes(payload: dict) -> tuple[list[str], dict[str, list[str]]]:
    """Dimension order plus each dimension's category codes in index order."""
    order = payload["id"]
    codes: dict[str, list[str]] = {}
    for name in order:
        index = payload["dimension"][name]["category"]["index"]
        if isinstance(index, dict):
            codes[name] = [c for c, _ in sorted(index.items(), key=lambda kv: kv[1])]
        else:
            codes[name] = list(index)
    return order, codes


def _cells(payloads: list[dict]):
    """Yield (dict of dimension code, value) for every populated cell.

    JSON-stat stores a sparse flat map keyed by the row-major offset over `size`, so the
    offset has to be unravelled back into one code per dimension.
    """
    for payload in payloads:
        order, codes = _axes(payload)
        sizes = payload["size"]
        strides = [1] * len(sizes)
        for i in range(len(sizes) - 2, -1, -1):
            strides[i] = strides[i + 1] * sizes[i + 1]
        for flat, value in payload.get("value", {}).items():
            offset = int(flat)
            picked = {}
            for dim_index, name in enumerate(order):
                picked[name] = codes[name][(offset // strides[dim_index]) % sizes[dim_index]]
            yield picked, value


def _nuts2_keys(root: Path) -> tuple[dict[str, str], set[str]]:
    """(committed NUTS-2 geometry keys -> name, the subset that also has a CDR row).

    The join target is the committed *geometry* in data/nuts2-20m.json (334 regions), not the
    287 NUTS-2 rows in data/subnational-cdr.json. The plan said 287, but those two sets are not
    the same thing: NL31, NL33, PT16-PT18 and NO0B are all in the geometry and absent from the
    CDR, so joining to the CDR would throw away Eurostat rows for regions this project can
    already draw. The CDR subset is still tracked, because it is what a consumer wanting a
    death rate alongside these distributions can actually use.
    """
    topo = json.loads((root / "data" / "nuts2-20m.json").read_text())
    geometry = {
        g["properties"]["NUTS_ID"]: g["properties"].get("NAME_LATN", "")
        for g in topo["objects"]["nuts2_20m"]["geometries"]
    }
    cdr = json.loads((root / "data" / "subnational-cdr.json").read_text())
    with_cdr = {r["key"] for r in cdr["regions"] if r.get("geo") == "nuts2"}
    return geometry, with_cdr


def build(root: Path, cache_dir: Path) -> Path:
    committed, with_cdr = _nuts2_keys(root)

    # --- annual deaths by single year of age x sex (counts: sum) -------------------------
    age_sex: dict[tuple[str, int, str], float] = defaultdict(float)
    seen_geo: set[str] = set()
    dropped_age: set[str] = set()
    for cell, value in _cells(_read(cache_dir, "demo_r_magec")):
        geo, sex_code = cell["geo"], cell["sex"]
        seen_geo.add(geo)
        if geo not in committed or sex_code not in _SEX:
            continue
        band = _single_year_band(cell["age"])
        if band is None:
            dropped_age.add(cell["age"])
            continue
        age_sex[(geo, band, _SEX[sex_code])] += float(value)

    # --- weekly deaths by 5-year group x sex (counts: sum, folded to month) --------------
    weekly: dict[tuple[str, int, str, int], float] = defaultdict(float)
    for cell, value in _cells(_read(cache_dir, "demo_r_mwk2_05")):
        geo, sex_code = cell["geo"], cell["sex"]
        if geo not in committed or sex_code not in _SEX:
            continue
        band = _weekly_band(cell["age"])
        if band is None:
            continue
        week = int(cell["time"].split("-W")[1])
        # ISO week -> month by the week's midpoint, which is what the seasonality curve
        # elsewhere in this pipeline uses to place a week in the year.
        month = min(12, max(1, ((week - 1) * 7 + 3) // 30 + 1))
        weekly[(geo, band, _SEX[sex_code], month)] += float(value)

    # --- standardised death rate by cause x sex ------------------------------------------
    # Two different rules apply to the same numbers and conflating them is the easy bug here:
    #
    #   * ACROSS REGIONS a standardised rate is intensive -- already per-100k and
    #     age-standardised -- so regions average, they never sum. That is `aggregate_regions()`.
    #   * WITHIN one region, two disjoint ICD groupings that land on the same project label
    #     (influenza J09-J11 and pneumonia J12-J18 both being "lower respiratory infection")
    #     describe different deaths, so their rates add.
    #
    # This accumulator is the second case, so it sums.
    cause_acc: dict[tuple[str, int, str, str], float] = defaultdict(float)
    unmapped_icd: set[str] = set()
    cause_band = {"Y_LT65": 0, "Y_GE65": 1}
    for cell, value in _cells(_read(cache_dir, "hlth_cd_asdr2")):
        geo, sex_code = cell["geo"], cell["sex"]
        if geo not in committed or sex_code not in _SEX:
            continue
        band = cause_band.get(cell["age"])
        if band is None:
            continue
        label = ICD10_TO_CAUSE.get(cell["icd10"])
        if label is None:
            if cell["icd10"] not in _ROLLUP_CODES:
                unmapped_icd.add(cell["icd10"])
            continue
        cause_acc[(geo, band, _SEX[sex_code], label)] += float(value)

    vocabulary = set(json.loads((root / "data" / "causes.json").read_text())["causes"])
    emitted_labels = {label for (_, _, _, label) in cause_acc}
    stray = sorted(emitted_labels - vocabulary)
    if stray:
        raise ValueError(
            f"cause labels outside data/causes.json vocabulary: {stray}. "
            "Map onto an existing label or drop the grouping -- never add a second vocabulary."
        )

    matched = sorted({geo for (geo, _, _) in age_sex})
    # Both directions of the join, because only one of them is a data loss for us: an Eurostat
    # code we cannot place, and a committed region that got no rows.
    unmatched = sorted(g for g in seen_geo if g not in committed and len(g) == 4)
    missing = sorted(set(committed) - set(matched))

    keys = sorted(
        {geo for (geo, _, _) in age_sex}
        | {geo for (geo, _, _, _) in weekly}
        | {geo for (geo, _, _, _) in cause_acc}
    )
    key_index = {k: i for i, k in enumerate(keys)}
    sex_index = {"m": 0, "f": 1}
    cause_labels = sorted({label for (_, _, _, label) in cause_acc})
    cause_index = {c: i for i, c in enumerate(cause_labels)}

    payload = {
        "meta": {
            "note": (
                "Observed NUTS-2 age x sex and cause distributions from Eurostat. Counts are "
                "summed; the cause layer is a standardised rate and is averaged, never summed. "
                "Bands differ per layer -- see each layer's `bands`."
            ),
            "year": YEAR,
            "license": LICENSE,
            "citation": "Eurostat, dissemination API, tables demo_r_magec, demo_r_mwk2_05, hlth_cd_asdr2",
            "geo": "nuts2",
            "nutsRevision": _detect_revision(committed, seen_geo),
            "tables": {t: list(urls) for t, urls in _TABLES.items()},
            "committedNuts2Keys": len(committed),
            "matchedNuts2Keys": len(matched),
            "keysAlsoInSubnationalCdr": len(set(matched) & with_cdr),
            "subnationalCdrKeys": len(with_cdr),
            "unmatchedEurostatCodes": unmatched,
            "committedKeysWithNoData": missing,
            "joinNotes": _join_notes(unmatched, missing),
            "droppedAgeCodes": sorted(dropped_age),
            "unmappedIcd10": sorted(unmapped_icd),
            "measurement": {
                "ageSex": "crvs",
                "weekly": "crvs",
                "cause": "rate",
            },
        },
        # Rows are positional arrays against the vocabularies above them, the way
        # data/causes.json already indexes its 90 cause labels. Spelling each row out as an
        # object costs 7.3 MB against 1.4 MB, almost all of it the same region key and cause
        # label repeated sixty thousand times.
        "keys": keys,
        "sexes": ["m", "f"],
        "ageSex": {
            "bands": [list(b) for b in AGE_SEX_BANDS],
            "row": "[keyIndex, band, sexIndex, deaths]",
            "rows": [
                [key_index[geo], band, sex_index[sex], int(round(v))]
                for (geo, band, sex), v in sorted(age_sex.items())
            ],
        },
        "weekly": {
            "bands": [list(b) for b in WEEKLY_BANDS],
            "row": "[keyIndex, band, sexIndex, month, deaths]",
            "rows": [
                [key_index[geo], band, sex_index[sex], month, int(round(v))]
                for (geo, band, sex, month), v in sorted(weekly.items())
            ],
        },
        "causes": {
            "bands": [list(b) for b in CAUSE_BANDS],
            "unit": "age-standardised deaths per 100 000 inhabitants",
            "labels": cause_labels,
            "row": "[keyIndex, band, sexIndex, causeIndex, ratePer100k]",
            "rows": [
                [key_index[geo], band, sex_index[sex], cause_index[label], round(rate, 3)]
                for (geo, band, sex, label), rate in sorted(cause_acc.items())
            ],
        },
    }

    out = root / "data" / "eurostat-regional.json"
    out.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=False) + "\n"
    )
    return out


def _detect_revision(committed: dict[str, str], seen: set[str]) -> str:
    """Report how the pulled codes line up with the committed geometry.

    Eurostat's API has no revision parameter -- a table is published in whatever NUTS revision
    was in force -- so the revision cannot be requested, only observed. Recording the overlap is
    the honest version of the plan's "pin the NUTS revision": it makes a revision drift visible
    as a drop in matched keys rather than as regions silently missing.
    """
    hits = len([g for g in seen if g in committed])
    return f"observed: {hits}/{len(committed)} committed NUTS-2 keys present in the {YEAR} pull"


def aggregate_regions(rows: list[dict], value_key: str, intensive: bool) -> dict[tuple, float]:
    """Roll `rows` up over their `key` (region), collapsing to (band, sex, ...) cells.

    `intensive=True` averages, `intensive=False` sums, and the distinction is not cosmetic:

      * Deaths are extensive. Two regions with 100 deaths each have 200 deaths between them.
      * An age-standardised death rate is intensive. Two regions at 300 per 100 000 do not make
        a region at 600 per 100 000 -- they make one at 300. Summing them inflates every
        multi-region rollup by roughly the number of regions in it.

    The same split is already made for Russia's RusSTMF handling, where rate rows and count rows
    come off the same reader. Population weighting would be better than a flat mean for the
    intensive case, but Eurostat's NUTS-2 population is a separate table and this artifact has no
    consumer that needs it yet -- the flat mean is documented rather than silently "close enough".
    """
    buckets: dict[tuple, list[float]] = defaultdict(list)
    for row in rows:
        cell = tuple(
            row[k] for k in ("band", "sex", "month", "cause") if k in row
        )
        buckets[cell].append(float(row[value_key]))
    if intensive:
        return {cell: sum(vals) / len(vals) for cell, vals in buckets.items()}
    return {cell: sum(vals) for cell, vals in buckets.items()}


# Every code that fails the join in either direction, with why. The acceptance criterion is
# "zero unmatched region codes, or each is explicitly listed and justified" -- so the artifact
# carries the justification rather than leaving a bare list for someone to re-derive.
_JOIN_REASONS: tuple[tuple[str, str], ...] = (
    ("EFTA", "not a region: Eurostat's EFTA aggregate, which has no NUTS-2 geometry"),
    ("NL3", "NUTS revision newer than the committed geometry: the Dutch NL35/NL36 split"),
    ("PT1", "NUTS revision newer than the committed geometry: the Portuguese PT19-PT1D split"),
    ("UK", "the United Kingdom stopped reporting to Eurostat after leaving the EU"),
    ("ME", "candidate country: no demo_r_magec rows for this reference year"),
    ("MK", "candidate country: no demo_r_magec rows for this reference year"),
    ("NO0", "NUTS revision: pre-2021 Norwegian codes retired by the committed geometry"),
)


def _join_notes(unmatched: list[str], missing: list[str]) -> dict[str, str]:
    notes: dict[str, str] = {}
    for code in [*unmatched, *missing]:
        for prefix, reason in _JOIN_REASONS:
            if code.startswith(prefix):
                notes[code] = reason
                break
        else:
            notes[code] = "unexplained -- investigate before relying on this region"
    return notes
