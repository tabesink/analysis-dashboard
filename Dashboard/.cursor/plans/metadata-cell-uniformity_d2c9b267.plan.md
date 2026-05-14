---
name: metadata-cell-uniformity
overview: Refine the Edit Metadata Filter Values layout for consistent card styling/height, repositioned phases styling parity, and split weight inputs into separate cells with updated GVW label.
todos:
  - id: normalize-cell-style
    content: Restyle Applicable Phases and related cards to match uniform visual treatment and min-height.
    status: completed
  - id: split-weight-cards
    content: Replace grouped Weight Inputs section with three independent GVW/FGAWR/RGAWR cells.
    status: completed
  - id: rename-gvw-label
    content: Change RAW_WEIGHT_FIELDS label from Gross Vehicle Weight to GVW and verify bindings.
    status: completed
  - id: validate-and-doc
    content: Run lint for edited file and append a short completion note to activity doc.
    status: completed
isProject: false
---

# Edit Metadata Cell Uniformity Plan

## Scope

Update the Filter Values tab in `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/app/database/edit/page.tsx](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/app/database/edit/page.tsx)` to match the activity note in `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/docs/activity/2026-03-10..md](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/docs/activity/2026-03-10..md)`.

## Implementation Steps

- Normalize card visuals for all top-level cells in the two-column metadata layout:
  - Remove the special bordered styling from the current `Applicable Phases` cell.
  - Use the same container treatment as metadata cards (`rounded-md`, `p-3`, `space-y-3`, `bg-muted/50`).
  - Apply a shared minimum height class to key cards so cells read as uniform height while still allowing content growth.
- Keep `Applicable Phases` in the second column top position, but restyle it to match other cells and preserve single-row checkbox layout (`grid-cols-4`).
- Replace the grouped `Weight Inputs` card with 3 separate weight cells so each appears as an individual card:
  - `GVW (lbs)`
  - `FGAWR (lbs)`
  - `RGAWR (lbs)`
  Each cell will render its own label + input using existing `setWeightFieldValue` and `draftValues` bindings.
- Update weight field label source in `RAW_WEIGHT_FIELDS` from `Gross Vehicle Weight (lbs)` to `GVW (lbs)` so UI text and draft mapping stay aligned.
- Verify no regressions in disabled-state behavior (`!selectedProgramId || !selectedVersion || isSaving`) and ensure lint passes for edited file.

## Documentation Follow-up

- Add a brief entry to `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/docs/activity/2026-03-10..md](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/docs/activity/2026-03-10..md)` describing completion of this UI pass.
- If this is treated as a tracked task completion, follow project rules to update:
  - `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/docs/master-build-plan.md](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/docs/master-build-plan.md)`
  - `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/docs/decisions/log.md](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/docs/decisions/log.md)`
  - task note file in `docs/tasks/` only if this change is considered non-trivial under your workflow.

