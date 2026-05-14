---
name: simple-upload-timeout-hardening
overview: "Use a minimal, local-network-friendly approach to reduce upload interruption risk: keep current 24h auth policy and increase upload request timeout to 60 minutes."
todos:
  - id: set-upload-timeout
    content: Set CSV upload timeout to 60 minutes in upload API layer
    status: completed
  - id: verify-long-upload
    content: Run/observe long upload behavior to confirm timeout no longer triggers early
    status: completed
  - id: document-decision
    content: Add concise decision log entry for local-network timeout strategy
    status: completed
isProject: false
---

# Simple Upload Timeout Hardening

## Goal

Reduce user-facing upload interruptions without adding refresh-token/session complexity.

## Constraints Chosen

- Keep production auth guard unchanged (`jwt_expiry_hours` stays 24).
- Keep solution lightweight for a small local-network user group.
- Primary fix targets long upload timeout risk.

## Why This Is The Right Simple Fix

- Auto sign-out during a single upload is unlikely unless token expires mid-flow over very long timeframes.
- The immediate practical failure mode is `XMLHttpRequest` timeout on large uploads.
- Increasing upload timeout is a low-risk, single-point change.

## Implementation Steps

1. Update upload timeout used by `postFormDataWithProgress` calls for CSV upload to **60 minutes** (`3_600_000 ms`).
2. Keep auth expiry at 24h; do not modify production security validator.
3. Verify behavior with a long-running folder upload and confirm no timeout-triggered failure before 60m.
4. Add short docs note recording this operational decision.

## Target Files

- [/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/lib/api/upload.ts](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/lib/api/upload.ts)
- [/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/docs/decisions/log.md](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/docs/decisions/log.md)

## Verification

- Manual: trigger a representative large CSV folder upload and confirm no client timeout until 60 minutes.
- Manual: ensure auth still behaves normally (no config regression in production guard).

