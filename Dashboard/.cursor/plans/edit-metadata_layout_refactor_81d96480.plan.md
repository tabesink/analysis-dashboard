---
name: edit-metadata_layout_refactor
overview: Refactor the Edit Metadata page into a Database-style split-pane layout at `/database/edit`, keep existing filter-value editing behavior, replace custom-fields tab with a local under-construction placeholder, and preserve compatibility via redirect from old route.
todos:
  - id: p8-14-route-layout
    content: Create `/database/edit` page with Database-style split-pane shell and preserve existing edit/save logic.
    status: completed
  - id: p8-14-tabs-placeholder
    content: Keep Filter Values two-column reuse and replace Custom Fields content with local under-construction placeholder.
    status: completed
  - id: p8-14-routing-config
    content: Add old-route redirect and update sidebar/header/nav route references to `/database/edit`.
    status: completed
  - id: p8-14-validation-docs
    content: Run lint checks for touched files and update master plan, decision log, and task notes for completed work.
    status: completed
isProject: false
---

# Edit Metadata Split-Pane Refactor

## Scope

Implement the approved visual/layout refactor and route rename for Edit Metadata while preserving existing metadata edit/save behavior.

## Files to Change

- [client/src/app/database/filter-values/page.tsx](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/app/database/filter-values/page.tsx)
- [client/src/app/database/edit/page.tsx](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/app/database/edit/page.tsx)
- [client/src/config/sidebar-config.ts](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/config/sidebar-config.ts)
- [client/src/config/header-config.ts](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/config/header-config.ts)
- [client/src/components/layout/NavMain.tsx](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/components/layout/NavMain.tsx)
- [client/public/images/edit-metadata-under-construction.gif](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/public/images/edit-metadata-under-construction.gif)
- [docs/master-build-plan.md](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/docs/master-build-plan.md)
- [docs/decisions/log.md](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/docs/decisions/log.md)
- [docs/tasks/P8-14.md](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/docs/tasks/P8-14.md)

## Implementation Steps

1. Add new route page at `/database/edit` by moving current Edit Metadata implementation there and preserving all existing data-fetch/save logic.
2. Convert page shell to Database-style split panes:
  - left sticky collapsible panel (`320px` / `56px`) with `Edit Metadata`, Program ID + Version selectors, and `Current Selection Summary`.
  - right dominant card surface with tabs and toolbar-style header.
3. Keep Filter Values tab two-column metadata editor behavior unchanged.
4. Replace Custom Fields tab content with local GIF + `Under Construction` placeholder.
5. Add compatibility redirect at old route `/database/filter-values` to `/database/edit`.
6. Update navigation/header mappings and active-item logic to use `/database/edit`.
7. Run lint diagnostics for touched files and fix introduced issues.
8. Update project docs per AGENTS requirements for this non-trivial change.

## Verification

- `/database/edit` renders split-pane layout with collapse toggle and sticky left panel.
- Program/version selection and save/reset still work.
- Filter Values remains two-column.
- Custom Fields tab only shows local placeholder GIF + label.
- `/database/filter-values` redirects to `/database/edit`.
- Sidebar/header labels resolve correctly for new route.

