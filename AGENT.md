# AGENT.md - Release Pipeline Contract

This file covers **releasing and deploying** the RSP Dashboard only. For code style, security, multi-user, schema, and any other engineering concern, read [`Dashboard/AGENTS.md`](Dashboard/AGENTS.md).

If you have been asked to "cut release vX.Y.Z", "ship a new version", or "build a release bundle" - run the checklist in this file end-to-end and verify each phase before moving on.

## Repo at a glance (release-relevant only)

| Path | Role |
| --- | --- |
| `Dashboard/VERSION` | Single source of truth for the release version. |
| `Dashboard/CHANGELOG.md` | Keep-a-Changelog file. Has an `[Unreleased]` block at the top. |
| `Dashboard/scripts/release_version.sh` | Bumps `VERSION`, syncs `client/package.json` + `server/pyproject.toml`, regenerates `client/src/config/version.ts`, runs sync check. |
| `Dashboard/scripts/check_version_sync.py` | Verifies the three version files agree. |
| `Deployment/build.sh` | Preflight + builds `rsp-dashboard-{server,client}:<VERSION>` + packs `releases/rsp-dashboard-<VERSION>.tar.gz` (+ `.sha256`). |
| `Deployment/docker-compose.yml` | LAN production stack (server + client + jwt-init). |
| `Deployment/.env.example` | Template copied to `.env` on the prod host; only `ADMIN_SECRET` is required. |
| `Deployment/deploy.sh` / `deploy.ps1` | One-command prod-host deploy (Linux / Windows). |

## Release checklist (happy path)

Replace `1.2.0` with the actual SemVer for this release.

```bash
# Phase 1 - bump versions in lockstep
cd Dashboard
./scripts/release_version.sh 1.2.0
#   writes VERSION, client/package.json, server/pyproject.toml
#   regenerates client/src/config/version.ts
#   runs check_version_sync.py at the end

# Phase 2 - changelog (manual edit; no script)
#   In Dashboard/CHANGELOG.md:
#     - Move entries from [Unreleased] into a new section:
#         ## [1.2.0] - YYYY-MM-DD
#     - Leave [Unreleased] at the top, empty.

# Phase 3 - build release bundle (dev/build host)
cd ../Deployment
./build.sh
#   preflight: VERSION semver, schema.yaml parse, CHANGELOG mention
#   produces releases/rsp-dashboard-1.2.0.tar.gz (+ .sha256)

# Phase 4 - ship + deploy (prod host)
scp releases/rsp-dashboard-1.2.0.tar.gz{,.sha256} prod-host:/tmp/
ssh prod-host
cd /tmp && sha256sum -c rsp-dashboard-1.2.0.tar.gz.sha256
sudo tar xzf rsp-dashboard-1.2.0.tar.gz -C /opt
cd /opt/rsp-dashboard-1.2.0
cp .env.example .env && nano .env       # set ADMIN_SECRET
chmod 600 .env
sudo ./deploy.sh
#   On Windows / Docker Desktop: .\deploy.ps1
```

## Per-phase verification

Do not advance until the previous phase passes its check.

| Phase | Verify |
| --- | --- |
| 1 | `cat Dashboard/VERSION` matches the SemVer you passed; `python3 Dashboard/scripts/check_version_sync.py` exits 0. |
| 2 | `grep -F "1.2.0" Dashboard/CHANGELOG.md` returns a line; `[Unreleased]` block still exists and is empty. |
| 3 | `ls Deployment/releases/rsp-dashboard-1.2.0.tar.gz` exists; `sha256sum -c Deployment/releases/rsp-dashboard-1.2.0.tar.gz.sha256` passes. |
| 4 | `deploy.{sh,ps1}` exits 0 (it polls `/health/ready` itself); `curl http://<host>:8000/health/ready` returns HTTP 200; UI loads at `http://<host>:3000`. |

## Failure modes

Mapped to the actual error strings the pipeline emits.

| Symptom | Cause | Fix |
| --- | --- | --- |
| `error: VERSION='X' is not semver` | `Dashboard/VERSION` not `MAJOR.MINOR.PATCH` | Re-run `./scripts/release_version.sh <semver>` with a valid SemVer. |
| `error: server/schema.yaml failed to parse` | Invalid YAML | Validate locally: `python3 -c "import yaml; yaml.safe_load(open('Dashboard/server/schema.yaml'))"`. Fix and retry. |
| `warning: CHANGELOG.md does not mention v<x>` | Phase 2 was skipped | Non-fatal but means the release is undocumented. Go back, add the section, rebuild. |
| `Version drift detected:` from `check_version_sync.py` | Hand-edited `package.json` or `pyproject.toml` | Re-run `Dashboard/scripts/release_version.sh <semver>` instead of editing by hand. |
| `error: ADMIN_SECRET in .env is still 'changeme'` | Phase 4 `.env` edit was skipped | Edit `.env`, set a real password, `chmod 600 .env`, re-run `./deploy.sh`. |
| `error: ADMIN_SECRET must be set in .env` from compose | `.env` missing or `ADMIN_SECRET` empty | `cp .env.example .env`, edit, retry. |
| Server fails with `auth_cookie_secure must be true` | `ALLOW_INSECURE_COOKIES` not propagated | Confirm the bundled `docker-compose.yml` still sets `ALLOW_INSECURE_COOKIES=true` for the server. |
| Image runs old code after `deploy.sh` | An older `IMAGE_TAG` is set in `.env` | Either remove `IMAGE_TAG` from `.env` (the bundle's compose pins to the bundle's VERSION by default) or set `IMAGE_TAG=<new VERSION>`. |
| `npm run build` fails on missing `VERSION` or `schema.yaml` inside Docker | Client build context regressed off `Dashboard/` | Confirm `Deployment/build.sh` builds the client image with `"$DASHBOARD_DIR"` as context, not `"$DASHBOARD_DIR/client"`. |

## Hard rules

- **Always** bump versions via `Dashboard/scripts/release_version.sh`. It is the only thing that keeps `VERSION`, `client/package.json`, and `server/pyproject.toml` aligned.
- **Never** hand-edit `Dashboard/client/src/config/version.ts`, `filters.ts`, or `settings.ts`. They are regenerated on every Docker build by `Dashboard/client/scripts/generate-*.js`.
- **Never** delete `Dashboard/VERSION` or `Dashboard/server/schema.yaml`. The build's `preflight()` will hard-fail.
- **Never** run `Deployment/build.sh` from outside the `Deployment/` directory. Its paths are relative.
- **Never** commit `Deployment/.env`. It contains `ADMIN_SECRET`. The folder's `.gitignore` already excludes it; keep it that way.
- **Never** expose this stack to the public internet. It serves plain HTTP and runs with `ALLOW_INSECURE_COOKIES=true`. For internet-facing deployments, terminate TLS in a reverse proxy and revert that flag.

## Out of scope here

Anything that is not "bump version, update changelog, build, ship, deploy" lives in [`Dashboard/AGENTS.md`](Dashboard/AGENTS.md). Do not duplicate that content in this file.
