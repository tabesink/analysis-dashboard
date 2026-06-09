# FALLOW-02: Delete confirmed unused files

**Type:** AFK  
**Effort:** Low  
**Fallow category:** Dead code — unused files  
**Fallow evidence:** 12 files with zero importers (5.7% dead-file rate)

## What to build

Delete source files that Fallow identifies as completely unreferenced. Before deleting each file, grep the repo to confirm no dynamic imports, test imports, or config references exist.

Files to delete:

- `src/components/dashboard/index.ts`
- `src/components/layout/NavDocuments.tsx`
- `src/components/layout/index.ts`
- `src/components/ui/avatar.tsx`
- `src/components/ui/button-group.tsx`
- `src/components/ui/pagination.tsx`
- `src/components/ui/sheet.tsx`
- `src/lib/chart-utils/index.ts`
- `src/lib/utils/index.ts`
- `src/lib/utils/partition-sync.ts`
- `src/stores/index.ts`
- `src/types/index.ts`

If any file is referenced only by another file in this delete list, delete both in the same PR.

## Acceptance criteria

- [ ] All 12 files are removed (or documented with `fallow-ignore` if a false positive is confirmed)
- [ ] No broken imports remain (`npm run build` passes)
- [ ] `npx fallow dead-code --unused-files` no longer lists these paths
- [ ] Dead-file rate drops below 5.7%
- [ ] Existing client tests pass

## Blocked by

None — can start immediately

## Fallow finding reference

```
### Unused files (12)
- src/components/dashboard/index.ts
- src/components/layout/NavDocuments.tsx
- src/components/layout/index.ts
- src/components/ui/avatar.tsx
- src/components/ui/button-group.tsx
- src/components/ui/pagination.tsx
- src/components/ui/sheet.tsx
- src/lib/chart-utils/index.ts
- src/lib/utils/index.ts
- src/lib/utils/partition-sync.ts
- src/stores/index.ts
- src/types/index.ts
```
