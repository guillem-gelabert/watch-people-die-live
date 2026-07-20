"""Committed provenance manifest for raw files cached under data/source/subnational/
(that directory itself is gitignored, so the manifest lives here, tracked in git,
recording each raw file's source URL, retrieval date, and checksum)."""

from __future__ import annotations

import json
from pathlib import Path

from .contract import FetchedFile

MANIFEST_PATH = Path(__file__).resolve().parent / "sources.lock.json"


def load_manifest() -> dict:
    if MANIFEST_PATH.exists():
        return json.loads(MANIFEST_PATH.read_text())
    return {}


def record(source_key: str, files: list[FetchedFile]) -> None:
    manifest = load_manifest()
    manifest[source_key] = [
        {"file": f.path.name, "url": f.url, "sha256": f.sha256, "retrieved": f.retrieved}
        for f in files
    ]
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
