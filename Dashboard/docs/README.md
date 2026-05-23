# Documentation Index

**App version:** 1.3.7 (see root `VERSION` and `CHANGELOG.md`)

This folder is the source of truth for product, architecture, and engineering process docs. Brainstorm notes and task write-ups live in subfolders but are not the canonical product spec.

## Core documents

| Document | Purpose |
|----------|---------|
| [prd.md](prd.md) | Product requirements — users, workflows, functional and non-functional requirements |
| [master-build-plan.md](master-build-plan.md) | Phased task tracker with IDs, status, and key file references |
| [tech-stack.md](tech-stack.md) | Technology inventory and architecture patterns |
| [database-schema.txt](database-schema.txt) | DuckDB schema source of truth (mirrors `server/schema.yaml`) |
| [test-strategy.md](test-strategy.md) | Test stack, categories, coverage targets, and current gaps |
| [release-versioning.md](release-versioning.md) | Version bump workflow and release checklist |
| [frontend-audit.md](frontend-audit.md) | Point-in-time frontend production audit (2026-03-10) |
| [DESIGN.md](DESIGN.md) | External design reference (Ollama-inspired minimal theme notes) |

## Architecture and runtime notes

| Document | Purpose |
|----------|---------|
| [architecture/deployment-and-scaling.md](architecture/deployment-and-scaling.md) | Single-instance DuckDB constraints, production deployment path, scaling limits |
| [notes/database.md](notes/database.md) | Runtime connection model, load-data export/import operator summary |

## Process

| Location | Purpose |
|----------|---------|
| [decisions/log.md](decisions/log.md) | Append-only architectural decision log |
| [tasks/](tasks/) | Per-task implementation notes (e.g. `P8-03.md`) |
| [brainstorm/](brainstorm/) | Exploratory design notes — may be stale; check `master-build-plan.md` for shipped status |

## Related repo docs (outside `docs/`)

| Document | Purpose |
|----------|---------|
| [../README.md](../README.md) | Developer quick start, LAN smoke run, release bundle pointer |
| [../CHANGELOG.md](../CHANGELOG.md) | User-facing release notes |
| [../AGENTS.md](../AGENTS.md) | Agent workflow, security checklist, mandatory doc updates |
| [../CONTEXT.md](../CONTEXT.md) | Domain glossary for agents |
| [../../Deployment/README.md](../../Deployment/README.md) | Production operator deployment guide (release bundle) |
