# Agent Handoff — REF-12 Refactor

**Read this first.** Full plan: [refactor-plan.md](./refactor-plan.md)

---

## Your mission

Pick **one** issue from [`issues/`](./issues/), implement it completely, verify, and stop. Do not continue to the next issue in the same session unless the user explicitly asks.

---

## Quick start checklist

```
[ ] 1. Read refactor-plan.md § Agent handoff instructions
[ ] 2. Open your issue: issues/REF-12-XX-*.md
[ ] 3. Read relevant § in edit_metadata_page_reivew.md
[ ] 4. git checkout -b ref-12-XX-short-description
[ ] 5. Implement only acceptance criteria in the issue
[ ] 6. Run verification commands (below)
[ ] 7. PR with title: "REF-12-XX: <issue title>"
```

---

## Issue picker guide

| If you are… | Start here |
|-------------|------------|
| New to the repo | REF-12-01 or REF-12-15 (small, clear scope) |
| Continuing Edit Metadata refactor | Next unblocked issue in Track A (04→10) |
| Continuing Inspect Damage refactor | REF-12-15 → 16 → 17 → 18 |
| Blocked on code | Check if REF-12-12 or REF-12-22 ADR needs human approval |
| Preparing schedule backend | Wait for REF-12-10 + REF-12-22 |

---

## Context files (read selectively)

| File | When |
|------|------|
| [edit_metadata_page_reivew.md](./edit_metadata_page_reivew.md) | Architecture risks and evidence |
| [prd.md](./prd.md) | Schedule UI scope (iteration 1) |
| [FALLOW-13](../11_fallow_frontend_report_TODO/issues/FALLOW-13-refactor-database-edit-page.md) | Complexity targets for edit page |
| `AGENTS.md` (repo root) | Security + doc update rules |
| `docs/database-schema.txt` | Only if your issue touches schema |

---

## Verification commands

```bash
# From repo root — run what applies to your issue

# Server
uv run pytest tests/server/ -q --tb=short

# Client unit tests
cd client && npm test

# Client build
cd client && npm run build

# Complexity (REF-12-10 only)
cd client && npx fallow health --score --targets
```

---

## Rules of engagement

1. **No scope creep** — out-of-scope items are listed in refactor-plan.md
2. **No drive-by refactors** — match existing style
3. **Behavior preservation** — unless issue explicitly allows UX improvement (REF-12-14, 19)
4. **One issue per PR**
5. **HITL issues** (REF-12-12, 20, 22) — docs/ADR only unless human approves code

---

## Suggested Cursor skills

| Skill | Use when |
|-------|----------|
| `engineering/tdd` | Issues with test requirements (04, 11, 16) |
| `engineering/diagnose` | Regression or failing test you didn't cause |
| `zoom-out` | First time in inspect-damage or edit-metadata flow |
| `handoff` | End of session — compact state for next agent |

---

## GitNexus (optional)

```text
MCP server: user-gitnexus
repo: analysis-dashboard

query({ query: "save channel map edit metadata", repo: "analysis-dashboard" })
impact({ target: "handleSave", direction: "upstream", repo: "analysis-dashboard" })
```

Re-index after REF-12-10 or REF-12-18: `npx gitnexus analyze`

---

## When done

- PR description: paste acceptance criteria checkboxes with `[x]`
- Link issue file: `docs/brainstorm/12_schedule_upload_clientside/issues/REF-12-XX-...`
- If architectural decision made: `docs/decisions/log.md`
- If non-trivial: `docs/tasks/REF-12-XX.md`
- **Do not** publish GitHub issues unless user/tech lead asks (`engineering/to-issues`)

---

## Contact / escalation

| Blocker | Action |
|---------|--------|
| ADR not approved | Stop; label PR draft; ping tech lead |
| Test fixture unclear | Read `tests/server/services/test_damage_query_service.py` or `test_query_service_metadata.py` |
| Ownership check confusion | Read `docs/architecture/database-multi-user.md` |
| Scope too large | Stop; comment in issue; propose split — do not expand PR |

---

*Last updated: 2026-06-08*
