# REF-12-09: Extract ChannelMapTab component

**Type:** AFK  
**Phase:** 1  
**Effort:** Medium  
**Review reference:** H-01, FALLOW-13

## Parent

[refactor-plan.md](../refactor-plan.md)

## What to build

Move the **Assign Channels** tab UI into `ChannelMapTab.tsx`: plot column mapping table, CSV preview panel, save button, pending/failed artifact footer messages.

Props-driven from `useChannelMapEditor` and `useSaveChannelMap`.

## Acceptance criteria

- [ ] `ChannelMapTab.tsx` under `features/edit-metadata/components/`
- [ ] Empty state when no program/version selected preserved
- [ ] Loading spinner while channel map query fetches
- [ ] Save disabled when `column_count` missing — same as today
- [ ] Page `TabsContent value="custom-fields"` only mounts `<ChannelMapTab ... />`
- [ ] `npm run build` passes

## Blocked by

- REF-12-08
