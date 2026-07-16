"""Climate-profile helpers used by ``seasonality.ipynb``.

The mortality curves are population phenomena, so this module turns a climate
raster into population-weighted class shares rather than assigning a country one
possibly unrepresentative climate label.  Five classifications are supported (see
``CLASSIFICATIONS``): the 1 km, 30-class Köppen-Geiger raster is the primary one;
the four ``28071410`` 1° rasters (Köppen-11, Holdridge, Thornthwaite, Whittaker)
are coarser aggregation/robustness checks, not independent peers.  It deliberately
has no project-output side effects: the notebook remains the analysis surface.
"""

from __future__ import annotations

import json
from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from matplotlib.path import Path as MplPath


KG_CLASSES = {
    1: "Af", 2: "Am", 3: "Aw", 4: "BWh", 5: "BWk", 6: "BSh", 7: "BSk",
    8: "Csa", 9: "Csb", 10: "Csc", 11: "Cwa", 12: "Cwb", 13: "Cwc",
    14: "Cfa", 15: "Cfb", 16: "Cfc", 17: "Dsa", 18: "Dsb", 19: "Dsc",
    20: "Dsd", 21: "Dwa", 22: "Dwb", 23: "Dwc", 24: "Dwd", 25: "Dfa",
    26: "Dfb", 27: "Dfc", 28: "Dfd", 29: "ET", 30: "EF",
}
FAMILIES = ("A", "B", "C", "D", "E")
FAMILY_NAMES = {
    "A": "Tropical", "B": "Arid", "C": "Temperate", "D": "Cold", "E": "Polar",
}
UK_REGION_NAMES = {
    "GBR-ENW": "England & Wales",
    "GBR-SCO": "Scotland",
    "GBR-NIR": "Northern Ireland",
}


@dataclass(frozen=True)
class Classification:
    """One climate-classification raster: its class codes, base, and nodata."""

    name: str
    n_classes: int
    code_base: int
    nodata: float
    labels: dict[int, str]
    family_of: Callable[[str], str | None] | None = None
    families: dict[str, str] | None = None
    resampling: str = "mode"


KOPPEN_1980_CLASSES = {
    0: "Af", 1: "Aw", 2: "BS", 3: "BW", 4: "Cs", 5: "Cw", 6: "Cf",
    7: "Dw", 8: "Df", 9: "ET", 10: "EF",
}
HOLDRIDGE_CLASSES = {
    1: "T", 2: "CP", 3: "FT", 4: "BF", 5: "CD", 6: "ST", 7: "CF",
    8: "HD", 9: "CH", 10: "TF", 11: "TS", 12: "TD", 13: "TR",
}
_THERMAL_BANDS = ("Torrid", "Hot", "Warm", "Cool", "Cold", "Frigid")
_MOISTURE_BANDS = ("Saturated", "Wet", "Moist", "Dry", "Semiarid", "Arid")
THORNTHWAITE_CLASSES = {
    moisture_index * 6 + thermal_index + 1: f"{thermal}-{moisture}"
    for moisture_index, moisture in enumerate(_MOISTURE_BANDS)
    for thermal_index, thermal in enumerate(_THERMAL_BANDS)
}
WHITTAKER_CLASSES = {
    1: "Tundra", 2: "Boreal forest", 3: "Temperate grassland/desert",
    4: "Woodland/shrubland", 5: "Temperate seasonal forest", 6: "Temperate rain forest",
    7: "Tropical rain forest", 8: "Tropical seasonal forest/savanna", 9: "Subtropical desert",
}

KG = Classification(
    name="kg", n_classes=30, code_base=1, nodata=0, labels=KG_CLASSES,
    family_of=lambda label: label[0], families=FAMILY_NAMES, resampling="mode",
)
KOPPEN_1980 = Classification(
    name="kop11", n_classes=11, code_base=0, nodata=-9999, labels=KOPPEN_1980_CLASSES,
    family_of=lambda label: label[0], families=FAMILY_NAMES, resampling="nearest",
)
HOLDRIDGE = Classification(
    name="hlz", n_classes=13, code_base=1, nodata=-9999, labels=HOLDRIDGE_CLASSES,
    resampling="nearest",
)
THORNTHWAITE = Classification(
    name="thw", n_classes=36, code_base=1, nodata=-9999, labels=THORNTHWAITE_CLASSES,
    family_of=lambda label: label.split("-")[0],
    families={band: band for band in _THERMAL_BANDS},
    resampling="nearest",
)
WHITTAKER = Classification(
    name="whit", n_classes=9, code_base=1, nodata=-9999, labels=WHITTAKER_CLASSES,
    resampling="nearest",
)

CLASSIFICATIONS = {c.name: c for c in (KG, KOPPEN_1980, HOLDRIDGE, THORNTHWAITE, WHITTAKER)}


def _topology_rings(topology, object_name):
    """Return (properties, rings) for each polygon in a TopoJSON object.

    The NUTS file is small and its geometries are already in WGS84.  Decoding it
    here avoids adding geopandas/shapely as notebook-only dependencies.
    """
    sx, sy = topology["transform"]["scale"]
    tx, ty = topology["transform"]["translate"]
    arcs = []
    for arc in topology["arcs"]:
        x = y = 0
        points = []
        for dx, dy in arc:
            x += dx
            y += dy
            points.append((x * sx + tx, y * sy + ty))
        arcs.append(points)

    def join(arc_ids):
        points = []
        for index in arc_ids:
            segment = arcs[index] if index >= 0 else arcs[~index][::-1]
            points.extend(segment if not points else segment[1:])
        return points

    decoded = []
    for geometry in topology["objects"][object_name]["geometries"]:
        if geometry["type"] == "Polygon":
            polygons = [geometry["arcs"]]
        elif geometry["type"] == "MultiPolygon":
            polygons = geometry["arcs"]
        else:
            continue
        # Keep every ring: the first is an exterior boundary and later rings are
        # holes.  The NUTS2 data only needs this for the UK membership test.
        decoded.append((geometry.get("properties", {}), [[join(r) for r in poly] for poly in polygons]))
    return decoded


def _uk_region_paths(nuts2_path):
    topology = json.loads(Path(nuts2_path).read_text())
    grouped = defaultdict(list)
    for properties, polygons in _topology_rings(topology, "nuts2_20m"):
        nuts_id = properties.get("NUTS_ID", "")
        if not nuts_id.startswith("UK"):
            continue
        region = "GBR-SCO" if nuts_id.startswith("UKM") else "GBR-NIR" if nuts_id.startswith("UKN") else "GBR-ENW"
        for polygon in polygons:
            grouped[region].append([MplPath(np.asarray(ring)) for ring in polygon if len(ring) >= 3])
    missing = set(UK_REGION_NAMES) - set(grouped)
    if missing:
        raise ValueError(f"NUTS2 topology lacks UK region boundaries: {sorted(missing)}")
    return grouped


def _contains_polygon(points, paths):
    """Vectorised point-in-polygon test that respects interior holes."""
    hit = np.zeros(len(points), dtype=bool)
    for polygon in paths:
        exterior, *holes = polygon
        inside = exterior.contains_points(points)
        for hole in holes:
            inside &= ~hole.contains_points(points)
        hit |= inside
    return hit


def _load_population_cells(density_path, synthetic_path):
    density = json.loads(Path(density_path).read_text())
    cells = [tuple(cell) for cell in density["cells"]]
    present = {m49 for _, _, _, m49 in cells}
    synthetic = json.loads(Path(synthetic_path).read_text())
    cells.extend(tuple(cell) for cell in synthetic["cells"] if cell[3] not in present)
    return cells, density["cellsize"]


def population_weighted_profiles(
    *,
    climate_path,
    density_path,
    synthetic_path,
    nuts2_path,
    m49_to_iso3,
    included_geographies,
    classification=KG,
    sample_step=0.05,
    resampling=None,
):
    """Return climate-class shares, coverage, and a population-weighted centroid.

    Each 0.5° population cell is split over a regular 0.05° grid.  Its total
    population is apportioned equally among valid climate samples.  This retains
    coastal and microstate information that a single centre sample would lose.

    ``classification`` selects which raster's class legend applies (see
    ``CLASSIFICATIONS``); ``climate_path`` must point at a raster using that
    legend.  The geographic centroid is accumulated over every sample point
    regardless of climate validity, so it is identical across classifications.
    """
    import rasterio  # Imported lazily so notebook setup still explains missing deps.
    from rasterio.enums import Resampling

    lo = classification.code_base
    hi = classification.code_base + classification.n_classes - 1
    ncls = classification.n_classes
    if lo <= classification.nodata <= hi:
        raise ValueError(f"{classification.name}: nodata value overlaps the valid class range")

    cells, cellsize = _load_population_cells(density_path, synthetic_path)
    nside = round(cellsize / sample_step)
    if not np.isclose(nside * sample_step, cellsize):
        raise ValueError("sample_step must evenly divide the density-grid cell size")
    nside = int(nside)

    method = getattr(Resampling, resampling or classification.resampling)
    with rasterio.open(climate_path) as source:
        # A 0.05° grid (7,200 × 3,600) is compact, deterministic, and much more
        # faithful for small/coastal places than one class at a 0.5° centre. For
        # 1° sources this is a pure upsample (no aggregation), so "nearest" is
        # both cheaper and exact; "mode" is for the 1 km raster's downsample.
        raster = source.read(
            1,
            out_shape=(round(180 / sample_step), round(360 / sample_step)),
            resampling=method,
        )
    if not np.issubdtype(raster.dtype, np.integer):
        raster = raster.astype(np.int64)

    uk_paths = _uk_region_paths(nuts2_path)
    shares = defaultdict(lambda: np.zeros(ncls, dtype=float))
    denominator = defaultdict(float)
    observed = defaultdict(float)
    centroid_x = defaultdict(float)
    centroid_y = defaultdict(float)
    centroid_z = defaultdict(float)

    for lon, lat, population, m49 in cells:
        iso3 = m49_to_iso3.get(str(int(m49)).zfill(3))
        if iso3 is None:
            continue
        c0 = round((lon + 180) / sample_step)
        c1 = c0 + nside
        r0 = round((90 - (lat + cellsize)) / sample_step)
        r1 = r0 + nside
        classes = raster[r0:r1, c0:c1]
        if classes.shape != (nside, nside):
            continue
        xs = lon + (np.arange(nside) + 0.5) * sample_step
        ys = lat + (np.arange(nside) + 0.5) * sample_step
        xx, yy = np.meshgrid(xs, ys)
        points = np.column_stack([xx.ravel(), yy.ravel()])
        values = classes.ravel()
        valid_climate = (values >= lo) & (values <= hi)

        # Unit vectors for a dateline/pole-safe population-weighted centroid.
        lat_rad = np.radians(yy.ravel())
        lon_rad = np.radians(xx.ravel())
        cos_lat = np.cos(lat_rad)
        unit_x = cos_lat * np.cos(lon_rad)
        unit_y = cos_lat * np.sin(lon_rad)
        unit_z = np.sin(lat_rad)

        if iso3 == "GBR":
            masks = {region: _contains_polygon(points, paths) for region, paths in uk_paths.items()}
            overlap = np.sum(np.vstack(list(masks.values())), axis=0)
            if (overlap > 1).any():
                raise AssertionError("UK NUTS2 regional masks overlap")
            for region, region_mask in masks.items():
                if region not in included_geographies:
                    continue
                regional_points = region_mask.sum()
                if not regional_points:
                    continue
                point_weight = population / len(values)
                denominator[region] += regional_points * point_weight
                centroid_x[region] += (unit_x[region_mask] * point_weight).sum()
                centroid_y[region] += (unit_y[region_mask] * point_weight).sum()
                centroid_z[region] += (unit_z[region_mask] * point_weight).sum()
                mask = region_mask & valid_climate
                if not mask.any():
                    continue
                counts = np.bincount(values[mask] - lo, minlength=ncls)[:ncls]
                shares[region] += counts * point_weight
                observed[region] += mask.sum() * point_weight
            continue

        if iso3 not in included_geographies:
            continue
        denominator[iso3] += population
        point_weight_all = population / len(values)
        centroid_x[iso3] += (unit_x * point_weight_all).sum()
        centroid_y[iso3] += (unit_y * point_weight_all).sum()
        centroid_z[iso3] += (unit_z * point_weight_all).sum()
        if not valid_climate.any():
            continue
        # Reallocate a cell's full population across only its valid climate
        # samples.  Nodata is ocean/ice around populated coastal bins, not people.
        point_weight = population / valid_climate.sum()
        counts = np.bincount(values[valid_climate] - lo, minlength=ncls)[:ncls]
        shares[iso3] += counts * point_weight
        observed[iso3] += population

    rows = []
    for geography in sorted(included_geographies):
        profile = shares[geography]
        if profile.sum() <= 0:
            continue
        profile /= profile.sum()
        cx, cy, cz = centroid_x[geography], centroid_y[geography], centroid_z[geography]
        row = {
            "geography": geography,
            "climate_coverage": observed[geography] / denominator[geography] if denominator[geography] else 0.0,
            "population_lat": float(np.degrees(np.arctan2(cz, np.hypot(cx, cy)))),
            "population_lon": float(np.degrees(np.arctan2(cy, cx))),
        }
        row.update(
            {
                f"{classification.name}_{code:02d}": value
                for code, value in zip(classification.labels, profile, strict=True)
            }
        )
        rows.append(row)
    return rows
