# Product Requirements Document

**Product:** RSP Data Analytics Dashboard
**Version:** 1.0
**Last Updated:** 2026-03-20

---

## 1. Product Overview

A full-stack data analytics dashboard for uploading, filtering, and visualizing automotive suspension component test data. Engineers upload CSV test results, apply multi-dimensional filters, and view downsampled time-series plots organized in a configurable grid layout. Admins manage users, filter options, custom fields, and database portability.

---

## 2. Users

| Role | Capabilities |
|------|-------------|
| **Engineer** (user) | Upload CSV data with channel maps, browse events by program/version, apply 12+ filter dimensions, view grid and interactive plots, manage session state, pin events for comparison, export plot views |
| **Admin** | All engineer capabilities + manage users (create/delete), manage filter option values, create/edit custom fields, export/import the full database, purge soft-deleted data, update protected fields (e.g. status) |

---

## 3. Core Workflows

```
Upload CSV + channel_map.yaml
  --> ETL: parse, validate, transform (wide-to-long), LTTB downsample
  --> Store: dim_event + measurements_raw + measurements_lttb + dim_channel_map
  --> Cache invalidation

Filter & Select Events
  --> Global filters (12 built-in dimensions + custom fields)
  --> Partition: baseline (Approved/Obsolete) vs new_data (Pending)
  --> Program/version/event hierarchical tree selection

Render Plots
  --> Grid mode: multi-plot SVG grid with LTTB-downsampled data
  --> Interactive mode: single-plot canvas with pan/zoom
  --> Color coding by version, filter value, or per-event

Session Persistence
  --> Server-synced session state (partitions, filters, rendered events)
  --> Client-side sessionStorage backup
  --> Debounced sync with optimistic updates

Database Portability
  --> Admin exports compressed Parquet archive (ZIP: `schema.sql`, `load.sql`, `*.parquet` zstd)
  --> Live runtime DB remains a single DuckDB file (`dashboard.db`); export is for backup/transfer only
  --> Admin uploads ZIP once; server validates, then background import replaces DB after confirmation
  --> Schema compatibility warnings; `_init_schema()` reconciles missing columns after import
  --> Backup (`dashboard.db.bak`) created before import
```

---

## 4. Functional Requirements

### 4.1 Data Upload

- Accept one or more CSV files plus a `channel_map.yaml` defining plot channels
- Support RSP-format CSV with `#DATA`/`#TITLES` markers
- Validate: duplicate file hash detection, NaN percentage limits, row count limits, channel map index checks, timestamp monotonicity
- Metadata fields: program_id, version, status, phase, suspension_component, axle_location, weight ranges (GVW/FGAWR/RGAWR), drive_type, material_construction, steering_position, damper_type, vehicle_type, job_number, work_order
- Custom field values can be attached per event during upload
- Transactional ingestion: all-or-nothing per file
- LTTB downsampling computed and stored during ingestion

### 4.2 Filtering

- 12 built-in filter dimensions defined in `server/schema.yaml` with display names and allowed values
- Admin-defined custom fields with program-scoped allowed values
- Event ID search (substring match)
- Bidirectional filter propagation: filters constrain available programs/versions/events
- Partition logic: baseline partition = status IN (Approved, Obsolete); new_data partition = status = Pending
- Saved filter presets (per user)

### 4.3 Visualization

- Grid view: configurable plot grid rendering SVG plots from LTTB data
- Interactive view: single-plot canvas with full-resolution data, pan/zoom
- Color modes: by version, by filter value, per-event custom colors
- Color legend panel (docked or floating)
- Pinned events: pin events for cross-partition comparison
- Click-query: identify nearest curve at click coordinates
- Binary data transfer for large plot payloads (Web Worker decode)

### 4.4 Session Management

- Create/update/delete sessions via REST API
- JSON blob storage for partition state, global filters, rendered event IDs, UI preferences
- Session TTL with expiration
- User-scoped sessions (user_id binding)

### 4.5 Authentication & Authorization

- JWT-based auth with httpOnly cookie transport
- bcrypt password hashing
- Two roles: user, admin
- Route protection on frontend (redirect to /login when unauthenticated)
- Backend dependency guards: `get_current_user`, `require_admin`
- Admin-only operations: export/import DB, purge deleted events, update status field, manage filter options and custom fields

### 4.6 Database Portability

- **Export (admin):** Background job writes all tables to Parquet (ZSTD), generates `schema.sql` / `load.sql`, zips as `dashboard_export.zip`; client polls task status then downloads the ZIP (Save As where supported, or object-URL download).
- **Import (admin):** ZIP streamed to disk in chunks (no full-file RAM buffer); single upload returns `upload_id` + validation; confirm starts a background import task with per-table progress; cancel/close discards staged upload via API.
- **API:** `POST /api/v1/export/database/parquet/export/start`, `GET .../parquet/task/{id}`, `GET .../parquet/download/{id}`, `POST .../parquet/upload`, `DELETE .../parquet/upload/{upload_id}`, `POST .../parquet/import/{upload_id}`; `GET .../database/info` unchanged.
- Schema metadata (`_schema_metadata`) remains in the live DB and in export for compatibility checks (missing/extra filter columns, version mismatch warnings).

---

## 5. Non-Functional Requirements

### 5.1 Performance

| Metric | Target | Source |
|--------|--------|--------|
| Rate limit (default) | 120 req/min | settings.yaml |
| Rate limit (upload) | 10 req/min | settings.yaml |
| Rate limit (render) | 20 req/min | settings.yaml |
| Max upload size | 500 MB | settings.yaml |
| Max events per query | 200 | settings.yaml |
| Filter options cache TTL | 3600s | settings.yaml |
| Program IDs cache TTL | 60s | settings.yaml |
| Events cache TTL | 30s | settings.yaml |
| LTTB resolution | 5000 points | settings.yaml |

### 5.2 Data Validation

| Rule | Threshold | Source |
|------|-----------|--------|
| Max NaN percentage | 5.0% | settings.yaml |
| Min rows per file | 10 | settings.yaml |
| Max rows per file | 1,000,000 | settings.yaml |
| Timestamp monotonicity | Required | settings.yaml |

### 5.3 Security

- JWT with configurable expiry (default: 24h)
- Secure cookie enforcement in production (auth_cookie_secure)
- CORS restricted to configured origins
- Admin secret for bootstrap operations
- Rate limiting with burst allowance per endpoint category

---

## 6. Data Schema

See `docs/database-schema.txt` for the complete schema definition.

---

## 7. Multi-User Roadmap

Current state: basic multi-user support (auth, roles, ownership fields). Key gaps to close:

- Fix `status`/`status_value` keyword mismatch in upload path
- Add ownership checks on metadata updates (not just status)
- Add `data_version` monotonic counter for cross-user sync
- Frontend polling for data version changes
- Consistent cache invalidation on all write paths
- Optimistic concurrency control on updates

See Phase 8 in `docs/master-build-plan.md` for the full implementation plan.
