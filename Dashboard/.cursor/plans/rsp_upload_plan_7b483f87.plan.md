---
name: rsp upload plan
overview: Add direct `.rsp` upload support by converting `.rsp` files to the existing tagged CSV shape in a temporary server workspace, then reusing the current CSV ingestion pipeline and SSE progress UI.
todos:
  - id: backend-converter
    content: Create focused RSP-to-tagged-CSV converter from the notebook logic
    status: completed
  - id: backend-ingestion
    content: Normalize CSV/RSP uploads in the existing upload and ingestion pipeline
    status: completed
  - id: frontend-upload-ui
    content: Add single-file selection and CSV/RSP preflight validation in the database upload panel
    status: completed
  - id: progress-and-tests
    content: Expose conversion progress and add targeted backend/frontend verification
    status: completed
  - id: docs-update
    content: Update build-plan/task notes/decision log during implementation
    status: completed
isProject: false
---

# RSP Upload Implementation Plan

## Design Gates

- **Backend route shape:** Extend existing `[server/routers/upload.py](server/routers/upload.py)` `POST /api/v1/upload/folder/start`.
  - Pros: smallest API surface, same auth/rate-limit/SSE/task model, minimal frontend plumbing.
  - Cons: endpoint name remains CSV/folder flavored even though it now supports single files and `.rsp`.
  - Recommendation: proceed; rename/copy cleanup can happen later only if the API becomes public-facing.
- **Mapping policy:** Require `channel_map.yaml/.yml` for `.rsp` uploads too.
  - Pros: preserves explicit plot semantics and reuses `[server/services/etl/channel_map.py](server/services/etl/channel_map.py)` plus `[server/services/etl/csv_parser.py](server/services/etl/csv_parser.py)`.
  - Cons: users still need a map even though the notebook can recover channel names.
  - Recommendation: proceed; auto-map is too risky for plot correctness.
- **Artifact policy:** Use temporary conversion output only; do not persist under `data/rsp_raw` or `data/raw`.
  - Pros: less storage lifecycle code, no cleanup/purge/security surface, bloat-free first implementation.
  - Cons: no raw artifact audit trail or reprocessing from disk.
  - Recommendation: proceed; add durable artifacts later only if users need audit/reprocessing.
- **Folder validation:** Ignore unrelated files, but reject batches containing both `.csv` and `.rsp` excluding `channel_map.yaml/.yml`.
  - Pros: practical for real folders, clear single-format invariant.
  - Cons: ignored files are invisible unless we add UI warnings.
  - Recommendation: implement backend validation and a frontend preflight toast.

## Backend Plan

1. Add a small converter module, likely `[server/services/etl/rsp_converter.py](server/services/etl/rsp_converter.py)`, based on `[notebooks/rsp_to_csv_v2.ipynb](notebooks/rsp_to_csv_v2.ipynb)`.
  - Keep only the production path needed for `rpc-reader`, since `[server/pyproject.toml](server/pyproject.toml)` already includes `rpc-reader>=0.9`.
  - Output bytes in the same tagged CSV format currently parsed by `CSVParser` (`#TITLES`, `#UNITS`, `#DATATYPES`, `#DATA`).
  - Avoid notebook concerns such as repo-root discovery, printing, and optional pyRPC3 fallback unless tests prove `rpc-reader` cannot cover real files.
2. Generalize upload payload parsing in `[server/routers/upload.py](server/routers/upload.py)`.
  - Accept `.csv` and `.rsp` files in the existing `files` field.
  - Read `channel_map` as required by ingestion.
  - Ignore unrelated files.
  - Reject no data files, mixed `.csv` + `.rsp`, and oversize uploads with clear `422`/`413` errors.
3. Refactor `[server/services/ingestion.py](server/services/ingestion.py)` into a narrow normalize-then-ingest flow.
  - Before CSV parsing, detect upload kind.
  - For `.csv`, pass through unchanged.
  - For `.rsp`, set task phase to `converting`, convert each file to tagged CSV bytes with `.csv` display/source naming, then reuse existing parse/validate/write logic.
  - Extend `_generate_event_id` to strip `.rsp` and `.csv` consistently, while storing `source_file` as the original `.rsp` name unless we explicitly choose converted names.
4. Keep task progress compatible with current SSE.
  - Use existing `phase` string values and frontend `UploadTaskEvent.phase`.
  - Add simple phase transitions: `validating`, `converting`, `writing`, `completed`/`failed`.
  - No DB schema change expected because upload task phase is already a stored string.
5. Add focused tests.
  - Unit-test converter output from a small fixture or mocked `rpc_reader` reader.
  - Service-test `.rsp` normalization plus existing ingestion path with a channel map.
  - Router-test mixed `.csv`/`.rsp` rejection and unrelated-file ignore behavior if existing test setup makes that cheap.

## Frontend Plan

1. Update file selection in `[client/src/components/upload/UploadDataSection.tsx](client/src/components/upload/UploadDataSection.tsx)`.
  - Add a `Select Files` button beside existing `Select Folder`.
  - Keep one selected-files list.
  - Update helper text from “channel map required” to “CSV or RSP files plus channel map”.
2. Update client-side preflight in `[client/src/app/database/page.tsx](client/src/app/database/page.tsx)`.
  - Classify selected files into `.csv`, `.rsp`, `channel_map`, and ignored extras.
  - Require required metadata fields and channel map.
  - Reject mixed `.csv` + `.rsp` batches.
  - Pass the selected data files to the existing upload hook.
3. Generalize the hook/API names only where useful.
  - In `[client/src/hooks/use-upload.ts](client/src/hooks/use-upload.ts)`, change `csvFiles` parameter naming to `dataFiles` without changing behavior.
  - In `[client/src/lib/api/upload.ts](client/src/lib/api/upload.ts)`, keep posting to `/api/v1/upload/folder/start`, but rename local helpers from CSV-specific names where they now handle both formats.
  - In `[client/src/types/upload.ts](client/src/types/upload.ts)`, no new response type is needed unless we decide to type known phases.
4. Show conversion progress.
  - Map `phase === 'converting'` to “Converting RSP files...” in `[client/src/hooks/use-upload.ts](client/src/hooks/use-upload.ts)`.
  - Keep existing event-count progress for writing events.

## Verification

- Backend: run targeted server tests for ingestion/upload and add converter tests.
- Frontend: run TypeScript/lint for touched client files.
- Manual smoke: upload a single `.csv`, a folder of `.csv`, a single `.rsp` + channel map, a folder of `.rsp` + channel map, a mixed CSV/RSP folder, and a folder with ignored unrelated files.

## Documentation

- Update `[docs/master-build-plan.md](docs/master-build-plan.md)` for the selected task status when implementation starts/completes.
- Add task notes under `[docs/tasks/](docs/tasks/)` because this is a non-trivial ingestion change.
- Append `[docs/decisions/log.md](docs/decisions/log.md)` entry for the durable decisions: channel map required for `.rsp`, temp-only conversion, same upload endpoint.

