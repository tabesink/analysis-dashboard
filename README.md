# Release pipeline (releaser)

**Releaser (this doc):** Linux, repo clone, Docker + Compose v2, `python3` (PyYAML for builds/preflight) — you run `release.sh` and hand off artifacts.

**Operator:** Only needs the `.tar.gz` + `.sha256`; no clone, no Node/Python. See [Deployment/README.md](Deployment/README.md).

**More detail:** [AGENT.md](AGENT.md) (agents, failure modes) · [Deployment/README.md](Deployment/README.md) (deploy/operator).

---

## Prerequisites

- `docker compose version` works.
- `python3` (+ PyYAML — see deploy README).
- Version format: `MAJOR.MINOR.PATCH` or `MAJOR.MINOR.PATCH-prerelease` (e.g. `1.2.3`, `1.2.0-beta.1`).
- Do **not** use `+build…` in the version — Docker tags cannot contain `+` (see root `release.sh`).

---

## Before you cut a release

1. Edit [Dashboard/CHANGELOG.md](Dashboard/CHANGELOG.md): under `## [Unreleased]`, add user-facing bullets (Keep a Changelog style: Added / Changed / Fixed / Security). Drop empty sections.
2. `[Unreleased]` must not be empty, or the flow can fail (see [AGENT.md](AGENT.md)).

---

## Cut the release

From **repository root**:

```bash
./release.sh <VERSION>
# e.g. ./release.sh 1.2.4
```

**Order of work:**

1. `Deployment/scripts/promote_unreleased.sh` — moves `[Unreleased]` into `## [<VERSION>] - YYYY-MM-DD` in the changelog.
2. `Dashboard/scripts/release_version.sh` — updates `Dashboard/VERSION`, syncs `client/package.json` and `server/pyproject.toml`, regenerates client version bits, runs `scripts/check_version_sync.py`.
3. `Deployment/release.sh` — validates release notes (`extract_release_notes.py`), runs `Deployment/build.sh` (images + bundle).
4. `sha256sum -c` — checks the new archive against its `.sha256`.

---

## Artifacts to hand off

On success:

- `Deployment/releases/rsp-dashboard-<VERSION>.tar.gz`
- `Deployment/releases/rsp-dashboard-<VERSION>.tar.gz.sha256`

Copy those to USB, a share, or the target host.

---

## After the build (you do this)

Scripts do **not** commit or tag.

1. Review the diff (changelog, `VERSION`, synced metadata, any generated client files).
2. Commit when ready (your team’s process).
3. Smoke test per [Dashboard/docs/release-versioning.md](Dashboard/docs/release-versioning.md) (e.g. UI version label, `GET /api/v1/info` `server_version`).
4. Tag the shipped commit: annotated `v<version>` (e.g. `v1.2.4`).

---

## Rebuild only (no version/changelog bump)

If `Dashboard/VERSION` and changelog already match the release you want:

```bash
cd Deployment
./build.sh
```

For normal releases, prefer `./release.sh <VERSION>` so changelog, version files, bundle, and checksum stay aligned.

---

## Failures

See the **Failure modes** table in [AGENT.md](AGENT.md): empty `[Unreleased]`, bad/missing release notes, version drift, `server/schema.yaml` parse errors, etc.

Typical fixes: add changelog bullets; if metadata drifted, run `Dashboard/scripts/release_version.sh <semver>`; fix `server/schema.yaml` if validation complains.

---

## Checklist

1. Fill `Dashboard/CHANGELOG.md` `[Unreleased]`.
2. From repo root: `./release.sh <VERSION>`.
3. Ship the two files under `Deployment/releases/`.
4. Commit, smoke test, tag `v<VERSION>` when satisfied.
