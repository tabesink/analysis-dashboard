#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_PORT="${BACKEND_PORT:-8000}"

# Local-only development mode:
# - binds backend to localhost only
# - keeps development behavior for auth/debug workflows
export APP_ENV=development
export HOST=127.0.0.1
export DEBUG=true
export SETTINGS_YAML_PATH="${REPO_ROOT}/server/settings.yaml"

if ss -ltn | awk '{print $4}' | grep -Eq "[:.]${BACKEND_PORT}$"; then
  echo "Backend port ${BACKEND_PORT} is already in use. Stop existing process first."
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
echo "Starting backend on 127.0.0.1:${BACKEND_PORT}..."
# Ensure uv resolves dependencies from server/pyproject.toml.
uv run --project "${REPO_ROOT}/server" python -m server &
BACKEND_PID=$!

cd "${REPO_ROOT}/client"
echo "Starting frontend dev server on localhost only..."
npm run dev &
FRONTEND_PID=$!

echo "Backend PID: ${BACKEND_PID}"
echo "Frontend PID: ${FRONTEND_PID}"
echo "Local app URL: http://127.0.0.1:3001"

wait -n "${BACKEND_PID}" "${FRONTEND_PID}"
