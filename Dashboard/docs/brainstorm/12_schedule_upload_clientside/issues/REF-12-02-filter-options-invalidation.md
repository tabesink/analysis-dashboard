# REF-12-02: Invalidate filter-options after metadata save

**Type:** AFK  
**Phase:** 0  
**Effort:** Low  
**Review reference:** M-07

## Parent

[refactor-plan.md](../refactor-plan.md)

## What to build

After a successful metadata save on Edit Metadata, React Query should invalidate `filter-options` so dropdown values reflect new metadata immediately. Database upload/delete paths already invalidate this key; Edit Metadata save does not.

If metadata save moves to a mutation hook in a later issue, add invalidation there. If still inline in the page, add it to the existing save handler.

## Acceptance criteria

- [x] Successful metadata save invalidates `['filter-options']` (or the exact key used by `useFilterOptions`)
- [x] No change to save payload or server behavior
- [x] `npm run build` passes in `client/`

## Blocked by

None — can start immediately

## Agent notes

- Current invalidation keys are in `handleSave` in `client/src/app/database/edit/page.tsx`
- If REF-12-06 lands first, implement invalidation in the mutation hook instead and note in PR
