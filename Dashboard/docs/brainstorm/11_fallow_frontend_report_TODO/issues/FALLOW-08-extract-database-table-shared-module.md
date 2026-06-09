# FALLOW-08: Extract database/inspect-damage table shared module

**Type:** AFK  
**Effort:** High  
**Fallow category:** Duplication — clone family 3  
**Fallow evidence:** 164 lines duplicated across 8 clone groups between two page files

## What to build

`src/app/database/page.tsx` (~1046 LOC) and `src/app/inspect-damage/page.tsx` share substantial table-page infrastructure. Fallow clone family 3 reports **8 clone groups / 164 lines** between these pages, including:

- Filterable column header rendering
- Table preference parsing/persistence patterns
- Selection/delete handler scaffolding
- Pagination or scroll region setup
- Side-panel layout wiring

Extract shared hooks and presentational helpers (e.g. `useDatabaseTablePreferences`, `renderFilterableColumnHeader`, shared table toolbar fragments) into a module under `src/components/database-table/` or `src/lib/database-table/`.

Each page keeps only feature-specific columns, data sources, and actions.

## Acceptance criteria

- [ ] Shared database-table module extracted with no inspect-damage-specific or database-upload-specific imports in the base layer
- [ ] Clone family 3 groups are eliminated in `npx fallow dupes`
- [ ] Database page: upload, delete, filter, column resize, and batch select still work
- [ ] Inspect-damage page: damage columns, channel headers, load-data panel, and table filters still work
- [ ] `npm run build` and tests pass

## Blocked by

- FALLOW-07 (event tree dedup reduces overlap in load-data panels; optional but recommended first)

## Fallow finding reference

```
Clone family 3: 8 groups, 164 lines
- src/app/database/page.tsx ↔ src/app/inspect-damage/page.tsx
Includes groups 4–11 in Fallow dupes report
```
