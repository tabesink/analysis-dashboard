Below is a coding-agent-ready plan for a lightweight **monochrome ASCII Typer CLI admin schema viewer** for `analysis-dashboard`.

I’ll name the deployment script:

```bash
deploy-admin-tools.sh
```

## Context from the repo

The schema viewer should target the `Dashboard/server` app. The repo has a `server/schema.yaml` file that is explicitly documented as the source of truth for dim tables and filter options, while non-dim tables and indexes are currently managed in `server/storage/database.py`. ([GitHub][1])

The live store is DuckDB. `UnifiedStore` describes a single-file DuckDB store containing metadata tables, measurement tables, user state tables, sessions, filters, and access logs. ([GitHub][2]) The settings layer defines `data_root` and computes the database path as `data_root / "dashboard.db"`. ([GitHub][3])

Use **read-only DuckDB connections** for this admin viewer so it can inspect the database without changing data. DuckDB’s Python docs note that `read_only=True` is available and is required when multiple Python processes access the same database file at the same time. ([DuckDB][4])

---

# Build plan: lightweight admin schema CLI

## 1. Add a standalone admin tool folder

Create this structure:

```text
Dashboard/
  admin_tools/
    __init__.py
    cli.py
    config.py
    db_introspection.py
    schema_yaml.py
    ascii_table.py
    screens.py
    navigation.py
    README.md
  scripts/
    deploy-admin-tools.sh
```

Keep it separate from the FastAPI server runtime so it does not add entropy to the app. It should only **read**:

```text
Dashboard/server/schema.yaml
Dashboard/server/settings.yaml
Dashboard/data/dashboard.db OR detected live DB path
```

---

## 2. Use minimal dependencies

Use:

```text
typer
duckdb
pyyaml
prompt_toolkit
```

Reason:

```text
typer          CLI commands and entry point
duckdb         read-only DB schema introspection
pyyaml         read schema.yaml
prompt_toolkit optional arrow-key navigation
```

Typer is suitable because it is designed for Python CLI applications based on type hints. ([typer.tiangolo.com][5]) For monochrome output, disable Typer/Rich styling using `rich_markup_mode=None` or the `TYPER_USE_RICH=0` environment variable. Typer documents this Rich formatting override. ([typer.tiangolo.com][6])

---

## 3. CLI commands to implement

```bash
admin-db tui
admin-db tables
admin-db table dim_event
admin-db indexes
admin-db sequences
admin-db compare
admin-db export --out schema-report.txt
admin-db doctor
```

Command purpose:

```text
tui       Interactive monochrome menu
tables    List all live DuckDB tables
table     Show columns, types, nullability, defaults, PK-ish info
indexes   Show indexes from live DB
sequences Show known DuckDB sequences
compare   Compare schema.yaml definitions vs live DuckDB tables
export    Save ASCII schema report to .txt or .md
doctor    Check DB path, schema.yaml path, settings path, read-only connection
```

---

# CLI UX plan

## Main screen

```text
+------------------------------------------------------------+
| ANALYSIS DASHBOARD ADMIN DB VIEWER                         |
+------------------------------------------------------------+
| Database : data/dashboard.db                               |
| Mode     : READ ONLY                                       |
| Schema   : server/schema.yaml                              |
+------------------------------------------------------------+

[1] Tables
[2] Table Detail
[3] Indexes
[4] Sequences
[5] YAML vs Live DB Compare
[6] Export Schema Report
[7] Doctor / Health Check
[Q] Quit

Select:
```

For the first version, use numeric navigation because it is simple and junior-friendly. Add arrow-key selection using `prompt_toolkit` after the core commands are stable.

---

## Tables screen

```text
+----+----------------------------+------------+----------------+
| #  | table_name                 | columns    | source         |
+----+----------------------------+------------+----------------+
| 1  | dim_program                | 3          | schema.yaml    |
| 2  | dim_event                  | 30+        | schema.yaml/db |
| 3  | users                      | 8          | database.py    |
| 4  | sessions                   | 10         | database.py    |
| 5  | upload_tasks               | 11         | database.py    |
| 6  | measurements_raw           | 5          | database.py    |
| 7  | measurements_lttb          | 5          | database.py    |
| 8  | custom_field_definitions   | 7          | database.py    |
+----+----------------------------+------------+----------------+

[B] Back   [Q] Quit   Enter table #:
```

---

## Table detail screen

```text
+------------------------------------------------------------+
| TABLE: users                                                |
+------------------------------------------------------------+
| Purpose: application users / admin write control             |
| Source : live DuckDB                                         |
+----+--------------------------+-----------+----------+---------+
| #  | column                   | type      | nullable | default |
+----+--------------------------+-----------+----------+---------+
| 1  | id                       | VARCHAR   | NO       |         |
| 2  | username                 | VARCHAR   | NO       |         |
| 3  | role                     | VARCHAR   | NO       |         |
| 4  | password_hash            | VARCHAR   | YES      |         |
| 5  | can_write                | BOOLEAN   | YES      | FALSE   |
| 6  | created_at               | TIMESTAMP | YES      | now     |
| 7  | last_login_at            | TIMESTAMP | YES      |         |
| 8  | last_settings_visit_at   | TIMESTAMP | YES      |         |
+----+--------------------------+-----------+----------+---------+

[I] Indexes for this table   [B] Back   [Q] Quit
```

---

## YAML vs live DB compare screen

```text
+------------------------------------------------------------+
| SCHEMA COMPARE                                              |
+------------------------------------------------------------+
| schema.yaml tables : dim_program, dim_event                 |
| live DB tables    : dim_program, dim_event, users, ...      |
+----------------------+------------+------------+-------------+
| table                | in_yaml    | in_db      | status      |
+----------------------+------------+------------+-------------+
| dim_program          | yes        | yes        | OK          |
| dim_event            | yes        | yes        | OK          |
| users                | no         | yes        | runtime     |
| sessions             | no         | yes        | runtime     |
| upload_tasks         | no         | yes        | runtime     |
+----------------------+------------+------------+-------------+
```

This is useful because the repo currently splits schema responsibility between `schema.yaml` and `database.py`. ([GitHub][1])

---

# Implementation plan

## Phase 1 — Core read-only schema introspection

Implement `db_introspection.py`.

Responsibilities:

```python
def connect_readonly(db_path: Path) -> duckdb.DuckDBPyConnection:
    return duckdb.connect(str(db_path), read_only=True)

def list_tables(conn) -> list[TableSummary]:
    # query information_schema.tables

def list_columns(conn, table_name: str) -> list[ColumnInfo]:
    # query information_schema.columns

def list_indexes(conn) -> list[IndexInfo]:
    # use DuckDB metadata functions where available

def list_sequences(conn) -> list[SequenceInfo]:
    # query DuckDB catalog / information schema fallback
```

Do not execute arbitrary SQL from user input. Only use parameterized metadata queries.

---

## Phase 2 — YAML schema reader

Implement `schema_yaml.py`.

Responsibilities:

```python
def load_schema_yaml(path: Path) -> SchemaYaml:
    # parse version, sequences, tables, columns

def get_yaml_table_names(schema: SchemaYaml) -> set[str]:
    ...

def compare_yaml_to_live(yaml_schema, live_tables) -> list[SchemaCompareRow]:
    ...
```

This should not import server internals. It should read `server/schema.yaml` directly so the admin tool remains independent.

---

## Phase 3 — ASCII renderer

Implement `ascii_table.py`.

Rules:

```text
- No colours by default.
- No emojis.
- No Rich tables.
- Use +---+ ASCII borders.
- Clip long cells with ...
- Always fit terminal width when possible.
- Keep empty/null values visible as blank or NULL.
```

Functions:

```python
render_table(headers: list[str], rows: list[list[str]], max_width: int = 120) -> str
render_key_value(title: str, values: dict[str, str]) -> str
render_box(title: str, body: str) -> str
```

---

## Phase 4 — Typer command layer

Implement `cli.py`.

Example command shape:

```python
import typer

app = typer.Typer(
    name="admin-db",
    help="Monochrome admin database schema viewer.",
    rich_markup_mode=None,
    add_completion=False,
)

@app.command()
def tables(
    db_path: Path | None = typer.Option(None, "--db-path"),
    settings_path: Path | None = typer.Option(None, "--settings"),
):
    """List live DuckDB tables."""
    ...
```

Resolution priority:

```text
1. --db-path
2. ADMIN_TOOLS_DB_PATH
3. settings.yaml data_root + dashboard.db
4. fail with clear error and suggested path
```

---

## Phase 5 — Interactive navigation

Implement `screens.py` and `navigation.py`.

Keep it simple:

```text
Screen loop:
1. clear screen
2. print screen
3. read key / command
4. route to next screen
```

Use this first:

```text
input("Select: ")
```

Then add optional arrow navigation:

```text
prompt_toolkit.shortcuts.radiolist_dialog
```

But keep the rendering monochrome. Do not turn this into a heavy TUI framework.

---

## Phase 6 — Export report

Add:

```bash
admin-db export --out schema-report.txt
```

Report sections:

```text
1. DB path and timestamp
2. Live tables summary
3. Table-by-table column details
4. Indexes
5. YAML vs live comparison
6. Warnings
```

This makes it useful for code reviews and junior developers.

---

# Deployment plan with `deploy-admin-tools.sh`

Place script here:

```text
Dashboard/scripts/deploy-admin-tools.sh
```

Purpose:

```text
- Create isolated admin tools virtual environment
- Install minimal dependencies
- Create executable wrapper: Dashboard/.admin-tools/bin/admin-db
- Run doctor check
- Print usage commands
```

## Bash script skeleton

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOOLS_DIR="${ROOT_DIR}/admin_tools"
VENV_DIR="${ROOT_DIR}/.venv-admin-tools"
BIN_DIR="${ROOT_DIR}/.admin-tools/bin"
WRAPPER="${BIN_DIR}/admin-db"

echo "Deploying Analysis Dashboard admin tools"
echo "Root: ${ROOT_DIR}"

if [ ! -d "${TOOLS_DIR}" ]; then
  echo "ERROR: admin_tools folder not found: ${TOOLS_DIR}"
  exit 1
fi

python3 -m venv "${VENV_DIR}"

# shellcheck disable=SC1091
source "${VENV_DIR}/bin/activate"

python -m pip install --upgrade pip

python -m pip install \
  "typer>=0.12" \
  "duckdb>=1.0" \
  "pyyaml>=6.0" \
  "prompt_toolkit>=3.0"

mkdir -p "${BIN_DIR}"

cat > "${WRAPPER}" <<EOF
#!/usr/bin/env bash
set -euo pipefail
export TYPER_USE_RICH=0
ROOT_DIR="${ROOT_DIR}"
source "${VENV_DIR}/bin/activate"
cd "\${ROOT_DIR}"
python -m admin_tools.cli "\$@"
EOF

chmod +x "${WRAPPER}"

echo
echo "Admin tools deployed."
echo
echo "Try:"
echo "  ${WRAPPER} doctor"
echo "  ${WRAPPER} tables"
echo "  ${WRAPPER} tui"
echo
echo "Optional:"
echo "  export ADMIN_TOOLS_DB_PATH=/path/to/dashboard.db"
```

---

# Acceptance criteria

The coding agent is done when these pass:

```bash
./scripts/deploy-admin-tools.sh
./.admin-tools/bin/admin-db doctor
./.admin-tools/bin/admin-db tables
./.admin-tools/bin/admin-db table dim_event
./.admin-tools/bin/admin-db indexes
./.admin-tools/bin/admin-db compare
./.admin-tools/bin/admin-db export --out schema-report.txt
```

Expected behavior:

```text
- Never writes to the DB.
- Opens DuckDB in read-only mode.
- Works while FastAPI app is running.
- Uses monochrome ASCII output.
- Does not require the frontend.
- Does not require a web browser.
- Does not add API routes.
- Does not import heavy server modules.
- Gives junior-readable errors.
```

---

# Coding-agent prompt

Use this prompt directly:

```text
You are a senior Python developer building a lightweight admin-only CLI tool for the repository:

https://github.com/tabesink/analysis-dashboard.git

Objective:
Create a monochrome ASCII Typer CLI viewer that helps an admin inspect and understand the DuckDB database schemas used by the Dashboard app.

Important repo context:
- The app lives under Dashboard/.
- server/schema.yaml is the source of truth for dim tables and UI filter schema.
- server/storage/database.py creates additional live DuckDB runtime tables, user/session/upload tables, custom field tables, and indexes.
- server/config.py derives the DuckDB path as data_root / "dashboard.db".
- This tool must be read-only and must not modify the database.

Build:
Create:

Dashboard/admin_tools/
  __init__.py
  cli.py
  config.py
  db_introspection.py
  schema_yaml.py
  ascii_table.py
  screens.py
  navigation.py
  README.md

Dashboard/scripts/deploy-admin-tools.sh

Functional requirements:
1. Implement Typer command `admin-db`.
2. Commands:
   - admin-db doctor
   - admin-db tables
   - admin-db table <table_name>
   - admin-db indexes
   - admin-db sequences
   - admin-db compare
   - admin-db export --out schema-report.txt
   - admin-db tui
3. Use DuckDB read-only connections only.
4. Resolve DB path in this order:
   - --db-path
   - ADMIN_TOOLS_DB_PATH
   - settings.yaml data_root + dashboard.db
   - clear failure message
5. Read schema.yaml directly using PyYAML.
6. Compare schema.yaml tables against live DuckDB tables.
7. Render all output using plain ASCII tables.
8. Keep UI monochrome. Disable Rich formatting with Typer.
9. Do not create FastAPI routes.
10. Do not add this to the web app.
11. Keep code junior-friendly: small files, simple functions, clear names, comments only where useful.

Deployment script:
Create Dashboard/scripts/deploy-admin-tools.sh that:
- creates .venv-admin-tools
- installs typer, duckdb, pyyaml, prompt_toolkit
- creates wrapper .admin-tools/bin/admin-db
- sets TYPER_USE_RICH=0
- runs admin-db doctor
- prints usage examples

Acceptance commands:
./scripts/deploy-admin-tools.sh
./.admin-tools/bin/admin-db doctor
./.admin-tools/bin/admin-db tables
./.admin-tools/bin/admin-db table dim_event
./.admin-tools/bin/admin-db indexes
./.admin-tools/bin/admin-db compare
./.admin-tools/bin/admin-db tui
```

My recommendation: build Phase 1 with numeric menus first, then add arrow-key navigation once the schema introspection is reliable.

[1]: https://github.com/tabesink/analysis-dashboard/blob/master/Dashboard/server/schema.yaml "analysis-dashboard/Dashboard/server/schema.yaml at master · tabesink/analysis-dashboard · GitHub"
[2]: https://github.com/tabesink/analysis-dashboard/raw/refs/heads/master/Dashboard/server/storage/database.py "raw.githubusercontent.com"
[3]: https://github.com/tabesink/analysis-dashboard/blob/master/Dashboard/server/config.py "analysis-dashboard/Dashboard/server/config.py at master · tabesink/analysis-dashboard · GitHub"
[4]: https://duckdb.org/docs/current/clients/python/dbapi.html?utm_source=chatgpt.com "Python DB API"
[5]: https://typer.tiangolo.com/?utm_source=chatgpt.com "Typer"
[6]: https://typer.tiangolo.com/tutorial/commands/help/?utm_source=chatgpt.com "Command Help - Typer"
