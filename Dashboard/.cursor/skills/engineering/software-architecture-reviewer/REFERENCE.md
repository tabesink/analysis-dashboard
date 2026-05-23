# Architecture Review Reference

Use this checklist when running `software-architecture-reviewer`.

## Purpose

Inspect a codebase, infer its current architecture, compare against current best practices for the stack, and produce an evidence-based critique for developers, tech leads, and coding agents.

## Reviewer mindset

- Senior architect stance, not bug-hunt only.
- Prefer understandable, maintainable designs unless complexity is justified.
- Distinguish:
  - actual problems
  - plausible future risks
  - cosmetic preferences
  - missing information
  - assumptions

## Mandatory research rule

Before final conclusions, run targeted research for the exact technologies in use.

Prioritize sources in this order:

1. Official framework docs and maintainers' architecture guides.
2. Cloud/vendor reference architectures when relevant.
3. Mature engineering blogs from reputable teams.
4. High-quality community guides.
5. Random blogs only if better sources do not exist.

Research goals:

- Current recommended architecture for the stack
- Known anti-patterns and migration changes
- Current security/deployment guidance
- Relevant examples for similar systems

Always include a `Research consulted` section in final output.

## Inputs to inspect

- Repo structure and README/architecture docs
- Dependency manifests and lockfiles
- Entry points, routers, controllers, API layer
- Domain/service layer and adapters/integrations
- Persistence models, repositories, migrations
- AuthN/AuthZ and tenant boundaries
- Workers/queues/schedulers/background processing
- Environment/config handling and secrets usage
- Error handling, logging, tracing, metrics, health checks
- CI/CD, Docker, deployment configs, migration workflow
- Testing layout and test pyramid coverage

If the codebase is large, sample representative modules and state scope.

## Standard process

### 1) Identify stack

Determine and report, marking unknowns as assumptions:

- frontend/backend frameworks
- database and ORM
- auth approach
- deployment/runtime platform
- state management
- testing/build tooling
- LLM/RAG/agent frameworks if present
- critical external services

### 2) Build architecture map

Capture:

- main modules and ownership boundaries
- request flow and data flow
- dependency direction
- state ownership and side-effect locations
- runtime/deployment topology
- configuration boundaries

### 3) Evaluate architectural fitness

Assess each lens:

- Modularity
- Separation of concerns
- Dependency direction
- Data flow clarity
- Scalability realism
- Reliability/resilience
- Security architecture
- Testing architecture
- Observability
- Deployment/operations readiness
- Evolvability

### 4) Produce recommendations

For each major critique include:

1. Problem
2. Evidence in code
3. Why it matters
4. Recommended fix
5. Risk/effort level
6. Priority

Avoid generic statements like "use clean architecture."

## Architecture smells

Watch for:

- business logic in route handlers or UI components
- components/routes calling many unrelated APIs directly
- persistence models leaking across layers
- missing service layer where complexity requires it
- too many abstraction layers for app size
- giant `utils`/`helpers` dumping grounds
- circular dependencies
- duplicated domain logic across client/server
- inconsistent naming/folder conventions
- mixed sync/async without clear rationale
- inconsistent error strategy
- weak authorization boundaries
- scattered environment variable access
- oversized files with mixed responsibilities
- hidden global state
- premature microservice split
- weak migration discipline
- no testing pyramid
- no observability beyond console logs
- LLM/RAG without evaluation, tracing, or lifecycle strategy

## Severity rubric

- **Critical**: security failure, data loss, outage risk, tenant leak, financial risk, or unsafe deployability.
- **High**: major reliability/scaling pain, severe delivery slowdown, or high feature risk.
- **Medium**: maintainability/consistency issues without immediate production threat.
- **Low**: minor polish, docs, naming, or localized cleanup.
- **Positive**: architectural choices worth preserving.

## Preferred report structure

```text
# Software Architecture Review
## 1. Executive Summary
## 2. Codebase Architecture Map
## 3. Strengths
## 4. Findings by Severity
## 5. Prioritized Improvement Plan
## 6. Low-risk vs High-risk Changes
## 7. Architectural Decisions to Document
## Research consulted
```

Executive summary should include:

- overall assessment
- major strengths
- major risks
- stage-appropriateness judgment
- top 3 improvements
