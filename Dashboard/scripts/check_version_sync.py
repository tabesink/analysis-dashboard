#!/usr/bin/env python3
"""Fail when version metadata drifts from root VERSION."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
VERSION_FILE = ROOT / "VERSION"
CLIENT_PACKAGE_JSON = ROOT / "client" / "package.json"
SERVER_PYPROJECT = ROOT / "server" / "pyproject.toml"
SERVER_VERSION_LINE_PATTERN = re.compile(r'(?m)^version\s*=\s*"([^"]+)"\s*$')


def _read_root_version() -> str:
    return VERSION_FILE.read_text(encoding="utf-8").strip()


def _read_client_version() -> str:
    payload = json.loads(CLIENT_PACKAGE_JSON.read_text(encoding="utf-8"))
    return str(payload.get("version", "")).strip()


def _read_server_version() -> str:
    content = SERVER_PYPROJECT.read_text(encoding="utf-8")
    match = SERVER_VERSION_LINE_PATTERN.search(content)
    if not match:
        raise RuntimeError("Could not find project version in server/pyproject.toml")
    return match.group(1).strip()


def main() -> int:
    root_version = _read_root_version()
    client_version = _read_client_version()
    server_version = _read_server_version()

    errors: list[str] = []
    if client_version != root_version:
        errors.append(
            f"client/package.json version ({client_version}) != VERSION ({root_version})"
        )
    if server_version != root_version:
        errors.append(
            f"server/pyproject.toml version ({server_version}) != VERSION ({root_version})"
        )

    if errors:
        print("Version drift detected:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        print(
            "Fix: run `python3 scripts/release_version.py <version>` with the intended SemVer.",
            file=sys.stderr,
        )
        return 1

    print(f"Version sync check passed: {root_version}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
