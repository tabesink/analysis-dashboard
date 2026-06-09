# FALLOW-15: Add Fallow audit CI gate with baselines

**Type:** HITL  
**Effort:** Medium  
**Fallow category:** CI integration / guardrails  
**Fallow evidence:** 193 dead-code + 31 dupes + 137 complexity issues at baseline

## What to build

After Phase 1 cleanup issues (FALLOW-01 through FALLOW-05) reduce noise, add Fallow to CI so new regressions are caught on pull requests.

Steps:

1. Add `fallow` as a `devDependency` in `client/package.json` (pinned version).
2. Run baseline capture after cleanup:
   ```bash
   cd client
   npx fallow dead-code --save-baseline ../fallow-baselines/dead-code.json
   npx fallow health    --save-baseline ../fallow-baselines/health.json
   npx fallow dupes     --save-baseline ../fallow-baselines/dupes.json
   ```
3. Add `.fallowrc.json` in `client/` configuring audit baselines and rule severities (start with warn, not error, for inherited categories).
4. Add GitHub Actions job (or extend existing client CI) running:
   ```bash
   npx fallow audit --dead-code-baseline fallow-baselines/dead-code.json \
                    --health-baseline fallow-baselines/health.json \
                    --dupes-baseline fallow-baselines/dupes.json
   ```
5. Commit `fallow-baselines/` outside `.fallow/` cache directory.

**HITL decision needed:** whether CI should `fail` on warn-tier findings or only on newly introduced error-tier findings. Default recommendation: gate on new issues only (`--gate` default) with warn visibility.

## Acceptance criteria

- [ ] `fallow` devDependency pinned in `client/package.json`
- [ ] `fallow-baselines/` committed with dead-code, health, and dupes snapshots
- [ ] `.fallowrc.json` documents audit baseline paths and rule severities
- [ ] CI workflow runs `fallow audit` on pull requests touching `client/`
- [ ] CI passes on `main` after baseline cleanup; fails if a new unused dependency is introduced
- [ ] README or `docs/` note explains how to refresh baselines after intentional cleanup

## Blocked by

- FALLOW-01 (unused deps)
- FALLOW-02 (unused files)
- FALLOW-03 (shadcn scaffold)
- FALLOW-04 (barrel indexes)
- FALLOW-05 (config exports)

## Fallow finding reference

See [Fallow CI integration docs](https://github.com/fallow-rs/fallow#ci-integration). Baseline workflow prevents CI from failing on pre-existing legacy debt while blocking new regressions.
