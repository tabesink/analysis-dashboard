---
name: phase-to-booleans-full-replacement
overview: Replace legacy `phase` end-to-end with boolean fields `rfq`, `dv`, `pv`, and `post_prod`, including visible Edit Metadata UI changes and global filter/API behavior updates.
todos:
  - id: schema-and-models
    content: Replace phase with rfq/dv/pv/post_prod in schema and backend/frontend models
    status: completed
  - id: backend-routes-filters
    content: Migrate dashboard/upload routes and filtering logic to new boolean fields
    status: completed
  - id: edit-metadata-ui
    content: Implement visible Edit Metadata UI changes (numeric weight inputs + phase checkboxes)
    status: completed
  - id: global-filter-ui-types
    content: Update generated filter config, global filter UI, and related client types
    status: completed
  - id: validate-and-docs
    content: Run lint/smoke checks and update master plan, decisions log, and task notes
    status: completed
isProject: false
---

# Replace Phase with RFQ/DV/PV/Post-Prod Booleans

## Goal

Fully remove legacy `phase` usage and introduce boolean metadata fields `rfq`, `dv`, `pv`, `post_prod` with visible Edit Metadata UX updates and true/false Global Filter behavior.

## Implementation Steps

1. **Schema and backend model updates**

- Update [server/schema.yaml](server/schema.yaml): remove `phase` column/filter, add boolean columns `rfq`, `dv`, `pv`, `post_prod` with filter metadata supporting true/false values.
- Update [server/storage/database.py](server/storage/database.py): add compatibility `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for new boolean columns and keep old `phase` untouched for backward compatibility reads (not used by app logic).
- Update backend Pydantic models in [server/models/dashboard.py](server/models/dashboard.py) and [server/models/upload.py](server/models/upload.py): remove `phase`, add `rfq/dv/pv/post_prod` fields.

1. **Router + service behavior migration**

- Update [server/routers/dashboard.py](server/routers/dashboard.py):
  - replace `phase` query params in program/version endpoints with `rfq`, `dv`, `pv`, `post_prod`
  - return new boolean fields in event payloads
  - support boolean-safe metadata normalization in single-event and program-version update endpoints (no string `.strip()` assumptions for booleans).
- Update upload path in [server/routers/upload.py](server/routers/upload.py) and [server/services/ingestion.py](server/services/ingestion.py) to accept/persist new booleans and stop using `phase`.
- Ensure filtering logic in [server/services/query.py](server/services/query.py) and [server/storage/database.py](server/storage/database.py) handles boolean global filter values with true/false semantics.

1. **Frontend contracts and global filters**

- Update API/data types in [client/src/types/api.ts](client/src/types/api.ts) and [client/src/types/upload.ts](client/src/types/upload.ts): remove `phase`, add `rfq/dv/pv/post_prod` as booleans.
- Regenerate/update filter config path in [client/scripts/generate-filters.js](client/scripts/generate-filters.js) and [client/src/config/filters.ts](client/src/config/filters.ts) so Global Filters expose RFQ/DV/PV/Post-Prod with true/false options.
- Update global filter and color grouping usage points:
  - [client/src/components/dashboard/side-panel/global-filters/constants.ts](client/src/components/dashboard/side-panel/global-filters/constants.ts)
  - [client/src/stores/color-selection-store.ts](client/src/stores/color-selection-store.ts)
  - [client/src/components/dashboard/color-legend/ColorLegend.tsx](client/src/components/dashboard/color-legend/ColorLegend.tsx)

1. **Visible Edit Metadata UI refactor**

- Update [client/src/app/database/edit/page.tsx](client/src/app/database/edit/page.tsx):
  - replace dropdowns for GVWR/FGAWR/RGAWR with numeric inputs
  - remove `Phase` field from metadata list
  - add RFQ/DV/PV/Post-Prod checkbox UI in right-hand area (cell to the right of Status, split into four)
  - ensure save payload writes booleans (`rfq/dv/pv/post_prod`) and raw numeric strings for weight inputs.
- Update Database table metadata mapping in [client/src/app/database/page.tsx](client/src/app/database/page.tsx) to remove `Phase` and include new booleans where relevant.

1. **Validation + docs required by project rules**

- Run lint/diagnostics for touched backend/frontend files.
- Smoke-check key flows: Edit Metadata save, Global Filters (true/false), program/version filtered queries.
- Update project docs:
  - [docs/master-build-plan.md](docs/master-build-plan.md)
  - [docs/decisions/log.md](docs/decisions/log.md)
  - new task notes file under [docs/tasks/](docs/tasks/) for this task.

## Notes on migration behavior

- Existing records default `rfq/dv/pv/post_prod` to false when absent.
- No backfill from legacy `phase` values (per your prior decision).

