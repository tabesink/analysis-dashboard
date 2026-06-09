# REF-12-22: ADR — schedule upload UX surface

**Type:** HITL  
**Phase:** 6  
**Effort:** Low  
**Review reference:** M-01, ADR-EM-01

## Parent

[refactor-plan.md](../refactor-plan.md) · [prd.md](../prd.md)

## What to build

**Human / product decision** before schedule backend implementation.

Resolve split between:

1. **Side panel only** — Extract button uploads + parses `.sch`; Durability tab shows read-only summary
2. **Durability tab only** — Full schedule editor in main panel; side panel drops Upload Schedule section
3. **Both** — Upload in side panel; edit/review in Durability tab

Also decide:
- Parse on client vs server first
- Association model: one schedule per program/version vs versioned history

Record in `docs/decisions/log.md`. REF-12-23 implements chosen design.

## Acceptance criteria

- [ ] ADR with chosen UX surface and API scope
- [ ] User stories from prd.md iteration 2 drafted (or reference new PRD section)
- [ ] REF-12-23 unblocked with explicit endpoint contract outline

## Blocked by

- REF-12-11 (schedule UI tests establish current behavior baseline)
- REF-12-13 (channel contract pattern informs how schedule schema might work)

## Agent notes

- AFK agents must not start REF-12-23 without ADR approval
