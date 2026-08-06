import datetime
import math
import unittest
from types import SimpleNamespace

from pipeline.smoothing_demo import build_smoothing_demo, build_smoothing_demo_dataset


class Rows:
    def __init__(self, rows):
        self.rows = rows

    def itertuples(self):
        return iter(self.rows)


def weekly_rows(scale=1.0):
    rows = []
    for year in (2018, 2019, 2020, 2023):
        weeks = datetime.date(year, 12, 28).isocalendar().week
        for week in range(1, weeks + 1):
            value = scale * 1000 * (1 + 0.1 * math.cos(2 * math.pi * (week - 0.5) / weeks))
            rows.append(SimpleNamespace(year=year, period_type="week", period=week, deaths=value))
    return Rows(rows)


class SmoothingDemoTest(unittest.TestCase):
    def test_payload_contract_and_reproducibility(self):
        first = build_smoothing_demo(weekly_rows())
        second = build_smoothing_demo(weekly_rows())
        self.assertEqual(first, second)
        country = first["countries"]["CHE"]
        self.assertEqual(set(country["modes"]), {"weekly", "monthly", "quarterly", "circular3"})
        self.assertEqual(set(country["harmonics"]), {"1", "2", "3", "4"})
        self.assertEqual(len(country["modes"]["monthly"]["observations"]), 12)
        self.assertEqual(len(country["modes"]["quarterly"]["observations"]), 4)
        self.assertEqual(len(country["modes"]["circular3"]["smoothed"]), 12)
        self.assertNotIn(2020, country["years"])
        for order in range(1, 5):
            curve = country["harmonics"][str(order)]
            self.assertEqual(curve["order"], order)
            self.assertEqual(len(curve["coefficients"]), 2 * order + 1)
            self.assertAlmostEqual(curve["coefficients"][0], 1)

    def test_dataset_filters_and_sorts_eligible_weekly_countries(self):
        payload = build_smoothing_demo_dataset(
            [("ZZZ", weekly_rows()), ("AAA", weekly_rows()), ("LOW", weekly_rows(0.01))],
            {"ZZZ": "Alpha", "AAA": "Zulu", "LOW": "Low volume"},
        )
        self.assertEqual(list(payload["countries"]), ["ZZZ", "AAA"])
        self.assertEqual(payload["meta"]["countryCount"], 2)
        self.assertEqual(payload["meta"]["defaultCountry"], "ZZZ")
        self.assertEqual(payload["meta"]["harmonicOrders"], [1, 2, 3, 4])
        self.assertEqual(payload["countries"]["ZZZ"]["name"], "Alpha")


if __name__ == "__main__":
    unittest.main()
