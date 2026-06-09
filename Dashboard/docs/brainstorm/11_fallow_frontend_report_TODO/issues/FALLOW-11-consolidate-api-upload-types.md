# FALLOW-11: Consolidate duplicated API/upload type shapes

**Type:** AFK  
**Effort:** Medium  
**Fallow category:** Duplication — clone family 18  
**Fallow evidence:** 41 lines duplicated across type definition files

## What to build

Type definitions for upload/API responses are copy-pasted across:

- `src/types/api.ts`
- `src/types/upload.ts`

Fallow clone groups 30–31 and family 18 flag **20–21 line** duplicated interface blocks appearing 2–3 times (e.g. shared metadata shapes, paginated response wrappers, dataset info structs).

Identify the canonical type for each duplicated shape. Define it once in `src/types/` (either `api.ts` or a new `src/types/shared.ts`) and re-export from the feature-specific type files if needed for backward compatibility.

## Acceptance criteria

- [ ] Duplicated interface blocks between `api.ts` and `upload.ts` are consolidated to single definitions
- [ ] Clone groups 30, 31, and family 18 are eliminated
- [ ] All API client modules (`lib/api/*.ts`) compile without type errors
- [ ] Upload and database flows retain correct TypeScript types at boundaries
- [ ] `npm run build` and tests pass

## Blocked by

None — can start immediately

## Fallow finding reference

```
Clone family 18: 2 groups, 41 lines — api.ts ↔ upload.ts
Clone group 30: 21 lines (api.ts:13-33 ↔ upload.ts:70-90)
Clone group 31: 20 lines (3 instances across api.ts and upload.ts)
```
