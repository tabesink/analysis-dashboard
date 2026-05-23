---
name: software-architecture-reviewer
description: Reviews a codebase's software architecture for maintainability, scalability, reliability, security boundaries, and long-term evolution risk, with evidence-based findings and prioritized recommendations. Use when the user asks to review architecture, critique system design, assess maintainability/scalability, identify architectural smells/technical debt, or produce architecture documentation from an existing codebase.
---

# Software Architecture Reviewer

Perform a senior-level architecture critique of an existing codebase. Focus on system fitness, not style nitpicks.

## Quick start

1. Identify stack and runtime/deployment assumptions.
2. Build a concise architecture map from representative code paths.
3. Run targeted web research for current stack guidance before conclusions.
4. Compare implementation vs intended architecture and best practices.
5. Report strengths, risks, and prioritized recommendations with evidence.

## Required behavior

- Be skeptical but fair; keep simplicity when it is sufficient.
- Separate actual problems, future risks, assumptions, and preferences.
- Do not recommend heavy patterns unless the codebase clearly needs them.
- Mark uncertain findings explicitly as assumptions.
- If repo is large, sample representative modules and state sampled scope.

## Workflow

1. **Discover architecture**
   - Inspect structure, entry points, routing, service/persistence layers, auth, jobs/workers, integrations, config, tests, observability, and deployment files.
2. **Map system flow**
   - Document module boundaries, dependency direction, request/data flow, state ownership, side effects, and runtime topology.
3. **Research current guidance**
   - Use official docs first, then reputable architecture references for the exact stack and versions.
4. **Evaluate fitness**
   - Score modularity, separation of concerns, dependency direction, data flow, scalability, reliability, security, testing, observability, operations, and evolvability.
5. **Recommend changes**
   - For each major issue: problem, evidence, why it matters, fix, risk/effort, and priority.

## Output format

Always produce:

1. `# Software Architecture Review`
2. `## 1. Executive Summary`
3. `## 2. Codebase Architecture Map`
4. `## 3. Strengths`
5. `## 4. Findings by Severity` (Critical/High/Medium/Low)
6. `## 5. Prioritized Improvement Plan` (top 3 first)
7. `## 6. Low-risk vs High-risk Changes`
8. `## 7. Architectural Decisions to Document`
9. `## Research consulted` with links and short source notes

## Advanced guidance

Use the detailed rubric, severity model, smell catalog, and recommendation rules in [REFERENCE.md](REFERENCE.md).
