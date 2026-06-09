# REF-12-18: Thin inspect-damage page composer

**Type:** AFK  
**Phase:** 4  
**Effort:** Medium  
**Review reference:** H-02

## Parent

[refactor-plan.md](../refactor-plan.md)

## What to build

Reduce `client/src/app/inspect-damage/page.tsx` to layout composition:

- Auth guard
- `InspectDamageLayout` (optional wrapper): side panel + table card + `DamagePlotSidePanel`
- Wire `useDamageInspectMutation`, `useFilterState`, `useInspectDamageSelectedEvents`, results store
- Target **≤ 150 LOC** in page file

Export barrel `features/inspect-damage/index.ts`.

## Acceptance criteria

- [ ] Page file ≤ 150 lines
- [ ] Select events → Calculate → table + 3D plot flow works
- [ ] Session-selected events persist across refresh
- [ ] `npm run build` passes

## Blocked by

- REF-12-14
- REF-12-15
- REF-12-17

## Agent notes

- Re-run `npx gitnexus analyze` after completion per architecture review §10
