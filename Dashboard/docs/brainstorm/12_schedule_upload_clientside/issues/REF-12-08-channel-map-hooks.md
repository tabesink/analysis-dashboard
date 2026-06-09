# REF-12-08: Add use-channel-map-editor + save mutation

**Type:** AFK  
**Phase:** 1  
**Effort:** Medium  
**Review reference:** H-01, H-04

## Parent

[refactor-plan.md](../refactor-plan.md)

## What to build

Extract channel map state and save flow into:

**`useChannelMapEditor(programId, version)`**
- `channelMapQuery` for editor payload
- `channelMapDraft` state synced from query
- `setChannelMapValue` helper
- Loading/saving flags

**`useSaveChannelMap` mutation**
- Validates all 8 plots have x_col and y_col
- Calls `dashboardApi.saveChannelMap`
- Invalidates: `channel-map-editor`, `datasets`, `program-version-events`, `all-events`, `event-catalog`
- Toast messages unchanged

`FIXED_CHANNEL_MAP_PLOTS` should import from a single module (`features/edit-metadata/lib/channel-map-plots.ts`) — still duplicated with server until REF-12-13.

## Acceptance criteria

- [ ] Hooks under `features/edit-metadata/hooks/`
- [ ] Channel map save + reprocess behavior unchanged
- [ ] `FIXED_CHANNEL_MAP_PLOTS` defined once on client in lib module
- [ ] Page no longer contains `handleSaveChannelMap` or channel map `useEffect`
- [ ] `npm run build` passes

## Blocked by

- REF-12-03

## Agent notes

- Can run in parallel with REF-12-05/06/07 after REF-12-03 lands
- 300s timeout on save API call must be preserved
