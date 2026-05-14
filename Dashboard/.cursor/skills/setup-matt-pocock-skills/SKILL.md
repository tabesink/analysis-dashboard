---
name: setup-matt-pocock-skills
description: Scaffold the per-repo config that engineering skills consume: issue tracker, triage label vocabulary, and domain doc layout. Use once per repo before using to-issues, to-prd, triage, diagnose, tdd, improve-codebase-architecture, grill-with-docs, or zoom-out.
---

# Setup Engineering Skills

Scaffold the repo configuration consumed by the engineering skills:

- Issue tracker: where issues and PRDs live.
- Triage labels: strings used for canonical issue states.
- Domain docs: where the glossary and decisions live.

This is a prompt-driven setup skill. Explore the repo, present findings, confirm choices, then write. In this Cursor repo, prefer `AGENTS.md` over `CLAUDE.md`.

## Process

### 1. Explore

Read or inspect:

- Git remote configuration to infer GitHub/GitLab/local tracker.
- `AGENTS.md` for existing project instructions.
- Root `CONTEXT.md` or `CONTEXT-MAP.md`.
- `docs/decisions/`, `docs/agents/`, and project documentation.

### 2. Confirm Choices

Walk through these decisions one at a time unless the user already provided defaults:

- Issue tracker: GitHub, GitLab, local markdown, or other.
- Triage label vocabulary: map canonical roles to real tracker labels.
- Domain docs: single-context root `CONTEXT.md`, multi-context `CONTEXT-MAP.md`, or custom layout.

### 3. Draft Changes

Show the user the intended `AGENTS.md` section and docs under `docs/agents/` before writing when choices are not already explicit.

### 4. Write

Update or create:

- `AGENTS.md` section `## Agent Skills`.
- `docs/agents/issue-tracker.md`.
- `docs/agents/triage-labels.md`.
- `docs/agents/domain.md`.
- Root `CONTEXT.md` when the user wants a single-context glossary created now.

Use the seed files in this skill directory as references:

- `issue-tracker-github.md`
- `issue-tracker-gitlab.md`
- `issue-tracker-local.md`
- `triage-labels.md`
- `domain.md`

### 5. Done

Tell the user which skills now consume the setup files and where to edit the configuration later.
