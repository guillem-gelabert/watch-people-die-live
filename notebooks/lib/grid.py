"""Shared helpers for grid-layer notebooks.

Architecture: `data/density-grid.json` is the "base grid" — the canonical set of
populated 0.5deg cells (lon, lat, pop, m49) that every layer aligns to 1:1. A layer is a
population-weighted mean-1 relative multiplier per base-grid cell, authored by a notebook
that ends in a `get_mortality_multiplier(lonlat)` function and a call to `bake_layer(...)`.
`combine.ipynb` multiplies the base grid by every static (`dynamic: False`) layer to
produce `data/rate-grid.json`, the single grid the browser samples at runtime.

See the plan this implements for the full model (relative multipliers, not probabilities;
one committed grid; seasonality stays a browser-side layer, not baked here).
"""

import json
import math
from pathlib import Path


def find_root(start=None):
    """Walk upward from `start` (default: cwd) until a directory containing package.json."""
    p = (start or Path.cwd()).resolve()
    for candidate in [p, *p.parents]:
        if (candidate / "package.json").exists():
            return candidate
    raise FileNotFoundError(f"Could not locate project root (no package.json found above {p})")


ROOT = find_root()
DATA_DIR = ROOT / "data"
LAYERS_DIR = DATA_DIR / "layers"


def load_base():
    """Load the base grid. Returns (cells, cellsize) where each cell is
    {"lon", "lat", "pop", "m49"} — lon/lat are the SW corner, matching
    data/density-grid.json's own convention.
    """
    raw = json.loads((DATA_DIR / "density-grid.json").read_text())
    cells = [
        {"lon": lon, "lat": lat, "pop": pop, "m49": m49}
        for lon, lat, pop, m49 in raw["cells"]
    ]
    return cells, raw["cellsize"]


_country_index = None
_country_index_cellsize = None


def country_at(lon, lat):
    """Look up the m49 id of the base-grid cell containing (lon, lat), or None if the
    cell isn't populated. O(1) after the first call (builds a bucket index once).
    """
    global _country_index, _country_index_cellsize
    if _country_index is None:
        cells, cellsize = load_base()
        _country_index_cellsize = cellsize
        _country_index = {(c["lon"], c["lat"]): c["m49"] for c in cells}
    cs = _country_index_cellsize
    key = (round(math.floor(lon / cs) * cs, 2), round(math.floor(lat / cs) * cs, 2))
    return _country_index.get(key)


def bake_layer(fn, name):
    """Evaluate `fn((lon, lat))` at every base-grid cell's center, normalize to a
    population-weighted mean of 1, and write data/layers/<name>.json.
    """
    cells, cellsize = load_base()
    half = cellsize / 2
    raw_values = [fn((c["lon"] + half, c["lat"] + half)) for c in cells]

    total_pop = sum(c["pop"] for c in cells)
    weighted_mean = sum(v * c["pop"] for v, c in zip(raw_values, cells)) / total_pop
    if not weighted_mean > 0:
        raise ValueError(f"Layer '{name}' has a non-positive population-weighted mean: {weighted_mean}")

    LAYERS_DIR.mkdir(parents=True, exist_ok=True)
    out = {
        "layer": name,
        "dynamic": False,
        "cellsize": cellsize,
        "unit": "relative-multiplier",
        "cells": [
            [c["lon"], c["lat"], c["m49"], round(v / weighted_mean, 6)]
            for v, c in zip(raw_values, cells)
        ],
    }
    out_path = LAYERS_DIR / f"{name}.json"
    out_path.write_text(json.dumps(out))
    print(f"Wrote {out_path.relative_to(ROOT)}: {len(out['cells'])} cells, mean={weighted_mean:.4f} (pre-normalize)")
    return out


def load_layer(name):
    """Read a previously baked data/layers/<name>.json."""
    return json.loads((LAYERS_DIR / f"{name}.json").read_text())


def load_cdr_snapshot():
    """Read data/source/cdr-snapshot.json (produced by `npm run dump:cdr`).
    Returns a dict m49 -> {iso3, name, cdr (per 1000), population}.
    """
    raw = json.loads((DATA_DIR / "source" / "cdr-snapshot.json").read_text())
    return {
        v["id"]: {"iso3": v["iso3"], "name": v["name"], "cdr": v["value"], "population": v["population"]}
        for v in raw["values"]
        if v["value"] is not None and v["population"] is not None
    }
