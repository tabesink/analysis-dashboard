#!/usr/bin/env bash
# RSP Dashboard - LAN release bundle builder.
#
# Run from the Deployment/ directory:
#     ./build.sh
#
# Output (versioned by Dashboard/VERSION):
#     releases/rsp-dashboard-<VERSION>/
#         images.tar           combined `docker save` of server + client
#         docker-compose.yml
#         nginx.conf
#         .env.example
#         deploy.sh
#         deploy.ps1
#         README.md
#         RELEASE_NOTES.md    current version section from Dashboard/CHANGELOG.md
#         VERSION
#         CHECKSUMS.sha256     per-file SHA-256 of the bundle contents
#     releases/rsp-dashboard-<VERSION>.tar.gz
#     releases/rsp-dashboard-<VERSION>.tar.gz.sha256
#
# Ship the .tar.gz + .sha256 to the prod host. See README.md.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$SCRIPT_DIR"
REPO_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"
DASHBOARD_DIR="$REPO_DIR/Dashboard"

cd "$DEPLOY_DIR"

# ---------------------------------------------------------------------------
# preflight - fail fast on the things that have historically broken builds.
# ---------------------------------------------------------------------------
preflight() {
    if [[ ! -f "$DASHBOARD_DIR/VERSION" ]]; then
        echo "error: $DASHBOARD_DIR/VERSION not found" >&2
        exit 1
    fi
    local version
    version="$(tr -d '[:space:]' < "$DASHBOARD_DIR/VERSION")"
    if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]]; then
        echo "error: VERSION='$version' is not a deployable SemVer tag" >&2
        echo "       Use MAJOR.MINOR.PATCH or MAJOR.MINOR.PATCH-prerelease." >&2
        echo "       Build metadata with '+' is not supported in Docker image tags." >&2
        exit 1
    fi

    if [[ ! -f "$DASHBOARD_DIR/server/schema.yaml" ]]; then
        echo "error: $DASHBOARD_DIR/server/schema.yaml not found" >&2
        exit 1
    fi
    if ! python3 -c "import yaml,sys; yaml.safe_load(open(sys.argv[1]))" \
            "$DASHBOARD_DIR/server/schema.yaml" >/dev/null 2>&1; then
        echo "error: $DASHBOARD_DIR/server/schema.yaml failed to parse as YAML" >&2
        exit 1
    fi

    if [[ ! -f "$DASHBOARD_DIR/CHANGELOG.md" ]]; then
        echo "error: $DASHBOARD_DIR/CHANGELOG.md not found" >&2
        exit 1
    fi
    python3 "$DEPLOY_DIR/scripts/extract_release_notes.py" \
        --changelog "$DASHBOARD_DIR/CHANGELOG.md" \
        --version "$version" \
        >/dev/null

    command -v docker >/dev/null 2>&1 \
        || { echo "error: docker not found in PATH" >&2; exit 1; }

    VERSION="$version"
}

preflight

OUT="releases/rsp-dashboard-${VERSION}"
echo "==> Building RSP Dashboard LAN bundle v${VERSION}"
rm -rf "$OUT"
mkdir -p "$OUT"

# ---------------------------------------------------------------------------
# Build images. NEXT_PUBLIC_API_URL is intentionally NOT passed - the client
# resolves the API base from window.location at runtime, so a single image
# works on any LAN host.
# ---------------------------------------------------------------------------
echo "==> Building server image (rsp-dashboard-server:${VERSION})"
docker build \
    -t "rsp-dashboard-server:${VERSION}" \
    -f "$DASHBOARD_DIR/server/Dockerfile" \
    "$DASHBOARD_DIR"

echo "==> Building client image (rsp-dashboard-client:${VERSION})"
docker build \
    -t "rsp-dashboard-client:${VERSION}" \
    --build-arg NEXT_PUBLIC_API_MODE=same-origin \
    -f "$DASHBOARD_DIR/client/Dockerfile" \
    "$DASHBOARD_DIR"

# ---------------------------------------------------------------------------
# Combined image tarball (single file, easy to ship).
# ---------------------------------------------------------------------------
echo "==> Saving combined images tarball"
docker save \
    "rsp-dashboard-server:${VERSION}" \
    "rsp-dashboard-client:${VERSION}" \
    -o "$OUT/images.tar"

# ---------------------------------------------------------------------------
# Bundle the operator-facing files.
# Update the compose file's IMAGE_TAG default to match this VERSION so
# operators don't need to set IMAGE_TAG in .env unless they want to override.
# ---------------------------------------------------------------------------
echo "==> Bundling compose, proxy config, env example, deploy scripts, README"
sed -E "s|\\\$\\{IMAGE_TAG:-[0-9]+\\.[0-9]+\\.[0-9]+(-[0-9A-Za-z.-]+)?\\}|\\\${IMAGE_TAG:-${VERSION}}|g" \
    docker-compose.yml > "$OUT/docker-compose.yml"
cp nginx.conf "$OUT/nginx.conf"
cp .env.example "$OUT/.env.example"
cp scripts/deploy.sh    "$OUT/deploy.sh"
cp scripts/deploy.ps1   "$OUT/deploy.ps1"
cp README.md    "$OUT/README.md"
chmod +x "$OUT/deploy.sh"
echo "$VERSION" > "$OUT/VERSION"
python3 "$DEPLOY_DIR/scripts/extract_release_notes.py" \
    --changelog "$DASHBOARD_DIR/CHANGELOG.md" \
    --version "$VERSION" \
    --output "$OUT/RELEASE_NOTES.md"

# ---------------------------------------------------------------------------
# Per-file checksums (so the deploy script could verify on the prod host).
# ---------------------------------------------------------------------------
echo "==> Computing CHECKSUMS.sha256"
( cd "$OUT" && \
    find . -type f ! -name CHECKSUMS.sha256 -print0 \
    | LC_ALL=C sort -z \
    | xargs -0 sha256sum > CHECKSUMS.sha256 )

# ---------------------------------------------------------------------------
# Pack and checksum the outer tarball.
# ---------------------------------------------------------------------------
echo "==> Packaging tarball"
tar czf "releases/rsp-dashboard-${VERSION}.tar.gz" -C releases "rsp-dashboard-${VERSION}"
( cd releases && sha256sum "rsp-dashboard-${VERSION}.tar.gz" > "rsp-dashboard-${VERSION}.tar.gz.sha256" )

cat <<EOF

Bundle ready:
    $OUT/
    releases/rsp-dashboard-${VERSION}.tar.gz
    releases/rsp-dashboard-${VERSION}.tar.gz.sha256

Ship to the prod host:
    scp releases/rsp-dashboard-${VERSION}.tar.gz{,.sha256} prod-host:/tmp/

On the prod host:
    sha256sum -c /tmp/rsp-dashboard-${VERSION}.tar.gz.sha256
    sudo tar xzf /tmp/rsp-dashboard-${VERSION}.tar.gz -C /opt
    cd /opt/rsp-dashboard-${VERSION}
    cp .env.example .env && nano .env       # set ADMIN_SECRET
    chmod 600 .env
    sudo ./deploy.sh
EOF
