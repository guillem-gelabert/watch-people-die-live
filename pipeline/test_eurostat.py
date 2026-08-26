"""Aggregation rules for the Eurostat regional layer.

The one that matters is rate-vs-count: `hlth_cd_asdr2` publishes an age-standardised rate, so a
two-region rollup of it must average. Summing would inflate every rollup by the region count,
and nothing downstream would look obviously wrong.
"""

from __future__ import annotations

import unittest

from pipeline.sources.eurostat import (
    ICD10_TO_CAUSE,
    _ROLLUP_CODES,
    _single_year_band,
    _weekly_band,
    aggregate_regions,
)


class AggregationTest(unittest.TestCase):
    def test_counts_sum_across_regions(self):
        rows = [
            {"key": "BE10", "band": 8, "sex": "f", "deaths": 100},
            {"key": "BE21", "band": 8, "sex": "f", "deaths": 140},
        ]
        self.assertEqual(aggregate_regions(rows, "deaths", intensive=False), {(8, "f"): 240.0})

    def test_rates_average_across_regions(self):
        rows = [
            {"key": "BE10", "band": 1, "sex": "m", "cause": "a stroke", "ratePer100k": 300.0},
            {"key": "BE21", "band": 1, "sex": "m", "cause": "a stroke", "ratePer100k": 500.0},
        ]
        out = aggregate_regions(rows, "ratePer100k", intensive=True)
        self.assertEqual(out, {(1, "m", "a stroke"): 400.0})
        # The bug this guards: summing gives 800, a two-region rollup at a rate no region has.
        self.assertNotEqual(out[(1, "m", "a stroke")], 800.0)


class BandFoldTest(unittest.TestCase):
    def test_single_year_ages_fold_onto_the_nine_bands(self):
        self.assertEqual(_single_year_band("Y_LT1"), 0)
        self.assertEqual(_single_year_band("Y1"), 1)
        self.assertEqual(_single_year_band("Y4"), 1)
        self.assertEqual(_single_year_band("Y5"), 2)
        self.assertEqual(_single_year_band("Y84"), 7)
        self.assertEqual(_single_year_band("Y85"), 8)
        self.assertEqual(_single_year_band("Y_GE100"), 8)

    def test_aggregate_age_codes_resolve_to_nothing(self):
        # Dropped rather than smeared across the bands the way "All ages" would be.
        self.assertIsNone(_single_year_band("TOTAL"))
        self.assertIsNone(_single_year_band("UNK"))

    def test_weekly_youngest_group_is_not_split(self):
        # Y_LT5 spans the project's band 0 and band 1, so the weekly layer declares its own
        # bands and puts it whole into one rather than inventing an infant share.
        self.assertEqual(_weekly_band("Y_LT5"), 0)
        self.assertEqual(_weekly_band("Y5-9"), 1)
        self.assertEqual(_weekly_band("Y_GE90"), 7)
        self.assertIsNone(_weekly_band("TOTAL"))


class CauseMapTest(unittest.TestCase):
    def test_no_parent_is_mapped_alongside_its_children(self):
        # I20-I25 is mapped, so its two children must stay out of the map or their deaths land
        # in the output twice.
        self.assertIn("I20-I25", ICD10_TO_CAUSE)
        for child in ("I21_I22", "I20_I23-I25"):
            self.assertNotIn(child, ICD10_TO_CAUSE)
            self.assertIn(child, _ROLLUP_CODES)

    def test_mapped_and_skipped_sets_do_not_overlap(self):
        self.assertEqual(set(ICD10_TO_CAUSE) & _ROLLUP_CODES, set())


if __name__ == "__main__":
    unittest.main()
