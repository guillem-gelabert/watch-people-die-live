"""Producer for data/argentina-partido-latitudes.json -- a single death-weighted centroid
latitude for the unified Buenos Aires "partidos" region, from the Argentina Georef API. This
is a standalone companion to argentina_partido.py: it doesn't feed the seasonality curve
pipeline (no `fetch`/`load` pair, not in the source registry), it just keeps the latitude the
unified region's dot uses in `app/roadmap/charts/LatitudeScatter.tsx` reproducible from its
real sources instead of being a hand-maintained, unprovenanced file.

Since argentina_partido.py now folds all 135 partidos into one province-wide curve keyed
`AR-B-partidos`, the matching latitude is the province centroid weighted by each partido's
death count -- so the dot lands where the mortality mass actually is (Greater Buenos Aires,
near the city) rather than at the province's geometric middle.

The PBA registry's `municipio_id` (e.g. 6007 for Adolfo Alsina) is a single-digit province
code (6 = Buenos Aires) plus a 3-digit municipio code, whereas Georef's `id` is INDEC's
standard 2-digit province + 4-digit code (e.g. "060007"). `mid = 6000 + int(georef_id[2:])`
converts one to the other.
"""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

import pandas as pd
import requests

GEOREF_URL = "https://apis.datos.gob.ar/georef/api/municipios"
SOURCE_LABEL = "Argentina Georef API v2.0 — Buenos Aires partido centroids, death-weighted"
UNIFIED_KEY = "AR-B-partidos"

_PBA_FILES = (
    ("pba-registro-mensual-defunciones-2018-2019.csv", "cantidad"),
    ("pba-registro-mensual-defunciones-2020-2026.csv", "total"),
)


def build(root: Path) -> Path:
    response = requests.get(
        GEOREF_URL,
        params={"provincia": "06", "max": 200, "campos": "id,nombre,centroide"},
        timeout=30,
    )
    response.raise_for_status()
    lat_by_mid = {6000 + int(m["id"][2:]): m["centroide"]["lat"] for m in response.json()["municipios"]}

    cache_dir = root / "data" / "source" / "subnational"
    deaths_by_mid: dict[int, float] = defaultdict(float)
    for name, col in _PBA_FILES:
        df = pd.read_csv(cache_dir / name, usecols=["municipio_id", col])
        df["mid"] = pd.to_numeric(df["municipio_id"], errors="coerce")
        df["deaths"] = pd.to_numeric(df[col], errors="coerce").fillna(0)
        for mid, deaths in df.dropna(subset=["mid"]).groupby("mid")["deaths"].sum().items():
            deaths_by_mid[int(mid)] += float(deaths)

    weight = {mid: w for mid, w in deaths_by_mid.items() if mid in lat_by_mid}
    weighted_lat = sum(lat_by_mid[mid] * w for mid, w in weight.items()) / sum(weight.values())

    out_path = root / "data" / "argentina-partido-latitudes.json"
    out_path.write_text(
        json.dumps({"source": SOURCE_LABEL, "latitudes": {UNIFIED_KEY: round(weighted_lat, 6)}}) + "\n"
    )
    return out_path
