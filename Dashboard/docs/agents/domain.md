# Domain Docs

This repo uses a single-context domain documentation layout for engineering skills.

## Read Before Exploring

- `CONTEXT.md` at the repo root: shared domain vocabulary for the RSP Data Analytics Dashboard.
- `docs/decisions/log.md`: append-only architectural and implementation decision log.
- `docs/master-build-plan.md`: phase/task tracker and completed work map.
- `docs/prd.md`: product requirements baseline.
- `docs/tech-stack.md`: framework and dependency inventory.
- `docs/test-strategy.md`: test approach and known gaps.
- `docs/database-schema.txt`: source of truth for database schema work.

If a file is absent or does not cover the current topic, proceed with code exploration and note the gap only when it affects the task.

## Context Layout

```text
/
|-- CONTEXT.md
|-- AGENTS.md
`-- docs/
    |-- agents/
    |   |-- domain.md
    |   |-- issue-tracker.md
    |   `-- triage-labels.md
    |-- decisions/log.md
    |-- master-build-plan.md
    |-- prd.md
    |-- tech-stack.md
    |-- test-strategy.md
    `-- database-schema.txt
```

## Usage Rules

- Use `CONTEXT.md` terms in issue titles, PRDs, test names, hypotheses, and refactor proposals.
- If a domain term is missing or overloaded, resolve it through `grill-with-docs` and update `CONTEXT.md`.
- If a proposed change contradicts `docs/decisions/log.md`, surface the conflict explicitly instead of silently overriding it.
- Database changes must also follow the database rules in `AGENTS.md` and update `docs/database-schema.txt`.
