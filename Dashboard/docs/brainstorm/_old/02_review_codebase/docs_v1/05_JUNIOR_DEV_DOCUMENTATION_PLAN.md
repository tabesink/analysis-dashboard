# Junior Developer Documentation Plan

## Goal

Create documentation that helps a junior developer understand, run, debug, and safely modify the application.

The documentation should be short, practical, and connected to real files in the codebase.

## Required Document: `JUNIOR_DEV_CODEBASE_GUIDE.md`

Use the following structure.

# Junior Developer Codebase Guide

## 1. What This App Does

Explain the app in plain language.

Example:

```text
This application lets internal users log in, view dashboard data, and perform selected admin operations.
```

## 2. How to Run the App Locally

Include exact commands.

```bash
# install dependencies
...

# create environment file
cp .env.example .env

# start backend
...

# start frontend
...
```

## 3. Important Folders

Use a table:

```markdown
| Folder | Purpose | Change Carefully? |
|---|---|---|
| frontend/... | UI pages and components | No |
| backend/... | API and server logic | Yes |
| backend/auth/... | Login and permissions | Yes |
| backend/data/... | Data access | Yes |
```

## 4. High-Level Architecture

Include a simple text diagram.

```text
Browser UI
   |
   v
Frontend routes/components
   |
   v
API client
   |
   v
Backend routes
   |
   v
Auth check
   |
   v
Service logic
   |
   v
Database or file storage
```

## 5. How Login Works

Explain:

- where the login page is
- which API route it calls
- how credentials are checked
- where the session/token is stored
- how logout works
- how protected pages are handled

## 6. How Permissions Work

Explain roles:

```text
admin: can manage data and settings
user: can view/use normal dashboard features
```

Document:

- how backend checks normal login
- how backend checks admin access
- where to add new protected routes
- where not to place permission logic

## 7. How API Routes Work

Explain the standard pattern:

```text
request comes in
validate input
check user
call service
return response
```

Show one real example from the codebase after review.

## 8. How Data Is Stored

Explain:

- database type
- important tables/files
- upload storage, if any
- what data is user-specific
- what data is shared

## 9. Where to Make Common Changes

Examples:

```markdown
| Task | Start Here | Notes |
|---|---|---|
| Add a new dashboard card | frontend/... | Use existing card pattern |
| Add a new API endpoint | backend/routes/... | Add auth check |
| Add admin-only action | backend/auth/... | Use requireAdmin |
| Change data import logic | backend/services/... | Add tests first |
```

## 10. Files to Be Careful With

List files where changes can break important behavior.

Examples:

- auth/session files
- database migration files
- dashboard calculation files
- import/export logic
- shared type definitions

## 11. Common Debugging Tips

Include:

- login fails
- API returns unauthorized
- dashboard does not load
- database cannot connect
- upload/import fails
- CORS error
- environment variable missing

## 12. Refactor Rules for Junior Developers

Use these rules:

1. Do not change working behavior without a test or smoke-test note.
2. Do not put permission checks only in frontend code.
3. Do not commit secrets.
4. Do not add large abstractions for small problems.
5. Keep route logic short.
6. Keep business logic in services.
7. Keep storage logic in data/repository functions.
8. Ask before changing auth, database schema, or dashboard calculations.
