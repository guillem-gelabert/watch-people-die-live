"""Join subnational curves to Natural Earth admin-1 geometry, and sample each region's
Koppen-Geiger climate family. Single source of truth for iso_3166_2 -> adm1_code/centroid,
so every pipeline/sources/*.py module joins the same way."""

from __future__ import annotations

import json
from pathlib import Path

# Koppen-Geiger class id -> code, duplicated from notebooks/lib/climate_seasonality.py
# (which pulls in matplotlib for its plotting helpers -- too heavy a dependency for this
# pipeline just to read a 30-entry static lookup table).
KG_CLASSES = {
    1: "Af", 2: "Am", 3: "Aw", 4: "BWh", 5: "BWk", 6: "BSh", 7: "BSk",
    8: "Csa", 9: "Csb", 10: "Csc", 11: "Cwa", 12: "Cwb", 13: "Cwc",
    14: "Cfa", 15: "Cfb", 16: "Cfc", 17: "Dsa", 18: "Dsb", 19: "Dsc",
    20: "Dsd", 21: "Dwa", 22: "Dwb", 23: "Dwc", 24: "Dwd", 25: "Dfa",
    26: "Dfb", 27: "Dfc", 28: "Dfd", 29: "ET", 30: "EF",
}


def load_iso_geo(root: Path) -> dict[str, dict]:
    """iso_3166_2 -> {adm1_code, adm0_a3, name, latitude, longitude}, one row per code.

    Natural Earth's 10m admin-1 layer has a few multi-part regions sharing one
    iso_3166_2 code across a mainland + outlying-island feature (e.g. AU-NSW covers
    both New South Wales and Lord Howe Island); keeping the first occurrence in file
    order picks the mainland region, which is also the feature order these geometries
    have always shipped in.
    """
    topology = json.loads((root / "data" / "admin1-10m.json").read_text())
    geo: dict[str, dict] = {}
    for feature in topology["objects"]["ne_10m_admin_1"]["geometries"]:
        props = feature["properties"]
        code = props.get("iso_3166_2")
        if code and code not in geo:
            geo[code] = {
                "adm1_code": props["adm1_code"],
                "adm0_a3": props["adm0_a3"],
                "name": props["name"],
                "latitude": props.get("latitude"),
                "longitude": props.get("longitude"),
            }
    return geo


def sample_kg_family(root: Path, points: list[tuple[float | None, float | None]]) -> list[str | None]:
    """Centroid-sample the dominant Koppen-Geiger family (A-E) at each (lat, lon)."""
    import rasterio

    tif = root / "climate-zones" / "koppen-geiger" / "koppen_geiger_climatezones_1991_2020_1km.tif"
    coords = [(lon, lat) if lon is not None else (0, 0) for lat, lon in points]
    with rasterio.open(tif) as ds:
        samples = list(ds.sample(coords))

    results: list[str | None] = []
    for (lat, lon), value in zip(points, samples):
        if lat is None or lon is None:
            results.append(None)
            continue
        code = KG_CLASSES.get(int(value[0]))
        results.append(code[0] if code else None)
    return results
