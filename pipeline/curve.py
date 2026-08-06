"""Canonical continuous mortality-seasonality curve derivation.

The production curve is one pooled order-4 Fourier regression over every complete,
quality-gated, non-COVID year. Count observations are converted to daily intensity before
fitting; already-standardised rate observations remain intensive. Complete weekly sources
retain their 52/53 observations instead of being reduced to months.
"""

from __future__ import annotations

import calendar
import collections
import datetime
import math
from dataclasses import dataclass
from types import SimpleNamespace

import numpy as np

COVID_YEARS = {2020, 2021, 2022}
HARMONIC_ORDER = 4
MONTHS = 12
MEAN_MONTH_DAYS = np.array(
    [31, 28.2425, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31], dtype=float
)
MONTH_PHASES = (np.cumsum(MEAN_MONTH_DAYS) - MEAN_MONTH_DAYS / 2) / MEAN_MONTH_DAYS.sum()


@dataclass(frozen=True)
class _YearObservations:
    year: int
    phases: np.ndarray
    values: np.ndarray
    annual_deaths: float
    cadence: str


def _iso_weeks_in_year(year: int) -> int:
    return datetime.date(year, 12, 28).isocalendar().week


def _month_of_week(year: int, week: int) -> tuple[int | None, int | None]:
    if week < 1 or week > _iso_weeks_in_year(year):
        return None, None
    date = datetime.date.fromisocalendar(year, week, 4)
    return date.year, date.month - 1


def _months_of_quarter(period: int) -> list[int]:
    return [(period - 1) * 3 + offset for offset in range(3)]


def _month_days(year: int, month: int) -> int:
    return calendar.monthrange(year, month + 1)[1]


def _quarter_days(year: int, quarter: int) -> int:
    return sum(_month_days(year, month) for month in _months_of_quarter(quarter))


def _month_phases(year: int) -> np.ndarray:
    lengths = np.array([_month_days(year, month) for month in range(MONTHS)], dtype=float)
    return (np.cumsum(lengths) - lengths / 2) / lengths.sum()


def _normalise(values: np.ndarray, exposure: np.ndarray | None = None) -> np.ndarray:
    mean = float(np.average(values, weights=exposure)) if exposure is not None else float(np.mean(values))
    if not math.isfinite(mean) or mean <= 0:
        raise ValueError("A seasonal vector must have a positive finite mean.")
    return values / mean


def _weekly_count_years(rows: list[object]) -> list[_YearObservations]:
    periods: dict[tuple[int, int], float] = collections.defaultdict(float)
    for row in rows:
        if row.period_type != "week":
            continue
        year, week = int(row.year), int(row.period)
        if year in COVID_YEARS or week > _iso_weeks_in_year(year):
            continue
        periods[(year, week)] += float(row.deaths)

    by_year: dict[int, dict[int, float]] = collections.defaultdict(dict)
    for (year, week), deaths in periods.items():
        by_year[year][week] = deaths

    result = []
    for year in sorted(by_year):
        weeks = range(1, _iso_weeks_in_year(year) + 1)
        if set(by_year[year]) != set(weeks):
            continue
        values = np.array([by_year[year][week] / 7 for week in weeks], dtype=float)
        if not np.all(np.isfinite(values)) or np.any(values <= 0):
            continue
        days = 366 if calendar.isleap(year) else 365
        dates = [datetime.date.fromisocalendar(year, week, 4) for week in weeks]
        result.append(
            _YearObservations(
                year,
                np.array([((date - datetime.date(year, 1, 1)).days + 0.5) / days for date in dates]),
                _normalise(values),
                float(sum(by_year[year].values())),
                "week",
            )
        )
    return result


def _monthly_count_years(rows: list[object]) -> list[_YearObservations]:
    periods: dict[tuple[int, str, int], float] = collections.defaultdict(float)
    for row in rows:
        year, cadence, period = int(row.year), str(row.period_type), int(row.period)
        if year not in COVID_YEARS:
            periods[(year, cadence, period)] += float(row.deaths)

    deaths: dict[int, dict[int, float]] = collections.defaultdict(lambda: collections.defaultdict(float))
    exposure: dict[int, dict[int, float]] = collections.defaultdict(lambda: collections.defaultdict(float))
    annual: dict[int, float] = collections.defaultdict(float)
    cadence: dict[int, set[str]] = collections.defaultdict(set)
    for (source_year, period_type, period), count in periods.items():
        if period_type == "week":
            cal_year, month = _month_of_week(source_year, period)
            if cal_year is None or month is None or cal_year in COVID_YEARS:
                continue
            deaths[cal_year][month] += count
            exposure[cal_year][month] += 7
            annual[cal_year] += count
        elif period_type == "month" and 1 <= period <= 12:
            month = period - 1
            days = _month_days(source_year, month)
            deaths[source_year][month] += count
            exposure[source_year][month] += days
            annual[source_year] += count
        elif period_type == "quarter" and 1 <= period <= 4:
            daily = count / _quarter_days(source_year, period)
            for month in _months_of_quarter(period):
                days = _month_days(source_year, month)
                deaths[source_year][month] += daily * days
                exposure[source_year][month] += days
            annual[source_year] += count
        else:
            continue
        cadence[source_year].add(period_type)

    result = []
    for year in sorted(deaths):
        if set(deaths[year]) != set(range(MONTHS)):
            continue
        weights = np.array([_month_days(year, month) for month in range(MONTHS)], dtype=float)
        values = np.array(
            [deaths[year][month] / exposure[year][month] for month in range(MONTHS)], dtype=float
        )
        if not np.all(np.isfinite(values)) or np.any(values <= 0):
            continue
        result.append(
            _YearObservations(
                year,
                _month_phases(year),
                _normalise(values, weights),
                annual[year],
                "+".join(sorted(cadence[year])),
            )
        )
    return result


def _weekly_rate_years(rows: list[object]) -> list[_YearObservations]:
    periods: dict[tuple[int, int], list[float]] = collections.defaultdict(list)
    for row in rows:
        year, week = int(row.year), int(row.period)
        if year not in COVID_YEARS and 1 <= week <= _iso_weeks_in_year(year):
            periods[(year, week)].append(float(row.rate))
    by_year: dict[int, dict[int, float]] = collections.defaultdict(dict)
    for (year, week), rates in periods.items():
        by_year[year][week] = float(np.mean(rates))

    result = []
    for year in sorted(by_year):
        weeks = range(1, _iso_weeks_in_year(year) + 1)
        if set(by_year[year]) != set(weeks):
            continue
        values = np.array([by_year[year][week] for week in weeks], dtype=float)
        if not np.all(np.isfinite(values)) or np.any(values <= 0):
            continue
        days = 366 if calendar.isleap(year) else 365
        dates = [datetime.date.fromisocalendar(year, week, 4) for week in weeks]
        result.append(
            _YearObservations(
                year,
                np.array([((date - datetime.date(year, 1, 1)).days + 0.5) / days for date in dates]),
                _normalise(values),
                math.nan,
                "week",
            )
        )
    return result


def harmonic_design(phases: np.ndarray, order: int = HARMONIC_ORDER) -> np.ndarray:
    phases = np.asarray(phases, dtype=float)
    columns = [np.ones_like(phases)]
    for harmonic in range(1, order + 1):
        angle = 2 * np.pi * harmonic * phases
        columns.extend((np.cos(angle), np.sin(angle)))
    return np.column_stack(columns)


def evaluate_harmonic(coefficients, phases) -> np.ndarray:
    coefficients = np.asarray(coefficients, dtype=float)
    order = (len(coefficients) - 1) // 2
    return harmonic_design(np.asarray(phases, dtype=float), order) @ coefficients


def _fit_pooled(years: list[_YearObservations], order: int = HARMONIC_ORDER) -> np.ndarray:
    phases = np.concatenate([year.phases for year in years])
    values = np.concatenate([year.values for year in years])
    coefficients, *_ = np.linalg.lstsq(harmonic_design(phases, order), values, rcond=None)
    intercept = float(coefficients[0])
    if not math.isfinite(intercept) or intercept <= 0:
        raise ValueError("Harmonic fit produced a non-positive annual mean.")
    coefficients = coefficients / intercept
    dense = evaluate_harmonic(coefficients, np.linspace(0, 1, 1464, endpoint=False))
    if not np.all(np.isfinite(dense)) or np.any(dense <= 0):
        raise ValueError("Harmonic fit produced a non-positive annual multiplier.")
    return coefficients


def _result(years: list[_YearObservations], min_years: int, min_annual: float | None):
    if len(years) < min_years:
        return None
    annual = None if min_annual is None else float(np.mean([year.annual_deaths for year in years]))
    if min_annual is not None and (annual is None or annual < min_annual):
        return None
    try:
        coefficients = _fit_pooled(years)
    except ValueError:
        return None
    curve = evaluate_harmonic(coefficients, MONTH_PHASES).tolist()
    return {
        # Month-centre samples are diagnostics for existing notebook tables only. Production
        # artifacts serialize `harmonic`, which is continuous and is never month-bucketed.
        "curve": curve,
        "harmonic": {"order": HARMONIC_ORDER, "coefficients": coefficients.tolist()},
        "n_years": len(years),
        "annual": annual,
        "cadence": "week" if all(year.cadence == "week" for year in years) else "month",
    }


def country_curve(rows, min_years=1, min_annual=10_000):
    """Fit pooled order-4 seasonality to a country's complete non-COVID count years."""
    records = list(rows.itertuples())
    weekly = _weekly_count_years(records)
    years = weekly if len(weekly) >= min_years else _monthly_count_years(records)
    return _result(years, min_years, min_annual)


class _RecordRows:
    def __init__(self, records):
        self.records = records

    def itertuples(self):
        return (SimpleNamespace(**record) for record in self.records)


def country_curve_records(records, min_years=1, min_annual=10_000):
    return country_curve(_RecordRows(records), min_years=min_years, min_annual=min_annual)


def rate_curve(rows, min_years=1):
    """Fit pooled order-4 seasonality to complete non-COVID weekly rate years."""
    return _result(_weekly_rate_years(list(rows.itertuples())), min_years, None)


def rate_curve_records(records, min_years=1):
    return rate_curve(_RecordRows(records), min_years=min_years)


def cov_pct(curve):
    values = np.asarray(curve, dtype=float)
    return 100 * float(np.sqrt(np.mean((values - 1) ** 2)))


def winter_amp(curve):
    values = np.asarray(curve, dtype=float)
    return float(
        sum(value * math.cos(2 * math.pi * month / len(values)) for month, value in enumerate(values))
        / len(values)
        * 2
    )
