# Deployment and Scaling

**Last updated:** 2026-05-21  
**App version:** 1.3.7

## Production deployment path

The supported production path is the **repo-level release bundle** in `Deployment/`:

1. On a build host: `cd Deployment && ./release.sh <version>`
2. Copy `rsp-dashboard-<version>.tar.gz` (+ `.sha256`) to the target server
3. Extract, copy `.env.example` → `.env`, set `ADMIN_SECRET`
4. Run `deploy.sh` or `deploy.ps1`

The bundle includes versioned Docker images, checksums, generated `RELEASE_NOTES.md`, and a single-origin LAN HTTP proxy (default port 3000). See [Deployment/README.md](../../../Deployment/README.md) for operator steps.

### Trusted LAN HTTP

For internal networks without TLS termination:

- Set `ALLOW_INSECURE_COOKIES=true` in deployment env
- Restrict CORS origins to known LAN hostnames/IPs
- Do **not** expose the service directly to the public internet without HTTPS and secure cookies

When the app sits behind HTTPS or a same-origin reverse proxy, disable insecure cookies and set `auth_cookie_secure: true`.

### Resource expectations for large imports

| Concern | Default / guidance |
|---------|-------------------|
| Server container RAM | 12 GiB `mem_limit` |
| Staging DuckDB memory | 10 GiB (`DUCKDB_IMPORT_MEMORY_LIMIT`) |
| Compressed import ZIP | Up to 60 GiB end-to-end |
| Temp/staging files | Under persistent `data/tmp` on the data volume (not container `/tmp` tmpfs) |
| Disk during import | ZIP + extracted Parquet + staging DB + backup + margin (see Deployment README) |

Health checks use `/health/live` during heavy imports so readiness probes do not block on DuckDB locks.

## Architecture constraints (single instance)

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Browser   │────▶│  LAN proxy   │────▶│  FastAPI server │
│  (Next.js)  │     │  (nginx)     │     │  + UnifiedStore │
└─────────────┘     └──────────────┘     └────────┬────────┘
                                                   │
                                                   ▼
                                          ┌─────────────────┐
                                          │  dashboard.db   │
                                          │  (one file)     │
                                          └─────────────────┘
```

### Single DuckDB writer

- One `dashboard.db` file per deployment.
- One `UnifiedStore` connection owner per server process, guarded by `RLock`.
- All reads and writes share that connection; write transactions serialize access.
- **Implication:** horizontal scaling (multiple API replicas writing the same file) is not supported. Read replicas are not implemented.

### Process-local cache

- Query results are cached in-memory (`SimpleCache`) with TTLs defined in `server/settings.yaml`.
- Cache invalidation is process-local; `data_version` polling keeps clients coherent after writes from other users on the **same** instance.

### Background jobs

- Parquet export/import and CSV ingestion run as in-process background tasks with persisted state under `data/tmp/`.
- Long imports reduce live-connection concurrency and use an isolated staging database file.

## When to consider a different datastore

Stay on DuckDB + single instance while:

- Expected concurrent writers are low (typical LAN engineering team)
- Dataset size fits comfortably on one host's disk and RAM
- Sub-second plot queries on precomputed LTTB data remain acceptable

Plan migration (e.g. Postgres + object storage, or DuckDB per tenant) when:

- Multiple write-heavy API instances are required
- The database file exceeds practical single-host limits or backup windows
- Fine-grained row-level security or external analytics tooling needs standard SQL wire protocol at scale

Until then, scale **vertically** (CPU, RAM, NVMe) and keep one server container per deployment.

## Local development vs production

| Mode | Entry | API bind | Notes |
|------|-------|----------|-------|
| Local dev | `./scripts/start-local-dev.sh` | `127.0.0.1:8000` | Next.js dev server on 3001/3002 |
| LAN smoke | `./scripts/start-server-lan.sh` or `.\scripts\start-server-lan.ps1` | `0.0.0.0:8000` | Non-container quick internal test |
| Production | `Deployment/deploy.sh` or `Deployment/scripts/deploy.ps1` | Behind proxy :3000 | Versioned images, env-primary secrets |

`server/settings.yaml` is a **development template**. Production secrets and machine-specific values come from environment variables / deployment `.env`.
