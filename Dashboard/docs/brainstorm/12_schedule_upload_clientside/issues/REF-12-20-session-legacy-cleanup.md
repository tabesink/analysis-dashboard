# REF-12-20: Deprecate inspect_damage_state.selected_event_ids

**Type:** HITL  
**Phase:** 5  
**Effort:** Medium  
**Review reference:** M-06, ADR-ID-03

## Parent

[refactor-plan.md](../refactor-plan.md)

## What to build

**Human review required** for session migration impact.

The client reads event selection from `data_state.selected_event_ids` only. Server model and tests still reference `inspect_damage_state.selected_event_ids`.

1. Confirm with tech lead: safe to stop writing/reading legacy field
2. Remove field from `server/models/session.py` `InspectDamageState` (or mark deprecated with migration)
3. Update `test_boundary_regressions.py` to use `data_state.selected_event_ids`
4. Remove unused `INSPECT_DAMAGE_TABLE_PREFS_STORAGE_KEY` / `parseInspectDamageTablePreferences` if truly dead, or document why kept
5. Update `session-sync.ts` backup strip logic if simplified

## Acceptance criteria

- [ ] Single documented source of truth for event selection: `data_state.selected_event_ids`
- [ ] Server session merge tests updated
- [ ] Client `use-inspect-damage-state.test.ts` still passes
- [ ] Entry in `docs/decisions/log.md` if production sessions may contain legacy field
- [ ] No user-visible selection regression

## Blocked by

- REF-12-18

## Agent notes

- Check `docs/brainstorm/_old/session_state.md` for historical context
- If production DB has sessions with legacy field, add one-time read fallback before delete
