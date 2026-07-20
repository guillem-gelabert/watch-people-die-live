"""South Africa -- SAMRC "Report on Weekly Deaths in South Africa", province-level weekly
estimated deaths (2019w52-present). This is a National Population Register surveillance
estimate, not raw CRVS -- `measurement="surveillance-estimate"`. Only the ACTUAL column is
used (the workbook's PREDICTED column is itself a smoothed model output, which would double
up on the smoothing this pipeline's own curve-folding already does). The download URL embeds
a dated path and a version suffix that change every report cycle, so `fetch` scrapes the
report hub page for the current link rather than using a pinned URL.
"""

from __future__ import annotations

import datetime
import re
from pathlib import Path

import openpyxl
import requests

from ..cache import sha256_of, today
from ..contract import FetchedFile, Source

REPORT_HUB = "https://www.samrc.ac.za/research-reports/report-weekly-deaths-south-africa"

SOURCE = Source(
    key="south_africa",
    country_iso3="ZAF",
    geo="adm1",
    cadence="week",
    retrieval_mode="direct-download",
    measurement="surveillance-estimate",
    urls=(REPORT_HUB,),
    license="SAMRC (check report terms before redistribution)",
    expected_regions=9,
    min_annual=500,
    notes=(
        "South Africa: SAMRC Report on Weekly Deaths, province-level weekly estimated "
        "deaths (National Population Register surveillance estimate, not raw CRVS) -> "
        "Natural Earth admin-1"
    ),
)

# Column layout of the "Provincial All-cause deaths" sheet: (province, ACTUAL column index),
# 0-based, matching the fixed header layout (Epiweek, Week start, blank, then 9 provinces x
# [ACTUAL, PREDICTED, blank]).
_PROVINCES = [
    ("ZA-EC", 3), ("ZA-FS", 6), ("ZA-GT", 9), ("ZA-NL", 12), ("ZA-LP", 15),
    ("ZA-MP", 18), ("ZA-NC", 21), ("ZA-NW", 24), ("ZA-WC", 27),
]

_FILE = "south-africa-samrc-weekly.xlsx"


def _file(cache_dir: Path) -> Path:
    return cache_dir / _FILE


def fetch(cache_dir: Path) -> list[FetchedFile]:
    hub = requests.get(REPORT_HUB, timeout=60, headers={"User-Agent": "Mozilla/5.0"})
    hub.raise_for_status()
    match = re.search(r'href="(/sites/default/files/attachments/[^"]*\.xlsx)"', hub.text)
    if not match:
        raise RuntimeError(f"Could not find a .xlsx report link on {REPORT_HUB}")
    xlsx_url = "https://www.samrc.ac.za" + match.group(1)

    response = requests.get(xlsx_url, timeout=120, headers={"User-Agent": "Mozilla/5.0"})
    response.raise_for_status()
    _file(cache_dir).write_bytes(response.content)

    return [
        FetchedFile(
            path=_file(cache_dir), url=xlsx_url, sha256=sha256_of(_file(cache_dir)), retrieved=today()
        )
    ]


def load(cache_dir: Path) -> list[dict]:
    wb = openpyxl.load_workbook(_file(cache_dir), read_only=True, data_only=True)
    ws = wb["Provincial All-cause deaths"]

    rows: list[dict] = []
    for row in ws.iter_rows(min_row=4, values_only=True):
        week_start = row[1]
        if week_start is None:
            continue
        iso_year, iso_week, _ = (week_start + datetime.timedelta(days=3)).isocalendar()
        for iso_region, col in _PROVINCES:
            value = row[col]
            if value is None:
                continue
            rows.append({
                "country": "ZAF", "geo": "adm1", "iso_region": iso_region, "region_key": None,
                "region_name": iso_region, "year": int(iso_year), "period": int(iso_week),
                "period_type": "week", "deaths": float(value),
            })
    return rows
