# REF-12-05: Add use-program-version-selection + use-metadata-draft

**Type:** AFK  
**Phase:** 1  
**Effort:** Medium  
**Review reference:** H-01

## Parent

[refactor-plan.md](../refactor-plan.md) · FALLOW-13

## What to build

Extract selection and draft state management from the edit page into two hooks:

**`useProgramVersionSelection`**
- Program ID + version state
- React Query for `program-ids`, `versions`, `program-version-events`
- `selectedEventMetadata` summary derivation
- Loading/error flags passed to side panel

**`useMetadataDraft`**
- `draftValues`, `baselineDraftValues`, `phaseDraftValues`, `baselinePhaseDraftValues`
- `dirtyFields`, `dirtyPhases`, `preResetSnapshot`, `copyClipboard`
- Handlers: set field, set phase, reset, restore, copy, paste, clear
- Merges server prefill without clobbering dirty fields (preserve existing ref-based logic)

Page should call both hooks but may still render tabs inline (tab extraction is REF-12-07).

## Acceptance criteria

- [ ] Hooks live under `client/src/features/edit-metadata/hooks/`
- [ ] Edit page uses hooks; draft/save behavior unchanged
- [ ] Dirty-field tracking still sends only changed fields on save
- [ ] Copy/paste/reset/restore work as before
- [ ] `npm run build` passes

## Blocked by

- REF-12-04

## Agent notes

- Keep `useQuery` keys identical to avoid cache regressions
- Auth guard (`canWrite`, redirect) may stay in page for now
