#!/usr/bin/env bash
# RSP Dashboard - one-command LAN deploy.
#
# Usage (from this folder, on the prod host):
#     cp .env.example .env && nano .env       # set ADMIN_SECRET
#     ./deploy.sh
#
# What it does:
#   1. Validates .env exists and ADMIN_SECRET is not the placeholder.
#   2. If images.tar is present (build bundle), `docker load` it.
#   3. `docker compose --env-file .env up -d` (jwt-init runs once, then server, then client).
#   4. Waits up to 60 s for http://localhost:<SERVER_PORT>/health/ready to return 200.
#
# Requires: docker (with the compose v2 plugin), curl. That's it.

set -euo pipefail

cd "$(dirname "$(readlink -f "$0")")"

require() {
    command -v "$1" >/dev/null 2>&1 \
        || { echo "error: required command '$1' not found in PATH" >&2; exit 1; }
}
require docker
require curl
docker compose version >/dev/null 2>&1 \
    || { echo "error: 'docker compose' (v2) plugin not available" >&2; exit 1; }

# --- 1. Validate .env -------------------------------------------------------
if [[ ! -f .env ]]; then
    echo "error: .env not found." >&2
    echo "       cp .env.example .env  &&  edit .env to set ADMIN_SECRET" >&2
    exit 1
fi
if grep -qE '^ADMIN_SECRET=changeme[[:space:]]*$' .env; then
    echo "error: ADMIN_SECRET in .env is still 'changeme'. Set a real password." >&2
    exit 1
fi
if ! grep -qE '^ADMIN_SECRET=.+' .env; then
    echo "error: ADMIN_SECRET is missing or empty in .env." >&2
    exit 1
fi

# --- 2. Load images if a build bundle is present ----------------------------
if [[ -f images.tar ]]; then
    echo "==> Loading images from images.tar"
    docker load -i images.tar
else
    echo "==> No images.tar found; assuming images are already loaded in Docker"
fi

# --- 3. Bring stack up ------------------------------------------------------
echo "==> Validating compose config"
docker compose --env-file .env -f docker-compose.yml config >/dev/null

echo "==> Starting stack"
docker compose --env-file .env -f docker-compose.yml up -d
docker compose --env-file .env -f docker-compose.yml ps

# --- 4. Health check --------------------------------------------------------
SERVER_PORT="$(grep -E '^SERVER_PORT=' .env | tail -1 | cut -d= -f2- | tr -d '[:space:]' || true)"
SERVER_PORT="${SERVER_PORT:-8000}"
CLIENT_PORT="$(grep -E '^CLIENT_PORT=' .env | tail -1 | cut -d= -f2- | tr -d '[:space:]' || true)"
CLIENT_PORT="${CLIENT_PORT:-3000}"
URL="http://localhost:${SERVER_PORT}/health/ready"

echo "==> Waiting up to 60 s for ${URL}"
for _ in $(seq 1 30); do
    code="$(curl -s -o /dev/null -w '%{http_code}' "$URL" || true)"
    if [[ "$code" == "200" ]]; then
        host="$(hostname -f 2>/dev/null || hostname)"
        echo "    OK"
        echo
        echo "Dashboard is up:"
        echo "    UI:  http://${host}:${CLIENT_PORT}"
        echo "    API: http://${host}:${SERVER_PORT}"
        echo
        echo "Day-2:"
        echo "    docker compose --env-file .env -f docker-compose.yml logs -f server"
        echo "    docker compose --env-file .env -f docker-compose.yml down"
        exit 0
    fi
    sleep 2
done

echo "warning: server did not become ready within 60 s. Investigate:" >&2
echo "    docker compose --env-file .env -f docker-compose.yml logs server" >&2
exit 1
