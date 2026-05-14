# Release Versioning Workflow

This project uses a single product version and a single changelog.

## Source Of Truth

- Canonical version: `VERSION` (repo root)
- Canonical release notes: `CHANGELOG.md` (repo root)

Mirrored metadata fields are kept in sync with the canonical version:

- `client/package.json` -> `version`
- `server/pyproject.toml` -> `[project].version`

## Commands

Set a new release version and synchronize metadata:

```bash
python3 scripts/release_version.py 1.2.3
```

Regenerate frontend version artifact after bump:

```bash
npm --prefix client run generate:version
```

Verify no drift between canonical and mirrored versions:

```bash
python3 scripts/check_version_sync.py
```

## Release Checklist

1. Add user-facing changes under `## [Unreleased]` in `CHANGELOG.md`.
2. Pick the next SemVer and run `python3 scripts/release_version.py <version>`.
3. Run `npm --prefix client run generate:version`.
4. Run `python3 scripts/check_version_sync.py`.
5. Smoke check:
   - Frontend version label shows `client/server` in the header.
   - `GET /api/v1/info` returns the expected `server_version`.
6. Move changelog notes from `Unreleased` to `## [<version>] - YYYY-MM-DD`.
7. Create annotated git tag `v<version>` on the tested release commit.
