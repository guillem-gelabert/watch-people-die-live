"""Pure-function tests for 04-07's seasonal-composition machinery: the leaf-cause ranges, the
ICD-10-chapter derivation reused from ICD10_TO_CAUSE, and the weekly-to-project band fold. Real
network/CSV integration is exercised by `python -m pipeline seasonal-composition` directly --
these tests avoid the 400+MB Brazil/Mexico source files and the live Eurostat fetch.
"""

from __future__ import annotations

import unittest

from pipeline.age_bands import BANDS, leaf_cause_group
from pipeline.curve import COVID_YEARS, country_curve_records
from pipeline.seasonal_composition import ALL_CHAPTERS, LEAF_GROUPS
from pipeline.sources.eurostat import (
    PROJECT_BAND_TO_WEEKLY_BAND,
    WEEKLY_BANDS,
    _chapter_leaf_code,
    chapter_of_cause_label,
)


class LeafCauseGroupTest(unittest.TestCase):
    def test_drowning_range(self):
        self.assertEqual(leaf_cause_group("W650"), "drowning")
        self.assertEqual(leaf_cause_group("W74"), "drowning")
        self.assertIsNone(leaf_cause_group("W64"))
        self.assertIsNone(leaf_cause_group("W75"))

    def test_heat_exposure_range(self):
        self.assertEqual(leaf_cause_group("X300"), "exposure to forces of nature")
        self.assertEqual(leaf_cause_group("X39"), "exposure to forces of nature")
        self.assertIsNone(leaf_cause_group("X29"))
        self.assertIsNone(leaf_cause_group("X40"))

    def test_unrelated_code_and_empty_input(self):
        self.assertIsNone(leaf_cause_group("I219"))
        self.assertIsNone(leaf_cause_group(None))
        self.assertIsNone(leaf_cause_group(""))


class ChapterOfCauseLabelTest(unittest.TestCase):
    def test_stays_a_subset_of_the_causes_vocabulary_shape(self):
        table = chapter_of_cause_label()
        self.assertGreater(len(table), 40)  # most of ICD10_TO_CAUSE's ~55 mapped labels resolve
        # Circulatory and respiratory labels the winter-excess acceptance criterion cares about.
        self.assertEqual(table["ischaemic heart disease"], "IX")
        self.assertEqual(table["a stroke"], "IX")
        self.assertEqual(table["COPD"], "X")
        self.assertEqual(table["lower respiratory infection"], "X")

    def test_every_chapter_is_a_known_roman_numeral(self):
        table = chapter_of_cause_label()
        self.assertTrue(set(table.values()) <= set(ALL_CHAPTERS))

    def test_v_y85_override_resolves_to_external_causes(self):
        self.assertEqual(_chapter_leaf_code("V_Y85"), "V01")
        self.assertEqual(chapter_of_cause_label()["a road injury"], "XX")

    def test_toxico_has_no_chapter(self):
        self.assertIsNone(_chapter_leaf_code("TOXICO"))
        self.assertNotIn("drug use disorders", chapter_of_cause_label())


class WeeklyBandFoldTest(unittest.TestCase):
    def test_project_bands_0_and_1_share_the_same_weekly_band(self):
        self.assertEqual(len(PROJECT_BAND_TO_WEEKLY_BAND), len(BANDS))
        self.assertEqual(PROJECT_BAND_TO_WEEKLY_BAND[0], 0)
        self.assertEqual(PROJECT_BAND_TO_WEEKLY_BAND[1], 0)

    def test_remaining_project_bands_are_a_1to1_relabelling(self):
        # Bands 2..8 (7 of them) map onto WEEKLY_BANDS[1..7], the 7 weekly bands finer than [0,4].
        self.assertEqual(list(PROJECT_BAND_TO_WEEKLY_BAND[2:]), [1, 2, 3, 4, 5, 6, 7])
        self.assertEqual(len(WEEKLY_BANDS), 8)


class CovidExclusionTest(unittest.TestCase):
    def test_country_curve_records_drops_covid_years(self):
        # A COVID-year-only dataset must fit nothing -- the same guard the timing curve relies on.
        rows = [
            {"year": year, "period_type": "month", "period": month, "deaths": 100.0}
            for year in COVID_YEARS
            for month in range(1, 13)
        ]
        self.assertIsNone(country_curve_records(rows, min_years=1, min_annual=0))

    def test_leaf_groups_are_declared(self):
        self.assertEqual(set(LEAF_GROUPS), {"drowning", "exposure to forces of nature"})


if __name__ == "__main__":
    unittest.main()
