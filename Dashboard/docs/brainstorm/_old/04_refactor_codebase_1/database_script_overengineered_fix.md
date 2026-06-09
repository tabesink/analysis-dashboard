Right now database.py is doing too many jobs: it owns the DuckDB connection, creates runtime tables, applies additive migrations, creates indexes, backfills legacy data, and also contains read/write business operations. The file’s own docstring says UnifiedStore is a single-file store for all app data, and _init_schema() creates schema objects from schema.yaml plus many additional runtime tables and indexes directly in Python.

My expert recommendation: do not split everything at once. First remove schema definitions from database.py. Then later split the huge store into repositories.

The core problem

Right now, the codebase has this shape:

database.py
  - DuckDB connection management
  - table creation
  - sequence creation
  - ALTER TABLE migrations
  - index creation
  - legacy backfills
  - user operations
  - event operations
  - measurement operations
  - session operations
  - upload task operations
  - custom field operations

That creates entropy because a junior dev has to ask:

Where is the schema?
Answer: partly schema.yaml, partly database.py, partly migrations.py.

That is the thing to fix first.

Recommended simplification
Target architecture
server/storage/
  schema_registry.yaml      # all declared tables, columns, indexes, sequences
  schema_loader.py          # reads schema registry
  schema_applier.py         # applies CREATE/ALTER/INDEX statements
  migrations.py             # owns schema versioning + safe upgrades
  database.py               # connection owner + temporary facade
  repositories/
    users_repo.py
    sessions_repo.py
    events_repo.py
    measurements_repo.py
    uploads_repo.py
    custom_fields_repo.py

Do this in phases. Do not jump straight to repositories.

Phase 1: Move schema facts out of database.py

Create or expand a schema registry.

I would rename the current schema file from:

server/schema.yaml

to:

server/storage/schema_registry.yaml

Or, if you want less disruption, keep the existing file name but expand its responsibility:

server/schema.yaml

The current schema.yaml already acts as a source of truth for some schema definitions, while SchemaLoader is already designed to load declared schema and generate SQL from it. So you are not inventing a new pattern — you are completing an existing one.

Example registry shape
version: 1

sequences:
  seq_channel_map_id:
    start: 1
  seq_meas_raw_id:
    start: 1
  seq_custom_field_value_id:
    start: 1
  seq_event_custom_field_value_id:
    start: 1
  seq_ingestion_artifact_id:
    start: 1

tables:
  users:
    category: auth
    columns:
      id:
        type: VARCHAR
        primary_key: true
      username:
        type: VARCHAR
        nullable: false
        unique: true
      role:
        type: VARCHAR
        nullable: false
      password_hash:
        type: VARCHAR
        nullable: true
      can_write:
        type: BOOLEAN
        default: false
      created_at:
        type: TIMESTAMP
        default: CURRENT_TIMESTAMP
      last_login_at:
        type: TIMESTAMP
        nullable: true
      last_settings_visit_at:
        type: TIMESTAMP
        nullable: true

  upload_tasks:
    category: ingestion
    columns:
      task_id:
        type: VARCHAR
        primary_key: true
      created_by_user_id:
        type: VARCHAR
        nullable: false
      status:
        type: VARCHAR
        nullable: false
      phase:
        type: VARCHAR
        nullable: false
      result_json:
        type: JSON
      created_at:
        type: TIMESTAMP
        default: CURRENT_TIMESTAMP
      expires_at:
        type: TIMESTAMP
        nullable: false

indexes:
  idx_users_username:
    table: users
    columns: [username]

  idx_upload_tasks_user:
    table: upload_tasks
    columns: [created_by_user_id]

  idx_upload_tasks_expires:
    table: upload_tasks
    columns: [expires_at]

Then database.py should no longer contain raw CREATE TABLE strings.

Phase 2: Make database.py call the schema system

Instead of this:

def _init_schema(self):
    conn.execute("CREATE TABLE IF NOT EXISTS users (...)")
    conn.execute("CREATE TABLE IF NOT EXISTS sessions (...)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_users_username ...")

Move toward this:

def _init_schema(self) -> None:
    with self.write_connection() as conn:
        self._schema_applier.apply(conn)

Then all schema logic lives in:

schema_registry.yaml
schema_loader.py
schema_applier.py
migrations.py

And database.py becomes a database access facade.

Phase 3: Separate schema changes from data backfills

Right now, _init_schema() includes both schema creation and data correction/backfill behavior. For example, it creates or alters columns and also updates legacy status/boolean values.

Separate them:

schema_applier.py
  - CREATE TABLE
  - ALTER TABLE ADD COLUMN IF NOT EXISTS
  - CREATE INDEX

data_backfills.py
  - UPDATE dim_event SET status = maturity WHERE ...
  - UPDATE dim_event SET rfq = COALESCE(...)

This matters because schema changes and data migrations have different risks.

Schema migration:
  Safe to run repeatedly if idempotent.

Data backfill:
  Must be reviewed carefully because it changes existing records.
Phase 4: Only then split repositories

After schema ownership is clean, split UnifiedStore slowly.

Do not immediately rewrite everything.

Start with the easiest, lowest-risk domain:

users_repo.py
sessions_repo.py

These are good first candidates because they are smaller and more isolated than event/measurement logic.

Before
database.py
  get_user_by_id()
  get_user_by_username()
  create_user()
  update_user_last_login()
  list_users()
  delete_user()
  get_program_ids()
  get_event()
  get_measurements()
  save_session()
  get_session()
After
database.py
  - owns connection
  - owns transaction helper
  - exposes read_connection/write_connection

repositories/users_repo.py
  - get_user_by_id()
  - get_user_by_username()
  - create_user()
  - list_users()
  - delete_user()

repositories/sessions_repo.py
  - save_session()
  - get_session()
  - delete_expired_sessions()

Keep this rule:

Repositories do not open their own DuckDB connections.
They receive the store/connection manager.

That avoids concurrency problems and keeps DuckDB access centralized.

What I would not do

I would not jump to SQLAlchemy.

I would not introduce Alembic yet.

I would not convert everything into a complex ORM.

I would not split every method into a tiny file immediately.

For this app, a clean DuckDB + schema registry + repository pattern is enough.

Recommended order
1. Inventory all runtime tables currently created in database.py.
2. Move sequences, tables, columns, and indexes into schema_registry.yaml.
3. Update SchemaLoader so it can generate all DDL from the registry.
4. Add schema compare/doctor command:
   declared schema vs live DuckDB.
5. Shrink database.py _init_schema() to one call:
   schema_applier.apply(conn).
6. Move data backfills into data_backfills.py.
7. After tests pass, split users/session methods into repositories.
8. Later split uploads/custom fields/measurements/events.

This is much better than:

schema.yaml says one thing
database.py creates another thing
live DB has a third thing
My strongest recommendation

Do this first:

Create one schema registry and move all runtime table definitions out of database.py.

Do not start by splitting UnifiedStore.

Why? Because if you split UnifiedStore while schema definitions are still scattered, you will just spread the confusion across more files.

The clean dependency direction should be:

schema_registry.yaml
        ↓
schema_loader.py
        ↓
schema_applier.py / migrations.py
        ↓
database.py
        ↓
repositories
        ↓
services / routers

That is the simplest path to lower entropy and easier production deployment.

## Progress Update (2026-05-15)

Completed from the recommended order:

1. Inventory runtime DDL in `database.py` and classify schema vs data behavior.
2. Move sequences/tables/additive-columns/indexes into declared schema (`server/schema.yaml`).
3. Extend `SchemaLoader` and add `SchemaApplier` for idempotent DDL.
4. Add schema compare/doctor reporting with statuses:
   - `OK`
   - `MISSING`
   - `TYPE_MISMATCH`
   - `DRIFT`
5. Shrink `_init_schema()` so DDL is delegated to schema application path.

Remaining steps (next refactor slices):

6. Move row-mutating backfills from `_init_schema()` into a dedicated backfill module with explicit invocation order after schema apply.
7. Keep startup behavior stable while making schema-mutation ownership easier to follow in one path.
8. Start repository extraction only after step 6 is complete:
   - first `users`
   - then `sessions`
   - keep one shared DuckDB connection owner in `database.py`.
9. Later split uploads/custom fields/measurements/events.