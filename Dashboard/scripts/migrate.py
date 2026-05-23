#!/usr/bin/env python3
"""
Database migration CLI tool.

Usage:
    python -m scripts.migrate status       # Show current vs target version
    python -m scripts.migrate up           # Apply pending migrations
    python -m scripts.migrate down         # Rollback last migration
    python -m scripts.migrate diff         # Show schema differences
    python -m scripts.migrate sql          # Print SQL that would be executed

Run from the project root directory.
"""

import argparse
import json
import sys
from pathlib import Path

# Add server to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from server.storage.migrations import MigrationRunner
from server.storage.schema_loader import SchemaLoader


def get_db_path() -> Path:
    """Get the database path from settings or default."""
    # Try to load from settings
    settings_path = Path(__file__).parent.parent / "server" / "settings.yaml"
    
    if settings_path.exists():
        import yaml
        with open(settings_path) as f:
            settings = yaml.safe_load(f)
        data_root = settings.get("data_root", "data")
    else:
        data_root = "data"
    
    return Path(data_root) / "unified.db"


def cmd_status(runner: MigrationRunner) -> int:
    """Show migration status."""
    status = runner.status()
    
    print("=" * 50)
    print("Database Migration Status")
    print("=" * 50)
    print(f"Schema file:     {status['schema_path']}")
    print(f"Database file:   {status['db_path']}")
    print(f"Current version: {status['current_version']}")
    print(f"Target version:  {status['target_version']}")
    print()
    
    if status['needs_migration']:
        print("⚠️  Migration needed!")
        print("Run 'python -m scripts.migrate up' to apply.")
        return 1
    else:
        print("✅ Database is up to date.")
        return 0


def cmd_up(runner: MigrationRunner) -> int:
    """Apply pending migrations."""
    print("Applying migrations...")
    result = runner.migrate_up()
    
    if result.get("success"):
        print(f"✅ Migration successful!")
        print(f"   Version: {result.get('version', 'unknown')}")
        print(f"   Statements: {result.get('statements_executed', 0)}")
        return 0
    else:
        print(f"❌ Migration failed: {result.get('error', 'Unknown error')}")
        return 1


def cmd_down(runner: MigrationRunner) -> int:
    """Rollback last migration."""
    print("Rolling back...")
    result = runner.migrate_down()
    
    if result.get("success"):
        print(f"✅ Rollback successful!")
        return 0
    else:
        print(f"❌ Rollback failed: {result.get('error', 'Unknown error')}")
        return 1


def cmd_diff(runner: MigrationRunner) -> int:
    """Show schema differences."""
    diff = runner.generate_migration_diff()
    
    print("=" * 50)
    print("Schema Difference Report")
    print("=" * 50)
    print(f"Schema version: {diff['schema_version']}")
    print(f"DB version:     {diff['db_version']}")
    print()
    
    print("Tables in schema.yaml:")
    for table in sorted(diff['tables_in_schema']):
        print(f"  - {table}")
    print()
    
    print("Tables in database:")
    for table in sorted(diff['tables_in_db']):
        print(f"  - {table}")
    print()
    
    if diff['missing_tables']:
        print("⚠️  Missing tables (need to be created):")
        for table in diff['missing_tables']:
            print(f"  - {table}")
    
    if diff['extra_tables']:
        print("ℹ️  Extra tables (not in schema.yaml):")
        for table in diff['extra_tables']:
            print(f"  - {table}")

    doctor_summary = diff.get("doctor_summary", {})
    doctor_report = diff.get("doctor_report", [])
    if doctor_report:
        print()
        print("Schema doctor summary:")
        for status in ("OK", "MISSING", "TYPE_MISMATCH", "DRIFT"):
            print(f"  - {status}: {doctor_summary.get(status, 0)}")

        print()
        print("Schema doctor table report:")
        for entry in sorted(doctor_report, key=lambda item: item["table"]):
            status = entry["status"]
            table = entry["table"]
            details = entry.get("details", {})
            print(f"  - [{status}] {table}")

            type_mismatches = details.get("type_mismatches", [])
            missing_columns = details.get("missing_columns", [])
            extra_columns = details.get("extra_columns", [])
            reason = details.get("reason")

            if reason:
                print(f"      reason: {reason}")
            if missing_columns:
                print(f"      missing_columns: {', '.join(missing_columns)}")
            if extra_columns:
                print(f"      extra_columns: {', '.join(extra_columns)}")
            if type_mismatches:
                for mismatch in type_mismatches:
                    print(
                        "      type_mismatch: "
                        f"{mismatch['column']} declared={mismatch['declared_type']} live={mismatch['live_type']}"
                    )
    
    return 0


def cmd_sql(runner: MigrationRunner) -> int:
    """Print SQL that would be executed."""
    print("-- Generated SQL from schema.yaml")
    print(f"-- Schema version: {runner.schema_loader.version}")
    print()
    
    for stmt in runner.schema_loader.generate_all_sql():
        print(stmt + ";")
        print()
    
    return 0


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Database migration tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    
    parser.add_argument(
        "command",
        choices=["status", "up", "down", "diff", "sql"],
        help="Migration command to run"
    )
    
    parser.add_argument(
        "--db",
        type=Path,
        default=None,
        help="Path to database file (default: data/unified.db)"
    )
    
    parser.add_argument(
        "--schema",
        type=Path,
        default=None,
        help="Path to schema.yaml (default: server/schema.yaml)"
    )
    
    args = parser.parse_args()
    
    # Set up paths
    db_path = args.db or get_db_path()
    schema_path = args.schema
    
    # Create runner
    schema_loader = SchemaLoader(schema_path) if schema_path else None
    runner = MigrationRunner(db_path, schema_loader)
    
    # Execute command
    commands = {
        "status": cmd_status,
        "up": cmd_up,
        "down": cmd_down,
        "diff": cmd_diff,
        "sql": cmd_sql,
    }
    
    return commands[args.command](runner)


if __name__ == "__main__":
    sys.exit(main())
