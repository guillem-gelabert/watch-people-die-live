"""Deterministic, from-scratch builder for data/seasonality-subnational.json.

Every enabled source's `load()` output is folded through the same canonical curve math
(pipeline.curve) and joined to Natural Earth admin-1 geometry (pipeline.geo), so the
output is reproducible from raw cached files alone -- no read-modify-write, no ordering
dependence between sources.
"""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path

from .cache import cache_dir as resolve_cache_dir
from .contract import Source
from .curve import HARMONIC_ORDER, country_curve_records, evaluate_harmonic, rate_curve_records
from .geo import load_iso_geo, sample_kg_family
from .registry import MODULES, REGISTRY


def find_root(start: Path | None = None) -> Path:
    """Walk upward until a directory containing package.json (mirrors notebooks/lib/grid.py)."""
    p = (start or Path.cwd()).resolve()
    for candidate in [p, *p.parents]:
        if (candidate / "package.json").exists():
            return candidate
    raise FileNotFoundError(f"No package.json found above {p}")


def _fold_source(source: Source, rows: list[dict], iso_geo: dict) -> tuple[list[dict], list[dict]]:
    by_key: dict[str, list[dict]] = defaultdict(list)
    meta_by_key: dict[str, dict] = {}
    for row in rows:
        key = row.get("iso_region") or row["region_key"]
        by_key[key].append(row)
        meta_by_key.setdefault(key, row)

    region_rows: list[dict] = []
    partido_rows: list[dict] = []
    for key, records in by_key.items():
        if source.cadence == "rate":
            result = rate_curve_records(records)
        else:
            result = country_curve_records(records, min_annual=source.min_annual)
        if result is None:
            continue

        interval = "week" if source.cadence in ("week", "rate") else "month"
        meta = meta_by_key[key]
        harmonic = {
            "order": result["harmonic"]["order"],
            "coefficients": [round(x, 8) for x in result["harmonic"]["coefficients"]],
        }
        annual = round(result["annual"]) if result["annual"] is not None else None

        if source.geo == "adm1":
            iso_region = meta.get("iso_region")
            if iso_region not in iso_geo:
                continue
            g = iso_geo[iso_region]
            region_rows.append({
                "country": g["adm0_a3"], "geo": "adm1", "key": g["adm1_code"], "name": g["name"],
                "isoRegion": iso_region, "interval": interval, "curve": harmonic,
                "nYears": result["n_years"], "annualDeaths": annual,
                "measurement": source.measurement,
            })
        else:
            partido_rows.append({
                "country": source.country_iso3, "geo": "partido", "key": meta["region_key"],
                "name": meta["region_name"], "isoRegion": None, "interval": interval, "curve": harmonic,
                "nYears": result["n_years"], "annualDeaths": annual,
                "measurement": source.measurement,
            })
    return region_rows, partido_rows


def _assert_expected(source: Source, region_rows: list[dict], partido_rows: list[dict]) -> None:
    got = len(region_rows) + len(partido_rows)
    assert got == source.expected_regions, (
        f"{source.key}: joined {got} regions, expected {source.expected_regions}"
    )


def _duplicated(keys: list) -> bool:
    return len(keys) != len(set(keys))


def build_seasonality(root: Path | None = None, sources: list[str] | None = None) -> dict:
    root = root or find_root()
    c_dir = resolve_cache_dir(root)
    iso_geo = load_iso_geo(root)

    enabled = [s for s in REGISTRY if s.enabled and (sources is None or s.key in sources)]

    all_region_rows: list[dict] = []
    all_partido_rows: list[dict] = []
    for source in enabled:
        module = MODULES[source.key]
        rows = module.load(c_dir)
        region_rows, partido_rows = _fold_source(source, rows, iso_geo)

        if source.key == "russia":
            region_rows = region_rows + module.impute(c_dir, iso_geo, region_rows)

        _assert_expected(source, region_rows, partido_rows)
        all_region_rows.extend(region_rows)
        all_partido_rows.extend(partido_rows)

    # Koppen-Geiger dominant family, sampled at each adm1 region's Natural Earth centroid.
    # Partido rows are finer than admin-1 and were never KG-sampled.
    cent_by_adm1 = {g["adm1_code"]: (g["latitude"], g["longitude"]) for g in iso_geo.values()}
    points = [cent_by_adm1.get(r["key"], (None, None)) for r in all_region_rows]
    for row, family in zip(all_region_rows, sample_kg_family(root, points), strict=True):
        if family:
            row["kgFamily"] = family

    # Estimated per-region curves for India and China (no observed subnational data): a
    # population-weighted Koppen climate fallback, so the amplitude map shows the within-country
    # variation their single national curve hides. Full builds only (they aren't a source).
    climate_rows: list[dict] = []
    if sources is None:
        from . import climate_fallback

        model = climate_fallback.build_climate_model(root)
        climate_rows = climate_fallback.india_china_regions(root, model, iso_geo)

    assert not _duplicated([r["key"] for r in all_region_rows + climate_rows]), "duplicate adm1 key"
    assert not _duplicated([r["key"] for r in all_partido_rows]), "duplicate partido key"
    all_rows = all_region_rows + all_partido_rows + climate_rows
    phases = [i / 1464 for i in range(1464)]
    for r in all_rows:
        harmonic = r["curve"]
        assert harmonic["order"] == HARMONIC_ORDER, r["key"]
        assert len(harmonic["coefficients"]) == 2 * HARMONIC_ORDER + 1, r["key"]
        assert abs(harmonic["coefficients"][0] - 1) < 1e-6, r["key"]
        dense = evaluate_harmonic(harmonic["coefficients"], phases)
        assert all(0.3 < x < 3 for x in dense), (r["key"], harmonic)

    meta = {
        "sources": [s.notes for s in enabled if s.notes],
        "method": (
            "Per-region continuous pooled order-4 Fourier curve via the canonical "
            "country_curve/rate_curve (pipeline/curve.py), identical to the country model. "
            "Each complete non-COVID calendar year is converted to daily intensity and "
            "normalised to annual mean 1 before all observations are pooled. Complete weekly "
            "series retain their 52/53 observations; Russia's weekly SDR remains intensive. "
            "min_annual=500 for count-based regions (nYears/annualDeaths attached so small "
            "regions can be confidence-flagged); Buenos Aires partidos keep all complete years."
        ),
        "harmonicOrder": HARMONIC_ORDER,
        "continuous": True,
        "covidExcluded": [2020, 2021, 2022],
        "geoLayer": (
            "adm1 rows keyed by Natural Earth 10m admin-1 code (data/admin1-10m.json), the "
            "same key as data/subnational-cdr.json; partido rows (geo='partido') are finer "
            "than admin-1 and roadmap-only."
        ),
        "curveMeaning": (
            "Fourier coefficients for a continuous annual multiplier with integral mean 1; "
            ">1 = above-average mortality at that phase of the year."
        ),
        "adm1Count": len(all_region_rows),
        "partidoCount": len(all_partido_rows),
        "perCountryAdm1": dict(sorted(Counter(r["country"] for r in all_region_rows).items())),
        "climateModeledCount": len(climate_rows),
        "perCountryClimateModeled": dict(sorted(Counter(r["country"] for r in climate_rows).items())),
        "climateModeledNote": (
            "India/China adm1 rows are estimates, not observations: a population-weighted "
            "Koppen class->family->latitude blend of measured countries' curves "
            "(measurement='climate-modeled'). Shown on the amplitude map only; excluded from the "
            "region leave-one-out validation."
        ),
        "regionCount": len(all_rows),
        "license": "; ".join(sorted({s.license for s in enabled})),
    }
    return {"meta": meta, "regions": all_rows}


def write_seasonality(root: Path | None = None, sources: list[str] | None = None) -> Path:
    root = root or find_root()
    result = build_seasonality(root, sources)
    out_path = root / "data" / "seasonality-subnational.json"
    out_path.write_text(json.dumps(result, ensure_ascii=False) + "\n")
    if sources is None:
        from . import climate_fallback

        climate_fallback.write_climate_model(root)
    return out_path
