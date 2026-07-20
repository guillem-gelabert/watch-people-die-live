"""Population-weighted Koppen climate fallback for the seasonal-mortality estimator.

Two products, both derived from the committed country-level artifacts
(data/seasonality-unified.json curves + data/seasonality-proxies.json Koppen labels)
weighted by gridded population (data/density-grid.json):

1. `build_climate_model()` -> class/family donor-blend curves + a per-M49 Koppen label
   table, written to data/seasonality-climate-fallback.json. The runtime estimator
   (lib/spatial-seasonality.ts) uses it for countries with no measured bordering donor:
   blend the observed curves of measured countries that share the target's Koppen class,
   falling back to family, then to the latitude model.

2. `india_china_regions()` -> one estimated adm1 curve per Indian/Chinese state, so the
   roadmap amplitude map shows within-country climate variation those two huge, climatically
   varied countries hide behind a single national curve. Each region's Koppen class is
   centroid-sampled from the 1 km raster; its curve is the same class->family->latitude
   cascade; its weight is the population of the density-grid cells nearest that region's
   centroid (so the globe's national aggregate reflects where people actually live).
"""

from __future__ import annotations

import json
import math
from pathlib import Path

CLIMATE_FALLBACK_PATH = "data/seasonality-climate-fallback.json"
_INDIA_M49, _CHINA_M49 = 356, 156

# A climate blend needs at least this many measured donor countries to be trusted; below it the
# cascade falls through (class -> family -> latitude), so a "blend" is never one or two countries.
MIN_DONORS = 3

# Countries the GPWv4 density grid omits because its vintage predates a border change, so they
# get no population cells and would otherwise strand on latitude. Sampled at their centroid
# (lon, lat). South Sudan (728) is folded into Sudan by GPWv4.
_DENSITY_GAP_CENTROIDS = {728: (30.3, 7.3)}


def _population_by_m49(root: Path) -> dict[int, float]:
    grid = json.loads((root / "data" / "density-grid.json").read_text())
    pop: dict[int, float] = {}
    for _lon, _lat, population, m49 in grid["cells"]:
        pop[m49] = pop.get(m49, 0.0) + population
    return pop


def _hemisphere_by_m49(root: Path) -> dict[int, int]:
    """+1 northern / -1 southern, from each country's population-weighted mean latitude."""
    grid = json.loads((root / "data" / "density-grid.json").read_text())
    lat_pop: dict[int, list[float]] = {}
    for _lon, lat, population, m49 in grid["cells"]:
        acc = lat_pop.setdefault(m49, [0.0, 0.0])
        acc[0] += (lat + 0.25) * population  # cell-centre latitude
        acc[1] += population
    return {m49: (-1 if (num / den) < 0 else 1) for m49, (num, den) in lat_pop.items() if den > 0}


def _dominant_koppen_by_m49(root: Path) -> dict[str, dict[str, str]]:
    """Population-weighted dominant Köppen class/family per country, from the density grid
    sampled against the 1 km raster. Covers every populated country — unlike proxies, which
    only labels the measured ones — so the climate fallback can fire for unmeasured targets
    (most of Africa, Central Asia, unmeasured islands)."""
    import collections

    import rasterio

    from .geo import KG_CLASSES

    grid = json.loads((root / "data" / "density-grid.json").read_text())["cells"]
    tif = root / "climate-zones" / "koppen-geiger" / "koppen_geiger_climatezones_1991_2020_1km.tif"
    with rasterio.open(tif) as ds:
        samples = list(ds.sample([(lon + 0.25, lat + 0.25) for lon, lat, _pop, _m49 in grid]))
        gap_samples = list(ds.sample(list(_DENSITY_GAP_CENTROIDS.values())))

    pop_by_class: dict[int, dict[str, float]] = collections.defaultdict(lambda: collections.defaultdict(float))
    for (_lon, _lat, population, m49), value in zip(grid, samples):
        code = KG_CLASSES.get(int(value[0]))
        if code:
            pop_by_class[m49][code] += population
    labels = {
        str(m49): {"class": (dom := max(classes, key=classes.get)), "family": dom[0]}
        for m49, classes in pop_by_class.items()
        if classes
    }
    for (m49, _coord), value in zip(_DENSITY_GAP_CENTROIDS.items(), gap_samples):
        code = KG_CLASSES.get(int(value[0]))
        if code and str(m49) not in labels:
            labels[str(m49)] = {"class": code, "family": code[0]}
    return labels


def _shift6(curve: list[float]) -> list[float]:
    """Swap summer/winter halves (its own inverse). Maps a southern-hemisphere curve to a
    northern-canonical phase and back, so donors of one Koppen class reinforce rather than
    cancel when blended, and a blend can be re-phased for a southern target."""
    return [curve[(m + 6) % 12] for m in range(12)]


def apply_hemisphere(curve: list[float], latitude: float) -> list[float]:
    """Re-phase a northern-canonical blend for the target's hemisphere."""
    return _shift6(curve) if latitude < 0 else list(curve)


def _deaths_by_m49(root: Path) -> dict[int, float]:
    grid = json.loads((root / "data" / "rate-grid.json").read_text())
    deaths: dict[int, float] = {}
    for _lon, _lat, m49, w in grid["cells"]:
        deaths[m49] = deaths.get(m49, 0.0) + w
    return deaths


def _weighted_mean_curves(entries: list[tuple[list[float], float]]) -> list[float] | None:
    """Population-weighted mean of equal-length curves; None if empty."""
    entries = [(c, w) for c, w in entries if c and w > 0]
    if not entries:
        return None
    months = min(len(c) for c, _ in entries)
    total = sum(w for _, w in entries)
    return [sum(c[m] * w for c, w in entries) / total for m in range(months)]


def _latitude_curve(latitude: float, fallback: dict) -> list[float]:
    """Port of lib/spatial-seasonality.ts latitudeFallbackCurve (quadratic-RMS branch)."""
    north = fallback["north"]
    abs_lat = abs(latitude)
    a, b, c = fallback["amplitudeCoef"]
    lo, hi = fallback["ampClamp"]
    target_rms = max(lo, min(hi, a * abs_lat * abs_lat + b * abs_lat + c)) / 100
    canonical_rms = math.sqrt(sum((v - 1) ** 2 for v in north) / len(north))
    scale = target_rms / canonical_rms if canonical_rms > 0 else 0.0
    shift = 6 if latitude < 0 else 0
    return [round(1 + scale * (north[(m + shift) % len(north)] - 1), 4) for m in range(len(north))]


def build_climate_model(root: Path) -> dict:
    unified = json.loads((root / "data" / "seasonality-unified.json").read_text())
    proxies = json.loads((root / "data" / "seasonality-proxies.json").read_text())["byM49"]
    pop = _population_by_m49(root)
    hemi = _hemisphere_by_m49(root)

    class_entries: dict[str, list[tuple[list[float], float]]] = {}
    family_entries: dict[str, list[tuple[list[float], float]]] = {}
    for m49_str, curve in unified["countries"].items():
        p = proxies.get(m49_str)
        if not p or not p.get("kgClass"):
            continue
        kg_class, kg_family = p["kgClass"], p["kgFamily"]
        weight = pop.get(int(m49_str), 0.0)
        if weight <= 0:
            continue
        # blend in a northern-canonical phase: flip southern donors so they reinforce
        aligned = _shift6(curve) if hemi.get(int(m49_str), 1) < 0 else curve
        class_entries.setdefault(kg_class, []).append((aligned, weight))
        family_entries.setdefault(kg_family, []).append((aligned, weight))

    # per-M49 target label table: dominant Koppen class for every populated country (so the
    # fallback reaches unmeasured targets), with the finer notebook proxies label kept where a
    # country has one.
    class_by_m49 = _dominant_koppen_by_m49(root)
    for m49_str, p in proxies.items():
        if p.get("kgClass"):
            class_by_m49[m49_str] = {"class": p["kgClass"], "family": p["kgFamily"]}

    round4 = lambda c: [round(x, 4) for x in c]  # noqa: E731
    return {
        # Only emit blends backed by >= MIN_DONORS countries; thin classes/families are omitted so
        # the class -> family -> latitude cascade skips them automatically.
        "classCurves": {
            k: round4(_weighted_mean_curves(v)) for k, v in class_entries.items() if len(v) >= MIN_DONORS
        },
        "familyCurves": {
            k: round4(_weighted_mean_curves(v)) for k, v in family_entries.items() if len(v) >= MIN_DONORS
        },
        "classByM49": class_by_m49,
        "fallback": unified["fallback"],
    }


def climate_curve(kg_class: str | None, kg_family: str | None, model: dict) -> tuple[list[float], str] | None:
    """class -> family blend from the model; None if neither has donors (caller does latitude)."""
    if kg_class and model["classCurves"].get(kg_class):
        return model["classCurves"][kg_class], "climate-class"
    if kg_family and model["familyCurves"].get(kg_family):
        return model["familyCurves"][kg_family], "climate-family"
    return None


def _nearest_centroid_population(root: Path, m49: int, region_centroids: dict[str, tuple[float, float]]) -> dict[str, float]:
    """Sum each country's density-grid population into the nearest region centroid (a cheap
    Voronoi split — good enough to weight the national aggregate by where people live)."""
    grid = json.loads((root / "data" / "density-grid.json").read_text())
    keys = list(region_centroids)
    pop: dict[str, float] = {k: 0.0 for k in keys}
    for lon, lat, population, cell_m49 in grid["cells"]:
        if cell_m49 != m49:
            continue
        clat = lat + 0.25  # density cells are SW corners on a 0.5deg grid; use cell centre
        clon = lon + 0.25
        best = min(keys, key=lambda k: (region_centroids[k][0] - clat) ** 2 + (region_centroids[k][1] - clon) ** 2)
        pop[best] += population
    return pop


def india_china_regions(root: Path, model: dict, iso_geo: dict) -> list[dict]:
    import rasterio

    from .geo import KG_CLASSES

    pop_m49 = _population_by_m49(root)
    deaths_m49 = _deaths_by_m49(root)

    tif = root / "climate-zones" / "koppen-geiger" / "koppen_geiger_climatezones_1991_2020_1km.tif"
    rows: list[dict] = []
    for m49, iso3 in ((_INDIA_M49, "IND"), (_CHINA_M49, "CHN")):
        prefix = "IN-" if iso3 == "IND" else "CN-"
        regions = {iso: g for iso, g in iso_geo.items() if iso.startswith(prefix)}
        centroids = {iso: (g["latitude"], g["longitude"]) for iso, g in regions.items()}
        region_pop = _nearest_centroid_population(root, m49, centroids)
        # national crude rate (deaths per person) to turn region population into estimated deaths
        rate = (deaths_m49.get(m49, 0.0) / pop_m49[m49]) if pop_m49.get(m49) else 0.0

        with rasterio.open(tif) as ds:
            samples = list(ds.sample([(g["longitude"], g["latitude"]) for g in regions.values()]))

        for (iso, g), value in zip(regions.items(), samples):
            kg = KG_CLASSES.get(int(value[0]))
            kg_class, kg_family = (kg, kg[0]) if kg else (None, None)
            picked = climate_curve(kg_class, kg_family, model)
            if picked:
                curve = apply_hemisphere(picked[0], g["latitude"])
            else:
                curve = _latitude_curve(g["latitude"], model["fallback"])
            mean = sum(curve) / len(curve)  # normalise to mean 1 (blends already are; latitude ~is)
            curve = [x / mean for x in curve]
            annual = round(region_pop.get(iso, 0.0) * rate)
            rows.append({
                "country": iso3, "geo": "adm1", "key": g["adm1_code"], "name": g["name"],
                "isoRegion": iso, "interval": "month", "curve": [round(x, 4) for x in curve],
                "nYears": None, "annualDeaths": annual if annual > 0 else None,
                "measurement": "climate-modeled", "kgFamily": kg_family,
            })
    return rows


def write_climate_model(root: Path) -> Path:
    model = build_climate_model(root)
    out = {k: model[k] for k in ("classCurves", "familyCurves", "classByM49")}
    path = root / CLIMATE_FALLBACK_PATH
    path.write_text(json.dumps(out, ensure_ascii=False) + "\n")
    return path
