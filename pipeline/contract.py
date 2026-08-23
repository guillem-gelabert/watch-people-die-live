"""Typed shapes shared by every pipeline/sources/*.py module."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal, TypedDict

RetrievalMode = Literal["api", "direct-download", "manual"]
Measurement = Literal["crvs", "surveillance-estimate", "rate"]
Geo = Literal["adm1", "partido"]
Cadence = Literal["week", "month", "quarter", "rate"]


class LongRow(TypedDict, total=False):
    """One period observation for one region, ready to fold into a curve.

    Adm1 sources resolve `iso_region` (a Natural Earth iso_3166_2 code) themselves, via a
    static lookup table -- the pipeline never fuzzy-matches region names. Partido (or other
    finer-than-admin-1) sources instead set `region_key`/`region_name` directly, since they
    have no iso_3166_2 join target.
    """

    country: str  # ISO3, e.g. "CAN"
    geo: Geo
    iso_region: str | None  # e.g. "CA-ON"; required for geo="adm1"
    region_key: str | None  # explicit output key, e.g. "AR-B-6007"; required for geo="partido"
    region_name: str
    year: int
    period: int  # ISO week (1-53), month (1-12), or quarter (1-4)
    period_type: Literal["week", "month", "quarter"]
    deaths: float  # count sources
    rate: float  # rate sources (mutually exclusive with deaths)


class AgeSexRow(TypedDict, total=False):
    """One observed death count for a region x age band x sex cell.

    Emitted by `load_age_sex()`, which only the sources whose raw files already carry age and
    sex implement. Deliberately separate from `LongRow`: the curve machinery is one-dimensional
    and folding an extra dimension into it would change committed seasonality output. Bands are
    each source's own -- StatCan publishes 0-44/45-64/65-84/85+ and nothing finer, while the
    Brazilian and Mexican microdata carry an exact age -- so a consumer aggregates its own
    estimate up to `bands` rather than the other way round.
    """

    country: str  # ISO3
    geo: Geo
    iso_region: str | None
    region_key: str | None
    region_name: str
    band: int  # index into the source's `bands` array
    sex: Literal["m", "f"]
    deaths: float
    icd_chapter: str  # ICD-10 chapter, e.g. "IX"; only where the source carries cause


@dataclass
class FetchedFile:
    path: Path
    url: str
    sha256: str
    retrieved: str  # ISO date, e.g. "2026-07-19"


@dataclass(frozen=True)
class Source:
    key: str
    country_iso3: str
    geo: Geo
    cadence: Cadence
    retrieval_mode: RetrievalMode
    measurement: Measurement
    urls: tuple[str, ...]
    license: str
    expected_regions: int
    min_annual: int = 500
    enabled: bool = True
    notes: str = ""
