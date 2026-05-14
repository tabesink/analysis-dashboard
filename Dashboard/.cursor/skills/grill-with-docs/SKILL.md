---
name: grill-with-docs
description: Stress-test a plan against the repo's domain language and documented decisions, then capture resolved terms or durable architectural decisions. Use when the user wants to be grilled on a plan while keeping CONTEXT.md and decision docs aligned.
---

# Grill With Docs

Interview the user relentlessly about the plan until every important branch of the design tree is resolved. Ask one question at a time and wait for feedback. For each question, provide your recommended answer.

If a question can be answered by exploring the codebase, explore instead of asking.

## Domain Awareness

Read `docs/agents/domain.md` if present. In this repo, the default layout is:

- Root `CONTEXT.md` for domain vocabulary, created lazily and maintained when terms are resolved.
- `docs/decisions/log.md` for durable architectural and implementation decisions.
- `docs/master-build-plan.md`, `docs/prd.md`, `docs/tech-stack.md`, and `docs/test-strategy.md` for baseline project context.

Use `CONTEXT-FORMAT.md` for domain vocabulary updates and `ADR-FORMAT.md` when a standalone ADR-style note is useful. This repo normally records decisions in `docs/decisions/log.md`, so prefer appending there unless the user asks for per-ADR files.

## During The Session

### Challenge Against The Glossary

When the user uses a term that conflicts with `CONTEXT.md`, call it out immediately and ask which meaning should win.

### Sharpen Fuzzy Language

When the user uses vague or overloaded terms, propose a precise canonical term.

### Discuss Concrete Scenarios

Invent edge-case scenarios that force precise boundaries between concepts.

### Cross-Reference With Code

When the user states how something works, check whether the code agrees. Surface contradictions clearly.

### Update `CONTEXT.md` Inline

When a term is resolved, update `CONTEXT.md` right away. Do not batch glossary updates. Keep it domain-level, not implementation-detail-heavy.

### Offer Decisions Sparingly

Only record a decision when all three are true:

1. It is hard to reverse.
2. Future readers would find it surprising without context.
3. It reflects a real trade-off.

If any condition is missing, skip the decision note.
