---
name: Docker Image Handoff Setup
overview: Update the deployment scripts so `Deployment/docker-build.sh` builds the `Dashboard` app images via compose and exports a shareable `.tar.gz` archive in `Deployment`, while `Deployment/docker-run.ps1` cleanly loads and runs those images with production-oriented defaults.
todos:
  - id: fix-build-paths
    content: Refactor docker-build.sh to target Dashboard paths and compose file reliably from Deployment.
    status: completed
  - id: archive-output
    content: Ensure docker-build.sh always writes dashboard-images.tar.gz to Deployment with clear success output.
    status: completed
  - id: harden-run-script
    content: Refine docker-run.ps1 defaults and startup flow for portable recipient usage.
    status: completed
  - id: verify-handoff
    content: Validate expected sender/recipient workflow and document assumptions in script output/comments.
    status: completed
isProject: false
---

# Docker Image Handoff Plan

## Goal

Make the deployment handoff self-contained: build images from the app in `Dashboard`, save the compressed Docker image archive into `Deployment`, and ensure recipients can run with `docker-run.ps1` using stable lightweight production defaults.

## Planned Changes

- Update `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Deployment/docker-build.sh](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Deployment/docker-build.sh)` to:
  - Resolve paths explicitly so it reads version from `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/VERSION](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/VERSION)`.
  - Build from compose in `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Deployment/docker-compose.yml](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Deployment/docker-compose.yml)`.
  - Ensure build contexts target `Dashboard` app folders correctly (without requiring manual file copies next to the script).
  - Export a compressed archive (`dashboard-images.tar.gz`) into the `Deployment` folder for sharing.
- Update `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Deployment/docker-run.ps1](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Deployment/docker-run.ps1)` to keep recommended runtime defaults:
  - Load image archive automatically when present.
  - Run detached containers with `--restart unless-stopped`.
  - Use fixed ports `3000` (client) and `8000` (server).
  - Keep persistent data/log mounts for production continuity.
  - Keep key runtime values centralized at top-of-file for easy recipient edits.

## Validation Plan

- Dry-check script logic for correct path assumptions (build from `Deployment`, source from `Dashboard`).
- Verify produced archive path and filename are in `Deployment`.
- Verify run script behavior order: load image -> ensure network/directories -> restart containers cleanly -> show access URLs.
- Confirm recipient workflow is straightforward:
  - `docker load -i dashboard-images.tar.gz` (implicit in script)
  - `./docker-run.ps1` from `Deployment`

## Current Gaps Addressed by This Plan

- Existing build script assumes `VERSION`, `client`, and `server` are local to `Deployment`.
- Shareable handoff path for the built archive is not guaranteed to stay in `Deployment`.
- Recipient experience needs a single predictable run path with sane production defaults.

