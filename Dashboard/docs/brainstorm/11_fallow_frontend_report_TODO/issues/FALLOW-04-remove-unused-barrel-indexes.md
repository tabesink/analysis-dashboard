# FALLOW-04: Remove unused barrel `index.ts` modules

**Type:** AFK  
**Effort:** Low  
**Fallow category:** Dead code — unused exports (barrel files)  
**Fallow evidence:** Multiple `index.ts` barrels with 100% dead re-exports

## What to build

The codebase has barrel `index.ts` files that re-export symbols nobody imports through the barrel. After FALLOW-02 removes the fully dead barrel files, update remaining barrels to export only symbols that are actually consumed via the barrel path.

Affected barrels (from Fallow unused-export report):

- `src/components/charts/index.ts` — 11 dead re-exports
- `src/components/dashboard/shared/index.ts` — 4 dead re-exports
- `src/components/dashboard/side-panel/index.ts` — 2 dead re-exports
- `src/components/shared/index.ts` — 2 dead re-exports + 1 dead type
- `src/components/upload/index.ts` — 13 dead re-exports/types
- `src/hooks/index.ts` — 18 dead re-exports
- `src/lib/api/index.ts` — 12 dead re-exports
- `src/modules/dashboard-workspace/index.ts` — 9 dead re-exports/types

Preferred approach: remove dead re-exports from barrels rather than deleting barrels that are still partially used. Update call sites to import directly from source modules where barrels add no value.

## Acceptance criteria

- [ ] No barrel file re-exports a symbol with zero importers (verify with `npx fallow dead-code --unused-exports`)
- [ ] Direct imports are used where barrels were only adding indirection
- [ ] Unused-export count drops materially from 126
- [ ] `npm run build` and tests pass

## Blocked by

- FALLOW-02 (removes fully dead barrel files first)

## Fallow finding reference

See `00_AUDIT_SUMMARY.md` § Unused exports — all `index.ts` entries.
