---
name: deployment-hardening-plan
overview: Plan a lightweight production-hardening pass for the local-network dashboard using env-primary deploy configuration, existing YAML defaults, explicit version/status visibility, and a junior-friendly deployment workflow.
todos:
  - id: config-contract
    content: Define env-primary configuration contract and example env files.
    status: completed
  - id: deployment-assets
    content: Plan deployment folder, Compose file, and future deploy.sh behavior.
    status: completed
  - id: version-status
    content: Expose app/runtime/database schema status through backend and subtle frontend UI.
    status: completed
  - id: docs-tracking
    content: Update README, deployment docs, master plan, decision log, and task notes.
    status: completed
  - id: verification
    content: Verify config, status endpoint, version sync, LAN startup, and Compose smoke path.
    status: completed
isProject: false
---

> Superseded: this is historical planning context only. Current release and
> deployment guidance lives in the repo root `AGENT.md` and `Deployment/README.md`;
> `Dashboard/deployment/` has been retired.

# Deployment Hardening Plan

## Current Architecture Summary

- The app is a two-process local-network dashboard: FastAPI backend + DuckDB database, and Next.js standalone frontend.
- Backend runtime starts from [`server/main.py`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/main.py), loads settings through [`server/config.py`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/config.py), and opens the single DuckDB file at `settings.database_path`.
- Frontend API calls resolve through [`client/src/lib/api/client.ts`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/lib/api/client.ts): explicit `NEXT_PUBLIC_API_URL` wins, otherwise browser hostname + API port is used.
- App version already has a root source of truth in [`VERSION`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/VERSION), with sync tooling in [`scripts/release_version.sh`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/scripts/release_version.sh).
- DB schema version already exists through [`server/schema.yaml`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/schema.yaml), [`server/storage/schema_loader.py`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/storage/schema_loader.py), and [`server/storage/migrations.py`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/storage/migrations.py).

## Current Configuration Map

- Existing backend config is YAML + environment override in [`server/config.py`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/config.py).
- Local/LAN scripts live in [`scripts/start-local-dev.sh`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/scripts/start-local-dev.sh) and [`scripts/start-server-lan.sh`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/scripts/start-server-lan.sh).
- Docker image config exists in [`client/Dockerfile`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/Dockerfile), [`server/Dockerfile`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/Dockerfile), and [`server/settings.docker.yaml`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/settings.docker.yaml).
- Docs currently drift: [`docs/master-build-plan.md`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/docs/master-build-plan.md) references Compose work, but no `docker-compose*.yml` exists in the repo.
- Hardcoded/friction points to address: client Docker default `NEXT_PUBLIC_API_URL=http://localhost:8000`, committed sample secrets in [`server/settings.yaml`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/settings.yaml), LAN hostnames in CORS, and inconsistent frontend ports between Docker and scripts.

## Recommended Configuration Strategy

Use env-primary configuration with YAML as readable defaults/templates.

- Add root [`/.env.example`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/.env.example) for development/LAN defaults.
- Add [`deployment/.env.production.example`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/deployment/.env.production.example) for production deployment values.
- Keep YAML for structured non-secret defaults already used by the app, but stop treating committed YAML as the place to put real deploy secrets.
- Keep `APP_ENV`, `JWT_SECRET`, `CORS_ORIGINS`, `ALLOW_INSECURE_COOKIES`, `DATA_ROOT`, `LOG_DIR`, `HOST`, and `PORT` as the deploy-facing knobs.
- Prefer the current LAN HTTP two-port model as the first implemented production path: frontend + backend on separate ports, explicit CORS, trusted-LAN insecure-cookie opt-in.
- Document reverse proxy / single-origin deployment as a later optional hardening path, not the first slice.

## Versioning Strategy

- Keep root [`VERSION`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/VERSION) as the app version source of truth.
- Keep [`scripts/release_version.sh`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/scripts/release_version.sh) as the version bump workflow.
- Extend [`server/routers/info.py`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/routers/info.py) or add a sibling status endpoint so the backend returns app version, API version, current DB schema version, target schema version, runtime mode, and readiness basics.
- Extend [`client/src/hooks/use-app-info.ts`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/hooks/use-app-info.ts) and [`client/src/components/layout/VersionLabel.tsx`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/components/layout/VersionLabel.tsx) only enough to show app/server/schema status subtly.

## Deployment Folder Design

Create a small [`deployment/`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/deployment) folder:

- `deployment/.env.production.example`: documented production variables.
- `deployment/docker-compose.yml`: server + client services, data/log volumes, health checks, explicit env variables.
- `deployment/deploy.sh`: future one-shot operator script.
- `deployment/README.md`: junior-friendly setup, LAN HTTP warning, CORS examples, backup/restore notes, rollback notes.

The future `deploy.sh` should:

- Detect whether desired frontend/backend ports are free.
- Suggest available alternatives if ports are occupied.
- Print the derived URLs, CORS origins, database path/volume, and cookie mode.
- Ask for confirmation before building/running containers.
- Refuse to continue if required secrets like `JWT_SECRET` are missing or placeholder values.

## Step-By-Step Implementation Plan

1. Inventory and clean configuration contracts.
   - Verify current env override behavior in [`server/config.py`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/config.py).
   - Add examples for root dev/LAN and deployment production env files.
   - Remove real-looking secrets from committed templates where possible.

2. Add deployment assets.
   - Add `deployment/docker-compose.yml` using the existing Dockerfiles.
   - Make server service inject `JWT_SECRET`, `CORS_ORIGINS`, `APP_ENV=production`, data/log paths, and optional `ALLOW_INSECURE_COOKIES=true` for LAN HTTP.
   - Make client service avoid baking `localhost` as the remote API URL unless explicitly requested.

3. Add system/version visibility.
   - Extend backend info/status response with DB schema version and runtime mode.
   - Update frontend types/hook and show this subtly where version is already displayed.

4. Document the operator workflow.
   - Expand [`README.md`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/README.md) with dev, LAN, and production quickstarts.
   - Add detailed deployment docs under `deployment/README.md`.
   - Document the future one-shot `deploy.sh` contract, including port probing and confirmation behavior.

5. Update project tracking docs.
   - Mark the chosen deployment-hardening task in [`docs/master-build-plan.md`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/docs/master-build-plan.md).
   - Add implementation notes under [`docs/tasks/`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/docs/tasks).
   - Append a decision entry to [`docs/decisions/log.md`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/docs/decisions/log.md) for env-primary + LAN HTTP primary deployment.

## Testing Plan

- Run backend tests that cover config loading, production validation, `/health`, `/health/ready`, and `/api/v1/info` or the new status endpoint.
- Run frontend tests/types for updated info response handling.
- Run `scripts/release_version.sh --check` to verify version sync remains intact.
- Smoke test local LAN startup with [`scripts/start-server-lan.sh`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/scripts/start-server-lan.sh).
- Smoke test Compose startup from `deployment/` with a copied production env file.

## Rollback Plan

- Deployment additions are isolated under `deployment/` plus docs and small info/config changes.
- If Compose or deployment docs cause trouble, revert `deployment/` without affecting current LAN scripts.
- If status endpoint changes cause UI/API issues, keep existing `/api/v1/info` response backward-compatible or introduce a new endpoint instead of breaking current clients.

## Junior Developer Notes

- `.env` files answer: “What values change per machine?”
- YAML files answer: “What are the app’s readable defaults?”
- `VERSION` answers: “What app release is this?”
- `server/schema.yaml` answers: “What database schema version does this code expect?”
- CORS must list the frontend URL that the browser actually uses.
- For LAN HTTP, `ALLOW_INSECURE_COOKIES=true` is acceptable only on the trusted internal network; HTTPS/reverse proxy should become the safer path later.