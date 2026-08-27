"""WorldPop 1km gridded age x sex population -- tier 2's population signal.

CORRECTS 04-04's verdict. 04-04 (`app/globe/persona.ts`'s tier-2 predecessor,
`scripts/build-age-sex-cells.ts`) concluded WorldPop 2020 was infeasible after testing only two
things: the global 1km mosaic (one file per age-sex band, ~3.28 GB x 36 = ~118 GB) and range
requests against it (genuinely unsupported -- `Accept-Ranges: bytes` is advertised but `curl -r`
returns 200 with the full body, and GDAL's `/vsicurl/` reports "Range downloading not supported").
Both of those findings hold. What was missed: WorldPop also publishes a **1km per-country tree**
at the same resolution, verified by HTTP probe on 2026-08-26 and again live during this plan's
execution (2026-08-27):

    https://data.worldpop.org/GIS/AgeSex_structures/Global_2000_2020_1km/unconstrained/2020/{ISO3}/{iso3}_{f|m}_{age}_2020_1km.tif

One Nigerian band is 5.1 MB (HTTP 200, Content-Length 5142168, confirmed live). 241 countries have
a directory. Do **not** use `Global_2000_2020/` (the 100m product, 438 MB for one Nigerian band) or
`.../2020.zip` (30 GB for the world). Fetch whole files -- range requests genuinely do not work at
any resolution, but at 1km-per-country that only means "no partial read", not "no read".

Ages: 0, 1, 5, 10, 15, ... 80 (18 groups) x {f, m} = 36 files per country. Age 0 is exactly age 0
(WorldPop's convention, not [0,4)); age 80 is the open-ended 80+ group.

Design, to keep peak disk small and stay honest about a real download budget:

  - Countries are visited in DESCENDING order of their share of expected deaths in grid cells
    **not already answered by tier 1** (data/subnational-age-sex.json's regional GBD weights, via
    data/region-keys.json) -- computed once by `_priority_order()`, so the budget buys the most
    coverage, and countries already fully served by tier 1 (Brazil, Mexico...) sink to the bottom
    without needing to be special-cased.
  - `fetch()` interleaves download, reduction and deletion PER COUNTRY -- 36 bands land in
    gitignored `data/source/worldpop/rasters/{ISO3}/`, get reduced to this project's 0.5deg cell
    lattice immediately, then the rasters are deleted. Peak disk stays at one country's rasters
    (~5-200 MB), never the cumulative total. This is why `fetch()` does more than a normal
    pipeline source's fetch(): the reduction has to happen before the delete, so it cannot wait
    for a separate `build()` step the way eurostat.py's fetch/build split does. Each country's
    REDUCED result (small: a few hundred cells x 9 bands x 2 sexes) is cached in gitignored
    `data/source/worldpop/reduced/{ISO3}.json` so a second run of `build()` needs no network.
  - `DOWNLOAD_BUDGET_BYTES` (40 GB) is the plan's cumulative cap, checked against each country's
    real `HEAD` Content-Length x 36 before it is fetched -- a country that would blow the
    remaining budget is skipped (not fetched partially), and the *next* (smaller) country in
    priority order is still tried, matching the plan's own rationale ("so the budget buys the
    most coverage") rather than stopping dead at the first oversized country.
  - `MAX_FETCH_SECONDS` is a practical session-time ceiling (this is fetched inside one CLI
    invocation over a live network connection, not a batch job with retries/resume). Whatever is
    still unfetched when it trips is recorded in `meta.skippedCountries` with reason
    "session time budget" and its forgone death share, exactly like a budget-exhausted skip --
    nothing is dropped silently.

Fold: WorldPop's 18 age groups onto this project's nine BANDS (pipeline/age_bands.py). Group 80
(80+) straddles BANDS[7]=[75,84] and BANDS[8]=[85,200]: it is split using the country's own
75-84-vs-85+ *death* share from data/mortality-age-sex.json (per sex), because no finer population
structure is available -- an apportionment, not an observation, and `meta.apportionment80Plus`
says so per country.

Output: data/worldpop-cell-age-sex.json (a build input, NOT browser data -- do not add to
scripts/sync-data.ts).
"""

from __future__ import annotations

import json
import shutil
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

from ..age_bands import BANDS
from ..cache import sha256_of, today
from ..contract import FetchedFile
from ..manifest import record

BASE = "https://data.worldpop.org/GIS/AgeSex_structures/Global_2000_2020_1km/unconstrained/2020"

WP_GROUPS: tuple[int, ...] = (0, 1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80)
SEXES: tuple[str, ...] = ("f", "m")

DOWNLOAD_BUDGET_BYTES = 40_000_000_000
MAX_FETCH_SECONDS = 2700  # 45 min -- a live-network CLI invocation, not a resumable batch job

OUT = "data/worldpop-cell-age-sex.json"

USER_AGENT = "watch-people-die-live/1.0"


def _root_source_dir(root: Path) -> Path:
    d = root / "data" / "source" / "worldpop"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _raster_dir(root: Path, iso3: str) -> Path:
    d = _root_source_dir(root) / "rasters" / iso3
    d.mkdir(parents=True, exist_ok=True)
    return d


def _reduced_dir(root: Path) -> Path:
    d = _root_source_dir(root) / "reduced"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _band_url(iso3: str, sex: str, group: int) -> str:
    return f"{BASE}/{iso3}/{iso3.lower()}_{sex}_{group}_2020_1km.tif"


# --- Priority order: expected-death share of cells NOT already answered by tier 1 -----------


def _priority_order(root: Path) -> tuple[list[dict], dict[int, str], dict[int, list[tuple[int, float, float]]]]:
    """(priority list, m49->iso3, m49->[(gridIndex, lon, lat)]), computed once from
    data/rate-grid.json + data/region-keys.json + data/subnational-age-sex.json (tier 1's real
    regional weights). "Priority" = share of the grid's expected deaths (rate-grid.json's own `w`
    column) in cells whose region key is NOT one tier 1 already answers with a real GBD pyramid.
    Countries tier 1 already fully covers (Brazil, Mexico) fall to ~0 and sink to the bottom.
    """
    grid = json.loads((root / "data" / "rate-grid.json").read_text())
    region_keys = json.loads((root / "data" / "region-keys.json").read_text())
    sub_age_sex = json.loads((root / "data" / "subnational-age-sex.json").read_text())

    tier1_keys = {f"{r['geo']}:{r['key']}" for r in sub_age_sex["regions"]}
    unassigned_iso3 = {row["m49"]: row["iso3"] for row in region_keys["unassigned"]["byCountry"]}

    weight_by_m49: dict[int, float] = defaultdict(float)
    iso3_by_m49: dict[int, str] = {}
    cells_by_m49: dict[int, list[tuple[int, float, float]]] = defaultdict(list)

    for i, (lon, lat, m49, w) in enumerate(grid["cells"]):
        cells_by_m49[m49].append((i, lon, lat))
        ridx = region_keys["cells"][i]
        if ridx >= 0:
            k = region_keys["keys"][ridx]
            iso3_by_m49.setdefault(m49, k["country"])
            key = f"{k['geo']}:{k['key']}"
            if key in tier1_keys:
                continue  # tier 1 already answers this cell; does not count toward priority
        else:
            iso3 = unassigned_iso3.get(m49)
            if iso3:
                iso3_by_m49.setdefault(m49, iso3)
        weight_by_m49[m49] += w

    total_not_tier1 = sum(weight_by_m49.values()) or 1.0
    order = [
        {
            "m49": m49,
            "iso3": iso3_by_m49.get(m49),
            "notTier1Weight": w,
            "notTier1DeathShare": w / total_not_tier1,
        }
        for m49, w in sorted(weight_by_m49.items(), key=lambda kv: -kv[1])
        if iso3_by_m49.get(m49)
    ]
    return order, iso3_by_m49, cells_by_m49


# --- Age-group fold: WorldPop's 18 groups -> this project's 9 BANDS -------------------------


def _wp_bounds(group: int) -> tuple[int, int]:
    if group == 0:
        return (0, 0)
    if group == 1:
        return (1, 4)
    if group == 80:
        return (80, 200)
    return (group, group + 4)


def _band_index_for_group(group: int) -> int:
    """Which of BANDS' 9 indices a WorldPop group falls fully inside, or -1 for group 80
    (80+), which straddles BANDS[7] and BANDS[8] and is apportioned separately."""
    lo, _hi = _wp_bounds(group)
    if group == 80:
        return -1
    for i, (blo, bhi) in enumerate(BANDS):
        if blo <= lo <= bhi:
            return i
    raise ValueError(f"WorldPop group {group} does not fall in any project band")


def _apportionment_ratio(mort: dict, m49: int) -> dict[str, float]:
    """Per-sex share of the country's 75-84-vs-85+ DEATHS that goes to 75-84 -- used to split
    WorldPop's open-ended 80+ population group between BANDS[7]=[75,84] and BANDS[8]=[85,200].
    This is an apportionment (deaths structure standing in for population structure), not an
    observation -- see module docstring. Falls back to the global pyramid, then to 0.5/0.5."""
    row = mort["countries"].get(str(m49)) or mort.get("global")
    out = {}
    for sex in ("m", "f"):
        vals = row[sex] if row else None
        d7 = vals[7] if vals else 0.0
        d8 = vals[8] if vals else 0.0
        denom = d7 + d8
        out[sex] = d7 / denom if denom > 0 else 0.5
    return out


# --- Reduction: sum each raster into this project's 0.5deg grid cells -----------------------


def _reduce_band(tif_path: Path, cells: list[tuple[int, float, float]]) -> tuple[dict[int, float], float]:
    """(gridIndex -> summed population, whole-raster sum) for one band's 36 files, restricted to
    `cells` (this country's own grid cells). The whole-raster sum is the independent control the
    plan's verification step compares the summed cells against (must agree within 2%)."""
    import rasterio
    from rasterio.windows import from_bounds

    with rasterio.open(tif_path) as ds:
        arr = ds.read(1)
        nodata = ds.nodata
        transform = ds.transform
        valid = arr[arr != nodata] if nodata is not None else arr
        whole_sum = float(valid.sum()) if valid.size else 0.0

        per_cell: dict[int, float] = {}
        for idx, lon, lat in cells:
            win = from_bounds(lon, lat, lon + 0.5, lat + 0.5, transform=transform)
            row_off = max(0, int(round(win.row_off)))
            col_off = max(0, int(round(win.col_off)))
            row_end = min(arr.shape[0], int(round(win.row_off + win.height)))
            col_end = min(arr.shape[1], int(round(win.col_off + win.width)))
            if row_end <= row_off or col_end <= col_off:
                continue
            sub = arr[row_off:row_end, col_off:col_end]
            sub_valid = sub[sub != nodata] if nodata is not None else sub
            s = float(sub_valid.sum()) if sub_valid.size else 0.0
            if s > 0:
                per_cell[idx] = s
    return per_cell, whole_sum


def _reduce_country(
    root: Path, m49: int, iso3: str, raster_dir: Path, cells: list[tuple[int, float, float]], mort: dict
) -> dict:
    """Download-independent reduction step: turn 36 already-downloaded rasters for one country
    into per-cell population by this project's 9 bands x 2 sexes, plus the control-sum check."""
    ratio = _apportionment_ratio(mort, m49)
    # raw[sex][group] -> {cellIdx: population}
    raw: dict[str, dict[int, dict[int, float]]] = {sex: {} for sex in SEXES}
    control: list[dict] = []
    for sex in SEXES:
        for group in WP_GROUPS:
            tif = raster_dir / f"{iso3.lower()}_{sex}_{group}_2020_1km.tif"
            per_cell, whole_sum = _reduce_band(tif, cells)
            raw[sex][group] = per_cell
            summed = sum(per_cell.values())
            diff_pct = abs(summed - whole_sum) / whole_sum * 100 if whole_sum > 0 else 0.0
            control.append(
                {"sex": sex, "group": group, "gridSum": round(summed, 1), "rasterSum": round(whole_sum, 1), "diffPct": round(diff_pct, 3)}
            )

    cell_ids = sorted({idx for sex in SEXES for group in WP_GROUPS for idx in raw[sex][group]})
    m_by_cell: list[list[float]] = []
    f_by_cell: list[list[float]] = []
    for idx in cell_ids:
        row = {"m": [0.0] * 9, "f": [0.0] * 9}
        for sex in SEXES:
            for group in WP_GROUPS:
                pop = raw[sex][group].get(idx, 0.0)
                if pop <= 0:
                    continue
                bi = _band_index_for_group(group)
                if bi >= 0:
                    row[sex][bi] += pop
                else:  # group 80 (80+): apportion across BANDS[7]/BANDS[8]
                    r = ratio[sex]
                    row[sex][7] += pop * r
                    row[sex][8] += pop * (1 - r)
        m_by_cell.append([round(v, 3) for v in row["m"]])
        f_by_cell.append([round(v, 3) for v in row["f"]])

    max_diff = max((c["diffPct"] for c in control), default=0.0)
    avg_diff = sum(c["diffPct"] for c in control) / len(control) if control else 0.0
    return {
        "m49": m49,
        "iso3": iso3,
        "cellIndex": cell_ids,
        "m": m_by_cell,
        "f": f_by_cell,
        "controlCheck": {"maxDiffPct": round(max_diff, 3), "avgDiffPct": round(avg_diff, 3)},
        "apportionment80Plus": ratio,
    }


# --- Fetch: HEAD-budget, parallel download, reduce, delete -- per country, in priority order --


def fetch(root: Path) -> dict:
    """Fetch+reduce+delete, country by country, in descending priority order, until the 40 GB
    cumulative budget or the practical session-time ceiling is hit. Returns a summary dict; the
    per-country reduced results are cached on disk (data/source/worldpop/reduced/) for `build()`.
    """
    started = time.time()
    priority, _iso3_by_m49, cells_by_m49 = _priority_order(root)
    mort = json.loads((root / "data" / "mortality-age-sex.json").read_text())

    session = requests.Session()
    adapter = requests.adapters.HTTPAdapter(pool_connections=40, pool_maxsize=40)
    session.mount("https://", adapter)
    session.headers.update({"User-Agent": USER_AGENT})

    reduced_dir = _reduced_dir(root)
    covered: list[dict] = []
    skipped: list[dict] = []
    cumulative_bytes = 0
    stopped_on_time = False

    def _write_summary_so_far() -> None:
        # Written (and the sources.lock.json manifest re-recorded) after EVERY country, not just
        # at the loop's natural end -- an interrupted run (Ctrl-C, a killed session, a machine
        # that goes to sleep) still leaves an accurate, honest summary AND provenance record on
        # disk instead of silently losing the whole run's history. Two 2026-08-27 incidents made
        # this necessary: a run that had already covered 63 countries was stopped early for
        # practical session-time reasons and, before this fix, left no summary for build() to
        # read; separately, an earlier version of the manifest recording only tracked what THIS
        # invocation's own loop had touched, so a run interrupted before re-visiting every
        # already-cached country would overwrite sources.lock.json's "worldpop" key with a
        # partial list -- fixed by scanning the reduced/ directory directly, below.
        summary = {
            "coveredCountries": covered,
            "skippedCountries": skipped,
            "cumulativeBytes": cumulative_bytes,
            "elapsedSeconds": round(time.time() - started, 1),
            "stoppedOnTimeBudget": stopped_on_time,
        }
        (reduced_dir / "_fetch-summary.json").write_text(json.dumps(summary))
        on_disk = [p for p in reduced_dir.glob("*.json") if p.name != "_fetch-summary.json"]
        if on_disk:
            record(
                "worldpop",
                [
                    FetchedFile(path=Path(f"{p.stem}-36bands"), url=f"{BASE}/{p.stem}/", sha256=sha256_of(p), retrieved=today())
                    for p in sorted(on_disk)
                ],
            )

    for entry in priority:
      try:
        m49, iso3, share = entry["m49"], entry["iso3"], entry["notTier1DeathShare"]
        cache_path = reduced_dir / f"{iso3}.json"
        if cache_path.exists():
            covered.append({"iso3": iso3, "m49": m49, "notTier1DeathShare": share, "cached": True})
            continue

        if time.time() - started > MAX_FETCH_SECONDS:
            stopped_on_time = True
            skipped.append({"iso3": iso3, "m49": m49, "notTier1DeathShare": share, "reason": "session time budget"})
            continue

        # A connection reset/timeout here must not take down the whole priority loop -- one flaky
        # country is a skip, not a crash. Two attempts: transient network blips (observed live
        # against data.worldpop.org) usually clear on retry.
        head = None
        head_error: str | None = None
        for _attempt in range(2):
            try:
                head = session.head(_band_url(iso3, "f", 0), timeout=30, allow_redirects=True)
                head_error = None
                break
            except requests.RequestException as exc:
                head_error = str(exc)
        if head is None:
            skipped.append({"iso3": iso3, "m49": m49, "notTier1DeathShare": share, "reason": f"HEAD request failed: {head_error}"})
            continue
        if head.status_code != 200 or "Content-Length" not in head.headers:
            skipped.append({"iso3": iso3, "m49": m49, "notTier1DeathShare": share, "reason": f"not available from WorldPop (HTTP {head.status_code})"})
            continue
        estimated_bytes = int(head.headers["Content-Length"]) * len(WP_GROUPS) * len(SEXES)
        if cumulative_bytes + estimated_bytes > DOWNLOAD_BUDGET_BYTES:
            skipped.append({"iso3": iso3, "m49": m49, "notTier1DeathShare": share, "reason": "40 GB cumulative budget"})
            continue

        # Everything from here on touches the network, the filesystem and rasterio -- any of
        # which can throw for reasons specific to one country's files (a mid-download reset, a
        # truncated/corrupt raster, a disk hiccup). This is an unattended loop over ~50-200
        # countries; one country's failure must be a recorded skip, never a crash that loses
        # every country after it (see 2026-08-27 incident: an uncaught ConnectionError from the
        # HEAD probe above took down a whole run after 9 countries had already succeeded).
        raster_dir = _raster_dir(root, iso3)
        try:
            urls = [(sex, group, _band_url(iso3, sex, group)) for sex in SEXES for group in WP_GROUPS]
            actual_bytes = 0
            ok = True
            with ThreadPoolExecutor(max_workers=len(urls)) as pool:
                futures = {}
                for sex, group, url in urls:
                    dest = raster_dir / f"{iso3.lower()}_{sex}_{group}_2020_1km.tif"
                    futures[pool.submit(session.get, url, timeout=180)] = (sex, group, url, dest)
                for fut in as_completed(futures):
                    sex, group, url, dest = futures[fut]
                    try:
                        response = fut.result()
                        response.raise_for_status()
                        dest.write_bytes(response.content)
                        actual_bytes += len(response.content)
                    except requests.RequestException as exc:
                        ok = False
                        skipped.append({"iso3": iso3, "m49": m49, "notTier1DeathShare": share, "reason": f"download failed: {exc}"})
                        break

            if not ok:
                continue  # `finally` below still cleans up raster_dir

            cells = cells_by_m49.get(m49, [])
            result = _reduce_country(root, m49, iso3, raster_dir, cells, mort)
            cache_path.write_text(json.dumps(result))
        except Exception as exc:  # noqa: BLE001 -- unattended batch loop; see comment above
            skipped.append({"iso3": iso3, "m49": m49, "notTier1DeathShare": share, "reason": f"fetch/reduce failed: {exc}"})
            continue
        finally:
            shutil.rmtree(raster_dir, ignore_errors=True)

        cumulative_bytes += actual_bytes
        covered.append({"iso3": iso3, "m49": m49, "notTier1DeathShare": share, "bytes": actual_bytes, "controlCheck": result["controlCheck"]})
        print(
            f"worldpop {iso3}: {len(cells)} cells, {actual_bytes / 1e6:.1f} MB, "
            f"control diff avg {result['controlCheck']['avgDiffPct']:.2f}% max {result['controlCheck']['maxDiffPct']:.2f}%, "
            f"cumulative {cumulative_bytes / 1e9:.2f} GB"
        )
      finally:
        _write_summary_so_far()  # also re-records the manifest -- see its docstring

    # Loop already wrote the summary (and manifest) after every country; this final call just
    # folds in the (accurate either way) elapsedSeconds/stoppedOnTimeBudget as of a clean, natural
    # exit and returns the same shape the CLI prints from.
    _write_summary_so_far()
    return {
        "coveredCountries": covered,
        "skippedCountries": skipped,
        "cumulativeBytes": cumulative_bytes,
        "elapsedSeconds": round(time.time() - started, 1),
        "stoppedOnTimeBudget": stopped_on_time,
    }


# --- Build: assemble the final artifact from cached per-country reduced results -------------


def build(root: Path) -> Path:
    reduced_dir = _reduced_dir(root)
    summary_path = reduced_dir / "_fetch-summary.json"
    if not summary_path.exists():
        raise FileNotFoundError(f"{summary_path} missing -- run `python -m pipeline fetch-worldpop` first")
    summary = json.loads(summary_path.read_text())

    grid = json.loads((root / "data" / "rate-grid.json").read_text())
    cell_count = len(grid["cells"])

    by_cell_m: dict[int, list[float]] = {}
    by_cell_f: dict[int, list[float]] = {}
    covered_iso3: list[str] = []
    for entry in summary["coveredCountries"]:
        iso3 = entry["iso3"]
        path = reduced_dir / f"{iso3}.json"
        if not path.exists():
            continue
        result = json.loads(path.read_text())
        covered_iso3.append(iso3)
        for idx, m_row, f_row in zip(result["cellIndex"], result["m"], result["f"], strict=True):
            by_cell_m[idx] = m_row
            by_cell_f[idx] = f_row

    cell_index = sorted(by_cell_m)
    covered_weight = sum(w for i, (_, _, _, w) in enumerate(grid["cells"]) if i in by_cell_m)
    total_weight = sum(w for _, _, _, w in grid["cells"])

    # Dense alignment array, one entry per rate-grid.json cell (length == cellCount == 59954,
    # the plan's own verification criterion) -- exactly the way 04-05's data/region-keys.json
    # aligns its own dense `cells` array to a compact `keys` table, rather than shipping a sparse
    # index that only implies the grid's length via a meta field.
    cells_dense: list[int] = [-1] * cell_count
    for pos, idx in enumerate(cell_index):
        cells_dense[idx] = pos

    payload = {
        "meta": {
            "note": (
                "Per-cell population by 9 age bands x 2 sexes, from WorldPop 2020 1km "
                "unconstrained per-country GeoTIFFs, reduced onto data/rate-grid.json's own "
                "0.5deg lattice. Corrects 04-04's WorldPop-infeasibility verdict, which tested "
                "only the global 118 GB mosaic -- see this module's docstring. Feeds tier 2's "
                "population x national-age-specific-rate estimator in "
                "scripts/build-age-sex-cells.ts; tier 3 (the old CDR-gap proxy, or the flat "
                "national pyramid) still answers everywhere WorldPop was not fetched for."
            ),
            "urlTemplate": f"{BASE}/{{ISO3}}/{{iso3}}_{{f|m}}_{{age}}_2020_1km.tif",
            "retrieved": today(),
            "bands": [list(b) for b in BANDS],
            "wpAgeGroups": list(WP_GROUPS),
            "apportionment80PlusNote": (
                "WorldPop's open-ended 80+ group straddles bands[7]=[75,84] and "
                "bands[8]=[85,200]; split per country x sex using data/mortality-age-sex.json's "
                "own 75-84-vs-85+ DEATH share as a stand-in for the population split -- an "
                "apportionment, not an observation. See each covered country's "
                "apportionment80Plus in data/source/worldpop/reduced/{ISO3}.json."
            ),
            "cellCount": cell_count,
            "coveredCells": len(cell_index),
            "coveredCountries": sorted(covered_iso3),
            "coveredCountryCount": len(covered_iso3),
            "coveredDeathShareOfWorld": round(covered_weight / total_weight, 4) if total_weight else 0,
            "skippedCountries": summary["skippedCountries"],
            "cumulativeDownloadBytes": summary["cumulativeBytes"],
            "elapsedSeconds": summary["elapsedSeconds"],
            "stoppedOnTimeBudget": summary["stoppedOnTimeBudget"],
        },
        "cells": cells_dense,
        "m": [by_cell_m[i] for i in cell_index],
        "f": [by_cell_f[i] for i in cell_index],
    }

    out = root / OUT
    out.write_text(json.dumps(payload) + "\n")
    return out
