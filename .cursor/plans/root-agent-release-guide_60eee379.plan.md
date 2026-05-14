---
name: root-agent-release-guide
overview: "Create AGENT.md at the workspace root that gives an agent (human or AI) a tight, copy-pasteable contract for cutting and shipping a release: bump version, update changelog, build, ship, deploy. All other repo concerns are deferred to Dashboard/AGENTS.md."
todos:
  - id: write-agent-md
    content: Write AGENT.md at workspace root with header, repo-at-a-glance, 4-phase release checklist, per-phase verifications, failure-mode table, hard rules, and pointer to Dashboard/AGENTS.md
    status: completed
isProject: false
---

## Goal

Replace the empty [AGENT.md](AGENT.md) at the workspace root with a release-pipeline-only guide. Optimized for an agent that has been told "cut release vX.Y.Z" and needs to do it correctly first try.

## File to create

`AGENT.md` at the workspace root (same directory as `Dashboard/` and `Deployment/`). Singular `AGENT.md` is preserved per the existing empty file.

## Structure

1. **Header / scope statement** — one sentence: this file covers releases only; everything else lives in [Dashboard/AGENTS.md](Dashboard/AGENTS.md).
2. **Repo-at-a-glance table** — the only files/dirs an agent doing a release will touch:
  - `Dashboard/VERSION` — single source of truth for the release version.
  - `Dashboard/CHANGELOG.md` — Keep-a-Changelog file with `[Unreleased]` block.
  - `Dashboard/scripts/release_version.sh` — bumps VERSION, syncs `client/package.json` and `server/pyproject.toml`, regenerates `client/src/config/version.ts`.
  - `Deployment/scripts/build.sh` — preflight + builds both images tagged `:VERSION` + packs `releases/rsp-dashboard-<VERSION>.tar.gz`.
  - `Deployment/.env.prod.example` -> `compose/.env.prod` on prod host (set `IMAGE_TAG=<VERSION>`).
3. **Release checklist (copy-paste, happy path)** — four phases, every command verified against the actual scripts:
  ```bash
   # Phase 1 - bump versions in lockstep
   cd Dashboard
   ./scripts/release_version.sh 1.2.0          # writes VERSION, package.json, pyproject.toml; regenerates client version.ts; runs sync check

   # Phase 2 - changelog (manual edit)
   #   In Dashboard/CHANGELOG.md, move entries from [Unreleased] into a new
   #   "## [1.2.0] - YYYY-MM-DD" section. Keep [Unreleased] at the top, empty.

   # Phase 3 - build release bundle (dev/build host)
   cd ../Deployment
   DASHBOARD_HOSTNAME=dashboard.lan ./scripts/build.sh
   #   produces releases/rsp-dashboard-1.2.0.tar.gz (+ .sha256)

   # Phase 4 - ship + deploy (prod host)
   scp Deployment/releases/rsp-dashboard-1.2.0.tar.gz{,.sha256} prod-host:/tmp/
   ssh prod-host
   sudo mkdir -p /opt
   cd /tmp && sha256sum -c rsp-dashboard-1.2.0.tar.gz.sha256
   sudo tar xzf rsp-dashboard-1.2.0.tar.gz -C /opt
   cd /opt/rsp-dashboard-1.2.0 && sudo ./scripts/bootstrap.sh
   #   then edit compose/.env.prod: IMAGE_TAG=1.2.0  DASHBOARD_HOSTNAME=<your-host>
   sudo ./scripts/up.sh
   sudo ./scripts/logs.sh server
  ```
4. **Verifications after each phase** (so an agent loops on success criteria, not vibes):
  - After Phase 1: `cat Dashboard/VERSION` matches CLI arg; `python3 Dashboard/scripts/check_version_sync.py` passes.
  - After Phase 2: `grep -F "1.2.0" Dashboard/CHANGELOG.md` returns a line.
  - After Phase 3: `ls Deployment/releases/rsp-dashboard-1.2.0.tar.gz` exists; `sha256sum -c Deployment/releases/rsp-dashboard-1.2.0.tar.gz.sha256` passes.
  - After Phase 4: `curl -k https://<DASHBOARD_HOSTNAME>/api/health/ready` returns 200.
5. **Failure modes** (compact table, mapped to the actual error strings the user will see):
  - `error: VERSION='X' is not semver` -> use MAJOR.MINOR.PATCH.
  - `error: server/schema.yaml failed to parse` -> validate YAML; this comes from `preflight()` in `build.sh`.
  - `warning: CHANGELOG.md does not mention v<x>` -> non-fatal but means Phase 2 was skipped; go back and add the section.
  - `Version drift detected:` (from `check_version_sync.py`) -> rerun `./scripts/release_version.sh <semver>` instead of hand-editing.
  - Image runs old code after deploy -> `IMAGE_TAG` in `compose/.env.prod` is still old; update and `./scripts/up.sh` again.
6. **Hard rules (do / don't)**:
  - Always bump versions via `Dashboard/scripts/release_version.sh` -- it's the only way all three version files stay aligned.
  - Never hand-edit `Dashboard/client/src/config/{version,filters,settings}.ts` -- they are regenerated on every build by `Dashboard/client/scripts/generate-*.js`.
  - Never delete `Dashboard/VERSION` or `Dashboard/server/schema.yaml` -- preflight will hard-fail.
  - Never set `IMAGE_TAG=latest` in production `.env.prod`.
  - Never run `Deployment/scripts/build.sh` from outside `Deployment/` (paths are relative).
7. **For everything else (code style, security, multi-user, schema changes)** -> single pointer to [Dashboard/AGENTS.md](Dashboard/AGENTS.md). Do not duplicate.

## What this is NOT

- Not a tutorial. Not background. No "why we chose Docker." Just the contract.
- Not a duplication of `Deployment/README.md` (which is human-facing and slightly chattier). This is the agent-facing condensate.
- No emojis, no horizontal rules between every section -- keep it skimmable.

## Acceptance check

After writing, an agent told "cut and ship release 1.2.0" should be able to read AGENT.md once and execute all four phases without consulting another doc.