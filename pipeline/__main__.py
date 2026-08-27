"""CLI: python -m pipeline
{status | fetch [source...] | build [source...] | age-sex [source...] |
 fetch-eurostat | eurostat | fetch-worldpop | worldpop | argentina-latitudes}
"""

from __future__ import annotations

import argparse
from pathlib import Path

from .age_sex import write_age_sex
from .build import find_root, write_seasonality
from .cache import cache_dir as resolve_cache_dir
from .manifest import record
from .registry import MODULES, REGISTRY
from .sources import argentina_partido_latitudes, eurostat, worldpop


def cmd_status(root: Path) -> None:
    resolve_cache_dir(root)  # ensure it exists
    print(f"{'source':20s} {'mode':16s} {'enabled':8s} {'expected':9s}")
    for source in REGISTRY:
        print(
            f"{source.key:20s} {source.retrieval_mode:16s} {str(source.enabled):8s} "
            f"{source.expected_regions:9d}"
        )


def cmd_fetch(root: Path, keys: list[str]) -> None:
    c_dir = resolve_cache_dir(root)
    targets = [s for s in REGISTRY if not keys or s.key in keys]
    for source in targets:
        module = MODULES[source.key]
        print(f"fetching {source.key} ({source.retrieval_mode})...")
        files = module.fetch(c_dir)
        if files:
            record(source.key, files)


def cmd_build(root: Path, keys: list[str] | None) -> None:
    out_path = write_seasonality(root, keys)
    print(f"wrote {out_path}")


def cmd_age_sex(root: Path, keys: list[str]) -> None:
    out_path = write_age_sex(root, keys or None)
    print(f"wrote {out_path}")


def cmd_fetch_eurostat(root: Path) -> None:
    """Eurostat is not in REGISTRY -- it feeds its own artifact, not the seasonality curve --
    so it gets its own fetch/build pair rather than riding `fetch`/`build`."""
    c_dir = resolve_cache_dir(root)
    files = eurostat.fetch(c_dir)
    record("eurostat", files)
    for f in files:
        print(f"fetched {f.path.name}")


def cmd_eurostat(root: Path) -> None:
    out_path = eurostat.build(root, resolve_cache_dir(root))
    print(f"wrote {out_path}")


def cmd_fetch_worldpop(root: Path) -> None:
    """WorldPop is not in REGISTRY either -- like eurostat, it feeds its own artifact. Unlike
    eurostat's fetch, this one also reduces and deletes each country's rasters before moving to
    the next (see pipeline/sources/worldpop.py's docstring for why fetch/build cannot cleanly
    split here the way eurostat's does)."""
    summary = worldpop.fetch(root)
    print(
        f"worldpop fetch: {len(summary['coveredCountries'])} countries covered, "
        f"{len(summary['skippedCountries'])} skipped, "
        f"{summary['cumulativeBytes'] / 1e9:.2f} GB, {summary['elapsedSeconds']:.0f}s"
    )


def cmd_worldpop(root: Path) -> None:
    out_path = worldpop.build(root)
    print(f"wrote {out_path}")


def cmd_argentina_latitudes(root: Path) -> None:
    out_path = argentina_partido_latitudes.build(root)
    print(f"wrote {out_path}")


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m pipeline")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("status")
    fetch_p = sub.add_parser("fetch")
    fetch_p.add_argument("source", nargs="*")
    build_p = sub.add_parser("build")
    build_p.add_argument("source", nargs="*")
    age_sex_p = sub.add_parser("age-sex")
    age_sex_p.add_argument("source", nargs="*")
    sub.add_parser("fetch-eurostat")
    sub.add_parser("eurostat")
    sub.add_parser("fetch-worldpop")
    sub.add_parser("worldpop")
    sub.add_parser("argentina-latitudes")
    args = parser.parse_args()

    root = find_root()
    if args.command == "status":
        cmd_status(root)
    elif args.command == "fetch":
        cmd_fetch(root, args.source)
    elif args.command == "build":
        cmd_build(root, args.source or None)
    elif args.command == "age-sex":
        cmd_age_sex(root, args.source)
    elif args.command == "fetch-eurostat":
        cmd_fetch_eurostat(root)
    elif args.command == "eurostat":
        cmd_eurostat(root)
    elif args.command == "fetch-worldpop":
        cmd_fetch_worldpop(root)
    elif args.command == "worldpop":
        cmd_worldpop(root)
    elif args.command == "argentina-latitudes":
        cmd_argentina_latitudes(root)


if __name__ == "__main__":
    main()
