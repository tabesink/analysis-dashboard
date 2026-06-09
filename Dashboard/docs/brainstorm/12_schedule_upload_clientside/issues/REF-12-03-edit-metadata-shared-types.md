# REF-12-03: Extract shared edit-metadata types and helpers

**Type:** AFK  
**Phase:** 0  
**Effort:** Low  
**Review reference:** L-01, L-02, L-03

## Parent

[refactor-plan.md](../refactor-plan.md)

## What to build

Extract duplicated and repeated primitives from the edit page into a shared module under `client/src/features/edit-metadata/` (create the folder scaffold):

- `SelectionMetadata` type (currently duplicated in page + `SelectDatasetSection`)
- `isStatusField(displayName, config)` helper (repeated ~5 times in page)
- Shared constants: `RAW_WEIGHT_FIELDS`, `PHASE_FIELDS`, `EXCLUDED_METADATA_COLUMNS` (if not already only used in one place after extraction)
- Rename default export intent: document that `FilterValuesPage` will become `EditMetadataPage` in REF-12-10 (no rename required in this issue unless trivial)

Move `components/edit-metadata/*` imports to re-export from `features/edit-metadata` barrel without breaking existing import paths (re-export from old path or update imports — pick one, keep diff small).

## Acceptance criteria

- [ ] `client/src/features/edit-metadata/types.ts` exists with `SelectionMetadata`
- [ ] `client/src/features/edit-metadata/lib/metadata-field-helpers.ts` exists with `isStatusField`
- [ ] Edit page and `SelectDatasetSection` import from shared module — no duplicate type definitions
- [ ] No user-visible behavior change
- [ ] `npm run build` passes

## Blocked by

None — can start immediately
