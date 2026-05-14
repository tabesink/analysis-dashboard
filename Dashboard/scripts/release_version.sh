#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

usage() {
  echo "Usage:"
  echo "  scripts/release_version.sh <semver>   # bump + sync + generate + verify"
  echo "  scripts/release_version.sh --check    # verify sync only"
}

if [[ "${1:-}" == "" ]]; then
  usage
  exit 2
fi

cd "${ROOT_DIR}"

if [[ "$1" == "--check" ]]; then
  python3 scripts/check_version_sync.py
  exit 0
fi

VERSION="$1"

python3 scripts/release_version.py "${VERSION}"
npm --prefix client run generate:version
python3 scripts/check_version_sync.py

echo "Release version workflow complete for ${VERSION}"
