# REF-12-23: Schedule upload API vertical slice

**Type:** AFK  
**Phase:** 6  
**Effort:** High  
**Review reference:** Phase 6 in architecture review

## Parent

[refactor-plan.md](../refactor-plan.md) · [prd.md](../prd.md) · REF-12-22 ADR

## What to build

End-to-end vertical slice per REF-12-22 ADR. Minimum tracer bullet:

**Server**
- `POST /api/v1/dashboard/program-version/schedule` — multipart `.sch` upload scoped to `program_id` + `version`
- `WriteUserDep` + `user_can_edit_program_version` ownership
- Parse `.sch` (server-side): `*id`, `*multiplier`, pattern entries (see `notebooks/` prototypes)
- Persist artifact (new table or extend `ingestion_artifacts` — per ADR)
- Cache invalidation consistent with metadata writes
- Update `docs/database-schema.txt`

**Client**
- Wire `UploadScheduleSection` `onExtract` to upload API
- Progress/error toasts; clear file on success
- `DurabilityScheduleTab` shows parsed summary (per ADR)

**Tests**
- Server: upload, ownership denial, parse errors, schema round-trip
- Client: upload success/error behavior tests

## Acceptance criteria

- [ ] Write user can upload `.sch` for selected program/version
- [ ] Parsed schedule visible in UI per ADR
- [ ] Read-only user cannot upload (API + UI)
- [ ] `docs/database-schema.txt` updated if schema changes
- [ ] `docs/decisions/log.md` entry if storage model is new
- [ ] Server + client tests pass

## Blocked by

- REF-12-22 (ADR approved)

## Agent notes

- Reference notebooks: `notebooks/rsp_file_name_extraction.ipynb` for domain patterns — do not import notebook code directly
- Follow `upload.py` streaming patterns for large files
- This issue completes schedule iteration 2 — update prd.md status when done
