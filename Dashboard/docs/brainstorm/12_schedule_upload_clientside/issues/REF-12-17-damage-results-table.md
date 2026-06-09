# REF-12-17: Extract DamageResultsTable component

**Type:** AFK  
**Phase:** 4  
**Effort:** High  
**Review reference:** H-02, FALLOW-13

## Parent

[refactor-plan.md](../refactor-plan.md)

## What to build

Move `DamageTable` from `page.tsx` to `features/inspect-damage/components/DamageResultsTable.tsx`.

Uses `useDamageTablePreferences` from REF-12-16 and receives damage data via props (`damageRowsByEventId`, `channelMetadata`, `events`, `isCalculating`, `hasNoDamageChannels`).

## Acceptance criteria

- [ ] `DamageResultsTable.tsx` created; page no longer contains DamageTable function
- [ ] Column visibility popover, sort, filter, resize, tree expansion all work
- [ ] Empty state and `hasNoDamageChannels` banner unchanged
- [ ] `npm run build` passes

## Blocked by

- REF-12-16

## Agent notes

- Consider sharing header render helpers with database table only if FALLOW-08 already landed — do not block on FALLOW-08
