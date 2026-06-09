# FALLOW-06: Extract shared route error boundary

**Type:** AFK  
**Effort:** Low  
**Fallow category:** Duplication — clone family 1  
**Fallow evidence:** 18-line clone across 3 route `error.tsx` files

## What to build

Three Next.js App Router error boundaries contain identical logic:

- `src/app/dashboard/error.tsx`
- `src/app/database/error.tsx`
- `src/app/database/edit/error.tsx`

Extract a shared `RouteErrorFallback` (or similar) component under `src/components/shared/` that accepts the App Router `error` and `reset` props. Each route `error.tsx` becomes a thin re-export/default wrapper.

Preserve existing user-visible error text, retry behavior, and styling.

## Acceptance criteria

- [ ] Shared error component exists and is used by all three route error files
- [ ] Clone group 1 (18 lines × 3 instances) is eliminated in `npx fallow dupes`
- [ ] Manual smoke: triggering an error on dashboard, database, and database/edit routes still shows the fallback UI with a working reset action
- [ ] `npm run build` and tests pass

## Blocked by

None — can start immediately

## Fallow finding reference

```
Clone group 1 (18 lines, 3 instances)
- src/app/dashboard/error.tsx:6-23
- src/app/database/edit/error.tsx:6-23
- src/app/database/error.tsx:6-23
```
