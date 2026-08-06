from __future__ import annotations

from types import SimpleNamespace
import unittest

import numpy as np
import pandas as pd

from harmonic_seasonality import (
    MONTH_PHASES,
    MONTHS,
    YearVector,
    compare_harmonic_strategies,
    circular_three_point,
    count_year_vectors,
    dynamic_state_harmonic,
    evaluate_harmonic,
    fit_harmonic,
    fit_harmonic_observations,
    latest_year_holdout,
    mean_annual_harmonic,
    rate_year_vectors,
    robust_ewma_harmonic,
    summarize_method_pair_by_group,
    summarize_strategies_by_latitude,
    validate_country_groups,
    weekly_count_year_vectors,
    weekly_rate_year_vectors,
)


def count_row(
    year: int, period_type: str, period: int, deaths: float
) -> SimpleNamespace:
    return SimpleNamespace(
        year=year, period_type=period_type, period=period, deaths=deaths
    )


class HarmonicSeasonalityTest(unittest.TestCase):
    @staticmethod
    def harmonic_year(year: int, amplitude: float) -> YearVector:
        values = 1 + amplitude * np.cos(2 * np.pi * MONTH_PHASES)
        return YearVector(
            year=year,
            values=values,
            annual_deaths=100_000,
            cadence="month",
            phases=MONTH_PHASES,
            month_indices=np.arange(MONTHS),
        )

    def test_flat_series_stays_flat(self):
        curve, _ = fit_harmonic(np.ones(MONTHS), 2)
        np.testing.assert_allclose(curve, np.ones(MONTHS), atol=1e-12)

    def test_recovers_a_two_harmonic_signal(self):
        phases = MONTH_PHASES
        values = (
            1 + 0.16 * np.cos(2 * np.pi * phases) + 0.05 * np.sin(4 * np.pi * phases)
        )
        curve, coefficients = fit_harmonic(values, 2)
        np.testing.assert_allclose(curve, values, atol=1e-12)
        self.assertAlmostEqual(float(coefficients[0]), 1)

    def test_order_five_recovers_a_positive_weekly_signal(self):
        phases = (np.arange(52) + 0.5) / 52
        values = (
            1 + 0.12 * np.cos(2 * np.pi * phases) + 0.02 * np.sin(10 * np.pi * phases)
        )

        _, coefficients = fit_harmonic_observations(phases, values, order=5)
        dense = evaluate_harmonic(coefficients, np.linspace(0, 1, 366, endpoint=False))

        np.testing.assert_allclose(
            evaluate_harmonic(coefficients, phases), values, atol=1e-12
        )
        self.assertTrue(np.all(dense > 0))

    def test_complete_weekly_year_retains_weekly_observations(self):
        rows = [count_row(2019, "week", week, 70 + week) for week in range(1, 53)]
        [year] = weekly_count_year_vectors(rows)
        self.assertEqual(len(year.values), 52)
        self.assertEqual(len(year.phases), 52)
        self.assertEqual(year.cadence, "week")

    def test_circular_smoother_wraps_december_to_january(self):
        values = np.ones(MONTHS)
        values[0] = 2
        smoothed = circular_three_point(values)
        self.assertGreater(smoothed[-1], 1)
        self.assertAlmostEqual(float(smoothed.mean()), 1)

    def test_monthly_counts_use_leap_year_exposure(self):
        rows = [
            count_row(
                2016,
                "month",
                month,
                100
                * (
                    29 if month == 2 else 31 if month in {1, 3, 5, 7, 8, 10, 12} else 30
                ),
            )
            for month in range(1, 13)
        ]
        [year] = count_year_vectors(rows)
        np.testing.assert_allclose(year.values, np.ones(MONTHS), atol=1e-12)

    def test_weekly_demographic_rows_do_not_multiply_exposure(self):
        rows = []
        for week in range(1, 53):
            rows.extend(
                (count_row(2019, "week", week, 70), count_row(2019, "week", week, 30))
            )
        [year] = count_year_vectors(rows)
        self.assertTrue(np.all(np.isfinite(year.values)))
        self.assertAlmostEqual(float(year.values.mean()), 1)

    def test_quarterly_counts_are_daily_rate_flat_within_quarter(self):
        rows = [
            count_row(2019, "quarter", quarter, 91 * quarter) for quarter in range(1, 5)
        ]
        [year] = count_year_vectors(rows)
        self.assertAlmostEqual(year.values[0], year.values[1])
        self.assertAlmostEqual(year.values[1], year.values[2])

    def test_covid_years_are_excluded(self):
        rows = [count_row(2020, "month", month, 100) for month in range(1, 13)]
        self.assertEqual(count_year_vectors(rows), [])

    def test_covid_years_can_be_included_explicitly(self):
        rows = [count_row(2020, "month", month, 100) for month in range(1, 13)]

        [year] = count_year_vectors(rows, excluded_years=frozenset())

        self.assertEqual(year.year, 2020)
        self.assertEqual(len(year.values), MONTHS)

    def test_incomplete_year_is_excluded(self):
        rows = [count_row(2019, "month", month, 100) for month in range(1, 12)]
        self.assertEqual(count_year_vectors(rows), [])

    def test_weekly_rate_rows_are_averaged_not_summed(self):
        rows = []
        for week in range(1, 53):
            rows.append(SimpleNamespace(year=2019, period=week, rate=10.0))
        [year] = rate_year_vectors(rows)
        np.testing.assert_allclose(year.values, np.ones(MONTHS), atol=1e-12)

    def test_complete_weekly_rates_stay_at_weekly_resolution(self):
        rows = [
            SimpleNamespace(year=2019, period=week, rate=10.0) for week in range(1, 53)
        ]
        [year] = weekly_rate_year_vectors(rows)
        self.assertEqual(len(year.values), 52)
        np.testing.assert_allclose(year.values, np.ones(52), atol=1e-12)

    def test_validation_preserves_the_annual_death_quality_gate(self):
        rows = [
            {"year": year, "period_type": "month", "period": month, "deaths": 100}
            for year in (2018, 2019)
            for month in range(1, 13)
        ]
        groups = [("LOW", pd.DataFrame(rows))]
        self.assertEqual(validate_country_groups(groups)["countries"], {})
        self.assertEqual(
            len(validate_country_groups(groups, min_annual=1)["countries"]), 1
        )

    def test_validation_prefers_complete_weekly_years_and_gates_order_three(self):
        rows = [
            {"year": year, "period_type": "week", "period": week, "deaths": 700 + week}
            for year in (2018, 2019)
            for week in range(1, 53)
        ]
        result = validate_country_groups([("WEEKLY", pd.DataFrame(rows))], min_annual=1)
        self.assertEqual(result["selected_order"], 3)
        self.assertEqual(result["countries"]["WEEKLY"][0].cadence, "week")
        self.assertEqual(len(result["countries"]["WEEKLY"][0].values), 52)
        self.assertIn("monthly_step_rmse", result["orders"][3][0]["harmonic"])
        self.assertAlmostEqual(
            float(result["orders"][3][0]["harmonic"]["coefficients"][0]), 1
        )

    def test_latest_year_validation_trains_only_on_prior_years(self):
        rows = [
            count_row(year, "month", month, (100 + 10 * (year - 2018)) * month)
            for year in (2017, 2018, 2019)
            for month in range(1, 13)
        ]
        result = latest_year_holdout(count_year_vectors(rows), order=3)
        self.assertEqual(result["train_through"], 2018)
        self.assertEqual(result["target_year"], 2019)
        self.assertEqual(result["cadence"], "month")

    def test_mean_annual_fit_matches_pooled_fit_on_a_common_grid(self):
        years = [
            self.harmonic_year(year, amplitude)
            for year, amplitude in ((2017, 0.1), (2018, 0.2))
        ]
        annual_curve, _ = mean_annual_harmonic(years)
        expected, _ = fit_harmonic(np.mean([year.values for year in years], axis=0), 3)
        np.testing.assert_allclose(annual_curve, expected, atol=1e-12)

    def test_robust_ewma_limits_an_outlying_annual_curve(self):
        years = [
            self.harmonic_year(2015, 0.1),
            self.harmonic_year(2016, 0.1),
            self.harmonic_year(2017, 0.1),
            self.harmonic_year(2018, 0.8),
        ]
        mean_curve, _ = mean_annual_harmonic(years)
        robust_curve, _ = robust_ewma_harmonic(years, target_year=2019)
        target = self.harmonic_year(2019, 0.1).values
        recency = 2.0 ** (-np.array([4, 3, 2, 1]) / 5.0)
        raw_ewma = np.average([year.values for year in years], axis=0, weights=recency)
        self.assertLess(
            np.linalg.norm(robust_curve - target), np.linalg.norm(raw_ewma - target)
        )
        self.assertTrue(np.all(np.isfinite(mean_curve)))

    def test_dynamic_state_projects_a_damped_amplitude_trend(self):
        years = [
            self.harmonic_year(2015, 0.05),
            self.harmonic_year(2016, 0.10),
            self.harmonic_year(2017, 0.15),
            self.harmonic_year(2018, 0.20),
        ]
        mean_curve, _ = mean_annual_harmonic(years)
        dynamic_curve, _ = dynamic_state_harmonic(years, target_year=2019)
        self.assertGreater(float(np.ptp(dynamic_curve)), float(np.ptp(mean_curve)))

    def test_four_strategy_comparison_uses_the_latest_year_as_target(self):
        years = [
            self.harmonic_year(year, 0.1 + 0.01 * index)
            for index, year in enumerate((2016, 2017, 2018, 2019))
        ]
        comparison = compare_harmonic_strategies({"TEST": years})
        self.assertEqual(
            set(comparison["summaries"]),
            {
                "circular_3_point",
                "pooled",
                "annual_mean",
                "robust_ewma",
                "dynamic_state",
            },
        )
        for method in comparison["rows"]:
            self.assertEqual(comparison["rows"][method][0]["target_year"], 2019)
            self.assertEqual(comparison["rows"][method][0]["train_through"], 2018)
        self.assertEqual(
            comparison["summaries"]["circular_3_point"]["median_paired_delta"], 0
        )

    def test_strategy_comparison_can_hold_target_fixed_between_year_policies(self):
        years = [
            self.harmonic_year(2018, 0.10),
            self.harmonic_year(2020, 0.40),
            self.harmonic_year(2021, 0.35),
            self.harmonic_year(2023, 0.12),
            self.harmonic_year(2024, 0.50),
        ]

        comparison = compare_harmonic_strategies(
            {"TEST": years}, order=1, target_year_by_country={"TEST": 2023}
        )

        for method in comparison["rows"]:
            [row] = comparison["rows"][method]
            self.assertEqual(row["target_year"], 2023)
            self.assertEqual(row["train_through"], 2021)
            self.assertEqual(row["n_training_years"], 3)

    def test_latitude_summary_uses_absolute_latitude_and_paired_errors(self):
        method_rows = {
            "circular_3_point": [
                {"country": "N", "cadence": "week", "rmse": 0.2},
                {"country": "S", "cadence": "month", "rmse": 0.3},
            ],
            "dynamic_state": [
                {"country": "N", "cadence": "week", "rmse": 0.1},
                {"country": "S", "cadence": "month", "rmse": 0.4},
            ],
        }
        rows = summarize_strategies_by_latitude(
            method_rows,
            {"N": 10.0, "S": -30.0},
            [("low", 0, 23.5), ("middle", 23.5, 50)],
        )
        dynamic = {row["band"]: row for row in rows if row["method"] == "dynamic_state"}
        self.assertAlmostEqual(dynamic["low"]["median_paired_delta"], -0.1)
        self.assertAlmostEqual(dynamic["middle"]["median_paired_delta"], 0.1)
        self.assertEqual(dynamic["low"]["weekly"], 1)
        self.assertEqual(dynamic["middle"]["monthly"], 1)

    def test_method_pair_summary_is_paired_within_named_groups(self):
        rows = {
            "pooled": [
                {"country": "A", "cadence": "week", "rmse": 0.10},
                {"country": "B", "cadence": "month", "rmse": 0.20},
                {"country": "C", "cadence": "week", "rmse": 0.30},
            ],
            "robust_ewma": [
                {"country": "A", "cadence": "week", "rmse": 0.08},
                {"country": "B", "cadence": "month", "rmse": 0.24},
                {"country": "C", "cadence": "week", "rmse": 0.20},
            ],
        }
        summary = summarize_method_pair_by_group(
            rows,
            {"A": "Tropical", "B": "Tropical", "C": "High"},
            group_order=["Tropical", "High"],
        )

        self.assertEqual([row["group"] for row in summary], ["Tropical", "High"])
        tropical = summary[0]
        self.assertEqual(tropical["entities"], 2)
        self.assertEqual(tropical["weekly"], 1)
        self.assertEqual(tropical["monthly"], 1)
        self.assertAlmostEqual(tropical["median_paired_delta"], 0.01)
        self.assertEqual(tropical["second_method_wins"], 1)

    def test_method_pair_summary_can_report_overall_cohort(self):
        rows = {
            "pooled": [{"country": "A", "cadence": "week", "rmse": 0.10}],
            "robust_ewma": [{"country": "A", "cadence": "week", "rmse": 0.08}],
        }

        [summary] = summarize_method_pair_by_group(rows)

        self.assertEqual(summary["group"], "Overall")
        self.assertAlmostEqual(summary["median_paired_delta"], -0.02)
        self.assertEqual(summary["second_method_wins"], 1)


if __name__ == "__main__":
    unittest.main()
