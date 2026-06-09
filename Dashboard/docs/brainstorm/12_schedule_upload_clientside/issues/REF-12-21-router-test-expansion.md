# REF-12-21: Expand damage + metadata router integration tests

**Type:** AFK  
**Phase:** 5  
**Effort:** Medium  
**Review reference:** L-05, M-02

## Parent

[refactor-plan.md](../refactor-plan.md)

## What to build

Strengthen router-layer integration tests:

**Damage router** (`test_damage_router.py`)
- Assert all 12 channel keys appear in response for fixture with full channel map
- Assert `unavailable` status when channel map missing for a group

**Metadata router** (extend `test_dashboard_router.py` or new file)
- `PUT /program-version/metadata` happy path for write user
- Ownership denial for non-admin editing another user's program/version
- Admin status field update allowed

## Acceptance criteria

- [ ] Damage router test covers ≥ 4 component groups (not only ball joint)
- [ ] Metadata PUT router tests cover write guard (complements REF-12-01)
- [ ] `uv run pytest tests/server/routers/ -q` passes
- [ ] No change to production router code unless tests reveal bugs (fix in separate commit if needed)

## Blocked by

- REF-12-01

## Agent notes

- Reuse fixtures from `test_damage_query_service.py` where possible
