# REF-12-07: Extract MetadataFieldsTab component

**Type:** AFK  
**Phase:** 1  
**Effort:** Medium  
**Review reference:** H-01, FALLOW-13

## Parent

[refactor-plan.md](../refactor-plan.md)

## What to build

Move the **Edit Metadata** tab UI (filter values form: status, two-column metadata selects, phase checkboxes, weight fields) from `page.tsx` into `MetadataFieldsTab.tsx`.

Component receives props from `useMetadataDraft` and `useProgramVersionSelection` — no direct API calls inside the tab.

Remove inline IIFE rendering pattern; use straightforward JSX.

## Acceptance criteria

- [ ] `MetadataFieldsTab.tsx` under `features/edit-metadata/components/`
- [ ] Tab renders identically: field order, admin status lock, mixed-value placeholders, disabled states
- [ ] Page `TabsContent value="filter-values"` only mounts `<MetadataFieldsTab ... />`
- [ ] No new `useQuery` calls inside tab
- [ ] `npm run build` passes

## Blocked by

- REF-12-06

## Agent notes

- Largest UI chunk in the page — extract mechanically first, simplify layout in a follow-up only if needed
- Keep `getFieldSelectLabel` with draft hook or pass as prop
