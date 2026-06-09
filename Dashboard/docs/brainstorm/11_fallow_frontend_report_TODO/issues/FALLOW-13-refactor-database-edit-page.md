# FALLOW-13: Refactor database edit page complexity

**Type:** AFK  
**Effort:** High  
**Fallow category:** Complexity hotspot  
**Fallow evidence:** CRAP 4692; 1328 LOC page component

## What to build

`src/app/database/edit/page.tsx` is the second-highest complexity hotspot. Fallow flags:

| Function | Cyclomatic | Cognitive | CRAP | Lines |
|----------|----------:|----------:|-----:|------:|
| `FilterValuesPage` (page default) | 68 | 44 | 4692 | 1147 |
| `<arrow>` (inline handler) | 24 | 11 | 600 | 91 |
| `handleSave` | 15 | 13 | 240 | 89 |
| `handleSaveChannelMap` | 12 | 11 | 156 | 47 |

Split the page into feature components:

- Channel map editor section
- Filter values editor section
- Metadata field editor section
- Save/cancel action bar

Extract data-loading and save orchestration into hooks (`useChannelMapEditor`, `useFilterValuesEditor`). Keep the page file as a layout composer under 150 LOC.

## Acceptance criteria

- [ ] Page file reduced to layout composition; no function with cyclomatic > 20
- [ ] `FilterValuesPage` no longer appears as a single 1100+ LOC function in Fallow
- [ ] File CRAP risk drops below 30
- [ ] Channel map edit, filter value edit, metadata edit, and save flows work end-to-end
- [ ] Error and loading states preserved
- [ ] `npm run build` and tests pass

## Blocked by

None — can start immediately

## Fallow finding reference

```
File health: database/edit/page.tsx — Risk 4692.0
Refactoring target (efficiency 5.8): Extract FilterValuesPage (cognitive: 44)
  in 1328-LOC file
```
