"""Notebook-only harmonic-seasonality experiment helpers.

This module deliberately does not feed the production builder.  It is used by
``notebooks/seasonality.ipynb`` to compare a daily-intensity harmonic model
with the currently shipped circular three-point smoother before any production
port is approved.
"""

from __future__ import annotations

import calendar
import collections
import datetime
import math
from dataclasses import dataclass
from typing import AbstractSet, Iterable

import numpy as np

from pipeline.curve import COVID_YEARS, _month_of_week


MONTHS = 12
# Mean Gregorian month lengths.  They are intentionally fixed across folds so
# every held-out year is scored on the same annual exposure basis.
DAYS = np.array([31, 28.2425, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31], dtype=float)
MONTH_PHASES = (np.cumsum(DAYS) - DAYS / 2) / DAYS.sum()
STRATEGY_ORDER = 3
ROBUST_EWMA_HALF_LIFE = 5.0
ROBUST_HUBER_CUTOFF = 1.5
DYNAMIC_TREND_DAMPING = 0.8
DYNAMIC_LEVEL_NOISE = 0.05
DYNAMIC_SLOPE_NOISE = 0.005
DYNAMIC_OBSERVATION_VARIANCE = 1.0


@dataclass(frozen=True)
class YearVector:
    """One complete non-COVID year's observations on a periodic annual axis."""

    year: int
    values: np.ndarray
    annual_deaths: float
    cadence: str
    phases: np.ndarray
    month_indices: np.ndarray


def _normalise(values: np.ndarray) -> np.ndarray:
    mean = float(np.mean(values))
    if not math.isfinite(mean) or mean <= 0:
        raise ValueError("A seasonal vector must have a positive finite mean.")
    return values / mean


def _normalise_exposure(values: np.ndarray, exposure: np.ndarray) -> np.ndarray:
    """Normalize an intensity so its exposure-weighted annual mean is one."""

    mean = float(np.average(values, weights=exposure))
    if not math.isfinite(mean) or mean <= 0:
        raise ValueError("A seasonal vector must have a positive finite mean.")
    return values / mean


def _quarter_days(year: int, quarter: int) -> int:
    first_month = (quarter - 1) * 3 + 1
    return sum(
        calendar.monthrange(year, first_month + offset)[1] for offset in range(3)
    )


def _month_days(year: int, month_index: int) -> int:
    return calendar.monthrange(year, month_index + 1)[1]


def _month_phases(year: int) -> np.ndarray:
    lengths = np.array(
        [_month_days(year, month) for month in range(MONTHS)], dtype=float
    )
    return (np.cumsum(lengths) - lengths / 2) / lengths.sum()


def _weeks_in_year(year: int) -> int:
    return datetime.date(year, 12, 28).isocalendar().week


def weekly_count_year_vectors(
    rows: Iterable[object], excluded_years: AbstractSet[int] = COVID_YEARS
) -> list[YearVector]:
    """Keep complete weekly count years at weekly resolution for harmonic fitting.

    Counts are first collapsed across demographic rows.  Each ISO week's
    Thursday supplies its phase and output-month assignment, matching the
    production fold while retaining 52/53 observations instead of twelve.
    """

    periods: dict[tuple[int, int], float] = collections.defaultdict(float)
    for row in rows:
        if row.period_type != "week":
            continue
        year, week = int(row.year), int(row.period)
        if year in excluded_years or week > _weeks_in_year(year):
            continue
        periods[(year, week)] += float(row.deaths)

    by_year: dict[int, dict[int, float]] = collections.defaultdict(dict)
    for (year, week), deaths in periods.items():
        by_year[year][week] = deaths

    result = []
    for year in sorted(by_year):
        expected = set(range(1, _weeks_in_year(year) + 1))
        if set(by_year[year]) != expected:
            continue
        days_in_year = 366 if calendar.isleap(year) else 365
        dates = [
            datetime.date.fromisocalendar(year, week, 4) for week in sorted(expected)
        ]
        daily = np.array(
            [by_year[year][week] / 7 for week in sorted(expected)], dtype=float
        )
        if not np.all(np.isfinite(daily)) or np.any(daily <= 0):
            continue
        result.append(
            YearVector(
                year=year,
                values=_normalise(daily),
                annual_deaths=float(sum(by_year[year].values())),
                cadence="week",
                phases=np.array(
                    [
                        ((date - datetime.date(year, 1, 1)).days + 0.5) / days_in_year
                        for date in dates
                    ]
                ),
                month_indices=np.array([date.month - 1 for date in dates], dtype=int),
            )
        )
    return result


def weekly_rate_year_vectors(
    rows: Iterable[object], excluded_years: AbstractSet[int] = COVID_YEARS
) -> list[YearVector]:
    """Keep complete weekly intensive-rate years without treating rates as counts."""

    periods: dict[tuple[int, int], list[float]] = collections.defaultdict(list)
    for row in rows:
        year, week = int(row.year), int(row.period)
        if year in excluded_years or week > _weeks_in_year(year):
            continue
        periods[(year, week)].append(float(row.rate))

    by_year: dict[int, dict[int, float]] = collections.defaultdict(dict)
    for (year, week), values in periods.items():
        by_year[year][week] = float(np.mean(values))

    result = []
    for year in sorted(by_year):
        expected = set(range(1, _weeks_in_year(year) + 1))
        if set(by_year[year]) != expected:
            continue
        days_in_year = 366 if calendar.isleap(year) else 365
        dates = [
            datetime.date.fromisocalendar(year, week, 4) for week in sorted(expected)
        ]
        values = np.array(
            [by_year[year][week] for week in sorted(expected)], dtype=float
        )
        if not np.all(np.isfinite(values)) or np.any(values <= 0):
            continue
        result.append(
            YearVector(
                year=year,
                values=_normalise(values),
                annual_deaths=math.nan,
                cadence="week",
                phases=np.array(
                    [
                        ((date - datetime.date(year, 1, 1)).days + 0.5) / days_in_year
                        for date in dates
                    ]
                ),
                month_indices=np.array([date.month - 1 for date in dates], dtype=int),
            )
        )
    return result


def count_year_vectors(
    rows: Iterable[object], excluded_years: AbstractSet[int] = COVID_YEARS
) -> list[YearVector]:
    """Fold count rows into complete calendar-year daily-intensity vectors.

    Rows may include demographic detail.  Counts are therefore aggregated at a
    source period before an exposure is assigned: a sex/age breakdown must not
    multiply a month's number of days.  Week assignment intentionally matches
    the production curve's ISO Thursday convention.
    """

    periods: dict[tuple[int, str, int], float] = collections.defaultdict(float)
    for row in rows:
        year, period_type, period = int(row.year), row.period_type, int(row.period)
        if year in excluded_years:
            continue
        periods[(year, period_type, period)] += float(row.deaths)

    deaths_by_year: dict[int, dict[int, float]] = collections.defaultdict(
        lambda: collections.defaultdict(float)
    )
    exposure_by_year: dict[int, dict[int, float]] = collections.defaultdict(
        lambda: collections.defaultdict(float)
    )
    annual_by_year: dict[int, float] = collections.defaultdict(float)
    cadence_by_year: dict[int, set[str]] = collections.defaultdict(set)

    for (source_year, period_type, period), deaths in periods.items():
        if period_type == "week":
            cal_year, month = _month_of_week(source_year, period)
            if cal_year is None or cal_year in excluded_years:
                continue
            deaths_by_year[cal_year][month] += deaths
            exposure_by_year[cal_year][month] += 7
            annual_by_year[cal_year] += deaths
            cadence_by_year[cal_year].add("week")
        elif period_type == "month":
            if period < 1 or period > MONTHS:
                continue
            month = period - 1
            days = _month_days(source_year, month)
            deaths_by_year[source_year][month] += deaths
            exposure_by_year[source_year][month] += days
            annual_by_year[source_year] += deaths
            cadence_by_year[source_year].add("month")
        elif period_type == "quarter":
            if period < 1 or period > 4:
                continue
            daily_rate = deaths / _quarter_days(source_year, period)
            for month in range((period - 1) * 3, period * 3):
                days = _month_days(source_year, month)
                deaths_by_year[source_year][month] += daily_rate * days
                exposure_by_year[source_year][month] += days
            annual_by_year[source_year] += deaths
            cadence_by_year[source_year].add("quarter")
        else:
            raise ValueError(f"Unsupported count cadence: {period_type!r}")

    result = []
    for year in sorted(deaths_by_year):
        if set(deaths_by_year[year]) != set(range(MONTHS)):
            continue
        if any(exposure_by_year[year][month] <= 0 for month in range(MONTHS)):
            continue
        daily = np.array(
            [
                deaths_by_year[year][month] / exposure_by_year[year][month]
                for month in range(MONTHS)
            ],
            dtype=float,
        )
        if not np.all(np.isfinite(daily)) or np.any(daily <= 0):
            continue
        result.append(
            YearVector(
                year=year,
                values=_normalise_exposure(
                    daily,
                    np.array(
                        [_month_days(year, month) for month in range(MONTHS)],
                        dtype=float,
                    ),
                ),
                annual_deaths=annual_by_year[year],
                cadence="+".join(sorted(cadence_by_year[year])),
                phases=_month_phases(year),
                month_indices=np.arange(MONTHS, dtype=int),
            )
        )
    return result


def rate_year_vectors(
    rows: Iterable[object], excluded_years: AbstractSet[int] = COVID_YEARS
) -> list[YearVector]:
    """Fold weekly intensive-rate rows into complete monthly annual shapes."""

    weeks: dict[tuple[int, int], list[float]] = collections.defaultdict(list)
    for row in rows:
        source_year, week = int(row.year), int(row.period)
        if source_year in excluded_years:
            continue
        cal_year, month = _month_of_week(source_year, week)
        if cal_year is None or cal_year in excluded_years:
            continue
        weeks[(cal_year, month)].append(float(row.rate))

    by_year: dict[int, dict[int, list[float]]] = collections.defaultdict(
        lambda: collections.defaultdict(list)
    )
    for (year, month), values in weeks.items():
        by_year[year][month].extend(values)

    result = []
    for year in sorted(by_year):
        months = by_year[year]
        if set(months) != set(range(MONTHS)) or any(
            not months[m] for m in range(MONTHS)
        ):
            continue
        values = np.array(
            [float(np.mean(months[m])) for m in range(MONTHS)], dtype=float
        )
        if not np.all(np.isfinite(values)) or np.any(values <= 0):
            continue
        result.append(
            YearVector(
                year,
                _normalise_exposure(
                    values,
                    np.array(
                        [_month_days(year, month) for month in range(MONTHS)],
                        dtype=float,
                    ),
                ),
                math.nan,
                "rate",
                _month_phases(year),
                np.arange(MONTHS, dtype=int),
            )
        )
    return result


def circular_three_point(values: np.ndarray) -> np.ndarray:
    """The currently shipped circular [0.25, 0.5, 0.25] baseline."""

    values = np.asarray(values, dtype=float)
    if values.shape != (MONTHS,):
        raise ValueError("Circular smoothing requires twelve monthly values.")
    return _normalise(
        0.25 * np.roll(values, 1) + 0.5 * values + 0.25 * np.roll(values, -1)
    )


def harmonic_design(phases: np.ndarray, order: int) -> np.ndarray:
    """Intercept plus ``order`` annual Fourier sine/cosine pairs."""

    if order < 1 or order > 5:
        raise ValueError("Harmonic order must be between 1 and 5.")
    phases = np.asarray(phases, dtype=float)
    columns = [np.ones_like(phases)]
    for harmonic in range(1, order + 1):
        angle = 2 * np.pi * harmonic * phases
        columns.extend((np.cos(angle), np.sin(angle)))
    return np.column_stack(columns)


def fit_harmonic_observations(
    phases: np.ndarray, values: np.ndarray, order: int
) -> tuple[np.ndarray, np.ndarray]:
    """Fit observations and return diagnostic month samples plus continuous coefficients."""

    phases = np.asarray(phases, dtype=float)
    values = np.asarray(values, dtype=float)
    if phases.shape != values.shape or values.ndim != 1 or len(values) < 2 * order + 1:
        raise ValueError(
            "Harmonic fitting requires aligned phases and enough observations."
        )
    if not np.all(np.isfinite(values)) or np.any(values <= 0):
        raise ValueError("Harmonic fitting requires positive finite values.")
    design = harmonic_design(phases, order)
    coefficients, *_ = np.linalg.lstsq(design, values, rcond=None)
    return _curve_from_coefficients(coefficients)


def _curve_from_coefficients(coefficients: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Normalize a positive continuous curve to annual integral mean one.

    A Fourier series' annual mean is its intercept.  The returned twelve values
    are only month-centre diagnostics; the coefficients are the actual output.
    """

    coefficients = np.asarray(coefficients, dtype=float)
    order = (len(coefficients) - 1) // 2
    scale = float(coefficients[0])
    if not math.isfinite(scale) or scale <= 0:
        raise ValueError("Harmonic fit produced a non-positive annual mean.")
    coefficients = coefficients / scale
    monthly = harmonic_design(MONTH_PHASES, order) @ coefficients
    dense = (
        harmonic_design(np.linspace(0, 1, 366, endpoint=False), order) @ coefficients
    )
    if np.any(dense <= 0) or not np.all(np.isfinite(dense)):
        raise ValueError("Harmonic fit produced a non-positive annual multiplier.")
    return monthly, coefficients


def _unconstrained_coefficients(year: YearVector, order: int) -> np.ndarray:
    """Fit one year without rejecting transient negative annual predictions.

    Only the final aggregate curve is subject to the positivity contract.  This
    keeps an anomalous annual fit available to the robust aggregation method so
    it can be downweighted rather than silently discarded.
    """

    design = harmonic_design(year.phases, order)
    coefficients, *_ = np.linalg.lstsq(design, year.values, rcond=None)
    scale = float(coefficients[0])
    if not math.isfinite(scale) or scale <= 0:
        raise ValueError(f"Year {year.year} produced a non-positive harmonic mean.")
    return coefficients / scale


def fit_harmonic(values: np.ndarray, order: int) -> tuple[np.ndarray, np.ndarray]:
    """Fit twelve monthly observations; retained as the simple public helper."""

    values = np.asarray(values, dtype=float)
    if values.shape != (MONTHS,):
        raise ValueError("Monthly harmonic fitting requires twelve values.")
    return fit_harmonic_observations(MONTH_PHASES, values, order)


def evaluate_harmonic(coefficients: np.ndarray, phases: np.ndarray) -> np.ndarray:
    """Evaluate normalized Fourier coefficients at annual-cycle phases."""

    order = (len(coefficients) - 1) // 2
    return harmonic_design(np.asarray(phases, dtype=float), order) @ np.asarray(
        coefficients, dtype=float
    )


def monthly_values(year: YearVector) -> np.ndarray:
    """Reduce one monthly or weekly year to twelve source-cadence month means."""

    if len(year.values) == MONTHS and np.array_equal(
        year.month_indices, np.arange(MONTHS)
    ):
        return year.values
    monthly = np.array(
        [
            float(np.mean(year.values[year.month_indices == month]))
            for month in range(MONTHS)
        ],
        dtype=float,
    )
    if not np.all(np.isfinite(monthly)):
        raise ValueError(f"Year {year.year} does not cover all calendar months.")
    return _normalise(monthly)


def day_weighted_rmse(prediction: np.ndarray, actual: np.ndarray) -> float:
    """RMSE across monthly intensities weighted by mean calendar-month exposure."""

    error = np.asarray(prediction, dtype=float) - np.asarray(actual, dtype=float)
    return float(np.sqrt(np.average(error**2, weights=DAYS)))


def _peak_distance(a: np.ndarray, b: np.ndarray) -> int:
    """Circular distance, in months, between two maximum-risk months."""

    delta = abs(int(np.argmax(a)) - int(np.argmax(b)))
    return min(delta, MONTHS - delta)


def _amplitude(curve: np.ndarray) -> float:
    return float(100 * np.sqrt(np.mean((curve - 1) ** 2)))


def _fit_years(years: list[YearVector], order: int) -> tuple[np.ndarray, np.ndarray]:
    phases = np.concatenate([year.phases for year in years])
    values = np.concatenate([year.values for year in years])
    return fit_harmonic_observations(phases, values, order)


def annual_harmonic_coefficients(
    years: list[YearVector], order: int = STRATEGY_ORDER
) -> tuple[np.ndarray, np.ndarray]:
    """Return calendar years and independently fitted annual coefficient rows."""

    ordered = sorted(years, key=lambda year: year.year)
    return (
        np.array([year.year for year in ordered], dtype=int),
        np.vstack([_unconstrained_coefficients(year, order) for year in ordered]),
    )


def mean_annual_harmonic(
    years: list[YearVector], order: int = STRATEGY_ORDER
) -> tuple[np.ndarray, np.ndarray]:
    """Give each independently fitted annual harmonic exactly equal weight."""

    _, coefficients = annual_harmonic_coefficients(years, order)
    return _curve_from_coefficients(np.mean(coefficients, axis=0))


def robust_ewma_harmonic(
    years: list[YearVector],
    target_year: int,
    order: int = STRATEGY_ORDER,
    half_life: float = ROBUST_EWMA_HALF_LIFE,
    huber_cutoff: float = ROBUST_HUBER_CUTOFF,
) -> tuple[np.ndarray, np.ndarray]:
    """Robust exponentially weighted location of annual coefficient vectors."""

    calendar_years, coefficients = annual_harmonic_coefficients(years, order)
    if half_life <= 0 or huber_cutoff <= 0:
        raise ValueError("EWMA half-life and Huber cutoff must be positive.")
    recency = 2.0 ** (-(target_year - calendar_years) / half_life)
    location = np.average(coefficients, axis=0, weights=recency)
    seasonal = coefficients[:, 1:]
    centre = np.median(seasonal, axis=0)
    scale = 1.4826 * np.median(np.abs(seasonal - centre), axis=0)
    quartile_scale = (
        np.percentile(seasonal, 75, axis=0) - np.percentile(seasonal, 25, axis=0)
    ) / 1.349
    scale = np.where(scale > 1e-6, scale, np.maximum(quartile_scale, 1e-6))
    for _ in range(25):
        distance = np.sqrt(np.mean(((seasonal - location[1:]) / scale) ** 2, axis=1))
        robust = np.minimum(1.0, huber_cutoff / np.maximum(distance, 1e-12))
        weights = recency * robust
        updated = np.average(coefficients, axis=0, weights=weights)
        if np.max(np.abs(updated - location)) < 1e-12:
            location = updated
            break
        location = updated
    return _curve_from_coefficients(location)


def dynamic_state_harmonic(
    years: list[YearVector],
    target_year: int,
    order: int = STRATEGY_ORDER,
    damping: float = DYNAMIC_TREND_DAMPING,
) -> tuple[np.ndarray, np.ndarray]:
    """Forecast annual coefficients with a damped local-linear state model.

    The same predeclared state-noise ratios are used for every geography and
    coefficient.  This is deliberately a small notebook experiment rather than
    a per-country hyperparameter search against the held-out target.
    """

    calendar_years, observations = annual_harmonic_coefficients(years, order)
    if not 0 < damping < 1:
        raise ValueError(
            "Dynamic trend damping must lie strictly between zero and one."
        )
    level = observations[0].copy()
    slope = np.zeros_like(level)
    covariance = np.diag([1.0, 0.1])
    observation_variance = DYNAMIC_OBSERVATION_VARIANCE
    for index in range(1, len(calendar_years)):
        gap = int(calendar_years[index] - calendar_years[index - 1])
        damped = damping**gap
        slope_sum = damping * (1 - damped) / (1 - damping)
        transition = np.array([[1.0, slope_sum], [0.0, damped]])
        process = np.diag([DYNAMIC_LEVEL_NOISE * gap, DYNAMIC_SLOPE_NOISE * gap])
        level_prediction = level + slope_sum * slope
        slope_prediction = damped * slope
        covariance_prediction = transition @ covariance @ transition.T + process
        innovation_variance = covariance_prediction[0, 0] + observation_variance
        gain = covariance_prediction[:, 0] / innovation_variance
        innovation = observations[index] - level_prediction
        level = level_prediction + gain[0] * innovation
        slope = slope_prediction + gain[1] * innovation
        covariance = covariance_prediction - np.outer(gain, covariance_prediction[0])

    forecast_gap = int(target_year - calendar_years[-1])
    if forecast_gap < 1:
        raise ValueError("Dynamic target year must follow all training observations.")
    damped = damping**forecast_gap
    slope_sum = damping * (1 - damped) / (1 - damping)
    forecast = level + slope_sum * slope
    return _curve_from_coefficients(forecast)


def _source_cadence_rmse(curve: np.ndarray, held_out: YearVector) -> float:
    prediction = curve[held_out.month_indices]
    if len(held_out.values) == MONTHS:
        return day_weighted_rmse(prediction, held_out.values)
    return float(np.sqrt(np.mean((prediction - held_out.values) ** 2)))


def _continuous_rmse(coefficients: np.ndarray, held_out: YearVector) -> float:
    prediction = evaluate_harmonic(coefficients, held_out.phases)
    if len(held_out.values) == MONTHS:
        return day_weighted_rmse(prediction, held_out.values)
    return float(np.sqrt(np.mean((prediction - held_out.values) ** 2)))


def latest_year_holdout(years: list[YearVector], order: int) -> dict:
    """Train on prior complete years and score the latest complete year only.

    This mirrors the intended production use: all observations known before the
    current year estimate one curve, without allowing the evaluation year to
    influence that curve.
    """

    if len(years) < 2:
        raise ValueError("Latest-year validation needs at least two complete years.")
    ordered = sorted(years, key=lambda year: year.year)
    held_out = ordered[-1]
    training_years = ordered[:-1]
    training_monthly = np.mean(
        [monthly_values(year) for year in training_years], axis=0
    )
    actual_monthly = monthly_values(held_out)
    baseline_curve = circular_three_point(training_monthly)
    harmonic_curve, coefficients = _fit_years(training_years, order)
    continuous_rmse = _continuous_rmse(coefficients, held_out)

    return {
        "target_year": held_out.year,
        "train_through": training_years[-1].year,
        "cadence": held_out.cadence,
        "baseline": {
            "curve": baseline_curve,
            "rmse": _source_cadence_rmse(baseline_curve, held_out),
            "amplitude_error": abs(
                _amplitude(baseline_curve) - _amplitude(actual_monthly)
            ),
            "peak_distance": _peak_distance(baseline_curve, actual_monthly),
        },
        "harmonic": {
            "curve": harmonic_curve,
            "coefficients": coefficients,
            "rmse": continuous_rmse,
            "monthly_step_rmse": _source_cadence_rmse(harmonic_curve, held_out),
            "amplitude_error": abs(
                _amplitude(harmonic_curve) - _amplitude(actual_monthly)
            ),
            "peak_distance": _peak_distance(harmonic_curve, actual_monthly),
        },
    }


def compare_harmonic_strategies(
    countries: dict[str, list[YearVector]],
    order: int = STRATEGY_ORDER,
    target_year_by_country: dict[str, int] | None = None,
) -> dict:
    """Compare four harmonic estimators on an aligned forward holdout year.

    By default the latest available year is held out. ``target_year_by_country``
    fixes the target when comparing two training-year policies, ensuring that
    neither the target nor any later observation can change between variants.
    """

    method_rows: dict[str, list[dict]] = {
        "circular_3_point": [],
        "pooled": [],
        "annual_mean": [],
        "robust_ewma": [],
        "dynamic_state": [],
    }
    failures: list[dict[str, object]] = []
    comparison_countries = (
        countries
        if target_year_by_country is None
        else {
            country: vectors
            for country, vectors in countries.items()
            if country in target_year_by_country
        }
    )
    for country, vectors in comparison_countries.items():
        ordered = sorted(vectors, key=lambda year: year.year)
        target_year = (
            target_year_by_country.get(country)
            if target_year_by_country is not None
            else ordered[-1].year
            if ordered
            else None
        )
        held_out_candidates = [year for year in ordered if year.year == target_year]
        training = [
            year
            for year in ordered
            if target_year is not None and year.year < target_year
        ]
        if len(held_out_candidates) != 1 or not training:
            failures.append(
                {
                    "country": country,
                    "method": "all",
                    "error": f"Target year {target_year!r} is unavailable or has no training year.",
                }
            )
            continue
        held_out = held_out_candidates[0]
        actual_monthly = monthly_values(held_out)
        baseline = circular_three_point(
            np.mean([monthly_values(year) for year in training], axis=0)
        )
        candidates: dict[str, tuple[np.ndarray, np.ndarray | None]] = {
            "circular_3_point": (baseline, None),
        }
        builders = {
            "pooled": lambda training=training: _fit_years(training, order),
            "annual_mean": lambda training=training: mean_annual_harmonic(
                training, order
            ),
            "robust_ewma": lambda training=training, target=held_out.year: (
                robust_ewma_harmonic(training, target, order)
            ),
            "dynamic_state": lambda training=training, target=held_out.year: (
                dynamic_state_harmonic(training, target, order)
            ),
        }
        for method, build in builders.items():
            try:
                candidates[method] = build()
            except ValueError as error:
                failures.append(
                    {"country": country, "method": method, "error": str(error)}
                )

        for method, (curve, coefficients) in candidates.items():
            monthly_step_rmse = _source_cadence_rmse(curve, held_out)
            prediction_rmse = (
                monthly_step_rmse
                if coefficients is None
                else _continuous_rmse(coefficients, held_out)
            )
            method_rows[method].append(
                {
                    "country": country,
                    "cadence": held_out.cadence,
                    "n_training_years": len(training),
                    "train_through": training[-1].year,
                    "target_year": held_out.year,
                    "rmse": prediction_rmse,
                    "monthly_step_rmse": monthly_step_rmse,
                    "amplitude_error": abs(
                        _amplitude(curve) - _amplitude(actual_monthly)
                    ),
                    "peak_distance": _peak_distance(curve, actual_monthly),
                }
            )

    baseline_by_country = {
        row["country"]: row for row in method_rows["circular_3_point"]
    }
    summaries: dict[str, dict[str, object]] = {}
    cadence_summaries: dict[str, dict[str, dict[str, float | int]]] = {}
    for method, rows in method_rows.items():
        errors = np.array([row["rmse"] for row in rows], dtype=float)
        monthly_step = np.array([row["monthly_step_rmse"] for row in rows], dtype=float)
        amplitude = np.array([row["amplitude_error"] for row in rows], dtype=float)
        peaks = np.array([row["peak_distance"] for row in rows], dtype=float)
        paired_delta = np.array(
            [row["rmse"] - baseline_by_country[row["country"]]["rmse"] for row in rows],
            dtype=float,
        )
        wins = sum(
            row["rmse"] < baseline_by_country[row["country"]]["rmse"] for row in rows
        )
        summaries[method] = {
            "countries": len(rows),
            "median_rmse": float(np.median(errors)) if len(errors) else math.nan,
            "p90_rmse": float(np.percentile(errors, 90)) if len(errors) else math.nan,
            "monthly_step_median_rmse": (
                float(np.median(monthly_step)) if len(monthly_step) else math.nan
            ),
            "median_amplitude_error": (
                float(np.median(amplitude)) if len(amplitude) else math.nan
            ),
            "median_peak_distance": float(np.median(peaks)) if len(peaks) else math.nan,
            "median_paired_delta": (
                float(np.median(paired_delta)) if len(paired_delta) else math.nan
            ),
            "wins_vs_circular": wins,
        }
        cadence_summaries[method] = {}
        for cadence in sorted({row["cadence"] for row in rows}):
            cohort = [row for row in rows if row["cadence"] == cadence]
            cohort_delta = [
                row["rmse"] - baseline_by_country[row["country"]]["rmse"]
                for row in cohort
            ]
            cadence_summaries[method][cadence] = {
                "countries": len(cohort),
                "median_rmse": float(np.median([row["rmse"] for row in cohort])),
                "median_paired_delta": float(np.median(cohort_delta)),
                "wins_vs_circular": sum(delta < 0 for delta in cohort_delta),
            }

    complete_methods = [
        method
        for method, summary in summaries.items()
        if summary["countries"] == len(comparison_countries)
        and method != "circular_3_point"
    ]
    lowest_median_method = min(
        complete_methods, key=lambda method: summaries[method]["median_rmse"]
    )
    return {
        "order": order,
        "settings": {
            "robust_ewma_half_life": ROBUST_EWMA_HALF_LIFE,
            "robust_huber_cutoff": ROBUST_HUBER_CUTOFF,
            "dynamic_trend_damping": DYNAMIC_TREND_DAMPING,
            "dynamic_level_noise": DYNAMIC_LEVEL_NOISE,
            "dynamic_slope_noise": DYNAMIC_SLOPE_NOISE,
            "dynamic_observation_variance": DYNAMIC_OBSERVATION_VARIANCE,
        },
        "rows": method_rows,
        "summaries": summaries,
        "cadence_summaries": cadence_summaries,
        "lowest_median_method": lowest_median_method,
        "failures": failures,
    }


def summarize_strategies_by_latitude(
    method_rows: dict[str, list[dict]],
    latitude_by_country: dict[str, float],
    bands: list[tuple[str, float, float]],
) -> list[dict[str, object]]:
    """Produce paired method metrics within absolute country-latitude bands."""

    baseline = {row["country"]: row["rmse"] for row in method_rows["circular_3_point"]}
    summaries: list[dict[str, object]] = []
    for band, lower, upper in bands:
        if lower < 0 or upper <= lower:
            raise ValueError(
                f"Invalid absolute-latitude band {band!r}: {lower}, {upper}"
            )
        for method, rows in method_rows.items():
            cohort = [
                row
                for row in rows
                if row["country"] in latitude_by_country
                and lower <= abs(latitude_by_country[row["country"]]) < upper
            ]
            if not cohort:
                continue
            errors = np.array([row["rmse"] for row in cohort], dtype=float)
            paired = np.array(
                [row["rmse"] - baseline[row["country"]] for row in cohort],
                dtype=float,
            )
            summaries.append(
                {
                    "band": band,
                    "lower": lower,
                    "upper": upper,
                    "method": method,
                    "countries": len(cohort),
                    "weekly": sum(row["cadence"] == "week" for row in cohort),
                    "monthly": sum(row["cadence"] == "month" for row in cohort),
                    "median_rmse": float(np.median(errors)),
                    "p90_rmse": float(np.percentile(errors, 90)),
                    "median_paired_delta": float(np.median(paired)),
                    "wins_vs_circular": int(np.sum(paired < 0)),
                }
            )
    return summaries


def summarize_method_pair_by_group(
    method_rows: dict[str, list[dict]],
    group_by_entity: dict[str, str] | None = None,
    *,
    first_method: str = "pooled",
    second_method: str = "robust_ewma",
    group_order: list[str] | None = None,
) -> list[dict[str, object]]:
    """Compare two methods directly, overall or within named geography cohorts.

    The paired delta is always ``second_method - first_method`` for the same
    held-out geography. Negative values therefore favour the second method.
    Unlabelled entities are omitted from grouped summaries.
    """

    if first_method not in method_rows or second_method not in method_rows:
        raise ValueError("Both requested methods must be present in method rows.")
    first = {row["country"]: row for row in method_rows[first_method]}
    second = {row["country"]: row for row in method_rows[second_method]}
    paired_entities = sorted(set(first) & set(second))

    if group_by_entity is None:
        cohorts = [("Overall", paired_entities)]
    else:
        available_groups = set(group_by_entity.values())
        ordered_groups = (
            [group for group in group_order if group in available_groups]
            if group_order is not None
            else sorted(available_groups)
        )
        cohorts = [
            (
                group,
                [
                    entity
                    for entity in paired_entities
                    if group_by_entity.get(entity) == group
                ],
            )
            for group in ordered_groups
        ]

    summaries: list[dict[str, object]] = []
    for group, entities in cohorts:
        if not entities:
            continue
        first_errors = np.array([first[entity]["rmse"] for entity in entities])
        second_errors = np.array([second[entity]["rmse"] for entity in entities])
        paired_delta = second_errors - first_errors
        summaries.append(
            {
                "group": group,
                "entities": len(entities),
                "weekly": sum(
                    first[entity]["cadence"] == "week" for entity in entities
                ),
                "monthly": sum(
                    first[entity]["cadence"] == "month" for entity in entities
                ),
                "first_method": first_method,
                "second_method": second_method,
                "first_median_rmse": float(np.median(first_errors)),
                "second_median_rmse": float(np.median(second_errors)),
                "first_p90_rmse": float(np.percentile(first_errors, 90)),
                "second_p90_rmse": float(np.percentile(second_errors, 90)),
                "median_paired_delta": float(np.median(paired_delta)),
                "mean_paired_delta": float(np.mean(paired_delta)),
                "second_method_wins": int(np.sum(paired_delta < 0)),
            }
        )
    return summaries


def country_year_vectors(
    groups: Iterable[tuple[str, object]],
    min_annual: float = 10_000,
    excluded_years: AbstractSet[int] = COVID_YEARS,
) -> dict[str, list[YearVector]]:
    """Build quality-gated national vectors under an explicit year policy."""

    countries: dict[str, list[YearVector]] = {}
    for country, frame in groups:
        # Prefer genuinely complete weekly years.  This is the key experiment:
        # order-3 coefficients see 52/53 observations per year instead of the
        # twelve month buckets used by the baseline and monthly-only countries.
        vectors = weekly_count_year_vectors(frame.itertuples(), excluded_years)
        if len(vectors) < 2:
            vectors = count_year_vectors(frame.itertuples(), excluded_years)
        if len(vectors) < 2:
            continue
        if float(np.mean([year.annual_deaths for year in vectors])) < min_annual:
            continue
        countries[country] = vectors
    return countries


def validate_country_groups(
    groups: Iterable[tuple[str, object]], min_annual: float = 10_000
) -> dict:
    """Run a latest-year forecast comparison and deterministic promotion gate.

    ``groups`` is an iterable of ``(country_code, dataframe)`` pairs.  This
    preserves the notebook as the data owner while keeping metric code testable.
    """

    countries = country_year_vectors(groups, min_annual)

    if not countries:
        return {
            "countries": {},
            "orders": {},
            "summaries": {},
            "selected_order": None,
            "rule_selected_order": None,
            "cadence_cohorts": {},
            "latest_year_accuracy": {},
            "gate": {"eligible_countries": False},
            "pass": False,
        }

    order_rows: dict[int, list[dict]] = {order: [] for order in (1, 2, 3)}
    for country, vectors in countries.items():
        for order in order_rows:
            result = latest_year_holdout(vectors, order)
            order_rows[order].append(
                {
                    "country": country,
                    "cadence": "+".join(sorted({year.cadence for year in vectors})),
                    "n_years": len(vectors),
                    **result,
                }
            )

    def aggregate(rows: list[dict]) -> dict:
        baseline = [row["baseline"]["rmse"] for row in rows]
        harmonic = [row["harmonic"]["rmse"] for row in rows]
        monthly_step = [row["harmonic"]["monthly_step_rmse"] for row in rows]
        return {
            "baseline_median_rmse": float(np.median(baseline)),
            "baseline_p90_rmse": float(np.percentile(baseline, 90)),
            "harmonic_median_rmse": float(np.median(harmonic)),
            "harmonic_p90_rmse": float(np.percentile(harmonic, 90)),
            "harmonic_monthly_step_median_rmse": float(np.median(monthly_step)),
            "harmonic_monthly_step_p90_rmse": float(np.percentile(monthly_step, 90)),
        }

    summaries = {order: aggregate(rows) for order, rows in order_rows.items()}
    best_rmse = min(summary["harmonic_median_rmse"] for summary in summaries.values())
    rule_selected_order = min(
        order
        for order, summary in summaries.items()
        if summary["harmonic_median_rmse"] <= best_rmse * 1.01
    )
    # The follow-up experiment explicitly asks whether the third harmonic can
    # be extracted from weekly source data.  Keep the original sweep visible,
    # but gate the requested order rather than silently falling back to order 2.
    selected_order = 3
    selected_rows = order_rows[selected_order]
    selected = summaries[selected_order]

    cohort_pass = True
    cadence_cohorts: dict[str, dict] = {}
    for cadence in sorted({row["cadence"] for row in selected_rows}):
        cohort = [row for row in selected_rows if row["cadence"] == cadence]
        if len(cohort) < 3:
            continue
        baseline = float(np.median([row["baseline"]["rmse"] for row in cohort]))
        harmonic = float(np.median([row["harmonic"]["rmse"] for row in cohort]))
        monthly_step = float(
            np.median([row["harmonic"]["monthly_step_rmse"] for row in cohort])
        )
        passed = harmonic <= baseline * 1.10
        cadence_cohorts[cadence] = {
            "countries": len(cohort),
            "baseline": baseline,
            "harmonic": harmonic,
            "harmonic_monthly_step": monthly_step,
            "pass": passed,
        }
        cohort_pass = cohort_pass and passed

    def prediction_metric(path: str) -> tuple[float, float]:
        baseline = float(np.median([row["baseline"][path] for row in selected_rows]))
        harmonic = float(np.median([row["harmonic"][path] for row in selected_rows]))
        return baseline, harmonic

    amplitude_base, amplitude_harmonic = prediction_metric("amplitude_error")
    peak_base, peak_harmonic = prediction_metric("peak_distance")
    valid = True
    for vectors in countries.values():
        _, coefficients = _fit_years(vectors, selected_order)
        dense = evaluate_harmonic(coefficients, np.linspace(0, 1, 366, endpoint=False))
        valid = (
            valid
            and len(coefficients) == 2 * selected_order + 1
            and bool(np.all(np.isfinite(dense)))
            and bool(np.all(dense > 0.3))
            and bool(np.all(dense < 3))
            and abs(float(coefficients[0]) - 1) < 1e-12
        )

    gate = {
        "median_rmse": selected["harmonic_median_rmse"]
        <= selected["baseline_median_rmse"],
        "p90_rmse": selected["harmonic_p90_rmse"]
        <= selected["baseline_p90_rmse"] * 1.05,
        "cadence_cohorts": cohort_pass,
        "amplitude_accuracy": amplitude_harmonic <= amplitude_base,
        "peak_accuracy": peak_harmonic <= peak_base,
        "valid_curves": valid,
    }
    return {
        "countries": countries,
        "orders": order_rows,
        "summaries": summaries,
        "selected_order": selected_order,
        "rule_selected_order": rule_selected_order,
        "cadence_cohorts": cadence_cohorts,
        "latest_year_accuracy": {
            "amplitude": {"baseline": amplitude_base, "harmonic": amplitude_harmonic},
            "peak": {"baseline": peak_base, "harmonic": peak_harmonic},
        },
        "gate": gate,
        "pass": all(gate.values()),
    }
