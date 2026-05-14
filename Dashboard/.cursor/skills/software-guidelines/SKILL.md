---
name: software-guidelines
description: Guides coding agents through software engineering fundamentals for alignment, shared language, feedback loops, debugging, TDD, PRDs, and architecture. Use when planning agent work, choosing Cursor skills, setting agent workflow expectations, or when the user mentions software guidelines, coding agent behavior, shared language, grilling, diagnostics, or avoiding a ball of mud.
---

# Software Guidelines

Use this skill to choose the right engineering loop before coding. The goal is not to add process for its own sake; it is to prevent the common agent failures of building the wrong thing, using vague language, shipping broken code, or growing a hard-to-change system.

## When To Use This Skill

Apply this skill when the user asks how coding agents should work, wants reusable software engineering guidance, is starting a meaningful change, or asks which project skill to use.

For tiny, obvious edits, keep moving. For ambiguous, risky, or architectural work, pause long enough to choose the right loop.

## Operating Principles

1. Align before building. If the user has a plan, design, or product idea with unresolved choices, use `/grill-me` to interview them until the decision tree is clear. If project language or durable decisions should be captured, use `/grill-with-docs`.

2. Prefer shared language over verbose explanation. Identify domain terms, use those terms consistently in conversation and code, and document durable meanings when they reduce future confusion.

3. Let feedback loops set the pace. For feature and bug work where behavior matters, use `/tdd` to write a failing test first, make it pass, then refactor. For unclear failures, use `/diagnose` to reproduce, observe, hypothesize, change one thing, and verify.

4. Invest in design continuously. Use `/zoom-out` when the agent needs system context before changing code. Use `/improve-codebase-architecture` when modules are shallow, tangled, hard to test, or showing signs of becoming a ball of mud.

5. Keep changes small and deliberate. Work in thin vertical slices, verify each slice, and avoid speculative abstractions.

## Choose The Right Skill

- Use `/grill-me` when alignment is the bottleneck and the answer depends on user intent.
- Use `/grill-with-docs` when the discussion should also update shared language or architectural decision records.
- Use `/tdd` when the task can be defined as observable behavior and regression risk matters.
- Use `/diagnose` when something is broken and the cause is not yet proven.
- Use `/zoom-out` when changing unfamiliar code or explaining how a module fits into the system.
- Use `/to-prd` or `/write-a-prd` when the work needs product framing before implementation.
- Use `/to-issues` when a plan should become independently implementable tickets.
- Use `/improve-codebase-architecture` when the codebase needs refactoring opportunities and deeper module boundaries.

## Execution Checklist

Before coding:

- State the intended outcome and success criteria.
- Identify the highest-risk uncertainty.
- Choose the smallest useful feedback loop.
- Use the existing project vocabulary and patterns.

While coding:

- Change only what the task requires.
- Verify with tests, types, browser checks, or targeted reproduction as appropriate.
- Stop and ask when user intent, domain meaning, or architectural direction is unclear.

After coding:

- Report what changed, how it was verified, and any remaining risk.
- Capture durable shared language or design decisions when the chosen workflow requires it.
