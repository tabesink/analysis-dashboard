#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3001}"
LAN_HOSTNAME="$(hostname | tr '[:upper:]' '[:lower:]')"

# Non-container LAN mode:
# - Backend uses development env so HTTP auth cookies can be set on LAN
# - Backend binds to all interfaces for remote access
export APP_ENV=development
export HOST=0.0.0.0
export DEBUG=false
export SETTINGS_YAML_PATH="${REPO_ROOT}/server/settings.yaml"
export ADMIN_SECRET="${ADMIN_SECRET:-dev-admin-password-change-me}"
export JWT_SECRET="${JWT_SECRET:-dev-jwt-secret-change-me}"
export CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:${FRONTEND_PORT},http://127.0.0.1:${FRONTEND_PORT},http://${LAN_HOSTNAME}:${FRONTEND_PORT}}"

if ss -ltn | awk '{print $4}' | grep -Eq "[:.]${BACKEND_PORT}$"; then
  echo "Backend port ${BACKEND_PORT} is already in use. Stop existing process first."
  exit 1
fi
if ss -ltn | awk '{print $4}' | grep -Eq "[:.]${FRONTEND_PORT}$"; then
  echo "Frontend port ${FRONTEND_PORT} is already in use. Stop existing process first."
  exit 1
fi

cleanup() {
  local exit_code=$?
  if [[ -n "${BACKEND_PID:-}" ]]; then
    kill "${BACKEND_PID}" >/dev/null 2>&1 || true
  fi
  if [[ -n "${FRONTEND_PID:-}" ]]; then
    kill "${FRONTEND_PID}" >/dev/null 2>&1 || true
  fi
  wait >/dev/null 2>&1 || true
  exit "${exit_code}"
}
trap cleanup EXIT INT TERM

cd "${REPO_ROOT}"
echo "Starting backend on 0.0.0.0:${BACKEND_PORT}..."
# Ensure uv resolves dependencies from server/pyproject.toml.
uv run --project "${REPO_ROOT}/server" python -m server &
BACKEND_PID=$!

echo "Building frontend for production..."
cd "${REPO_ROOT}/client"
# Ensure newly added dependencies are present before generate/build.
if ! npm ls --depth=0 js-yaml >/dev/null 2>&1; then
  echo "Installing frontend dependencies (missing js-yaml)..."
  npm install
fi
npm run build

echo "Starting frontend on 0.0.0.0:${FRONTEND_PORT}..."
npm run prepare:standalone
HOSTNAME=0.0.0.0 PORT="${FRONTEND_PORT}" node .next/standalone/server.js &
FRONTEND_PID=$!

echo "Backend PID: ${BACKEND_PID}"
echo "Frontend PID: ${FRONTEND_PID}"
echo "App URL: http://${LAN_HOSTNAME}:${FRONTEND_PORT}"

wait -n "${BACKEND_PID}" "${FRONTEND_PID}"
