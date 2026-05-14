---
name: tdd
description: Test-driven development with a red-green-refactor loop and vertical slices. Use when the user wants test-first implementation, red-green-refactor, stronger regression coverage, or feature/bug work driven by behavior tests.
---

# Test-Driven Development

## Philosophy

Tests should verify behavior through public interfaces, not implementation details. Code can change entirely; tests should keep describing the same observable capability.

Good tests are integration-style: they exercise real code paths through public APIs and read like specifications. Bad tests are coupled to implementation: they mock internal collaborators, test private methods, or fail when behavior is unchanged.

See `tests.md` for examples, `mocking.md` for mocking guidance, `interface-design.md` for testable interfaces, `deep-modules.md` for architectural shape, and `refactoring.md` for cleanup discipline.

## Avoid Horizontal Slices

Do not write all tests first and then all implementation. Work vertically:

```text
RED: write one behavior test -> watch it fail
GREEN: write minimal code -> watch it pass
REFACTOR: clean safely while green
```

Each cycle should teach the next one.

## Workflow

### 1. Plan

Before writing code:

- Read `docs/agents/domain.md` if present and use the repo's domain vocabulary.
- Respect relevant entries in `docs/decisions/log.md`.
- Confirm the public interface or user-facing behavior.
- Confirm which behaviors are most important to test.
- Identify whether a deep module would make the behavior easier to test.
- List behaviors, not implementation steps.

Ask: "What should the public interface look like, and which behaviors are most important to test?"

### 2. Tracer Bullet

Write one test that confirms one behavior through the smallest useful public path. Watch it fail for the expected reason, then write the smallest implementation that makes it pass.

### 3. Incremental Loop

For each remaining behavior:

- Write one focused behavior test.
- Confirm it fails for the intended reason.
- Implement only enough code to pass.
- Keep tests focused on observable behavior.

### 4. Refactor

When all tests are green, refactor in small steps. After each step, rerun the relevant tests. Never refactor while red.

## Per-Cycle Checklist

- Test describes behavior, not implementation.
- Test uses a public interface.
- Test would survive internal refactoring.
- Code is minimal for this test.
- No speculative behavior was added.
