# Product Requirements Document

**Product:** RSP Data Analytics Dashboard  
**App version:** 1.3.7  
**Last Updated:** 2026-05-21

---

## 1. Product Overview

A full-stack data analytics dashboard for uploading, filtering, and visualizing automotive suspension component test data. Engineers upload CSV or RSP test files, apply multi-dimensional filters, and view downsampled time-series plots in a configurable grid or interactive canvas. Admins manage users and permissions, filter options, custom fields, and load-data portability between hosts.

Production deployments use a Docker release bundle with a single-origin LAN proxy. The live database is one DuckDB file; admin export/import moves **load data only** (not user accounts or admin configuration).

---

## 2. Users

| Role | Write access | Capabilities |
|------|--------------|--------------|
| **Read-only user** | No (`can_write=false`) | Login/register, browse Dashboard, apply filters, view plots, manage own session. Database and Edit Filters nav items are disabled. |
| **Writer** (`can_write=true`) | Yes | All read-only capabilities + upload CSV/RSP with channel maps, edit event metadata (own rows or as permitted), manage channel maps, scope delete for owned program/version groups. |
| **Admin** | Always | All writer capabilities + user management (`/settings/users`), filter option administration, custom fields, per-event **Status** updates, load-data export/import, purge soft-deleted data. |

Self-service **registration** creates read-only accounts by default. Admins grant write access per user on the Settings page.

---

## 3. Core Workflows

```
Upload CSV/RSP + channel_map.yaml
  --> ETL: parse (RSP conversion when needed), validate, transform (wide-to-long), LTTB downsample
  --> Store: dim_event + measurements_raw + measurements_lttb + dim_channel_map
  --> Cache invalidation + data_version bump

Filter & Select Events (unified Load Data panel)
  --> Global filters (15 built-in dimensions + custom fields)
  --> Program / version / event hierarchical tree (channel-map gated selection)
  --> Status still filters semantics (Approved, Obsolete, Pending) but no separate baseline/new partitions

Render Plots
  --> Grid mode: multi-plot SVG grid with LTTB-downsampled data
  --> Interactive mode: single-plot canvas with pan/zoom
  --> Color coding by version, filter value, or per-event
  --> Group-level axis sync (Bushing vs BJ/Shock plot groups)

Session Persistence
  --> Server-synced session state (filters, rendered events, UI preferences)
  --> Client-side sessionStorage backup
  --> Debounced sync

Cross-User Refresh
  --> Authenticated clients poll GET /api/v1/sync/version
  --> When data_version increases, invalidate event catalogs, filters, program/version lists
  --> Polling pauses during active database import

Load-Data Portability (admin)
  --> Export: background Parquet ZIP (load-data tables only)
  --> Import: stream ZIP, validate, confirm with typed IMPORT, staging DB swap on success
  --> Target users, sessions, saved filters, audit log, and admin custom-field config preserved
  --> Backup dashboard.db.bak created before replace
```

---

## 4. Functional Requirements

### 4.1 Data Upload

- Accept CSV files, `.rsp` files (converted via channel map), or folders via a single drag-and-drop control
- Require `channel_map.yaml` defining plot channels (or complete channel-map setup for pending uploads)
- Support RSP-format CSV with `#DATA`/`#TITLES` markers
- Validate: duplicate file hash detection, NaN percentage limits, row count limits, channel map index checks, timestamp monotonicity
- Metadata fields: program_id, version, status, RFQ/DV/PV/Post-Prod applicability booleans, suspension_component, axle_location, raw weight fields (GVW/FGAWR/RGAWR) with derived range buckets for filtering, drive_type, material_construction, steering_position, damper_type, vehicle_type, job_number, work_order
- Custom field values can be attached per event during upload
- Transactional ingestion: all-or-nothing per file
- LTTB downsampling computed and stored during ingestion
- Creator-scoped upload progress over SSE with durable task state
- Dataset listing with server-side pagination and column facets

### 4.2 Filtering

- 15 built-in filter dimensions defined in `server/schema.yaml` (including RFQ/DV/PV/Post-Prod booleans replacing legacy phase)
- Admin-defined custom fields with program-scoped allowed values
- Event ID search (substring match)
- Bidirectional filter propagation: filters constrain available programs/versions/events
- Server-side filter semantics module validates filter plans consistently across endpoints
- Weight range buckets applied in SQL against raw numeric columns
- Saved filter presets (per user)

### 4.3 Visualization

- Grid view: configurable plot grid rendering SVG plots from LTTB data
- Interactive view: single-plot canvas with full-resolution data, pan/zoom; falls back to rendered events when selection is empty
- Color modes: by version, by filter value, per-event custom colors
- Color legend panel (docked or floating)
- Pinned events for cross-status comparison
- Click-query: identify nearest curve at click coordinates
- Binary data transfer for large plot payloads (Web Worker decode)

### 4.4 Session Management

- Create/update/delete sessions via REST API
- JSON blob storage for filter state, rendered event IDs, UI preferences
- Session TTL with expiration
- User-scoped sessions (user_id binding)

### 4.5 Authentication & Authorization

- JWT-based auth with httpOnly cookie transport
- bcrypt password hashing (minimum 8 characters)
- Closed login: accounts must exist (admin-created or self-registered)
- Route protection on frontend (redirect unauthenticated users to `/login`)
- Backend guards: `get_current_user`, `require_admin`, `require_write_or_admin`
- Admin-only: load-data export/import, user CRUD, filter option admin, custom field definitions, event Status field, purge
- Settings (`/settings/users`) and Changelog (`/changelog`) in app shell; version label shows client/server versions and live vs target DB schema version

### 4.6 Load-Data Portability

- **Scope:** Move processed engineering data between hosts. Does **not** replace target users, sessions, saved filters, audit history, or admin custom-field configuration. Does **not** include pending channel-map artifacts or retained raw CSV/RSP files (DEC-062, DEC-063).
- **Export (admin):** Background job writes load-data tables to Parquet (ZSTD), generates `schema.sql` / `load.sql`, zips as `dashboard_export.zip`; client polls task status then downloads the ZIP.
- **Import (admin):** ZIP streamed to disk in chunks; upload returns `upload_id` + validation; typed confirmation starts background import with phased progress (backup, load, finalize); loads into `dashboard.db.staging` then atomically swaps; cancel/close discards staged upload via API.
- **API:** `POST /api/v1/export/database/parquet/export/start`, `GET .../parquet/task/{id}`, `GET .../parquet/download/{id}`, `POST .../parquet/upload`, `DELETE .../parquet/upload/{upload_id}`, `POST .../parquet/import/{upload_id}`, `GET .../database/info`
- Schema metadata (`_schema_metadata`) included for compatibility checks
- Optimistic concurrency: single-event metadata updates require `if_unmodified_since`; HTTP 409 when stale

See `docs/notes/database.md` and `Deployment/README.md` for operator details.

---

## 5. Non-Functional Requirements

### 5.1 Performance

| Metric | Target | Source |
|--------|--------|--------|
| Rate limit (default) | 120 req/min | settings.yaml |
| Rate limit (upload) | 10 req/min | settings.yaml |
| Rate limit (render) | 20 req/min | settings.yaml |
| Rate limit (admin) | 30 req/min | settings.yaml |
| Max upload size (CSV/RSP/import ZIP) | 61440 MB (60 GiB) | settings.yaml + proxy |
| Max events per query | 500 | settings.yaml |
| Filter options cache TTL | 3600s | settings.yaml |
| Program IDs cache TTL | 60s | settings.yaml |
| Events cache TTL | 30s | settings.yaml |
| LTTB resolution | 5000 points | settings.yaml |
| Cross-user sync poll | 10s interval | `use-data-version-sync.ts` |

### 5.2 Data Validation

| Rule | Threshold | Source |
|------|-----------|--------|
| Max NaN percentage | 5.0% | settings.yaml |
| Min rows per file | 10 | settings.yaml |
| Max rows per file | 1,000,000 | settings.yaml |
| Timestamp monotonicity | Required | settings.yaml |

### 5.3 Security

- JWT with configurable expiry (default: 24h)
- Production: secrets from environment; `settings.yaml` is a dev template
- Secure cookie enforcement when not using trusted-LAN HTTP mode
- CORS restricted to configured origins
- `ADMIN_SECRET` bootstraps initial admin on first startup
- Rate limiting with burst allowance per endpoint category
- ZIP path traversal rejected on import
- Ownership checks on metadata updates and scope deletes

---

## 6. Data Schema

See `docs/database-schema.txt` for the complete schema definition.

---

## 7. Known Limitations & Remaining Work

| Area | Status |
|------|--------|
| Multi-user sync | **Shipped** — `data_version` polling, cache invalidation, optimistic metadata concurrency |
| Horizontal scaling | **Not supported** — single DuckDB file, single writer; see `docs/architecture/deployment-and-scaling.md` |
| HTTPS / secure cookies in LAN bundle | Operator choice — use `ALLOW_INSECURE_COOKIES` only on trusted networks |
| Frontend E2E (Playwright) | Not yet implemented |
| Full backend unit coverage (ETL, cache) | Partial — see `docs/test-strategy.md` |
| Responsive / mobile layout | Desktop-first; not optimized for small screens |
| Dark mode | CSS hook present; tokens not defined |

See Phase 8–9 and backlog in `docs/master-build-plan.md` for tracked follow-ups.
