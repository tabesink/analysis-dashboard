# REF-12-13: Server channel schema endpoint + client consumption

**Type:** AFK  
**Phase:** 3  
**Effort:** Medium  
**Review reference:** H-04

## Parent

[refactor-plan.md](../refactor-plan.md) · ADR from REF-12-12

## What to build

Implement the channel contract per REF-12-12 ADR. Default expectation if ADR silent:

**Server**
- `GET /api/v1/dashboard/channel-map-schema` returns ordered list of 8 `plot_key` values + display labels
- `GET /api/v1/damage/channel-schema` returns 12 damage channel keys + labels (or combine into one schema response)
- Server `ingestion.py` and `damage_channels.py` import from same Python constant module (`server/domain/channel_contract.py`)

**Client**
- Replace hardcoded `FIXED_CHANNEL_MAP_PLOTS` and `DAMAGE_CHANNELS` with schema fetched once (React Query, long stale time) or build-time import from shared contract file per ADR

## Acceptance criteria

- [ ] Single source of truth for 8 plot keys on server
- [ ] Client channel map editor uses schema — adding a plot key in one place updates UI
- [ ] Client 3D damage plot uses same damage channel keys from contract
- [ ] Existing tests updated; no behavior change for current 8+12 channel set
- [ ] Server + client tests pass
- [ ] `npm run build` passes

## Blocked by

- REF-12-12 (ADR approved)

## Agent notes

- Do not add new plot keys — refactor only
- Invalidate schema cache only on deploy, not on metadata save
