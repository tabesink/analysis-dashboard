#!/usr/bin/env python3
"""Bump and synchronize product version across canonical metadata files.

Usage:
    python scripts/release_version.py 1.2.3
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
VERSION_FILE = ROOT / "VERSION"
CLIENT_PACKAGE_JSON = ROOT / "client" / "package.json"
SERVER_PYPROJECT = ROOT / "server" / "pyproject.toml"
SEMVER_PATTERN = re.compile(r"^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$")
SERVER_VERSION_LINE_PATTERN = re.compile(r'(?m)^version\s*=\s*"[^"]*"\s*$')


def _validate_version(version: str) -> None:
    if not SEMVER_PATTERN.match(version):
        raise ValueError(
            f'Invalid version "{version}". Expected SemVer like 1.2.3 or 1.2.3-beta.1'
        )


def _write_root_version(version: str) -> None:
    VERSION_FILE.write_text(f"{version}\n", encoding="utf-8")


def _write_client_package_json(version: str) -> None:
    payload = json.loads(CLIENT_PACKAGE_JSON.read_text(encoding="utf-8"))
    payload["version"] = version
    CLIENT_PACKAGE_JSON.write_text(
        f'{json.dumps(payload, indent=2, ensure_ascii=True)}\n',
        encoding="utf-8",
    )


def _write_server_pyproject(version: str) -> None:
    current = SERVER_PYPROJECT.read_text(encoding="utf-8")
    match = SERVER_VERSION_LINE_PATTERN.search(current)
    if not match:
        raise RuntimeError("Could not find project version line in server/pyproject.toml")
    updated = SERVER_VERSION_LINE_PATTERN.sub(f'version = "{version}"', current, count=1)
    SERVER_PYPROJECT.write_text(updated, encoding="utf-8")


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python scripts/release_version.py <semver>", file=sys.stderr)
        return 2

    version = sys.argv[1].strip()
    try:
        _validate_version(version)
        _write_root_version(version)
        _write_client_package_json(version)
        _write_server_pyproject(version)
    except Exception as exc:  # pragma: no cover - defensive CLI guard
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    print(f"Synchronized release version: {version}")
    print("Updated: VERSION, client/package.json, server/pyproject.toml")
    print("Next: run `npm --prefix client run generate:version` to refresh client/src/config/version.ts")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
