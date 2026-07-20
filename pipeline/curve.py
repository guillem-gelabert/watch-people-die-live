"""Canonical seasonal-curve derivation, shared by the country-level model
(`notebooks/seasonality.ipynb`) and the sub-national retrieval pipeline (this package).

`country_curve` is lifted verbatim from seasonality.ipynb so both models fold counts into
a 12-point monthly shape identically -- no drift. `rate_curve` is the variant for weekly
*rate* inputs (e.g. RusSTMF SDR), which are averaged within a month rather than summed and
carry no absolute-count gate. The `*_records` wrappers run either over plain record
dictionaries instead of a pandas DataFrame, for sources that build rows as dicts.
"""

import collections
import datetime
import math
from types import SimpleNamespace

COVID_YEARS = {2020, 2021, 2022}


def _iso_weeks_in_year(y):
    return datetime.date(y, 12, 28).isocalendar()[1]


def _month_of_week(year, week):
    if week > _iso_weeks_in_year(year):
        return None, None
    d = datetime.date.fromisocalendar(year, week, 4)  # ISO week's Thursday decides the month
    return d.year, d.month - 1


def _months_of_quarter(period):
    # UNIFIED_COLS quarter `period` is 1-4 (Q1..Q4); expand flat across its 3 months.
    return [(period - 1) * 3 + i for i in range(3)]


def _smooth_normalize(avg):
    """Circular 3-tap [0.25, 0.5, 0.25] smooth, then renormalise to mean 1."""
    smoothed = [0.25 * avg[(i - 1) % 12] + 0.5 * avg[i] + 0.25 * avg[(i + 1) % 12] for i in range(12)]
    mean = sum(smoothed) / 12
    return [x / mean for x in smoothed]


def country_curve(rows, min_years=1, min_annual=10_000):
    """Fold one country's rows (any mix of week/month/quarter cadence) into a
    12-point seasonal curve. None if no calendar year is complete or too small."""
    by_year = collections.defaultdict(lambda: collections.defaultdict(float))
    for r in rows.itertuples():
        if r.year in COVID_YEARS:
            continue
        if r.period_type == "week":
            cal_year, month = _month_of_week(int(r.year), int(r.period))
            if cal_year is None or cal_year in COVID_YEARS:
                continue
            by_year[cal_year][month] += r.deaths
        elif r.period_type == "month":
            by_year[r.year][r.period - 1] += r.deaths
        elif r.period_type == "quarter":
            for m in _months_of_quarter(r.period):
                by_year[r.year][m] += r.deaths / 3

    vecs, totals = [], []
    for months in by_year.values():
        if len(months) == 12:
            vals = [months[i] for i in range(12)]
            total = sum(vals)
            if total > 0:
                vecs.append([v / total * 12 for v in vals])
                totals.append(total)

    n_years = len(vecs)
    if n_years < min_years:
        return None
    avg = [sum(v[i] for v in vecs) / n_years for i in range(12)]
    curve = _smooth_normalize(avg)
    annual = sum(totals) / len(totals)
    if annual < min_annual:
        return None
    return {"curve": curve, "n_years": n_years, "annual": annual}


class _RecordRows:
    """Small DataFrame-compatible adapter for scripts that use plain dictionaries."""

    def __init__(self, records):
        self.records = records

    def itertuples(self):
        return (SimpleNamespace(**record) for record in self.records)


def country_curve_records(records, min_years=1, min_annual=10_000):
    """Run the canonical count-based curve derivation over plain record dictionaries."""
    return country_curve(_RecordRows(records), min_years=min_years, min_annual=min_annual)


def rate_curve(rows, min_years=1):
    """Fold one region's weekly *rate* rows (e.g. RusSTMF SDR) into a 12-point
    seasonal curve. Weekly rates are averaged within each calendar month (a rate
    is intensive, so it must not be summed), then normalised per complete non-COVID
    year to mean 1, averaged across years, and lightly smoothed. Rates are already
    population-standardised, so there is no absolute-count (`min_annual`) gate."""
    by_year = collections.defaultdict(lambda: collections.defaultdict(list))
    for r in rows.itertuples():
        if r.year in COVID_YEARS:
            continue
        cal_year, month = _month_of_week(int(r.year), int(r.period))
        if cal_year is None or cal_year in COVID_YEARS:
            continue
        by_year[cal_year][month].append(r.rate)

    vecs = []
    for months in by_year.values():
        if len(months) == 12:
            monthly = [sum(months[i]) / len(months[i]) for i in range(12)]  # mean weekly rate per month
            mean = sum(monthly) / 12
            if mean > 0:
                vecs.append([v / mean for v in monthly])

    n_years = len(vecs)
    if n_years < min_years:
        return None
    avg = [sum(v[i] for v in vecs) / n_years for i in range(12)]
    curve = _smooth_normalize(avg)
    return {"curve": curve, "n_years": n_years, "annual": None}


def rate_curve_records(records, min_years=1):
    """Run the canonical rate-based curve derivation over plain record dictionaries."""
    return rate_curve(_RecordRows(records), min_years=min_years)


def cov_pct(curve):
    return 100 * (sum((x - 1) ** 2 for x in curve) / 12) ** 0.5


def winter_amp(curve):
    return sum(c * math.cos(2 * math.pi * m / 12) for m, c in enumerate(curve)) / 12 * 2
