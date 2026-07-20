"""Subnational + subyearly mortality-seasonality retrieval pipeline.

`python -m pipeline build` (re)writes data/seasonality-subnational.json from the raw
files cached in data/source/subnational/. `python -m pipeline fetch [source...]`
downloads/verifies each source's raw inputs. `python -m pipeline status` reports what's
cached and what's missing per the registry in pipeline/registry.py.
"""

from .build import build_seasonality, write_seasonality
from .registry import REGISTRY, get_source

__all__ = ["REGISTRY", "build_seasonality", "get_source", "write_seasonality"]
