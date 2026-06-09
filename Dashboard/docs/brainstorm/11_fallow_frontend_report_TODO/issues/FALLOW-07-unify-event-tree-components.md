# FALLOW-07: Unify hierarchical event tree components

**Type:** AFK  
**Effort:** High  
**Fallow category:** Duplication — clone families 6, 7, 10  
**Fallow evidence:** ~494 duplicated lines between event tree components

## What to build

Three event-tree implementations share substantial logic:

- `src/components/dashboard/shared/HierarchicalEventTree.tsx` (~592 LOC region)
- `src/components/upload/DatabaseEventTree.tsx` (~520 LOC region)
- `src/components/damage/DamageEventTree.tsx` (partial overlap)

Fallow reports clone family 10 as the highest-impact duplication: **475 lines** duplicated between `HierarchicalEventTree` and `DatabaseEventTree`, plus smaller clones with `DamageEventTree`.

Extract a shared module (e.g. `src/components/shared/event-tree/`) containing:

- Indeterminate checkbox behavior
- Group expand/collapse state (`getGroupState`)
- Tree row rendering primitives
- Roll-up status helpers (`rollUpStatusFromValues`)

Each feature-specific tree becomes a thin composition layer passing feature-specific props (colors, selection scope, damage badges, etc.).

## Acceptance criteria

- [ ] Shared event-tree primitives module exists with no feature-specific imports
- [ ] `HierarchicalEventTree`, `DatabaseEventTree`, and `DamageEventTree` use the shared module
- [ ] Clone families 6, 7, and 10 are eliminated or reduced below Fallow mild threshold
- [ ] Dashboard load-data tree, database upload tree, and inspect-damage tree still support expand/collapse, batch select, and indeterminate parent checkboxes
- [ ] `npm run build` and tests pass
- [ ] Duplication rate drops measurably from 7.5%

## Blocked by

None — can start immediately

## Fallow finding reference

```
Clone family 10: 494 lines — HierarchicalEventTree.tsx ↔ DatabaseEventTree.tsx
Clone group 14: 41 lines — DamageEventTree.tsx ↔ DatabaseEventTree.tsx
Clone group 15: 27 lines — DamageEventTree.tsx ↔ HierarchicalEventTree.tsx
```
