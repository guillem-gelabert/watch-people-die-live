"""Declarative registry of every subnational-seasonality source. Each entry pairs a
Source description (country, geo layer, cadence, retrieval mode, measurement class,
licensing, expected region count) with its sources/<key>.py module.
"""

from __future__ import annotations

from .sources import (
    argentina_adm1,
    argentina_partido,
    australia,
    brazil,
    canada,
    mexico,
    russia,
    south_africa,
    usa,
)

MODULES = {
    "russia": russia,
    "usa": usa,
    "brazil": brazil,
    "argentina_adm1": argentina_adm1,
    "argentina_partido": argentina_partido,
    "canada": canada,
    "australia": australia,
    "mexico": mexico,
    "south_africa": south_africa,
}

REGISTRY = [module.SOURCE for module in MODULES.values()]


def get_source(key: str):
    for source in REGISTRY:
        if source.key == key:
            return source
    raise KeyError(key)
