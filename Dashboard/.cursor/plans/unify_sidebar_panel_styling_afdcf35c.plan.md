---
name: Unify sidebar panel styling
overview: Unify the left-hand side panel styling across Database, Edit Events, and Dashboard pages to match the Edit Events page design, while applying SOLID principles by extracting shared components and eliminating code duplication.
todos:
  - id: extract-section
    content: Create shared SidePanelSection component in components/shared/, delete old SidebarSection from interactive-viewer, update CurveSelector import
    status: completed
  - id: refactor-edit-events
    content: Refactor Edit Events page to use SidePanelLayout + ScrollArea instead of inline sidebar code
    status: completed
  - id: database-headers-spacing
    content: Add panel-level header to DatabaseSidePanel, update spacing to space-y-5
    status: completed
  - id: restyle-upload-section
    content: Remove bg-muted/30 container from UploadDataSection, use SidePanelSection, revert to default shadcn form controls, text-xs labels
    status: completed
  - id: restyle-database-section
    content: Remove bg-muted/30 container from DatabaseSection, use SidePanelSection
    status: completed
  - id: dashboard-header-spacing
    content: Add panel-level header to Dashboard SidePanel, update spacing to space-y-5
    status: completed
  - id: restyle-global-filters
    content: Remove bg-muted/30 container from GlobalFilters, use SidePanelSection
    status: completed
  - id: restyle-partition-section
    content: Remove bg-muted/30 container from PartitionSection, use SidePanelSection
    status: completed
  - id: cleanup-verify
    content: Clean up orphaned exports, verify no remaining inconsistent styling, run linter
    status: completed
isProject: false
---

# Unify Left-Hand Sidebar Panel Styling

## Design Decisions (Resolved)

- **Panel width**: Flexible -- 320px for Edit Events/Database, 400px for Dashboard
- **Section containers**: Remove `bg-muted/30 rounded-lg p-4` from all section components
- **Title hierarchy**: One `h2 text-base font-semibold tracking-tight` panel-level title per sidebar, `text-sm font-semibold` for sub-section titles
- **Panel titles**: Database: "Database Management", Dashboard: "Data Selection", Edit Events: "Edit Metadata" (existing)
- **Section toggles**: Keep Plus/Minus expand/collapse on all sections
- **Spacing**: Standardize to Edit Events: `space-y-5`, `mt-1`, `text-xs` labels
- **Form controls**: Default shadcn Select/Input styling everywhere
- **SOLID**: Edit Events refactored to use `SidePanelLayout`; extract shared `SidePanelSection`

---

## Step 1: Extract shared `SidePanelSection` component

An existing `[SidebarSection](Dashboard/client/src/components/dashboard/interactive-viewer/SidebarSection.tsx)` already implements the expand/collapse section pattern but has `bg-muted/30 rounded-lg p-4` hardcoded and lives in the wrong directory.

**Actions:**

- Create `[components/shared/SidePanelSection.tsx](Dashboard/client/src/components/shared/SidePanelSection.tsx)` based on the existing `SidebarSection`, with these changes:
  - Remove `bg-muted/30 rounded-lg p-4` container (flat content, no card)
  - Change subtitle margin from `mt-0.5` to `mt-1`
  - Move `SidePanelSectionProps` interface into the file (decouple from interactive-viewer types)
- Export from `[components/shared/index.ts](Dashboard/client/src/components/shared/index.ts)`
- Update `[CurveSelector](Dashboard/client/src/components/dashboard/interactive-viewer/CurveSelector.tsx)` to import from `@/components/shared` instead of local `SidebarSection`
- Delete the old `[SidebarSection.tsx](Dashboard/client/src/components/dashboard/interactive-viewer/SidebarSection.tsx)` and clean up its exports from `[interactive-viewer/index.ts](Dashboard/client/src/components/dashboard/interactive-viewer/index.ts)` and `[types.ts](Dashboard/client/src/components/dashboard/interactive-viewer/types.ts)`

## Step 2: Refactor Edit Events sidebar to use `SidePanelLayout`

The Edit Events page at `[app/database/edit/page.tsx](Dashboard/client/src/app/database/edit/page.tsx)` (lines 506-528) duplicates ~30 lines of `SidePanelLayout` code inline.

**Actions:**

- Replace the inline sidebar wrapper (lines 506-528) with `<SidePanelLayout isCollapsed={sidePanelCollapsed} onToggleCollapse={...} expandedWidth="w-[320px]">`
- Wrap content in `<ScrollArea>` for consistency
- Remove the local `sidePanelCollapsed` `useState` toggle and replace with the same pattern (or keep local state -- it's a page-level concern)
- Keep the existing content structure (h2 title, selects, summary box, clear button) as-is since it's already the target style

## Step 3: Add panel-level headers to Database and Dashboard sidebars

Neither sidebar currently has a panel-level title.

**Actions on `[DatabaseSidePanel.tsx](Dashboard/client/src/components/upload/DatabaseSidePanel.tsx)`:**

- Add a header block before the ScrollArea content:

```tsx
<div className="p-5 pb-0">
  <h2 className="text-base font-semibold tracking-tight">Database Management</h2>
  <p className="text-xs text-muted-foreground mt-1">Upload data and manage database.</p>
</div>
```

**Actions on `[SidePanel.tsx](Dashboard/client/src/components/dashboard/side-panel/SidePanel.tsx)`:**

- Add a header block similarly:

```tsx
<div className="p-5 pb-0">
  <h2 className="text-base font-semibold tracking-tight">Data Selection</h2>
  <p className="text-xs text-muted-foreground mt-1">Filter and select events for analysis.</p>
</div>
```

## Step 4: Restyle Database section components

**Actions on `[UploadDataSection.tsx](Dashboard/client/src/components/upload/UploadDataSection.tsx)`:**

- Remove outer `bg-muted/30 rounded-lg p-4 space-y-4` container
- Replace inline header + toggle pattern with `<SidePanelSection title="Upload Data" subtitle="...">`
- Revert compact input styling (`h-6 rounded-none border-0 border-t bg-muted/30`) to default shadcn `<Input>` and `<Select>` components
- Replace `text-label` (11px) labels with `text-xs` (12px) to match Edit Events
- Update subtitle margin to `mt-1`

**Actions on `[DatabaseSection.tsx](Dashboard/client/src/components/upload/DatabaseSection.tsx)`:**

- Remove outer `bg-muted/30 rounded-lg p-4 space-y-4` container
- Replace inline header + toggle pattern with `<SidePanelSection title="Database" subtitle="...">`
- Update subtitle margin to `mt-1`

**Actions on `[DatabaseSidePanel.tsx](Dashboard/client/src/components/upload/DatabaseSidePanel.tsx)`:**

- Change inner spacing from `space-y-6` to `space-y-5`

## Step 5: Restyle Dashboard section components

**Actions on `[GlobalFilters.tsx](Dashboard/client/src/components/dashboard/side-panel/GlobalFilters.tsx)`:**

- Remove outer `bg-muted/30 rounded-lg p-4 space-y-4` container (line 183)
- Replace inline header + toggle pattern with `<SidePanelSection>`
- Update subtitle margin to `mt-1`

**Actions on `[PartitionSection.tsx](Dashboard/client/src/components/dashboard/side-panel/PartitionSection.tsx)`:**

- Remove outer `bg-muted/30 rounded-lg p-4 space-y-4 overflow-x-auto` container (line 136)
- Replace inline header + toggle pattern with `<SidePanelSection>`
- Update subtitle margin from `mt-0.5` to `mt-1`

**Actions on `[SidePanel.tsx](Dashboard/client/src/components/dashboard/side-panel/SidePanel.tsx)`:**

- Change inner spacing from `space-y-6` to `space-y-5`

## Step 6: Cleanup

- Remove orphaned `SidebarSection` re-exports from interactive-viewer barrel
- Remove `SidebarSectionProps` from interactive-viewer `types.ts`
- Verify no remaining `text-label` usage in sidebar contexts (grep for it)
- Verify no remaining `bg-muted/30` on sidebar section components

---

## Files Changed Summary


| File                                                         | Action                                                          |
| ------------------------------------------------------------ | --------------------------------------------------------------- |
| `components/shared/SidePanelSection.tsx`                     | **Create** -- shared section component                          |
| `components/shared/index.ts`                                 | Add export                                                      |
| `app/database/edit/page.tsx`                                 | Refactor to use `SidePanelLayout`                               |
| `components/upload/DatabaseSidePanel.tsx`                    | Add panel header, update spacing                                |
| `components/upload/UploadDataSection.tsx`                    | Remove container, use `SidePanelSection`, default shadcn inputs |
| `components/upload/DatabaseSection.tsx`                      | Remove container, use `SidePanelSection`                        |
| `components/dashboard/side-panel/SidePanel.tsx`              | Add panel header, update spacing                                |
| `components/dashboard/side-panel/GlobalFilters.tsx`          | Remove container, use `SidePanelSection`                        |
| `components/dashboard/side-panel/PartitionSection.tsx`       | Remove container, use `SidePanelSection`                        |
| `components/dashboard/interactive-viewer/CurveSelector.tsx`  | Update import path                                              |
| `components/dashboard/interactive-viewer/SidebarSection.tsx` | **Delete**                                                      |
| `components/dashboard/interactive-viewer/index.ts`           | Remove old exports                                              |
| `components/dashboard/interactive-viewer/types.ts`           | Remove `SidebarSectionProps`                                    |


## Verification

- Visual: All three sidebars share the same panel shell, typography scale, spacing, and form control styling
- SOLID: Single `SidePanelLayout` for panel shell, single `SidePanelSection` for collapsible sections
- DRY: No duplicated wrapper code in Edit Events page
- No linter errors introduced

