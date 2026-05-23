#!/usr/bin/env python3
"""Extract one Keep-a-Changelog release section into bundle release notes."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


SECTION_RE = re.compile(r"^## \[(?P<version>[^\]]+)\](?P<suffix>.*)$", re.MULTILINE)


def extract_release_section(changelog: str, version: str) -> str:
    matches = list(SECTION_RE.finditer(changelog))
    for index, match in enumerate(matches):
        if match.group("version") != version:
            continue
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(changelog)
        body = changelog[start:end].strip()
        if not body:
            raise ValueError(f"CHANGELOG.md release section for {version} is empty")
        heading = f"## [{version}]{match.group('suffix').rstrip()}"
        return f"# RSP Dashboard {version} Release Notes\n\n{heading}\n\n{body}\n"
    raise ValueError(f"CHANGELOG.md does not contain a release section for {version}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--changelog", required=True, type=Path)
    parser.add_argument("--version", required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    try:
        notes = extract_release_section(
            args.changelog.read_text(encoding="utf-8"),
            args.version,
        )
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    if args.output:
        args.output.write_text(notes, encoding="utf-8")
    else:
        print(notes, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
