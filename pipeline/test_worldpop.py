"""WorldPop reduction: the age-group fold onto this project's nine bands, the 80+
apportionment, and the raster -> grid-cell reduction (with its independent control sum).

No network access -- rasters here are tiny synthetic GeoTIFFs written to a temp dir, not
downloaded. Absolute imports throughout, so `uv run python -m unittest discover pipeline`
finds this module the way it already finds pipeline/test_eurostat.py.
"""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import from_origin

from pipeline.age_bands import BANDS
from pipeline.sources.worldpop import (
    SEXES,
    WP_GROUPS,
    _apportionment_ratio,
    _band_index_for_group,
    _reduce_band,
    _reduce_country,
    _wp_bounds,
)


class WpBoundsTest(unittest.TestCase):
    def test_irregular_groups(self):
        self.assertEqual(_wp_bounds(0), (0, 0))
        self.assertEqual(_wp_bounds(1), (1, 4))
        self.assertEqual(_wp_bounds(80), (80, 200))

    def test_regular_five_year_groups(self):
        self.assertEqual(_wp_bounds(5), (5, 9))
        self.assertEqual(_wp_bounds(65), (65, 69))
        self.assertEqual(_wp_bounds(75), (75, 79))


class BandFoldTest(unittest.TestCase):
    def test_every_regular_group_falls_in_exactly_one_project_band(self):
        # BANDS = [0,0] [1,4] [5,14] [15,29] [30,49] [50,64] [65,74] [75,84] [85,200]
        expected = {
            0: 0, 1: 1, 5: 2, 10: 2, 15: 3, 20: 3, 25: 3, 30: 4, 35: 4, 40: 4, 45: 4,
            50: 5, 55: 5, 60: 5, 65: 6, 70: 6, 75: 7,
        }
        for group, band in expected.items():
            self.assertEqual(_band_index_for_group(group), band, f"group {group}")

    def test_group_80_is_not_assigned_a_single_band(self):
        # 80+ straddles BANDS[7]=[75,84] and BANDS[8]=[85,200] -- apportioned, not folded whole.
        self.assertEqual(_band_index_for_group(80), -1)

    def test_every_wp_group_is_covered(self):
        for group in WP_GROUPS:
            _band_index_for_group(group)  # must not raise


class ApportionmentTest(unittest.TestCase):
    def test_splits_by_the_countrys_own_75_84_vs_85_plus_death_share(self):
        mort = {
            "global": {"m": [0] * 9, "f": [0] * 9},
            "countries": {
                "4": {
                    # band 7 (75-84) = 30, band 8 (85+) = 10 -> 75% goes to band 7
                    "m": [0, 0, 0, 0, 0, 0, 0, 30, 10],
                    "f": [0, 0, 0, 0, 0, 0, 0, 21, 9],
                }
            },
        }
        ratio = _apportionment_ratio(mort, 4)
        self.assertAlmostEqual(ratio["m"], 0.75)
        self.assertAlmostEqual(ratio["f"], 0.7)

    def test_falls_back_to_global_pyramid_when_country_missing(self):
        mort = {
            "global": {"m": [0, 0, 0, 0, 0, 0, 0, 40, 10], "f": [0, 0, 0, 0, 0, 0, 0, 40, 10]},
            "countries": {},
        }
        ratio = _apportionment_ratio(mort, 999)
        self.assertAlmostEqual(ratio["m"], 0.8)
        self.assertAlmostEqual(ratio["f"], 0.8)

    def test_falls_back_to_half_when_both_bands_are_zero(self):
        mort = {"global": {"m": [0] * 9, "f": [0] * 9}, "countries": {}}
        ratio = _apportionment_ratio(mort, 999)
        self.assertEqual(ratio, {"m": 0.5, "f": 0.5})


def _write_raster(path: Path, values: list[list[float]], west: float, north: float, res: float, nodata: float) -> None:
    arr = np.array(values, dtype="float32")
    transform = from_origin(west, north, res, res)
    with rasterio.open(
        path, "w", driver="GTiff", height=arr.shape[0], width=arr.shape[1],
        count=1, dtype="float32", crs="EPSG:4326", transform=transform, nodata=nodata,
    ) as ds:
        ds.write(arr, 1)


class ReduceBandTest(unittest.TestCase):
    def test_sums_pixels_into_each_grid_cell_and_the_whole_raster_independently(self):
        with tempfile.TemporaryDirectory() as tmp:
            tif = Path(tmp) / "test.tif"
            # Two 0.5deg cells, one pixel each (pixel size == cell size keeps this exact --
            # no partial-pixel windowing to reason about).
            _write_raster(tif, [[100.0, 250.0]], west=10.0, north=20.5, res=0.5, nodata=-99999.0)
            cells = [(0, 10.0, 20.0), (1, 10.5, 20.0)]
            per_cell, whole_sum = _reduce_band(tif, cells)
            self.assertEqual(per_cell, {0: 100.0, 1: 250.0})
            self.assertEqual(whole_sum, 350.0)

    def test_nodata_pixels_are_excluded_from_both_sums(self):
        with tempfile.TemporaryDirectory() as tmp:
            tif = Path(tmp) / "test.tif"
            _write_raster(tif, [[100.0, -99999.0]], west=10.0, north=20.5, res=0.5, nodata=-99999.0)
            cells = [(0, 10.0, 20.0), (1, 10.5, 20.0)]
            per_cell, whole_sum = _reduce_band(tif, cells)
            self.assertEqual(per_cell, {0: 100.0})  # cell 1 has no positive-population entry
            self.assertEqual(whole_sum, 100.0)

    def test_a_cell_outside_the_raster_bounds_contributes_nothing(self):
        with tempfile.TemporaryDirectory() as tmp:
            tif = Path(tmp) / "test.tif"
            _write_raster(tif, [[100.0]], west=10.0, north=20.5, res=0.5, nodata=-99999.0)
            cells = [(0, 10.0, 20.0), (1, 50.0, 50.0)]
            per_cell, whole_sum = _reduce_band(tif, cells)
            self.assertEqual(per_cell, {0: 100.0})
            self.assertEqual(whole_sum, 100.0)


class ReduceCountryTest(unittest.TestCase):
    def test_folds_regular_groups_and_apportions_group_80_per_sex(self):
        with tempfile.TemporaryDirectory() as tmp:
            raster_dir = Path(tmp)
            # One grid cell, one pixel, one country. Every (sex, group) band gets a distinct
            # value so the fold can be checked band by band.
            values = {(sex, group): float(10 + i) for i, (sex, group) in enumerate(
                (sex, group) for sex in SEXES for group in WP_GROUPS
            )}
            for (sex, group), value in values.items():
                dest = raster_dir / f"tst_{sex}_{group}_2020_1km.tif"
                _write_raster(dest, [[value]], west=10.0, north=20.5, res=0.5, nodata=-99999.0)

            mort = {
                "global": {"m": [0] * 9, "f": [0] * 9},
                "countries": {
                    # 75-84 (idx 7) vs 85+ (idx 8) death share -> 60% of group-80 population
                    # apportioned to band 7, 40% to band 8, same ratio both sexes here.
                    "1": {"m": [0, 0, 0, 0, 0, 0, 0, 60, 40], "f": [0, 0, 0, 0, 0, 0, 0, 60, 40]},
                },
            }
            cells = [(0, 10.0, 20.0)]
            result = _reduce_country(Path("."), 1, "TST", raster_dir, cells, mort)

            self.assertEqual(result["cellIndex"], [0])
            m_row, f_row = result["m"][0], result["f"][0]
            self.assertEqual(len(m_row), 9)
            self.assertEqual(len(f_row), 9)

            # band 0 <- WP group 0 whole (no apportionment)
            self.assertAlmostEqual(m_row[0], values[("m", 0)])
            self.assertAlmostEqual(f_row[0], values[("f", 0)])

            # band 2 [5,14] <- WP group 5 + WP group 10, summed whole
            self.assertAlmostEqual(m_row[2], values[("m", 5)] + values[("m", 10)])

            # band 7 [75,84] and band 8 [85,200] share WP group 75 (whole, band 7) and WP
            # group 80 (apportioned 60/40 by the country's own death-share ratio).
            group75, group80 = values[("m", 75)], values[("m", 80)]
            self.assertAlmostEqual(m_row[7], group75 + group80 * 0.6, places=2)
            self.assertAlmostEqual(m_row[8], group80 * 0.4, places=2)

            self.assertEqual(result["apportionment80Plus"], {"m": 0.6, "f": 0.6})
            self.assertIn("controlCheck", result)
            self.assertEqual(result["controlCheck"]["maxDiffPct"], 0.0)  # single pixel == cell

    def test_a_cell_with_zero_population_in_every_band_is_not_emitted(self):
        with tempfile.TemporaryDirectory() as tmp:
            raster_dir = Path(tmp)
            for sex in SEXES:
                for group in WP_GROUPS:
                    dest = raster_dir / f"tst_{sex}_{group}_2020_1km.tif"
                    _write_raster(dest, [[0.0]], west=10.0, north=20.5, res=0.5, nodata=-99999.0)
            mort = {"global": {"m": [0] * 9, "f": [0] * 9}, "countries": {}}
            cells = [(0, 10.0, 20.0)]
            result = _reduce_country(Path("."), 1, "TST", raster_dir, cells, mort)
            self.assertEqual(result["cellIndex"], [])


class BandsAlignmentTest(unittest.TestCase):
    def test_worldpop_module_uses_the_same_nine_bands_as_the_rest_of_the_pipeline(self):
        # Regression guard: this module imports BANDS from pipeline.age_bands rather than
        # declaring its own copy, so a change to the project's nine bands cannot silently
        # desync tier 2's population source from everything else that samples in this space.
        self.assertEqual(len(BANDS), 9)
        self.assertEqual(BANDS[0], (0, 0))
        self.assertEqual(BANDS[-1], (85, 200))


if __name__ == "__main__":
    unittest.main()
