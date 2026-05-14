---
name: Fix DuckDB connection conflict
overview: Fix the DuckDB ConnectionException that occurs when a background export thread holds a read-write connection while an API handler tries to open a read-only connection to the same file.
todos:
  - id: fix-conn
    content: "Refactor UnifiedStore in database.py: replace _write_lock with RLock, drop read_only=True from read_connection, guard lazy init with the lock"
    status: completed
isProject: false
---

# Fix DuckDB Connection Conflict

## Problem

DuckDB forbids opening two connections to the same file **with different configurations** in the same process. The current design uses `read_only=True` for reads and a normal (RW) connection for writes. When a long-running export holds an RW connection in a background thread, any concurrent API request that lazily opens the read-only connection explodes with `ConnectionException`.

The `write_connection()` context manager already closes the read connection before opening an RW one (line 94 of [database.py](Dashboard/server/storage/database.py)), but that only protects the **same thread** -- it does nothing to prevent a **different thread** (the API handler) from re-opening a read-only connection while the export thread still holds its RW connection.

## Options

### Option A: Single shared RW connection (recommended)

Stop using `read_only=True` entirely. Use a single persistent RW connection for reads (or open short-lived RW connections), and gate all access behind a `threading.RLock`.

**Changes in [database.py](Dashboard/server/storage/database.py):**

- Replace `_write_lock` with an `RLock` (reentrant, so nested calls like `_init_schema` -> `write_connection` work).
- Change `read_connection` to open with `duckdb.connect(db_path)` (no `read_only`).
- Acquire the lock in `read_connection` access too (or, simpler: just use a single connection for everything since DuckDB supports concurrent reads on the same connection).

**Pros:**

- Eliminates the root cause -- all connections have the same configuration.
- Minimal code change (~10 lines in `__init__`, `read_connection`, `write_connection`).
- No API or caller changes needed; the 42 `read_connection` call sites remain unchanged.

**Cons:**

- Serializes reads and writes through one lock (acceptable for this app's scale -- single-user admin dashboard, not a high-throughput service).
- A long export blocks reads until it finishes (but reads are fast DuckDB scans, so the lock contention window per-read is tiny; the export holds the lock across `COPY` calls, so this is real during export).

---

### Option B: RLock guard around all connection access (keep read_only)

Keep the read-only / read-write split, but protect **both** with the same lock so they never overlap.

**Changes in [database.py](Dashboard/server/storage/database.py):**

- Replace `_write_lock = threading.Lock()` with `_conn_lock = threading.RLock()`.
- Wrap `read_connection` property in `self._conn_lock.acquire()`/`release()` (or use a context manager for every read call).
- `write_connection` acquires the same lock.

**Pros:**

- Preserves the read-only safety semantics.

**Cons:**

- Holding a lock for every read is awkward because `read_connection` is a **property** -- callers do `self.read_connection.execute(...)`, which means the lock would need to span the `.execute()` call, not just the property access. This would require wrapping every read call site (42 of them) in a lock, or returning a proxy object. Much more invasive.
- Overly complex for what it buys.

---

### Option C: Copy-on-export (export from a file copy)

Before exporting, copy the `.db` file to a temp path and export from there, leaving the live DB untouched.

**Changes in [database.py](Dashboard/server/storage/database.py) `export_to_parquet`:**

- `shutil.copy2(self.db_path, tmp_path)` then `duckdb.connect(tmp_path, read_only=True)` for the export.

**Pros:**

- Zero contention -- export never touches the live file.
- Reads and writes continue unimpeded during export.

**Cons:**

- Doubles disk usage temporarily (the DB can be large with measurement data).
- Export snapshot may miss writes that happen after the copy -- acceptable for export but worth noting.
- Does not fix the same class of bug if it occurs elsewhere (e.g. import, migrations). Treats the symptom, not the cause.

---

## Recommendation: Option A

Option A is the cleanest fix. It removes the config mismatch at the root, requires the smallest diff, and doesn't touch any caller code. The serialization trade-off is irrelevant at this app's scale.

Concretely, the change is:

1. Replace `_write_lock` with `_db_lock = threading.RLock()`.
2. Change `read_connection` to open without `read_only=True`.
3. In `write_connection`, close and reopen the shared connection after each write (to see committed data), still under the same lock.
4. Guard `read_connection` lazy init with the lock to prevent races during the `None` check.

This keeps the external API identical -- every `self.read_connection.execute(...)` call works as before.