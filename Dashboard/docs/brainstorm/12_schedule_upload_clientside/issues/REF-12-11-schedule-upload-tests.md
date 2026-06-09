# REF-12-11: UploadScheduleSection + FileDropZone behavior tests

**Type:** AFK  
**Phase:** 2  
**Effort:** Low  
**Review reference:** M-02, prd.md testing section

## Parent

[refactor-plan.md](../refactor-plan.md) · [prd.md](../prd.md)

## What to build

Add client behavior tests per PRD testing decisions:

**`FileDropZone`** (if not already tested elsewhere)
- Renders primary label and hint
- `disabled` prop blocks `onFilesSelected`
- Drag/drop invokes callback when enabled

**`UploadScheduleSection`**
- Ghosted/disabled when `enabled=false`
- Accepts only `.sch` files (rejects `.csv`)
- Clears selected file when `selectionKey` changes
- Shows filename when file selected

Use existing client test patterns (`@testing-library/react`).

## Acceptance criteria

- [ ] Test files under `client/src/features/edit-metadata/` or `client/src/components/shared/`
- [ ] All PRD-listed UploadScheduleSection behaviors covered
- [ ] `npm test` passes
- [ ] No production code changes unless required to make components testable (minimal)

## Blocked by

- REF-12-10

## Agent notes

- Invoke `engineering/tdd` skill if starting from scratch
- Test externally visible behavior only
