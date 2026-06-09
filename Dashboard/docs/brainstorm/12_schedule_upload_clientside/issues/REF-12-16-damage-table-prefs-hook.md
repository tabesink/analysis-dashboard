# REF-12-16: Extract use-damage-table-preferences from DamageTable

**Type:** AFK  
**Phase:** 4  
**Effort:** High  
**Review reference:** H-02, M-06

## Parent

[refactor-plan.md](../refactor-plan.md)

## What to build

Move preference hydration/persistence logic from inline `DamageTable` into `useDamageTablePreferences` hook in `features/inspect-damage/hooks/`:

- Wraps existing `useInspectDamageState` + local `useState` for sort, filters, visibility, widths, expansion
- Encapsulates refs: `expansionInitializedRef`, `preferencesHydrated`, `expansionTreeHydratedRef`
- Exposes stable API: `tableState`, `setters`, `resetTablePreferences`, `renderHeaderHelpers` inputs

`DamageTable` component (still in page for this issue) consumes hook — table JSX extraction is REF-12-17.

Add unit tests for hook using mocked session where feasible, or test via extracted pure helpers.

## Acceptance criteria

- [ ] Hook file ≤ 250 LOC; no JSX in hook
- [ ] Table preference round-trip still works (manual smoke: resize column, refresh, value persists)
- [ ] Tree expansion merge behavior unchanged
- [ ] `use-inspect-damage-state.test.ts` still passes
- [ ] `npm run build` passes

## Blocked by

None — can start immediately

## Agent notes

- Highest complexity in inspect-damage track — read `inspect-damage-table-preferences.ts` first
- Do not remove legacy localStorage helpers in this issue (REF-12-20)
