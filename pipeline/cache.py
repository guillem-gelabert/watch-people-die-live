"""Cache-dir resolution, checksum helpers, and download/verify primitives for pipeline sources."""

from __future__ import annotations

import datetime
import hashlib
from pathlib import Path
from urllib.request import Request, urlopen

from .contract import FetchedFile

USER_AGENT = "watch-people-die-live/1.0"


def cache_dir(root: Path) -> Path:
    d = root / "data" / "source" / "subnational"
    d.mkdir(parents=True, exist_ok=True)
    return d


def today() -> str:
    return datetime.date.today().isoformat()


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def download(url: str, dest: Path, timeout: int = 120) -> FetchedFile:
    """Fetch `url` straight to `dest` (used by `api`/`direct-download` sources)."""
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=timeout) as response, dest.open("wb") as out:  # noqa: S310
        out.write(response.read())
    return FetchedFile(path=dest, url=url, sha256=sha256_of(dest), retrieved=today())


def verify_manual(cache_dir_path: Path, filenames: list[str], url: str, instructions: str) -> list[FetchedFile]:
    """Assert each expected manual-mode file is already cached and record its checksum for
    the provenance manifest, rather than downloading it -- for registration- or
    licence-gated sources `fetch` can't reach automatically."""
    missing = [name for name in filenames if not (cache_dir_path / name).exists()]
    if missing:
        raise FileNotFoundError(
            f"Missing manual-mode file(s) under {cache_dir_path}: {missing}\n{instructions}"
        )
    return [
        FetchedFile(
            path=cache_dir_path / name,
            url=url,
            sha256=sha256_of(cache_dir_path / name),
            retrieved=today(),
        )
        for name in filenames
    ]
