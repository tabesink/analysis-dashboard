# REF-12-01: Add WriteUserDep to metadata PUT + router test

**Type:** AFK  
**Phase:** 0  
**Effort:** Low  
**Review reference:** H-03

## Parent

[refactor-plan.md](../refactor-plan.md) · [edit_metadata_page_reivew.md](../edit_metadata_page_reivew.md)

## What to build

The batch metadata endpoint `PUT /api/v1/dashboard/program-version/metadata` currently accepts any authenticated user (`CurrentUserDep`). Channel map save already requires `WriteUserDep`. Align metadata PUT with the same write guard so read-only users cannot bypass the UI route guard via direct API calls.

Add a router integration test proving read-only users receive 403 (or the project's standard write-denied response).

## Acceptance criteria

- [x] `update_program_version_metadata` handler uses `WriteUserDep` instead of `CurrentUserDep`
- [x] Existing service-layer ownership checks remain unchanged
- [x] New router test: user with `can_write=false` and non-admin role cannot call metadata PUT
- [x] New router test: user with `can_write=true` can still update own program/version metadata
- [x] `uv run pytest tests/server/routers/ -q` passes

## Blocked by

None — can start immediately

## Agent notes

- Handler location: `server/routers/dashboard.py` (~line 529)
- Follow pattern from `save_program_version_channel_map` in the same file
- Do not change request/response models
