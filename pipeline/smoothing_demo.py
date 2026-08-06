"""Build the selectable weekly-country payload for the roadmap smoothing explainer."""

from __future__ import annotations

import calendar
import math
from collections import defaultdict

import numpy as np

from .curve import (
    COVID_YEARS,
    MEAN_MONTH_DAYS,
    MONTH_PHASES,
    _fit_pooled,
    _monthly_count_years,
    _weekly_count_years,
    evaluate_harmonic,
)

HARMONIC_ORDERS = (1, 2, 3, 4)
MIN_ANNUAL_DEATHS = 10_000
DEFAULT_COUNTRY = "CHE"


def _points(phases, values, digits=6):
    return [
        [round(float(phase), digits), round(float(value), digits)]
        for phase, value in zip(phases, values, strict=True)
    ]


def _mean_monthly(years):
    values = np.mean([year.values for year in years], axis=0)
    return values / np.average(values, weights=MEAN_MONTH_DAYS)


def _country_payload(rows, iso3: str, name: str, min_annual: float) -> dict | None:
    records = list(rows.itertuples()) if hasattr(rows, "itertuples") else list(rows)
    weekly_years = _weekly_count_years(records)
    monthly_years = _monthly_count_years(records)
    if not weekly_years or not monthly_years:
        return None
    if np.mean([year.annual_deaths for year in weekly_years]) < min_annual:
        return None

    weekly_by_index: dict[int, list[tuple[float, float]]] = defaultdict(list)
    for year in weekly_years:
        for index, (phase, value) in enumerate(
            zip(year.phases, year.values, strict=True), start=1
        ):
            weekly_by_index[index].append((float(phase), float(value)))
    weekly_phases = [
        np.mean([item[0] for item in weekly_by_index[index]])
        for index in sorted(weekly_by_index)
    ]
    weekly_values = np.asarray(
        [
            np.mean([item[1] for item in weekly_by_index[index]])
            for index in sorted(weekly_by_index)
        ]
    )
    weekly_values /= np.mean(weekly_values)

    monthly = _mean_monthly(monthly_years)
    quarter_values = []
    quarter_phases = []
    elapsed = 0.0
    annual_days = float(MEAN_MONTH_DAYS.sum())
    quarter_days = []
    for quarter in range(4):
        months = slice(quarter * 3, quarter * 3 + 3)
        days = MEAN_MONTH_DAYS[months]
        quarter_values.append(float(np.average(monthly[months], weights=days)))
        days_in_quarter = float(days.sum())
        quarter_days.append(days_in_quarter)
        quarter_phases.append((elapsed + days_in_quarter / 2) / annual_days)
        elapsed += days_in_quarter
    quarter_values = np.asarray(quarter_values)
    quarter_values /= np.average(quarter_values, weights=quarter_days)

    circular = 0.25 * np.roll(monthly, 1) + 0.5 * monthly + 0.25 * np.roll(monthly, -1)
    circular /= np.average(circular, weights=MEAN_MONTH_DAYS)

    harmonics = {}
    dense_phases = np.linspace(0, 1, 1464, endpoint=False)
    domain_values = [weekly_values, monthly, quarter_values, circular]
    try:
        for order in HARMONIC_ORDERS:
            coefficients = _fit_pooled(weekly_years, order)
            harmonics[str(order)] = {
                "order": order,
                "coefficients": [round(float(value), 8) for value in coefficients],
            }
            domain_values.append(evaluate_harmonic(coefficients, dense_phases))
    except ValueError:
        return None

    low = min(float(np.min(values)) for values in domain_values)
    high = max(float(np.max(values)) for values in domain_values)
    padding = max(0.015, (high - low) * 0.08)
    y_domain = [math.floor((low - padding) * 20) / 20, math.ceil((high + padding) * 20) / 20]

    years = sorted(year.year for year in weekly_years)
    observations = _points(MONTH_PHASES, monthly)
    return {
        "name": name,
        "iso3": iso3,
        "years": years,
        "leapYears": [year for year in years if calendar.isleap(year)],
        "yDomain": y_domain,
        "modes": {
            "weekly": {"observations": _points(weekly_phases, weekly_values)},
            "monthly": {"observations": observations},
            "quarterly": {"observations": _points(quarter_phases, quarter_values)},
            "circular3": {
                "observations": observations,
                "smoothed": _points(MONTH_PHASES, circular),
            },
        },
        "harmonics": harmonics,
    }


def build_smoothing_demo_dataset(
    country_rows,
    country_names: dict[str, str] | None = None,
    min_annual: float = MIN_ANNUAL_DEATHS,
) -> dict:
    """Return comparable cadence views and order 1–4 fits for eligible weekly countries."""

    country_names = country_names or {}
    groups = country_rows.items() if hasattr(country_rows, "items") else country_rows
    countries = {}
    for iso3, rows in groups:
        code = str(iso3)
        payload = _country_payload(rows, code, country_names.get(code, code), min_annual)
        if payload is not None:
            countries[code] = payload
    countries = dict(sorted(countries.items(), key=lambda item: (item[1]["name"], item[0])))
    if not countries:
        raise ValueError("The smoothing demo requires an eligible complete weekly country series.")

    default_country = DEFAULT_COUNTRY if DEFAULT_COUNTRY in countries else next(iter(countries))
    return {
        "meta": {
            "source": "HMD STMF and World Mortality Dataset, observed weekly deaths",
            "defaultCountry": default_country,
            "countryCount": len(countries),
            "covidExcluded": sorted(COVID_YEARS),
            "normalization": "daily mortality intensity; annual exposure-weighted mean 1",
            "harmonicOrders": list(HARMONIC_ORDERS),
            "generatedBy": "pipeline.smoothing_demo.build_smoothing_demo_dataset",
        },
        "countries": countries,
    }


def build_smoothing_demo(rows) -> dict:
    """Backward-compatible one-country wrapper, primarily useful in focused tests."""

    return build_smoothing_demo_dataset(
        [(DEFAULT_COUNTRY, rows)], {DEFAULT_COUNTRY: "Switzerland"}, min_annual=0
    )
