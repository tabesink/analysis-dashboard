---
name: kolla-create-architecture-markdown
description: Create architecture Markdown by reviewing a codebase first, then writing a detailed system architecture document in the style of docs/architecture/llm-wiki-system-architecture.md. Use when the user asks to generate, update, or scaffold architecture docs from an existing repository, module, product area, or codebase review.
---

# Kolla Architecture Markdown Writer

## Goal

Create architecture documents that a junior developer or coding agent can use to understand and implement a system.

The output should feel like `docs/architecture/llm-wiki-system-architecture.md`: evidence-backed, structured, operational, and concrete. It should explain the system at a higher level than individual files while staying grounded in actual code paths, symbols, workflows, and configuration.

## When to apply

Apply this skill when the user asks for any of the following:

- Create an architecture document from a codebase.
- Review a repository and write system architecture Markdown.
- Explain an unfamiliar area of code at a higher level.
- Produce docs similar to `llm-wiki-system-architecture.md`.
- Create module maps, caller maps, workflow maps, or implementation roadmaps from existing code.
- Turn a codebase investigation into durable architecture documentation.

## Operating stance

Act like a senior engineer writing for future maintainers.

Do not start by inventing the architecture. Start by reading the codebase.

Use the project's own domain vocabulary. If the code calls something a retriever, indexer, graph, worker, source, run, session, job, pipeline, project, tenant, or artifact, use those terms consistently instead of replacing them with generic labels.

## Research workflow

### Step 1: Identify scope

Determine the target system, folder, service, feature, or repository.

If the user gives a specific document path, treat it as the output target. If no output path is provided, propose a path under `docs/architecture/`.

If scope is broad or ambiguous, ask only the minimum critical questions needed to proceed.

### Step 2: Review the codebase first

Gather evidence before drafting.

Look for:

- Entrypoints: CLIs, apps, APIs, workers, scripts, package exports, server startup files.
- Core modules: domain services, orchestrators, routers, handlers, agents, pipelines, storage adapters.
- Callers: what invokes the target code and what the target code invokes.
- Data flow: request payloads, events, jobs, files, database rows, vector records, cache entries, external API calls.
- Configuration: environment variables, settings files, dependency injection, feature flags, deployment config.
- Persistence: databases, file stores, object stores, indexes, logs, queues, checkpoints.
- Tests: unit, integration, e2e, fixtures, snapshots, test helpers.
- Docs: README files, existing architecture docs, plans, ADRs, comments, generated docs.

Prefer exact evidence from paths and symbols over inference.

### Step 3: Zoom out

Before writing the architecture doc, produce a private working map:

- Domain glossary: project-specific nouns and what they mean.
- Module map: major packages, folders, and ownership boundaries.
- Caller map: who calls whom, including external entrypoints.
- Workflow map: the main user, agent, API, CLI, background, or data-processing flows.
- State map: where durable data, transient state, logs, and generated artifacts live.
- Risk map: unclear boundaries, hidden coupling, missing tests, operational risks.

Use this map to explain the system one abstraction layer above the code.

### Step 4: Grill only where code cannot answer

If a question can be answered by codebase exploration, answer it through exploration.

Ask the user only when a decision materially affects the architecture document and the code does not answer it. Examples:

- The intended audience is unclear.
- The target output path is unclear.
- Multiple systems could be documented and scope must be narrowed.
- The code and existing docs disagree about intended behavior.
- A roadmap, security posture, or deployment target requires product intent beyond the repository.

Ask one or two critical questions at a time.

### Step 5: Draft the architecture document

Write a complete Markdown document, not a loose summary.

Use the reference document's structure and rhythm:

- Title and `## Purpose`.
- Numbered top-level sections: `# 1.`, `# 2.`, `# 3.`
- Horizontal separators, `---`, between major sections.
- `##` subsections and decimal subsections for grouped templates or examples.
- `text` fences for ASCII diagrams, directory trees, pipelines, and stack summaries.
- Tables for comparisons, schemas, quality gates, and responsibility matrices.
- Numbered rules for invariants, workflows, and acceptance criteria.
- Concrete paths, commands, files, symbols, and config names in backticks.

## Required architecture document outline

Adapt section names to the project, but preserve this progression:

```markdown
# <System Name> System Architecture

## Purpose

# 1. System Goal

# 2. Mental Model

# 3. Main Architectural Principle

# 4. High-Level Architecture

# 5. System Layers or Subsystems

# 6. Recommended Project Structure

# 7. Core File and Module Responsibilities

# 8. Domain Types, Artifacts, or Page Types

# 9. Naming Conventions

# 10. Metadata, Configuration, and Environment Standard

# 11. System Invariants

# 12. Core Operations

# 13+. Operation Details

# N. Index, Navigation, or Discovery Design

# N. Logs, Observability, and Audit Trail

# N. Agent Instructions

# N. MVP or Implementation Plan

# N. Optional Data Model or Storage Model

# N. Example Scripts, Commands, or Prompts

# N. Quality Gates

# N. Human vs Agent Responsibilities

# N. Common Failure Modes

# N. Development Roadmap

# N. Implementation Stack Options

# N. Git and Review Workflow

# N. Scaling Guidance

# N. Security and Privacy

# N. Definition of Done

# N. Minimal First Task for a Coding Agent

# N. Best Practical Starting Point

# N. Final Architecture Summary
```

The document does not need exactly 39 sections, but it should cover the same categories when relevant.

## Section patterns

### Purpose

State:

- Who the document is for.
- What system or area it explains.
- What the reader should be able to do after reading it.
- The core idea in one short blockquote.

### Mental model

Use a table like this:

```markdown
| Project Concept | Architecture Meaning |
| --------------- | -------------------- |
| `<term>`        | <plain-language role> |
```

### High-level architecture

Use a `text` diagram grounded in real components:

```text
Human / Client
      |
      v
Entrypoint: <path or command>
      |
      v
Core Orchestrator: <symbol/path>
      |
      v
Storage / External Systems
```

### System layers or subsystems

For each layer, include:

- Responsibility.
- Key files and modules.
- Inputs.
- Outputs.
- Things it must not own.

### Core file and module responsibilities

Use a table:

```markdown
| Path | Responsibility | Important Callers | Notes |
| ---- | -------------- | ----------------- | ----- |
| `src/example.py` | <what it owns> | `<caller>` | <constraint or caveat> |
```

### Core operations

For each major workflow, use this pattern:

````markdown
# N. Operation: <Name>

## Input

## Output

## Pipeline

```text
Step 1 -> Step 2 -> Step 3
```

## Algorithm

1. <Step grounded in code>
2. <Step grounded in code>
3. <Step grounded in code>

## Acceptance Criteria

- <Observable pass condition>
````

Typical operations include bootstrap, ingest, query, build, deploy, sync, index, validate, evaluate, lint, backfill, migrate, retry, recover, or export. Use only operations that exist or are intended for the target system.

### Agent instructions

Include a copy-pasteable block for future coding agents:

```markdown
# Agent Operating Rules for <System Name>

## Mission

<One sentence mission.>

## Permissions

You may:
- <Allowed action>

You must not:
- <Forbidden action>

## Workflow Rules

1. <Rule grounded in repo behavior>
2. <Rule grounded in repo behavior>

## Writing Style

- Prefer durable explanations over chat-style answers.
- Cite real paths and symbols.
- Separate facts, interpretations, and open questions.
```

### Quality gates

Use a table:

```markdown
| Gate | Question | Pass Criteria |
| ---- | -------- | ------------- |
| Entrypoints mapped | Are all user-facing entrypoints identified? | Yes |
| Claims grounded | Does each major claim cite code, config, docs, or tests? | Yes |
```

### Common failure modes

Use repeated subsections:

````markdown
## Failure Mode 1: <Name>

Symptom:

```text
<Concrete symptom>
```

Fix:

```text
<Concrete mitigation>
```
````

### Final architecture summary

End by compressing the whole document:

````markdown
# N. Final Architecture Summary

<System name> is a <short classification> with <number> main layers:

```text
Layer 1 -> Layer 2 -> Layer 3
```

It has <number> core actions:

```text
Action 1 -> Action 2 -> Action 3
```

It becomes useful because:

1. <Reason>
2. <Reason>
3. <Reason>
````

## Evidence rules

- Every important architectural claim should be traceable to a file, symbol, config, test, existing doc, or user-confirmed intent.
- Mark uncertain claims as `Open question`, `Assumption`, or `TBD`.
- Do not fabricate components, services, queues, databases, roles, or deployment environments.
- If an implementation is planned but not present, label it as planned.
- Prefer local evidence over generic framework knowledge.
- When using framework knowledge, still connect it to the repository's actual files.

## Output quality bar

The final document should:

- Teach the system from goal to implementation.
- Help a new developer know where to start.
- Help a coding agent know what it may safely change.
- Show how data and control flow through the system.
- Name the stable invariants and risky failure modes.
- Include concrete first tasks and acceptance criteria.
- Be readable as standalone Markdown.

## Guardrails

- Do not write architecture from memory alone.
- Do not overfit the document to one file when the system spans multiple callers.
- Do not hide uncertainty.
- Do not replace project vocabulary with generic architecture buzzwords.
- Do not include huge code excerpts; cite paths and summarize responsibilities.
- Do not change code while creating the document unless the user explicitly asks.
- Keep diagrams simple enough to maintain in Markdown.
- Use plain ASCII diagrams unless the repository already uses another diagram style.

## Validation

Before finalizing, verify:

1. The document has a title, purpose, numbered sections, and final summary.
2. The high-level diagram matches the actual entrypoints and module boundaries.
3. Core operations include inputs, outputs, pipeline or steps, and acceptance criteria.
4. Important files and modules have responsibilities assigned.
5. Invariants and failure modes are project-specific.
6. Agent instructions are actionable and grounded in the codebase.
7. Open questions are explicit instead of hidden as guesses.
8. The document can guide a junior developer's first implementation task.

## Completion response

When reporting completion, include:

1. The architecture document path.
2. The main code areas reviewed.
3. Any important assumptions or open questions.
4. Whether tests or validation commands were run.