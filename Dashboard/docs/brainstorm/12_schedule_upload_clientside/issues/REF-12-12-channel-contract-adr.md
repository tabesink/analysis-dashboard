# REF-12-12: ADR — channel-map + damage channel contract

**Type:** HITL  
**Phase:** 3  
**Effort:** Low  
**Review reference:** H-04, ADR-EM-02

## Parent

[refactor-plan.md](../refactor-plan.md)

## What to build

**Human decision required.** Document the chosen approach for keeping these in sync:

- `FIXED_CHANNEL_MAP_PLOTS` (8 plots) — client edit page + `server/services/ingestion.py`
- Damage channel keys (12 channels) — `damage_channels.py` + `damage-channel-axis.ts`

Evaluate options from the architecture review:

1. **Server schema endpoint** — `GET /dashboard/channel-map-schema` returns plot keys + damage channel metadata; clients render dynamically
2. **Shared codegen** — generate TS from `server/schema.yaml` or `domain/contracts.yaml`
3. **Test-asserted mirror** — single YAML/JSON contract file imported by both sides with CI assertion test

Record decision in `docs/decisions/log.md` with ID (e.g. DEC-REF12-01). REF-12-13 implements the chosen option.

## Acceptance criteria

- [ ] ADR entry in `docs/decisions/log.md` with chosen option and rejected alternatives
- [ ] Implementation notes for REF-12-13 agent: endpoint shape or file location specified
- [ ] No code changes required in this issue (docs only)

## Blocked by

- REF-12-10

## Agent notes

- **AFK agents:** Do not implement REF-12-13 until this ADR is merged or explicitly approved by tech lead in issue comments
- Prefer option 1 if unsure — lowest drift risk for multi-client future
