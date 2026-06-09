# 12 — Schedule Upload + Edit Metadata Refactor

Brainstorm package for Edit Metadata schedule upload UI (iteration 1) and phased refactor of Edit Metadata + Inspect Damage routes (iteration 2+).

| Document | Description |
|----------|-------------|
| [prd.md](./prd.md) | Product requirements for two-section sidepanel layout and ghosted `.sch` file picker (UI only, no backend) |
| [edit_metadata_page_reivew.md](./edit_metadata_page_reivew.md) | Senior architecture review — findings, risks, target structure |
| [refactor-plan.md](./refactor-plan.md) | Phased refactor plan (REF-12-01 … REF-12-23) with dependencies |
| [AGENT_HANDOFF.md](./AGENT_HANDOFF.md) | **Start here** — quick checklist for coding agents |
| [issues/](./issues/) | Per-issue specs (to-issues vertical slices) for AFK/HITL implementation |

## Execution summary

| Phase | Focus | Key issues |
|-------|-------|------------|
| 0 | Security + quick fixes | REF-12-01, 02, 03 |
| 1 | Edit Metadata extraction (closes FALLOW-13) | REF-12-04 … 10 |
| 2 | Schedule UI tests | REF-12-11 |
| 3 | Channel contract ADR + endpoint | REF-12-12, 13 |
| 4 | Inspect Damage extraction | REF-12-14 … 18 |
| 5 | UX polish + tests | REF-12-19, 20, 21 |
| 6 | Schedule backend (future) | REF-12-22, 23 |
