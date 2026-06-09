# REF-12-10: Thin edit page + feature module layout

**Type:** AFK  
**Phase:** 1  
**Effort:** Medium  
**Review reference:** H-01, FALLOW-13

## Parent

[refactor-plan.md](../refactor-plan.md) · [FALLOW-13](../../11_fallow_frontend_report_TODO/issues/FALLOW-13-refactor-database-edit-page.md)

## What to build

Complete FALLOW-13 by reducing `client/src/app/database/edit/page.tsx` to a thin composer:

- Auth guard + loading shell
- `EditMetadataSidePanel` + tab shell with action bar (Copy/Paste, Reset/Restore, Save)
- `MetadataFieldsTab`, `ChannelMapTab`, `DurabilityScheduleTab` (stub component with existing empty-state message)
- Default export renamed to `EditMetadataPage` (re-export from feature module acceptable)

Target: **page file under 150 LOC**; no function with cyclomatic complexity > 20 in the page file.

Move remaining side panel files into `features/edit-metadata/components/` and update `components/edit-metadata/index.ts` to re-export for backward compatibility.

## Acceptance criteria

- [ ] `client/src/app/database/edit/page.tsx` ≤ 150 lines
- [ ] `DurabilityScheduleTab.tsx` stub extracted (no new behavior)
- [ ] `npx fallow health` shows edit page CRAP risk below 30 (or document score in PR if tooling unavailable)
- [ ] Metadata save, channel map save, side panel schedule staging work end-to-end
- [ ] `npm run build` passes
- [ ] FALLOW-13 acceptance criteria satisfied

## Blocked by

- REF-12-07
- REF-12-09

## Agent notes

- This issue closes FALLOW-13 — reference it in PR description
- Hide or disable unwired **Extract** button in `UploadScheduleSection` if still a no-op (optional 1-line fix)
