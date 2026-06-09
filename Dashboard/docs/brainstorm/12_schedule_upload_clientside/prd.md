# PRD: Edit Metadata Schedule Upload (Client-Side UI)

**Feature area:** Edit Metadata sidepanel (`/database/edit`)  
**Iteration:** Client-side UI shell only  
**Last updated:** 2026-06-08

---

## Problem Statement

The Edit Metadata workflow lets writers update program/version metadata for uploaded events, but its left sidepanel does not match the visual structure of the Database route sidepanel. Engineers working across both routes see inconsistent section headers, spacing, and upload affordances.

There is also no UI surface to attach a durability schedule file to a selected program/version. Autodam `.sch` schedule files are part of the domain workflow (see notebook exploration of schedule parsing and RSP filename matching), but the Edit Metadata page offers no place to select or stage a schedule before backend support exists.

## Solution

Restructure the Edit Metadata sidepanel into two collapsible sections separated by a horizontal divider, matching the Database route pattern:

1. **Select Dataset** — existing program ID, version, selection summary, and Clear controls.
2. **Upload Schedule** — a shared file drop zone (same styling as Database "Upload CSV/RSP files") that accepts `.sch` files only.

The upload zone is **ghosted** (reduced opacity, no pointer interaction) until both Program ID and Version are selected. File selection is held in local component state only; no server upload, parsing, or persistence in this iteration.

## User Stories

1. As a write user on Edit Metadata, I want the sidepanel to use the same section header typography and spacing as the Database route, so that the workspace feels consistent across routes.
2. As a write user, I want the sidepanel divided into "Select Dataset" and "Upload Schedule" sections with a horizontal divider between them, so that I can distinguish dataset selection from schedule staging.
3. As a write user, I want each section to be collapsible via the shared sidepanel section control, so that I can focus screen space on the task I am performing.
4. As a write user, I want the Select Dataset section to retain Program ID and Version dropdowns, so that I can scope metadata edits to a program/version group.
5. As a write user, I want the Current Selection Summary card to remain visible in Select Dataset, so that I can see audit fields (last update, upload info, status) for my selection.
6. As a write user, I want the Clear button to remain in Select Dataset and clear draft metadata fields, so that I can reset form values without changing my program/version selection.
7. As a write user, I want the Upload Schedule section to show a subtitle explaining that I must select program ID and version first when nothing is selected, so that I understand why upload is unavailable.
8. As a write user, I want the Upload Schedule drop zone to appear ghosted when program ID or version is missing, so that I cannot accidentally attempt a schedule selection without context.
9. As a write user, I want the Upload Schedule drop zone to become interactive once both program ID and version are selected, so that I can pick a schedule file for that scope.
10. As a write user, I want the schedule drop zone to accept only `.sch` files, so that I am guided toward the correct autodam durability schedule format.
11. As a write user, I want the schedule drop zone to use the same icon, dashed border, and label styling as the Database upload drop zone, so that upload affordances are recognizable across the app.
12. As a write user, I want to see the selected schedule filename after choosing a file, so that I can confirm my selection before a future upload action exists.
13. As a write user, I want the selected schedule file to clear when I change program ID or version, so that a schedule is never implicitly associated with the wrong scope.
14. As a write user, I want to clear a selected schedule file without changing my program/version selection, so that I can pick a different file.
15. As a write user, I want drag-and-drop and click-to-browse to work on the schedule drop zone when enabled, so that I can use my preferred file selection method.
16. As a read-only user, I want Edit Metadata to remain inaccessible (existing route guard), so that schedule UI does not bypass write permissions.
17. As a developer, I want the drop zone extracted into a shared component reused by Database upload and Edit Metadata schedule sections, so that styling drift is minimized.
18. As a developer, I want Edit Metadata sidepanel composition extracted into dedicated components, so that future backend wiring has a clear insertion point.
19. As a developer, I want the schedule section to accept an `enabled` prop derived from selection state, so that gating logic stays declarative and testable.
20. As a developer, I want a `selectionKey` prop to reset local file state on scope change, so that stale selections do not persist across program/version changes.
21. As a product owner, I want this iteration to ship without backend changes, so that UI parity and placement can be validated before API design.
22. As a product owner, I want the PRD to document out-of-scope backend work explicitly, so that a follow-up iteration can add persistence without re-litigating UI decisions.
23. As an engineer preparing backend work, I want the UI to reserve space for a future upload/import action button, so that the next iteration can add server integration without another layout refactor.
24. As an engineer, I want schedule upload gated on the same program/version pair used for metadata save, so that future server contracts align with existing bulk metadata scope.
25. As a QA engineer, I want visual parity checks between Database and Edit Metadata sidepanels, so that regressions in shared components are caught early.

## Implementation Decisions

### Shared file drop zone module

Extract a `FileDropZone` shared component encapsulating:
- Hidden file input + styled label drop target
- Drag-over, drag-leave, and drop handlers
- `disabled` prop applying ghost styles (`opacity-50`, `pointer-events-none`, `cursor-not-allowed`)
- Props: `inputId`, `accept`, `multiple`, `disabled`, `primaryLabel`, `hint`, `onFilesSelected`

Refactor the Database `UploadDataSection` to consume `FileDropZone` with no visual change.

### Edit Metadata sidepanel modules

Introduce three components mirroring the Database sidepanel composition pattern:

| Module | Responsibility |
|--------|----------------|
| `SelectDatasetSection` | `SidePanelSection` wrapper for program/version selects, summary card, Clear |
| `UploadScheduleSection` | `SidePanelSection` + ghosted `FileDropZone`; local `selectedFile` state |
| `EditMetadataSidePanel` | `SidePanelLayout` + `ScrollArea` + `p-5 space-y-5` + `Separator` between sections |

The edit page remains the data/save orchestrator; only sidepanel presentation moves out.

### Section layout contract

Match Database route tokens:
- Container padding/gap: `p-5 space-y-5`
- Section divider: Radix `Separator` (horizontal, `bg-border`)
- Section headers: `SidePanelSection` (`text-base font-semibold tracking-tight` title, `text-xs text-muted-foreground mt-1` subtitle)
- Field labels: `text-xs font-medium text-muted-foreground`

### Disabled / enabled gating

```
enabled = Boolean(selectedProgramId && selectedVersion)
```

When disabled:
- Drop zone ghosted
- Subtitle: "Select program ID and version to upload a schedule"
- Drag handlers no-op; file input disabled

When enabled:
- Drop zone interactive
- Subtitle: "Select a .sch durability schedule file" (or selected filename when chosen)
- Accept filter: `.sch` only

On `selectionKey` change (program:version string), clear local selected file.

### No API contract (this iteration)

No new endpoints, schema tables, or server routes. Selected `.sch` file exists only in React state inside `UploadScheduleSection`.

### Future domain context

Autodam `.sch` files contain:
- `*id` schedule identifier
- `*multiplier` global multiplier
- Glob-pattern entries (`*pattern* repeats weight`)

Future backend work will likely parse this format (notebook prototype exists) and associate schedule artifacts with a `program_id` + `version` scope. UI placement in Edit Metadata aligns with program-version metadata ownership.

## Testing Decisions

### What makes a good test

Test externally visible behavior only: disabled vs enabled interaction, file type acceptance, selection reset on scope change, and rendered labels — not internal state variable names.

### Modules to test

| Module | Tests |
|--------|-------|
| `FileDropZone` | Renders label/hint; `disabled` blocks file callback; drag/drop calls `onFilesSelected` when enabled |
| `UploadScheduleSection` | Ghosted when `enabled=false`; accepts `.sch`; clears file when `selectionKey` changes |
| `EditMetadataSidePanel` | Renders both sections and separator (smoke) |

### Prior art

Follow existing client component test patterns under `client/src/**/__tests__`. No server tests in this iteration.

### Manual verification

- Edit Metadata sidepanel section headers and divider match Database route
- Upload Schedule ghosted without full selection; interactive with both selected
- Database upload UI unchanged after `FileDropZone` extraction
- `npm run build` passes

## Out of Scope

- Backend API for schedule upload or storage
- `.sch` file parsing (client or server)
- Schedule-to-RSP event matching logic
- Import/upload progress, cancel, or error toasts for schedule files
- Admin-only restrictions on schedule upload (inherits existing Edit Metadata write guard only)
- Persisting selected schedule across page refresh
- Replacing or modifying metadata save flow
- Full `FilterValuesPage` decomposition (see FALLOW-13)

## Further Notes

- Canonical route: `/database/edit` (legacy `/database/filter-values` redirects).
- Schedule upload UI is a staging surface for a follow-up iteration that will add server persistence and likely reuse upload-task or artifact storage patterns.
- FALLOW-13 tracks broader edit-page refactor; this work extracts only the sidepanel without touching main editor tabs or save orchestration.
- When backend lands, expect a scoped endpoint (e.g., program-version schedule artifact) with ownership checks and cache invalidation consistent with DEC-003 program-version metadata writes.
