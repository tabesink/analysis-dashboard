---
name: unified-versioning-changelog
overview: Implement a single product-version workflow with one root changelog, and ensure the exact running client/server versions are consistently surfaced in the frontend.
todos:
  - id: add-release-sync-script
    content: Create a single command to bump VERSION and sync client/package.json + server/pyproject.toml.
    status: completed
  - id: fix-client-build-version-source
    content: Replace package.json.version usage in client/next.config.ts with root VERSION-derived value.
    status: completed
  - id: validate-runtime-version-display
    content: Verify frontend VersionLabel and /api/v1/info reflect synced runtime versions.
    status: completed
  - id: document-release-workflow
    content: Document the one-changelog, one-version release process and checks.
    status: completed
  - id: add-version-drift-ci-check
    content: Add a CI validation step that fails on version drift across canonical files.
    status: completed
isProject: false
---

# Unified Versioning And Changelog Plan

## Current Gaps To Fix

- Root `VERSION` is already treated as source-of-truth in runtime paths, but metadata files are out of sync (`client/package.json` differs from `VERSION`).
- Client build-time env in `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/next.config.ts](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/next.config.ts)` still reads `package.json.version`, which can drift from `VERSION`.
- Frontend currently shows `client/server` versions in `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/components/layout/VersionLabel.tsx](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/components/layout/VersionLabel.tsx)`, but release process is not enforcing synchronized bumps.

## Target Strategy (Single Product Version + Single Root Changelog)

- Keep one canonical version in `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/VERSION](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/VERSION)`.
- Keep one release log in `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/CHANGELOG.md](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/CHANGELOG.md)`.
- Treat `client/package.json` and `server/pyproject.toml` version fields as mirrored release metadata that must be auto-synced from `VERSION`.

```mermaid
flowchart LR
  bumpVersion["Update VERSION"] --> syncMeta["Sync package metadata"]
  syncMeta --> generateClient["Generate client version.ts"]
  generateClient --> buildArtifacts["Build client and server"]
  buildArtifacts --> runtimeExpose["Server /api/v1/info and frontend label"]
  runtimeExpose --> releaseLog["Move CHANGELOG Unreleased to tagged version"]
```



## Implementation Steps

1. Add a root release script (e.g., `scripts/release-version.*`) that takes a semver and atomically updates:
  - `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/VERSION](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/VERSION)`
  - `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/package.json](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/package.json)`
  - `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/pyproject.toml](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/pyproject.toml)`
2. Update client build config to consume root `VERSION` (or generated version artifact) instead of `package.json.version` in `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/next.config.ts](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/next.config.ts)`.
3. Keep runtime display path unchanged but validate it end-to-end:
  - Client: `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/config/version.ts](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/config/version.ts)`, `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/hooks/use-app-info.ts](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/hooks/use-app-info.ts)`
  - Server: `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/__init__.py](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/__init__.py)`, `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/routers/info.py](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/routers/info.py)`
4. Define a release checklist in docs (bump version, update changelog, regenerate artifacts, smoke check version label + `/api/v1/info`, tag release).
5. Add lightweight CI guard to fail if `VERSION`, `client/package.json`, and `server/pyproject.toml` versions diverge.

## Verification

- `VERSION`, `client/package.json`, and `server/pyproject.toml` report identical semver.
- Frontend header shows expected `clientVersion/serverVersion` after build.
- `/api/v1/info` returns the same server version as backend app metadata.
- `CHANGELOG.md` includes release entry for the new version.

