> Superseded: this brainstorm prompt is historical context only. Current release
> and deployment guidance lives in the repo root `AGENT.md` and
> `Deployment/README.md`.

Here is a refined version of your prompt you can give to a coding agent:

````markdown
# Task: Production-Harden a Lightweight Local Multi-User Dashboard App

You are a senior software architect and pragmatic full-stack developer.

Your job is to review and improve this codebase:

https://github.com/tabesink/analysis-dashboard.git

## Core Goal

Production-harden this application while keeping it lightweight, understandable, and easy for a junior developer to maintain.

This is **not** a public SaaS application. It is intended to run on a **secure local network** for approximately **5–10 concurrent users**.

Do **not** over-engineer. Do not introduce unnecessary enterprise patterns, microservices, complex secrets management, or heavy infrastructure unless there is a clear and practical reason.

The app currently works. The goal is to reduce deployment friction, improve configuration clarity, improve version visibility, and make the app easier to run reliably on a different machine.

---

## First: Understand the Application

Before proposing changes, inspect the codebase and answer:

1. What is this dashboard used for?
2. Who are the users?
3. What are the core workflows?
4. What backend/frontend/database components exist?
5. How is the app currently configured?
6. How is it currently deployed?
7. What assumptions does the current code make about ports, URLs, database paths, auth, environment variables, and runtime mode?

Create a short architecture summary before recommending changes.

---

## Main Design Question

Evaluate whether it makes sense to introduce a **single source of truth for configuration** during development.

Currently, development happens from the dashboard repo root. I want to know whether the repo should have a clear root-level configuration system such as:

```text
analysis-dashboard/
  .env.example
  .env.development
  .env.production.example
  config/
    app.yaml
    development.yaml
    production.yaml
````

Or whether a simpler `.env`-only approach is better.

Evaluate both options and recommend the simplest maintainable approach.

---

## Desired Configuration Model

The application should support two clear modes:

### 1. Development Mode

Used while working inside the main repo.

Requirements:

* Easy local startup.
* Clear ports for frontend/backend/database.
* Easy to change API base URLs.
* Developer-friendly defaults.
* Minimal manual setup.
* Root-level config should be easy to find and understand.
* Avoid duplicated configuration across frontend, backend, scripts, and deployment files.

### 2. Production Deployment Mode

Used when the app is ready to run on a completely different machine.

Requirements:

* Deployment settings should live clearly inside the deployment folder or production config files.
* Ports, hostnames, database connection settings, frontend API URLs, and runtime mode should be configurable.
* I should be able to move/deploy the app onto another machine without hunting through the codebase for hardcoded values.
* Production deployment should be scriptable.
* A junior developer or admin should understand what values need to be changed.

---

## Versioning Requirement

When the app is ready for deployment, I want to bump the application version.

The application should recognize and display:

1. **Application version**
2. **Database schema/migration version**

These should appear subtly in appropriate UI locations, such as:

* Login screen footer
* Admin/settings/about screen
* Dashboard footer
* Health/status page

Do not clutter the UI.

Evaluate the best way to implement version awareness.

Consider:

* `package.json` frontend version
* backend app version
* shared `VERSION` file
* build-time injected version
* database migration version from Alembic or equivalent
* API endpoint such as `/api/system/version` or `/api/health`

Recommend one simple source of truth.

---

## Production Hardening Scope

Focus on practical production hardening for a secure local network.

Review and recommend improvements for:

### Configuration

* Remove hardcoded ports, URLs, and environment assumptions.
* Centralize configuration.
* Add `.env.example` files.
* Validate required environment variables at startup.
* Make development vs production mode explicit.

### Deployment

* Make deployment repeatable.
* Add or improve deployment scripts.
* Ensure the app can run on a new machine with clear setup steps.
* Document how to configure ports, host, database, and runtime mode.
* Keep scripts readable and low-risk.

### Database

* Confirm how migrations are handled.
* Ensure database version/schema version can be surfaced.
* Check whether the database location/connection is configurable.
* Avoid destructive migration behavior.
* Add clear backup/restore notes if needed.

### Runtime Reliability

* Health check endpoint.
* Startup validation.
* Clear logs.
* Graceful failure messages.
* Basic service status visibility.

### Authentication and Multi-User Behavior

* Since this is for 5–10 users on a secure local network, do not overbuild security.
* Still check for obvious issues:

  * password handling
  * session handling
  * concurrent login behavior
  * role separation if admin/user roles exist
  * accidental exposure of admin functions

### Frontend Visibility

* Display app version and DB version subtly.
* Show environment/runtime mode only where useful, such as admin/settings/status screen.
* Avoid developer noise in normal user workflows.

---

## What Not To Do

Do not:

* Rewrite the entire app.
* Introduce Kubernetes.
* Introduce complex cloud secret managers.
* Add unnecessary service discovery.
* Add heavy observability platforms.
* Add complex feature flag systems.
* Split the app into more services unless absolutely necessary.
* Overcomplicate auth for a trusted local network.
* Add abstractions that make the code harder for junior developers.

---

## Deliverables

Produce a practical implementation plan with these sections:

1. **Current Architecture Summary**
2. **Current Configuration Map**

   * Where config currently lives
   * Hardcoded values found
   * Duplicated settings found
3. **Recommended Configuration Strategy**

   * `.env` only vs config files
   * Single source of truth recommendation
   * Development vs production setup
4. **Versioning Strategy**

   * App version source of truth
   * DB version source of truth
   * API endpoint design
   * UI display locations
5. **Production Hardening Checklist**
6. **Deployment Folder Design**
7. **Proposed File/Folder Changes**
8. **Step-by-Step Implementation Plan**
9. **Testing Plan**
10. **Rollback Plan**
11. **Junior Developer Notes**

---

## Preferred Implementation Style

Use clear, lightweight, junior-friendly code.

Prefer:

* Simple functions over clever abstractions.
* Typed config objects.
* Explicit validation.
* Clear naming.
* Small focused files.
* Good comments where the intent is not obvious.
* Documentation that explains why, not just what.

---

## Final Goal

After this refactor, I want the workflow to feel like this:

### During Development

```bash
git clone ...
cp .env.example .env
./scripts/dev-start.sh
```

The app starts locally with clear development settings.

### Before Production

```bash
./scripts/bump-version.sh 1.2.0
```

The app version is updated and displayed in the UI.

### On Production Machine

```bash
cp deployment/.env.production.example deployment/.env.production
# edit ports, host, database path/url, runtime mode
./deployment/deploy.sh
```

The app deploys cleanly on another machine without editing source code.

---

## Key Question To Answer First

Before implementing anything, answer this:

> What is the simplest configuration and deployment structure that gives us a reliable single source of truth without over-engineering this lightweight local-network app?

```

My recommendation: use this prompt first as an **architecture review + implementation planning task**, not as an immediate coding task. After the agent returns the plan, have it implement only the smallest first slice: configuration inventory, `.env.example`, startup validation, and version endpoint.
```
