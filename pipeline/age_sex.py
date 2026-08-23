"""Collect observed regional age x sex death counts from the sources that carry them.

Separate from build.py on purpose. The curve machinery there is one-dimensional -- one value per
region per period -- and threading age and sex through it would change committed seasonality
output. These sources' raw files already held age and sex; `load()` filtered them out at parse
time, and `load_age_sex()` is the second reader that keeps them.

Bands are per source, not shared. StatCan publishes 0-44/45-64/65-84/85+ and nothing finer; the
Brazilian and Mexican microdata carry an exact age and fold onto the project's nine; the ABS
weekly dataflow has no age dimension at all. A consumer aggregates its own estimate up to
whichever bands a source declares.

Output: data/observed-regional-age-sex.json
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Protocol

from .build import find_root
from .cache import cache_dir as resolve_cache_dir
from .contract import AgeSexRow, Source
from .registry import MODULES, REGISTRY


class AgeSexSource(Protocol):
    SOURCE: Source
    AGE_SEX_BANDS: tuple[tuple[int, int], ...]

    def load_age_sex(self, cache_dir: Path) -> tuple[list[AgeSexRow], list[str]]: ...


def build_age_sex(root: Path, keys: list[str] | None = None) -> dict:
    c_dir = resolve_cache_dir(root)
    sources: list[dict] = []
    rows: list[AgeSexRow] = []

    for source in REGISTRY:
        if keys and source.key not in keys:
            continue
        module = MODULES[source.key]
        loader = getattr(module, "load_age_sex", None)
        if loader is None:
            continue
        source_rows, notes = loader(c_dir)
        if not source_rows:
            continue
        # Counts, not rates: every source sums whole registrations, so integers are both smaller
        # and truer than the float repr. `region_key` is null for every adm1 source here, so it
        # is dropped rather than repeated 16,000 times.
        for row in source_rows:
            row["deaths"] = int(round(row["deaths"]))
            if row.get("region_key") is None:
                row.pop("region_key", None)
            if row.get("region_name") == row.get("iso_region"):
                row.pop("region_name", None)
        rows.extend(source_rows)
        bands = module.AGE_SEX_BANDS
        sources.append({
            "key": source.key,
            "country": source.country_iso3,
            "geo": source.geo,
            "measurement": source.measurement,
            "bands": [list(b) for b in bands],
            "regions": len({r["iso_region"] or r["region_key"] for r in source_rows}),
            "deaths": round(sum(r["deaths"] for r in source_rows), 1),
            "has_cause": any("icd_chapter" in r for r in source_rows),
            "notes": notes,
        })

    return {
        "meta": {
            "note": (
                "Observed regional age x sex death counts, from the pipeline sources whose raw "
                "files already carry age and sex. Bands differ per source -- see sources[].bands. "
                "Counts are observed registrations, not modelled estimates, and are summed over "
                "every period the source publishes rather than being a rate."
            ),
            "purpose": (
                "Validation fixture for derived per-cell age/sex pyramids: aggregate a derived "
                "pyramid up to a source's bands and compare."
            ),
            "sources": sources,
            "totalRows": len(rows),
        },
        "rows": rows,
    }


def write_age_sex(root: Path | None = None, keys: list[str] | None = None) -> Path:
    root = root or find_root()
    result = build_age_sex(root, keys)
    out_path = root / "data" / "observed-regional-age-sex.json"
    out_path.write_text(json.dumps(result, ensure_ascii=False) + "\n")
    return out_path
