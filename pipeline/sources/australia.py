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
from ..age_bands import BANDS
from ..contract import AgeSexRow, FetchedFile, Source

# Dimension order is MEASURE.SEX.AGE.REGION.WEEK_OCCUR. SEX was 3 (Persons) alone; it is now
# 1+2+3 so the male/female split survives the download, with load() filtering back to Persons so
# its curve output is unchanged.
#
# AGE stays TT (All ages) because that is the only value this dataflow has. The flow is titled
# "Number of deaths by Sex, Age and State of registration", but wildcarding AGE against the live
# API returns exactly one code, TT -- the age detail the title advertises is not in this frozen
# NonProductionDataflow snapshot. So Australia contributes a sex split and no age split.
DATA_URL = (
    "https://data.api.abs.gov.au/rest/data/ABS,PROV_MORTALITY_WK,1.0.0/"
    "1.1+2+3.TT.1+2+3+4+5+6+7+8.."
)

# One band spanning every age, since that is all the dataflow offers. Declared rather than
# omitted so a consumer can still validate the sex split, and can see at a glance that the age
# dimension here carries no information.
BANDS_ALL_AGES: tuple[tuple[int, int], ...] = ((0, 200),)

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


def _dims(payload: dict) -> tuple[list, list, list, list]:
    structure = payload["data"]["structures"][0]["dimensions"]
    return (
        next(d["values"] for d in structure["series"] if d["id"] == "SEX"),
        next(d["values"] for d in structure["series"] if d["id"] == "REGION"),
        next(d["values"] for d in structure["series"] if d["id"] == "WEEK_OCCUR"),
        next(d["values"] for d in structure["observation"] if d["id"] == "TIME_PERIOD"),
    )


def load(cache_dir: Path) -> list[dict]:
    payload = json.loads(_file(cache_dir).read_text())
    sex_values, region_values, week_values, time_values = _dims(payload)

    rows: list[dict] = []
    for key, series in payload["data"]["dataSets"][0]["series"].items():
        indexes = [int(x) for x in key.split(":")]
        # The download now carries Males and Females too; the curve is the Persons total, so
        # anything else here would double the counts.
        if sex_values[indexes[1]]["id"] != "3":
            continue
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


_SEX = {"1": "m", "2": "f"}


def load_age_sex(cache_dir: Path) -> tuple[list[AgeSexRow], list[str]]:
    """Deaths by state x sex, summed over every week. No age dimension -- see DATA_URL.

    Reconciled against the Persons series load() uses, so a mistake in the sex filter shows up
    as a failure rather than as a quietly wrong fixture.
    """
    payload = json.loads(_file(cache_dir).read_text())
    sex_values, region_values, week_values, _time = _dims(payload)

    by_cell: dict[tuple[str, str], float] = {}
    persons: dict[str, float] = {}
    blanks = [0]
    for key, series in payload["data"]["dataSets"][0]["series"].items():
        indexes = [int(x) for x in key.split(":")]
        sex_code = sex_values[indexes[1]]["id"]
        iso = AU_CODE2ISO.get(region_values[indexes[3]]["id"])
        if not iso or not week_values[indexes[4]]["id"].startswith("W"):
            continue
        # Some male/female week cells come back null where the Persons cell is populated, so
        # they are skipped and counted rather than coerced to zero.
        values = [v[0] for v in series["observations"].values()]
        total = sum(float(v) for v in values if v is not None)
        blanks[0] += sum(1 for v in values if v is None)
        if sex_code == "3":
            persons[iso] = persons.get(iso, 0.0) + total
        elif sex_code in _SEX:
            cell = (iso, _SEX[sex_code])
            by_cell[cell] = by_cell.get(cell, 0.0) + total

    if not by_cell:
        raise ValueError(
            "Australia: no male/female series in the cached download -- refetch with "
            "`uv run python -m pipeline fetch australia` to pick up the widened SEX dimension"
        )

    for iso, want in persons.items():
        got = by_cell.get((iso, "m"), 0.0) + by_cell.get((iso, "f"), 0.0)
        # Blank split cells mean the two sides need not match exactly; 2% is far tighter than a
        # wrong sex filter (which would be off by a third or double) yet loose enough for the
        # handful of suppressed weeks.
        if want > 0 and abs(got - want) / want > 0.02:
            raise ValueError(
                f"Australia {iso}: males + females = {got:,.0f} but Persons = {want:,.0f} "
                f"({abs(got - want) / want:.1%} apart) -- check the SEX filter"
            )

    assert len(BANDS) == 9  # the project's bands; deliberately not used here
    rows: list[AgeSexRow] = [
        {
            "country": "AUS", "geo": "adm1", "iso_region": iso, "region_key": None,
            "region_name": iso, "band": 0, "sex": sex, "deaths": deaths,
        }
        for (iso, sex), deaths in sorted(by_cell.items())
    ]
    split = sum(by_cell.values())
    total_persons = sum(persons.values())
    notes = [
        "AUS: sex only -- PROV_MORTALITY_WK publishes no age breakdown (AGE has one code, TT)",
        f"AUS: {blanks[0]:,} blank male/female week cells; split covers "
        f"{split / total_persons:.2%} of the Persons total",
    ]
    return rows, notes


AGE_SEX_BANDS = BANDS_ALL_AGES
