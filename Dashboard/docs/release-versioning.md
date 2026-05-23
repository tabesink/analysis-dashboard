# Release Versioning Workflow

This project uses a single product version and a single changelog.

## Source Of Truth

- Canonical version: `VERSION` (repo root)
- Canonical release notes: `CHANGELOG.md` (repo root)

Mirrored metadata fields are kept in sync with the canonical version:

- `client/package.json` -> `version`
- `server/pyproject.toml` -> `[project].version`

## Commands

For a full LAN release from the repository root:

```bash
./release.sh 1.2.3
```

That promotes `CHANGELOG.md` `[Unreleased]` notes, synchronizes metadata,
builds the deployment bundle, and verifies the generated checksum.

To only set a new Dashboard version and synchronize metadata:

```bash
./scripts/release_version.sh 1.2.3
```

Lower-level version commands remain available for troubleshooting:

```bash
python3 scripts/release_version.py 1.2.3
npm --prefix client run generate:version
python3 scripts/check_version_sync.py
```

## Release Checklist

1. Add user-facing changes under `## [Unreleased]` in `CHANGELOG.md`.
2. Pick the next SemVer and run root `./release.sh <version>`.
3. Confirm the command prints the two `Deployment/releases/` handoff files.
4. Smoke check:
   - Frontend version label shows `client/server` in the header.
   - `GET /api/v1/info` returns the expected `server_version`.
5. Create annotated git tag `v<version>` on the tested release commit.
