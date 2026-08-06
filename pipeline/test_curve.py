import calendar
import datetime
import math
import unittest

import numpy as np

from pipeline.curve import (
    HARMONIC_ORDER,
    country_curve_records,
    evaluate_harmonic,
    rate_curve_records,
)


def monthly_year(year, daily=lambda _phase: 100.0):
    rows = []
    days_in_year = 366 if calendar.isleap(year) else 365
    elapsed = 0
    for month in range(1, 13):
        days = calendar.monthrange(year, month)[1]
        phase = (elapsed + days / 2) / days_in_year
        rows.append(
            {
                "year": year,
                "period_type": "month",
                "period": month,
                "deaths": daily(phase) * days,
            }
        )
        elapsed += days
    return rows


def weekly_year(year, *, rate=False):
    rows = []
    days = 366 if calendar.isleap(year) else 365
    for week in range(1, datetime.date(year, 12, 28).isocalendar().week + 1):
        date = datetime.date.fromisocalendar(year, week, 4)
        phase = ((date - datetime.date(year, 1, 1)).days + 0.5) / days
        value = 100 * (1 + 0.12 * math.cos(2 * math.pi * phase) - 0.04 * math.sin(4 * math.pi * phase))
        row = {"year": year, "period_type": "week", "period": week}
        row["rate" if rate else "deaths"] = value if rate else value * 7
        rows.append(row)
    return rows


class HarmonicCurveTest(unittest.TestCase):
    def test_flat_monthly_daily_intensity_stays_flat_across_leap_years(self):
        result = country_curve_records(monthly_year(2019) + monthly_year(2024), min_annual=0)
        self.assertIsNotNone(result)
        np.testing.assert_allclose(result["harmonic"]["coefficients"], [1] + [0] * 8, atol=1e-10)
        self.assertEqual(result["harmonic"]["order"], HARMONIC_ORDER)

    def test_complete_weekly_counts_recover_known_harmonics_without_month_bucketing(self):
        rows = weekly_year(2018) + weekly_year(2019) + weekly_year(2023)
        result = country_curve_records(rows, min_annual=0)
        self.assertEqual(result["cadence"], "week")
        coefficients = result["harmonic"]["coefficients"]
        self.assertAlmostEqual(coefficients[1], 0.12, places=10)
        self.assertAlmostEqual(coefficients[4], -0.04, delta=1e-8)
        self.assertGreater(float(evaluate_harmonic(coefficients, [0.25])[0]), 0)

    def test_rate_inputs_remain_intensive_and_exclude_covid(self):
        rows = weekly_year(2019, rate=True) + weekly_year(2020, rate=True) + weekly_year(2023, rate=True)
        result = rate_curve_records(rows)
        self.assertEqual(result["n_years"], 2)
        self.assertIsNone(result["annual"])
        self.assertAlmostEqual(result["harmonic"]["coefficients"][0], 1)

    def test_quarter_counts_use_calendar_day_exposure(self):
        rows = []
        for quarter in range(1, 5):
            months = range((quarter - 1) * 3 + 1, quarter * 3 + 1)
            days = sum(calendar.monthrange(2023, month)[1] for month in months)
            rows.append(
                {"year": 2023, "period_type": "quarter", "period": quarter, "deaths": 50 * days}
            )
        result = country_curve_records(rows, min_annual=0)
        np.testing.assert_allclose(result["harmonic"]["coefficients"], [1] + [0] * 8, atol=1e-10)

    def test_quality_gates_reject_incomplete_and_small_series(self):
        incomplete = monthly_year(2023)[:-1]
        self.assertIsNone(country_curve_records(incomplete, min_annual=0))
        self.assertIsNone(country_curve_records(monthly_year(2023), min_annual=1_000_000))


if __name__ == "__main__":
    unittest.main()
