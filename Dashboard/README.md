# RSP Data Analytics Dashboard

This README currently documents the release version script workflow.
We can extend this file later with setup, architecture, and deployment guides.

## Release Version Script

Use `scripts/release_version.sh` to manage version updates in one command.

### Prerequisites

- `python3`
- `npm`

### Commands

Run the full release version workflow:

```bash
./scripts/release_version.sh 1.2.3
```

What this does:

1. Bumps and syncs:
   - `VERSION`
   - `client/package.json` (`version`)
   - `server/pyproject.toml` (`[project].version`)
2. Regenerates client version artifact:
   - `client/src/config/version.ts`
3. Validates version sync across files.

Run sync validation only:

```bash
./scripts/release_version.sh --check
```

### Typical Release Flow

1. Update `CHANGELOG.md` under `## [Unreleased]`.
2. Run `./scripts/release_version.sh <new-version>`.
3. Smoke-check UI version label and `/api/v1/info`.
4. Move notes from `Unreleased` to a dated release section.
5. Tag release commit as `v<new-version>`.

## Next Sections (Placeholder)

- Local development setup
- Docker run instructions
- Testing commands
- Project structure overview
