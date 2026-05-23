#!/usr/bin/env bash
# RSP Dashboard - version, validate release notes, then build LAN bundle.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$SCRIPT_DIR"
REPO_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"
DASHBOARD_DIR="$REPO_DIR/Dashboard"

usage() {
    echo "Usage: ./release.sh <MAJOR.MINOR.PATCH[-PRERELEASE]>" >&2
    echo "       SKIP_VERSION_SYNC=1 ./release.sh <VERSION>  # internal use by ../release.sh" >&2
}

VERSION="${1:-}"
if [[ -z "$VERSION" || "${2:-}" != "" ]]; then
    usage
    exit 2
fi

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]]; then
    echo "error: VERSION='$VERSION' is not a deployable SemVer tag" >&2
    echo "       Use MAJOR.MINOR.PATCH or MAJOR.MINOR.PATCH-prerelease." >&2
    echo "       Build metadata with '+' is not supported in Docker image tags." >&2
    exit 2
fi

if [[ "${SKIP_VERSION_SYNC:-0}" == "1" ]]; then
    echo "==> Skipping release version sync (already completed)"
else
    echo "==> Syncing release version ${VERSION}"
    ( cd "$DASHBOARD_DIR" && ./scripts/release_version.sh "$VERSION" )
fi

echo "==> Checking changelog release notes"
python3 "$DEPLOY_DIR/scripts/extract_release_notes.py" \
    --changelog "$DASHBOARD_DIR/CHANGELOG.md" \
    --version "$VERSION" \
    >/dev/null

echo "==> Building release bundle"
( cd "$DEPLOY_DIR" && ./build.sh )
