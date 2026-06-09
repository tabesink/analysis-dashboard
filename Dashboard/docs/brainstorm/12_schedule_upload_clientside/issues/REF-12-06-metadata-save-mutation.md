# REF-12-06: Add useUpdateProgramVersionMetadata mutation hook

**Type:** AFK  
**Phase:** 1  
**Effort:** Low  
**Review reference:** M-03

## Parent

[refactor-plan.md](../refactor-plan.md)

## What to build

Replace inline `handleSave` fetch logic with a TanStack Query `useMutation` hook `useUpdateProgramVersionMetadata` that:

- Calls `dashboardApi.updateProgramVersionMetadata`
- Shows loading toast via `onMutate` / `onSettled` (preserve existing toast copy)
- On success: invalidates the same query keys as today **plus** `filter-options` (if REF-12-02 not done)
- Updates `selectedEventMetadata` from response
- Clears dirty state on success
- Surfaces errors via toast

Wire hook into page or `useMetadataDraft` (pick the smaller diff).

## Acceptance criteria

- [ ] `use-update-program-version-metadata.ts` exists with typed mutation
- [ ] Save behavior and toast messages unchanged from user perspective
- [ ] All prior query invalidations preserved
- [ ] `filter-options` invalidated on success
- [ ] `npm run build` passes

## Blocked by

- REF-12-05

## Agent notes

- Mirror `useMutation` pattern from `inspect-damage/page.tsx` `inspectMutation`
- Admin-only status field exclusion stays in save payload builder
