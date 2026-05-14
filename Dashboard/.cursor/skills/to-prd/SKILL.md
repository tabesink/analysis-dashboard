---
name: to-prd
description: Turn the current conversation and codebase context into a PRD without a new interview, then publish it to the configured issue tracker. Use when the user wants a PRD synthesized from what has already been discussed.
---

# To PRD

Synthesize the current conversation into a PRD. Do not run a fresh interview; use what is already known and ask only if a critical blocking ambiguity remains.

Read `docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md`, and `docs/agents/domain.md` first when they exist.

## Process

1. Explore the repo enough to understand current behavior. Use `CONTEXT.md` vocabulary where available and respect relevant entries in `docs/decisions/log.md`.
2. Sketch the major modules that will be built or modified. Look for deep-module opportunities that would make behavior testable behind a simple interface.
3. Check with the user that the module sketch and testing focus match expectations if that has not already been resolved.
4. Write the PRD and publish it through the configured tracker. For this repo's default setup, use `gh issue create` and apply `needs-triage`.

## PRD Template

```markdown
## Problem Statement

The problem from the user's perspective.

## Solution

The solution from the user's perspective.

## User Stories

1. As an <actor>, I want a <feature>, so that <benefit>.

## Implementation Decisions

- Durable implementation decisions, module changes, API contracts, schema changes, and interaction details.

Do not include specific file paths or code snippets that may go stale quickly.

## Testing Decisions

- What behavior should be tested.
- Which modules or public interfaces should be tested.
- Prior examples of similar tests in the codebase.

## Out of Scope

Explicit exclusions.

## Further Notes

Optional supporting context.
```
