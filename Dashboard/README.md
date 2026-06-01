# RSP Data Analytics Dashboard

Lightweight FastAPI + DuckDB + Next.js dashboard for local-network RSP data analysis.

## Local Development

```bash
cp .env.example .env
./scripts/start-local-dev.sh
```

Local development binds the backend to `127.0.0.1:8000` and starts the Next.js dev
server on `127.0.0.1:3001` (falling back to `3002` if needed).

## LAN Smoke Run

```bash
./scripts/start-server-lan.sh
```

Windows (PowerShell):

```powershell
.\scripts\start-server-lan.ps1
```

This non-container script builds the frontend, starts the backend on
`0.0.0.0:8000`, and derives CORS origins for `localhost`, `127.0.0.1`, and the
current machine hostname. Use this for quick internal testing, not as the
documented production deployment.

## Production Deployment

The primary low-friction LAN production path is the release bundle workflow in
the repo-level `Deployment/` folder. It builds versioned Docker images on the
dev/build host, packages them into a tarball, and deploys them behind one
plain-HTTP LAN proxy port on the target host.

```bash
cd ../Deployment
./release.sh 1.2.3
```

The bundle includes `RELEASE_NOTES.md` extracted from this file's sibling
`CHANGELOG.md`. On the deployment host, copy `.env.example` to `.env`, set
`ADMIN_SECRET`, then run `deploy.sh` or `deploy.ps1`.

For the trusted-LAN HTTP deployment, `ALLOW_INSECURE_COOKIES=true` is expected.
If this app becomes internet reachable or sits behind HTTPS, disable that opt-in
and use secure cookies with a single-origin reverse proxy.

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
