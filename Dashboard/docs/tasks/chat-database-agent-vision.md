# Chat With Database Agent Vision

Date: 2026-04-27
Status: PLANNING

This document is guidance for coding agents implementing the chat route. It
captures the product vision, architectural boundaries, and non-goals before
code is written.

## Product Vision

The app is a lightweight, production-ready analytics workbench. Users upload
and manage data through the existing database route, then use a chat route to
ask questions about that database in natural language.

The chat experience is not a general chatbot. It is a focused database
assistant powered by a LangChain SQL Deep Agent. Its job is to help users
understand the database contents, schema, available fields, and query results
without requiring them to write SQL manually.

The app should stay lean and bloat-free:

- No persistent multi-chat history.
- No server-side chat session table.
- No conversation picker, rename flow, archive flow, or chat management UI.
- No speculative agent tools outside database analysis.
- No write-capable database actions from chat in the first implementation.

On page refresh, the chat state is cleared. A fresh page load starts a fresh
ephemeral conversation.

## Source Of Truth

This repo currently uses DuckDB through `server/storage/database.py` and exposes
read connections through the existing dependency and service layers. If a future
implementation switches to SQLite, this document should be revised first.

For this codebase, coding agents should plan against the existing DuckDB-backed
database unless the user explicitly says otherwise.

Important references:

- `docs/database-schema.txt` is the schema source of truth.
- `server/storage/database.py` owns database initialization and connections.
- `server/dependencies.py` exposes `DatabaseDep`, `CurrentUserDep`, and service
  dependencies.
- `server/services/query.py` shows the existing pattern for safe read queries,
  parameterization, limits, and cache-aware dashboard access.
- `client/src/components/layout/ClientLayout.tsx` wraps non-login pages with the
  app sidebar, site header, and main content region.
- `docs/DESIGN.md` defines the UI style for the chat page.

## Core User Flow

1. User logs into the app.
2. User opens `/chat` from the existing app sidebar.
3. The chat page renders inside the normal app shell, including `AppSidebar` and
   `SiteHeader`.
4. User asks a database question in natural language.
5. The frontend sends the current ephemeral message list to the backend.
6. The backend invokes a LangChain SQL Deep Agent with read-only database tools.
7. The agent inspects schema and executes safe read queries as needed.
8. The backend returns the assistant answer and any compact query/result context
   needed by the UI.
9. Refreshing the page clears the conversation.

## Architecture Principles

Follow SOLID principles, but keep the implementation small:

- Single Responsibility: route handlers validate HTTP concerns only; agent
  orchestration belongs in a service; SQL guardrails belong in a database tool
  or executor layer; UI components only render chat state.
- Open/Closed: make it possible to add more tools later without changing the
  route contract, but do not add unused abstractions.
- Dependency Inversion: inject settings, current user, and database access
  through existing FastAPI dependency patterns.
- Interface Segregation: expose only the minimal chat API needed by the client:
  send messages, receive one assistant response, surface a safe error.
- Least Privilege: the SQL agent must only get read-only database access in v1.

## Backend Target Shape

Add a new authenticated route under `/api/v1/chat`.

Recommended module boundaries:

- `server/models/chat.py`
  - Pydantic request and response models.
  - Validate message roles and content length.
  - Keep the payload simple: current ephemeral messages in, assistant message
    out.
- `server/services/chat_agent.py`
  - Builds and invokes the LangChain SQL Deep Agent.
  - Owns the system prompt.
  - Injects a read-only SQL toolset.
  - Converts LangChain messages to/from API models.
- `server/services/sql_agent_tools.py`
  - Owns schema inspection and safe SQL execution.
  - Enforces SELECT-only queries, denylisted statements, timeouts, row limits,
    and table allowlists.
  - Uses the existing DuckDB read connection.
- `server/routers/chat.py`
  - Authenticated route using `CurrentUserDep`.
  - Calls the chat agent service.
  - Returns generic client-safe errors.
- `server/main.py`
  - Registers the chat router.
- `server/config.py`
  - Adds chat settings: model name, maximum messages, maximum prompt length,
    SQL row limit, SQL timeout, and OpenAI API key via environment only.
- `server/middleware/rate_limiter.py`
  - Adds a chat-specific rate limit category.

Do not store conversation history in the database. The client sends the
ephemeral context needed for the current request.

## LangChain SQL Deep Agent Requirements

Use LangChain Deep Agent capabilities for planning and tool use. The agent must
be database-focused, not a generic assistant.

The system prompt should make these invariants explicit:

- You are a database assistant for this analytics dashboard.
- Answer using the connected database and schema when relevant.
- Prefer concise answers with the reasoning summarized in user language.
- Do not claim to modify data.
- Do not execute writes, DDL, deletes, updates, inserts, exports, imports, or
  filesystem operations.
- If the question cannot be answered from the database, say what information is
  missing.

The SQL executor must enforce safety outside the prompt. Do not rely on prompt
instructions alone.

Minimum SQL guardrails:

- Only allow a single statement.
- Only allow `SELECT` or dialect-equivalent read-only introspection statements
  needed for schema inspection.
- Reject `INSERT`, `UPDATE`, `DELETE`, `MERGE`, `DROP`, `ALTER`, `CREATE`,
  `COPY`, `EXPORT`, `IMPORT`, `ATTACH`, `DETACH`, `INSTALL`, `LOAD`, `CALL`,
  `PRAGMA` unless a specific read-only pragma is intentionally allowlisted.
- Apply a maximum row limit even if the generated SQL omits one.
- Apply a query timeout.
- Restrict accessible tables/views to an explicit allowlist.
- Return compact result samples, not unbounded data dumps.

## Frontend Target Shape

Add a `/chat` route that remains inside the normal app layout. Do not add a
layout exception like the login page.

Recommended module boundaries:

- `client/src/app/chat/page.tsx`
  - Auth check consistent with existing dashboard pages.
  - Owns ephemeral messages and pending/error state.
  - Clears naturally on refresh because state is local.
- `client/src/lib/api/chat.ts`
  - Small typed wrapper around `/api/v1/chat`.
- `client/src/components/chat/`
  - Adapt the `.references/shadcn-chatbot-kit` composition: message list,
    auto-scroll, prompt suggestions, composer.
  - Remove or defer file attachments, audio, ratings, conversation management,
    and tool debug panels for v1.
- `client/src/config/sidebar-config.ts`
  - Adds a Chat navigation item.

The UI should follow `docs/DESIGN.md`:

- Pure white page background.
- Grayscale surfaces only.
- No shadows.
- Static containers use 12px radius.
- Interactive controls use pill radius.
- Inputs have white background, light gray border, silver placeholder, and blue
  focus ring only.
- Typography stays restrained: regular and medium weights only.
- Avoid decorative motion and unnecessary transitions.

## API Contract Direction

Keep the first contract non-streaming unless streaming is explicitly requested.
This keeps implementation and tests smaller.

Example shape:

```json
{
  "messages": [
    { "role": "user", "content": "Which programs have the most events?" }
  ]
}
```

Example response:

```json
{
  "message": {
    "role": "assistant",
    "content": "Program X has the most events, followed by Program Y..."
  }
}
```

Future streaming can be added later as a separate endpoint or transport without
changing the core agent service.

## Production Readiness

Production-ready does not mean large. For this feature it means:

- Authenticated route.
- Dedicated rate limit.
- No hardcoded secrets.
- Environment-based OpenAI credentials.
- Safe, generic client-facing errors.
- Server logs contain enough detail to debug failures without leaking secrets.
- Agent SQL is read-only and bounded.
- Tests mock the LLM/provider so CI never calls OpenAI.
- UI handles pending, success, empty, and error states.

## Non-Goals For V1

- Persistent chat sessions.
- Multiple conversations per user.
- Conversation titles.
- Chat export.
- File attachments.
- Audio input.
- Agent writes to the database.
- Admin operations through chat.
- Cross-user chat history.
- Long-term memory.
- Vector search or RAG over external documents.
- Dashboard plot generation from chat.

## Open Decisions To Confirm Before Implementation

These were not confirmed yet and should be raised before coding if they matter
to the implementation:

- Whether the user meant DuckDB, SQLite, or a generic SQL abstraction. Current
  repo evidence points to DuckDB.
- Whether the SQL agent may execute read-only SQL directly with guardrails, or
  must ask for confirmation before each query.
- Whether responses should include generated SQL for transparency.
- Whether token streaming is required in v1.
- Which exact OpenAI model should be the default.

## Suggested Implementation Sequence

1. Add backend config, models, rate-limit category, and a mocked chat route.
2. Add the read-only SQL tool layer with unit tests for blocked statements,
   limits, and allowlists.
3. Wire the LangChain SQL Deep Agent service using OpenAI settings.
4. Add the frontend `/chat` page and typed API wrapper.
5. Adapt the chatbot-kit UI primitives to the local design system.
6. Add sidebar navigation.
7. Run backend tests, frontend lint/type checks, and a manual authenticated chat
   smoke test.

## Success Criteria

- `/chat` appears in the sidebar and renders inside the existing app shell.
- Refreshing `/chat` clears the conversation.
- A logged-in user can ask a natural-language question about the database and
  receive an answer based on read-only SQL.
- The backend rejects unsafe SQL even if the model tries to produce it.
- No chat messages are persisted server-side.
- The implementation remains small, typed, and easy for future agents to reason
  about.
