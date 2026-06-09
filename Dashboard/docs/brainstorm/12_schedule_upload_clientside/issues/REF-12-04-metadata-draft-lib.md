# REF-12-04: Extract program-version draft builders + unit tests

**Type:** AFK  
**Phase:** 1  
**Effort:** Medium  
**Review reference:** H-01

## Parent

[refactor-plan.md](../refactor-plan.md) · FALLOW-13

## What to build

Move pure draft-building functions out of `page.tsx` into `client/src/features/edit-metadata/lib/build-program-version-draft.ts`:

- `buildProgramVersionDraftValues`
- `buildProgramVersionPhaseDraftValues`
- `toClearedDraftValues`
- `toClearedPhaseDraftValues`
- `toTimestamp` (if only used by draft logic)

Add unit tests covering the **mixed-value semantics**: when some events have a value and others are null, draft shows the value but baseline stays empty so Save propagates to null events.

## Acceptance criteria

- [ ] Draft builders live in `lib/build-program-version-draft.ts` with no React imports
- [ ] Page imports builders from lib module
- [ ] Tests in `client/src/features/edit-metadata/lib/build-program-version-draft.test.ts` cover mixed-value case
- [ ] Tests cover all-true phase checkboxes when every event has phase flag set
- [ ] `npm test` passes for new tests
- [ ] Manual smoke: select program/version with mixed metadata still prefills correctly

## Blocked by

- REF-12-03

## Agent notes

- Use minimal fixture `EventMetadata` objects in tests
- Do not extract UI or hooks in this issue
