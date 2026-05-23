#!/usr/bin/env bash
# RSP Dashboard - one-command release from changelog notes to verified bundle.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$SCRIPT_DIR"
DASHBOARD_DIR="$REPO_DIR/Dashboard"
DEPLOY_DIR="$REPO_DIR/Deployment"

usage() {
    echo "Usage: ./release.sh <MAJOR.MINOR.PATCH[-PRERELEASE]>" >&2
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

echo "==> Promoting changelog notes for ${VERSION}"
"$DEPLOY_DIR/scripts/promote_unreleased.sh" \
    --changelog "$DASHBOARD_DIR/CHANGELOG.md" \
    --version "$VERSION"

echo "==> Syncing release version ${VERSION}"
( cd "$DASHBOARD_DIR" && ./scripts/release_version.sh "$VERSION" )

echo "==> Building release bundle"
( cd "$DEPLOY_DIR" && SKIP_VERSION_SYNC=1 ./release.sh "$VERSION" )

echo "==> Verifying release archive checksum"
( cd "$DEPLOY_DIR/releases" && sha256sum -c "rsp-dashboard-${VERSION}.tar.gz.sha256" )

cat <<EOF

Release ready. Ship these files:
    Deployment/releases/rsp-dashboard-${VERSION}.tar.gz
    Deployment/releases/rsp-dashboard-${VERSION}.tar.gz.sha256
EOF
