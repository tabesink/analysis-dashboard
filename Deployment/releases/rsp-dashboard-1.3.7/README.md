# RSP Dashboard Production Deployment

Use this guide to deploy this release bundle on a production server.

## 1) Prerequisites

- Linux production server
- Docker and Docker Compose v2 installed
- These two files copied to the server in the same directory:
  - `rsp-dashboard-<VERSION>.tar.gz`
  - `rsp-dashboard-<VERSION>.tar.gz.sha256`

## 2) Verify release file integrity

Run:

```bash
sha256sum -c rsp-dashboard-<VERSION>.tar.gz.sha256
```

Expected output:

`rsp-dashboard-<VERSION>.tar.gz: OK`

If checksum fails, stop and re-copy files.

## 3) Extract release bundle

Run:

```bash
sudo tar xzf rsp-dashboard-<VERSION>.tar.gz -C /opt
cd /opt/rsp-dashboard-<VERSION>
```

## 4) Configure environment

Create `.env` from template:

```bash
cp .env.example .env
chmod 600 .env
```

Edit `.env` and set:

```env
ADMIN_SECRET=<strong-production-password>
```

Optional port override:

```env
DASHBOARD_PORT=3000
```

## 5) Deploy application

From `/opt/rsp-dashboard-<VERSION>` run:

```bash
sudo ./deploy.sh
```

The script loads images, starts services, and waits for readiness.

## 6) Validate deployment

On server:

```bash
curl http://localhost:3000/health/ready
```

Expected response includes `"status":"ready"`.

From a browser on the LAN:

`http://<server-ip-or-dns>:3000`

Login:
- Username: `admin`
- Password: value of `ADMIN_SECRET` in `.env`

### Optional: Import load data from another host

To move uploaded load data from a source system to this deployment:

1. On the source system, log in as `admin`, open the Database page, and use **Export Load Data** to download `dashboard_export.zip`.
2. On this target system, log in as `admin`, open the Database page, and use **Import Load Data** to select that ZIP.
3. Type `IMPORT` when prompted.

Import replaces target load data but preserves this target system's users, sessions, saved filters, audit history, and admin configuration.

Large ZIPs stream through the proxy to the API instead of being buffered on the proxy's small cache tmpfs. Compressed import ZIPs are capped at 60 GiB and staged under the Docker `data` volume (`/app/data/tmp` inside the server container), not the small in-memory `/tmp` mount.

**Disk (data volume)** — plan for the extracted Parquet tables, not the ZIP size alone. Current exports omit retained raw/converted CSV artifacts (`managed_artifacts/channel-map`) and pending `ingestion_artifacts`, so they should be much smaller than older artifact-heavy archives. During import the server still keeps the uploaded ZIP, an extract tree, a staging `dashboard.db` copy, and `dashboard.db.bak`. Rule of thumb:

| Component | Example (your scale) |
|-----------|----------------------|
| Staged ZIP | ~2 GiB |
| Extracted tree | Parquet tables only (legacy `managed_artifacts` members are skipped) |
| Staging DB + backup | ~2× live `dashboard.db` (small if target is empty; grows with data) |
| **Minimum free on `/app/data`** | `zip + extracted Parquet + 2× live DB + 20 GiB margin` |

Check free space inside the container before a large import:

```bash
docker exec "$(docker compose ps -q server)" df -h /app/data
```

Remove stale workdirs from failed attempts (`/app/data/tmp/import-parquet-*`) if disk is tight. Old archives that still contain `managed_artifacts/channel-map` are accepted, but those members are skipped during validation/import and are not restored on the target.

**Memory (RAM)** — extract size on disk is **not** the same as DuckDB RAM usage. Peak memory is driven mainly by loading large Parquet tables (`measurements_raw`, `measurements_lttb`) into the staging database. The server container defaults to **12 GiB** `mem_limit` with staging DuckDB tuned to **10 GiB** (`duckdb_import_memory_limit`) and a **1 GiB** cap on the live connection during import.

Pending/no-channel-map uploads are not portable. Complete channel-map setup before export, or re-upload those raw files on the target host.

Override via environment if needed: `DUCKDB_IMPORT_MEMORY_LIMIT`, `DUCKDB_IMPORT_THREADS` (default `1`), `DUCKDB_LIVE_MEMORY_LIMIT_DURING_IMPORT`. Raise `mem_limit` in `docker-compose.yml` when increasing `DUCKDB_IMPORT_MEMORY_LIMIT` (leave ~2 GiB for Python and the live connection).

## 7) Day-2 commands

Run from `/opt/rsp-dashboard-<VERSION>`:

```bash
# Service status
docker compose --env-file .env -f docker-compose.yml ps

# Logs
docker compose --env-file .env -f docker-compose.yml logs -f

# Restart stack
docker compose --env-file .env -f docker-compose.yml restart

# Stop stack
docker compose --env-file .env -f docker-compose.yml down
```

## 8) Upgrade to next release

For a new version, repeat this process with the new tarball in a new directory:

`/opt/rsp-dashboard-<NEW_VERSION>`
