---
name: Database Export/Import UX
overview: Improve the Export Database UX to show a native "Save As" dialog instead of silent auto-download, with a fallback for Firefox. Import is already fully wired -- no changes needed.
todos:
  - id: export-save-dialog
    content: Replace anchor-download in handleExportDatabase with showSaveFilePicker() + fallback
    status: completed
  - id: verify-import
    content: Smoke-test the import flow to confirm it works end-to-end (no code changes needed)
    status: completed
isProject: false
---

# Database Export/Import UX Fix

## Current State

- **Export**: Fully wired but uses the `a.download` anchor pattern, which downloads silently to the browser's default Downloads folder. No Save As dialog appears, making it seem broken.
- **Import**: Fully wired with file picker + validation modal + confirmation + API call. Works correctly.
- **Backend**: Both `GET /api/v1/export/database` (export) and `POST /api/v1/export/database` (import) endpoints in [server/routers/export.py](server/routers/export.py) are functional.

## Changes Required

### 1. Export: Use `showSaveFilePicker()` with anchor fallback

**File**: [client/src/app/database/page.tsx](client/src/app/database/page.tsx) -- `handleExportDatabase` (lines 584-607)

Replace the anchor-download pattern with the File System Access API:

```typescript
const handleExportDatabase = async () => {
  if (!isAdmin) { toast.error('Admin access required'); return; }
  setIsExporting(true);
  try {
    const blob = await exportApi.exportDatabase();

    if ('showSaveFilePicker' in window) {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: 'dashboard.db',
        types: [{ description: 'DuckDB Database', accept: { 'application/octet-stream': ['.db'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
    } else {
      // Firefox fallback: anchor download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dashboard.db';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
    }

    toast.success('Database exported successfully');
  } catch (error: any) {
    if (error?.name === 'AbortError') return; // User cancelled Save As dialog
    const message = error instanceof Error ? error.message : 'Failed to export database';
    toast.error(`Export failed: ${message}`);
  } finally {
    setIsExporting(false);
  }
};
```

- **Chrome/Edge**: Shows a native Save As dialog where the user picks the save location.
- **Firefox**: Falls back to the current anchor download behavior (browser determines save location based on its download settings).
- Handles user cancellation of the Save As dialog gracefully (no error toast).

### 2. Import: No changes needed

The import flow is already production-grade:

- Native file picker via `<input type="file" accept=".db">`
- Validation via `POST /api/v1/export/database/validate`
- Confirmation modal (`ImportConfirmationModal`) showing schema compatibility, warnings, event counts
- Actual import via `POST /api/v1/export/database` which backs up existing DB and replaces it
- Cache invalidation + state reset after successful import

### Files touched

- [client/src/app/database/page.tsx](client/src/app/database/page.tsx) -- modify `handleExportDatabase` (~15 lines changed)

That's it. One function, one file.