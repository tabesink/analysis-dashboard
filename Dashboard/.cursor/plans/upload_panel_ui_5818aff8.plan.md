---
name: upload panel ui
overview: Redesign the Database upload section to use one screenshot-style drag/drop upload card with an `Import` CTA, while keeping the existing metadata fields and CSV/RSP/channel-map validation flow.
todos:
  - id: replace-picker-card
    content: Replace dual picker buttons with one dashed drag/drop upload card
    status: completed
  - id: preserve-validation-list
    content: Preserve and restyle selected file list plus validation messages
    status: completed
  - id: update-actions-progress
    content: Change action row to Cancel/Import and keep progress behavior
    status: completed
  - id: verify-upload-ui
    content: Run type/lint checks and manual upload smoke checklist
    status: completed
isProject: false
---

# Database Upload Panel UI Plan

## Decisions Resolved

- **Single control:** Replace the current separate `Select Folder` and `Select Files` buttons with one large dashed drag/drop card. Clicking the card opens a normal multi-file picker. Drag/drop accepts whatever files the browser provides, including folder contents when available.
- **Metadata:** Keep existing required metadata fields below the new upload card in the same `Upload Data` section.
- **Copy:** Use screenshot-style CTA language: primary button `Import`, dropzone copy `Drag & Drop or Choose CSV/RSP files to upload`, helper text adapted to `CSV/RSP files plus channel_map.yaml/.yml`.

## Implementation Steps

1. Refactor `[client/src/components/upload/UploadDataSection.tsx](client/src/components/upload/UploadDataSection.tsx)` upload picker UI.
  - Remove the two-button `Select Folder` / `Select Files` grid.
  - Add one hidden multi-file input with `accept=".csv,.rsp,.yaml,.yml"`.
  - Add a label/dropzone styled like `[.references/upload-side-panel/UploadDataSection.tsx](.references/upload-side-panel/UploadDataSection.tsx)`:
    - dashed border
    - centered upload cloud icon
    - main copy and helper text
    - hover and drag-active background/border state
  - Use the existing `onFilesChange(File[])` prop so the page-level upload logic remains unchanged.
2. Add drag/drop state and handlers in `UploadDataSection`.
  - Track `isDraggingFiles` locally.
  - On drag over/enter, prevent default and show active styling.
  - On drop, read `event.dataTransfer.files`, convert to `File[]`, and call `onFilesChange(files)`.
  - Keep this bloat-free: do not add recursive browser-specific folder traversal unless manual testing shows dropped folders are not surfaced as files in the target browser.
3. Restyle the selected-file list to match the reference.
  - Keep the current selected file list behavior and per-file remove action.
  - Swap the visual treatment toward the reference: compact list, `FileText`/file icon, ghost remove button, `Clear` action.
  - Preserve current CSV/RSP/channel-map validation messages:
    - missing channel map
    - no CSV/RSP data files
    - mixed CSV/RSP rejection
    - ignored unrelated files
4. Update action/progress area in `UploadDataSection`.
  - Replace centered `Upload` button with right-aligned `Cancel` and `Import` buttons like the screenshot.
  - During active upload, keep the existing progress message and percentage, using the app’s existing progress bar style or `Progress` if already available locally.
  - Disable `Import` unless existing `canUpload` conditions pass: data files present, channel map present, no mixed CSV/RSP, required metadata complete.
  - Keep cancel behavior wired to `onCancelUpload`.
5. Keep layout scope narrow.
  - Do not redesign `[client/src/components/upload/DatabaseSidePanel.tsx](client/src/components/upload/DatabaseSidePanel.tsx)` or the shared side-panel shell unless spacing issues require a minimal class tweak.
  - Keep the existing `SidePanelSection` header and metadata fields so this remains a focused upload-control replacement rather than a full Database page redesign.

## Verification

- Run `npx tsc --noEmit` from `[client](client)`.
- Run targeted ESLint for `[client/src/components/upload/UploadDataSection.tsx](client/src/components/upload/UploadDataSection.tsx)`.
- Manual smoke checks:
  - click dropzone and select `.csv` + `channel_map.yaml`
  - click dropzone and select `.rsp` + `channel_map.yaml`
  - drag/drop files onto the card
  - mixed `.csv` + `.rsp` shows validation and disables `Import`
  - missing channel map disables `Import`
  - upload progress still shows existing server messages, including RSP conversion

