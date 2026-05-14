---
name: to-issues
description: Break a plan, spec, or PRD into independently implementable issue-tracker items using vertical tracer-bullet slices. Use when the user wants implementation tickets, GitHub issues, or a plan decomposed into agent-ready work.
---

# To Issues

Break a plan into independently implementable issues using vertical slices. Read `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md` first.

## Process

### 1. Gather Context

Use the current conversation. If the user provides an issue number, URL, or local path, fetch/read its full body and comments.

### 2. Explore The Codebase

Explore enough code to understand current behavior. Use `CONTEXT.md` vocabulary where available and respect relevant entries in `docs/decisions/log.md`.

### 3. Draft Vertical Slices

Each issue should be a tracer bullet: a thin end-to-end path through all affected layers that is independently demoable or verifiable.

Slices may be:

- `AFK`: an agent can implement with no further human decision.
- `HITL`: requires human review, access, design judgment, or a decision.

Prefer many thin slices over a few thick ones.

### 4. Quiz The User

Present the proposed breakdown as a numbered list. For each slice, show:

- Title.
- Type: `AFK` or `HITL`.
- Blocked by.
- User stories or outcomes covered.

Ask whether granularity, dependencies, and HITL/AFK classification are right. Iterate until approved.

### 5. Publish Issues

After approval, publish issues through the configured tracker. For this repo's default setup, use `gh issue create` with heredoc bodies and apply the configured `needs-triage` label.

Publish blockers first so dependent issues can reference real identifiers.

## Issue Template

```markdown
## Parent

Reference the parent issue if applicable.

## What to build

Describe the end-to-end behavior for this vertical slice.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Blocked by

- None - can start immediately
```

Do not close or modify parent issues unless the user explicitly asks.
