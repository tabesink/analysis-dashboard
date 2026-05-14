---
name: diagnose
description: Disciplined diagnosis loop for hard bugs and performance regressions: reproduce, minimize, hypothesize, instrument, fix, and regression-test. Use when the user asks to debug, diagnose, investigate something broken/failing/throwing, or analyze a performance regression.
---

# Diagnose

A disciplined loop for hard bugs. Skip phases only when explicitly justified.

Before exploring code, read `docs/agents/domain.md` if present, then the domain docs it points to. In this repo, also respect `AGENTS.md`, `docs/master-build-plan.md`, `docs/test-strategy.md`, and relevant entries in `docs/decisions/log.md`.

## Phase 1: Build A Feedback Loop

This is the skill. If you have a fast, deterministic, agent-runnable pass/fail signal for the bug, you can find the cause. Bisection, hypothesis testing, and instrumentation all consume that signal.

Try feedback loops in roughly this order:

1. Failing test at the smallest public interface that reaches the bug.
2. HTTP script against a running dev server.
3. CLI invocation with fixture input and expected output.
4. Browser automation for UI bugs.
5. Replay a captured request, payload, trace, or event log.
6. Throwaway harness around the smallest runnable subsystem.
7. Property or fuzz loop for intermittent wrong output.
8. Bisection harness for regressions across commits, datasets, or versions.
9. Differential loop comparing old/new versions or configs.
10. Human-in-the-loop script using `scripts/hitl-loop.template.sh` as a last resort.

Improve the loop until it is fast, sharp, and deterministic enough to trust. For nondeterministic bugs, raise the reproduction rate with repetition, stress, parallelism, seeded randomness, and timing probes.

If you cannot build a loop, stop and say so. List what you tried and ask for a captured artifact, access to the reproducing environment, or permission to add temporary instrumentation.

## Phase 2: Reproduce

Run the loop and confirm:

- The failure matches the user-described symptom.
- The failure is reproducible enough to debug.
- The exact symptom is captured for later verification.

Do not proceed until the bug is reproduced.

## Phase 3: Hypothesize

Generate 3-5 ranked hypotheses before testing any of them. Each hypothesis must be falsifiable:

> If X is the cause, then changing Y will make the bug disappear or changing Z will make it worse.

Share the ranked list before testing when practical. Proceed if the user is unavailable.

## Phase 4: Instrument

Each probe must map to a prediction from Phase 3. Change one variable at a time.

Prefer:

1. Debugger or REPL inspection.
2. Targeted logs at boundaries that distinguish hypotheses.
3. Focused measurements for performance bugs.

Tag temporary debug logs with a unique prefix like `[DEBUG-a4f2]` so cleanup is reliable.

## Phase 5: Fix And Regression Test

Write the regression test before the fix when a correct public seam exists. A correct seam exercises the real bug pattern as it occurs at the call site.

If no correct seam exists, document that architecture gap. If one exists:

1. Turn the minimized repro into a failing test.
2. Watch it fail.
3. Apply the smallest fix.
4. Watch it pass.
5. Re-run the original feedback loop.

## Phase 6: Cleanup And Postmortem

Before declaring done:

- Original repro no longer reproduces.
- Regression test passes, or absence of a correct seam is documented.
- Temporary `[DEBUG-...]` instrumentation is removed.
- Throwaway prototypes are deleted or moved to a clearly marked debug location.
- The correct hypothesis is captured in the final summary, commit, or PR message.

If the bug exposed a hard-to-test or shallow module, recommend `improve-codebase-architecture` after the fix is verified.
