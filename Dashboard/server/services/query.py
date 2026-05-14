"""Query service for dashboard data operations."""

import json
import logging
from pathlib import Path
from typing import Any

from server.config import Settings
from server.storage.database import UnifiedStore
from server.storage.schema_loader import get_schema_loader
from server.utils.boolean_filters import build_boolean_filter_condition
from server.utils.cache import CacheKeys, SimpleCache
from server.utils.weight_ranges import apply_derived_weight_ranges
from server.utils.weight_filters import build_weight_range_condition

logger = logging.getLogger(__name__)


class QueryService:
    """
    Service for querying dashboard data.

    Executes SQL directly against the unified database with caching support.
    """

    def __init__(self, db: UnifiedStore, cache: SimpleCache, settings: Settings):
        self.db = db
        self.cache = cache
        self.settings = settings

    def get_program_ids(
        self,
        exclude_pending_only: bool = False,
        pending_only: bool = False,
        global_filters: dict[str, list[str] | str] | None = None,
    ) -> list[str]:
        """
        Get all unique program IDs.
        
        Args:
            exclude_pending_only: If True, only return programs with Approved/Obsolete events
            pending_only: If True, only return programs with Pending events
            global_filters: Optional dict of filter column -> values for bidirectional filtering
        """
        # Build cache key including filters for proper invalidation
        filter_key = json.dumps(global_filters, sort_keys=True) if global_filters else "none"
        cache_key = f"{CacheKeys.PROGRAM_IDS}:{exclude_pending_only}:{pending_only}:{filter_key}"

        return self.cache.get_or_set(
            cache_key,
            lambda: self.db.get_program_ids(exclude_pending_only, pending_only, global_filters),
            self.settings.caching.program_ids_ttl_seconds,
        )

    def get_versions(
        self,
        program_id: str | None = None,
        status_values: list[str] | None = None,
        program_ids: list[str] | None = None,
        global_filters: dict[str, list[str] | str] | None = None,
    ) -> list[str]:
        """
        Get all versions, optionally filtered by program(s), status, and global filters.
        
        Args:
            program_id: Single program ID (for backwards compatibility)
            status_values: List of status values to filter by
            program_ids: List of program IDs (for multi-program support)
            global_filters: Optional dict of filter column -> values for bidirectional filtering
        """
        # Build cache key including all parameters
        effective_program_ids = program_ids or ([program_id] if program_id else [])
        program_key = ",".join(sorted(effective_program_ids)) if effective_program_ids else "all"
        status_key = ",".join(sorted(status_values)) if status_values else "all"
        filter_key = json.dumps(global_filters, sort_keys=True) if global_filters else "none"
        cache_key = f"{CacheKeys.VERSIONS}:{program_key}:{status_key}:{filter_key}"

        return self.cache.get_or_set(
            cache_key,
            lambda: self.db.get_versions(
                program_id=program_id,
                status_values=status_values,
                program_ids=program_ids,
                global_filters=global_filters,
            ),
            self.settings.caching.versions_ttl_seconds,
        )

    def get_events(
        self,
        program_ids: list[str] | None = None,
        versions: list[str] | None = None,
        status_values: list[str] | None = None,
        global_filters: dict[str, list[str] | str] | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[dict[str, Any]], int]:
        """
        Get events with filtering and pagination.

        Returns tuple of (events, total_count).
        """
        # Build base query
        conditions = ["is_deleted = false"]
        params: list[Any] = []

        if program_ids:
            placeholders = ", ".join(["?"] * len(program_ids))
            conditions.append(f"program_id IN ({placeholders})")
            params.extend(program_ids)

        if versions:
            placeholders = ", ".join(["?"] * len(versions))
            conditions.append(f"version IN ({placeholders})")
            params.extend(versions)

        if status_values:
            placeholders = ", ".join(["?"] * len(status_values))
            conditions.append(f"status IN ({placeholders})")
            params.extend(status_values)

        # Apply global filters using schema-defined column mapping
        if global_filters:
            schema_loader = get_schema_loader()
            filter_column_map = schema_loader.get_filter_column_map()
            custom_field_keys = {
                field["field_key"]
                for field in self.db.get_custom_field_definitions(filterable_only=True)
            }

            event_id_query = global_filters.get("event_id_query")
            if isinstance(event_id_query, str) and event_id_query.strip():
                conditions.append("LOWER(event_id) LIKE ?")
                params.append(f"%{event_id_query.strip().lower()}%")

            for filter_key, filter_values in global_filters.items():
                if filter_key == "event_id_query":
                    continue
                if not isinstance(filter_values, list) or not filter_values:
                    continue
                boolean_condition = build_boolean_filter_condition(filter_key, filter_values)
                if boolean_condition is not None:
                    condition_sql, condition_params = boolean_condition
                    conditions.append(condition_sql)
                    params.extend(condition_params)
                    continue
                weight_condition = build_weight_range_condition(filter_key, filter_values)
                if weight_condition is not None:
                    condition_sql, condition_params = weight_condition
                    conditions.append(condition_sql)
                    params.extend(condition_params)
                    continue
                if filter_key in filter_column_map:
                    column = filter_column_map[filter_key]
                    placeholders = ", ".join(["?"] * len(filter_values))
                    conditions.append(f"{column} IN ({placeholders})")
                    params.extend(filter_values)
                    continue
                if filter_key in custom_field_keys:
                    placeholders = ", ".join(["?"] * len(filter_values))
                    conditions.append(
                        "event_id IN ("
                        "SELECT event_id FROM event_custom_field_values "
                        f"WHERE field_key = ? AND value IN ({placeholders})"
                        ")"
                    )
                    params.append(filter_key)
                    params.extend(filter_values)

        where_clause = " AND ".join(conditions)

        # Get total count
        count_query = f"SELECT COUNT(*) FROM dim_event WHERE {where_clause}"
        total = self.db.read_connection.execute(count_query, params).fetchone()[0]

        # Get paginated results
        data_query = f"""
            SELECT * FROM dim_event 
            WHERE {where_clause}
            ORDER BY program_id, version, event_id
            LIMIT ? OFFSET ?
        """
        result = self.db.read_connection.execute(
            data_query, params + [limit, offset]
        ).fetchall()

        columns = [desc[0] for desc in self.db.read_connection.description]
        events = [dict(zip(columns, row)) for row in result]
        event_ids = [event["event_id"] for event in events]
        custom_field_map = self.db.get_event_custom_field_values(event_ids)
        for event in events:
            event["custom_fields"] = custom_field_map.get(event["event_id"], {})
            channel_map = self.db.get_channel_map(event["program_id"], event["version"])
            has_channel_map = len(channel_map) > 0
            event["has_channel_map"] = has_channel_map
            event["missing_channel_map"] = False
            event["selectable_for_plotting"] = has_channel_map

        return events, total

    def get_all_events(
        self,
        global_filters: dict[str, list[str] | str] | None = None,
        limit: int = 500,
        offset: int = 0,
    ) -> dict[str, Any]:
        """
        Get all events (no partition split).

        Returns:
            {
                "events": [...],
                "total_count": int,
                "has_more": bool,
            }
        """
        events, total_count = self.get_events(
            global_filters=global_filters,
            limit=limit,
            offset=offset,
        )
        user_ids = {
            str(user_id)
            for event in events
            for user_id in (event.get("uploaded_by_user_id"), event.get("last_updated_by_user_id"))
            if user_id
        }
        usernames_by_id = self._resolve_usernames_by_id(user_ids)
        for event in events:
            uploaded_by_user_id = event.get("uploaded_by_user_id")
            last_updated_by_user_id = event.get("last_updated_by_user_id")
            event["uploaded_by_username"] = usernames_by_id.get(uploaded_by_user_id)
            event["last_updated_by_username"] = usernames_by_id.get(last_updated_by_user_id)
        existing_keys = {(event["program_id"], event["version"]) for event in events}
        for pending in self.db.get_pending_program_versions():
            key = (pending["program_id"], pending["version"])
            if key in existing_keys:
                continue
            events.append(
                {
                    "event_id": f"__pending_channel_map__::{pending['program_id']}::{pending['version']}",
                    "program_id": pending["program_id"],
                    "version": pending["version"],
                    "status": "Pending",
                    "custom_fields": {},
                    "source_file": None,
                    "row_count": 0,
                    "has_channel_map": False,
                    "missing_channel_map": True,
                    "selectable_for_plotting": False,
                }
            )
        return {
            "events": events,
            "total_count": total_count,
            "has_more": (offset + len(events)) < total_count,
        }

    def get_event_count(
        self,
        global_filters: dict[str, list[str] | str] | None = None,
    ) -> dict[str, int]:
        """Get total event count without fetching full data."""
        _, count = self.get_events(
            global_filters=global_filters,
            limit=0,
            offset=0,
        )
        return {"total": count}

    def get_plot_data(
        self,
        event_ids: list[str],
        plot_keys: list[str],
    ) -> list[dict[str, Any]]:
        """
        Get LTTB plot data for specified events and plot keys.

        Returns list of series data for plotting.
        Cached for 10 minutes (plot data is immutable after ingestion).
        """
        if not event_ids or not plot_keys:
            return []

        # Build cache key from sorted IDs (order-independent)
        cache_key = (
            f"{CacheKeys.PLOT_DATA}:"
            f"{','.join(sorted(event_ids))}:"
            f"{','.join(sorted(plot_keys))}"
        )

        return self.cache.get_or_set(
            cache_key,
            lambda: self._fetch_plot_data(event_ids, plot_keys),
            self.settings.caching.plot_data_ttl_seconds,
        )

    def _fetch_plot_data(
        self,
        event_ids: list[str],
        plot_keys: list[str],
    ) -> list[dict[str, Any]]:
        """Fetch plot data from database (called by get_plot_data on cache miss)."""
        # OPTIMIZED: Bulk fetch event metadata (1 query instead of N)
        events_map = self._get_events_metadata_bulk(event_ids)

        # OPTIMIZED: Fetch ALL plot data in ONE query (1 query instead of 8)
        df = self.db.get_lttb_bulk(event_ids, plot_keys)
        
        if df.empty:
            return []

        series = []
        # OPTIMIZED: Group by (plot_key, event_id) in one pass
        for (plot_key, event_id), group in df.groupby(["plot_key", "event_id"], sort=False):
            event_meta = events_map.get(event_id, {})
            
            # OPTIMIZED: Vectorized conversion (100x faster than iterrows)
            points = [
                {"x": x, "y": y}
                for x, y in zip(group["x"].tolist(), group["y"].tolist())
            ]
            
            series.append({
                "event_id": event_id,
                "plot_key": plot_key,
                "status": event_meta.get("status"),
                "points": points,
            })

        return series

    def get_plot_data_binary(
        self,
        event_ids: list[str],
        plot_keys: list[str],
    ) -> list[dict[str, Any]]:
        """
        Get LTTB plot data optimized for binary encoding.
        
        Returns list of dicts with x/y as numpy arrays instead of point dicts.
        Not cached - binary encoding is fast enough.
        """
        import numpy as np
        
        if not event_ids or not plot_keys:
            return []
        
        # Fetch all plot data in one query
        df = self.db.get_lttb_bulk(event_ids, plot_keys)
        
        if df.empty:
            return []
        
        series = []
        for (plot_key, event_id), group in df.groupby(["plot_key", "event_id"], sort=False):
            series.append({
                "event_id": event_id,
                "plot_key": plot_key,
                "x": group["x"].to_numpy(dtype=np.float32),
                "y": group["y"].to_numpy(dtype=np.float32),
            })
        
        return series

    def get_channel_map(self, program_id: str, version: str) -> list[dict[str, Any]]:
        """Get channel map for a program/version."""
        return self.db.get_channel_map(program_id, version)

    def get_filter_options(self, program_id: str | None = None) -> dict[str, dict[str, Any]]:
        """
        Get configured filter options from schema.yaml.
        
        Returns dict: display_name -> {column, order, values}
        """
        cache_key = f"{CacheKeys.FILTER_OPTIONS}:{program_id or 'all'}"
        return self.cache.get_or_set(
            cache_key,
            lambda: self._get_filter_options_uncached(program_id=program_id),
            self.settings.caching.filter_options_ttl_seconds,
        )

    def update_filter_options(
        self, updated_options: dict[str, dict[str, Any]]
    ) -> dict[str, dict[str, Any]]:
        """
        Update filter option values globally (admin-only usage at router layer).

        Only values are mutable; column and order remain schema-defined.
        """
        schema_options = get_schema_loader().get_filter_options()
        overrides: dict[str, list[str]] = {}

        for display_name, schema_entry in schema_options.items():
            incoming = updated_options.get(display_name)
            if not incoming:
                overrides[display_name] = schema_entry.get("values", [])
                continue

            raw_values = incoming.get("values", [])
            if not isinstance(raw_values, list):
                raise ValueError(f"Invalid values for filter '{display_name}'")

            normalized = []
            for item in raw_values:
                if not isinstance(item, str):
                    raise ValueError(f"Invalid filter value type for '{display_name}'")
                trimmed = item.strip()
                if trimmed:
                    normalized.append(trimmed)
            overrides[display_name] = normalized

        self._save_filter_overrides(overrides)
        self.cache.invalidate_prefix(CacheKeys.FILTER_OPTIONS)
        return self.get_filter_options()

    def reset_filter_options(self) -> dict[str, dict[str, Any]]:
        """Reset server-global filter overrides to schema defaults."""
        override_path = self._get_filter_overrides_path()
        if override_path.exists():
            override_path.unlink()
        self.cache.invalidate_prefix(CacheKeys.FILTER_OPTIONS)
        return self.get_filter_options()

    def get_events_by_ids(self, event_ids: list[str]) -> list[dict[str, Any]]:
        """
        Get event metadata for a list of event IDs.
        
        Used for color grouping to fetch category values for baseline events.
        Returns list of event dictionaries with full metadata.
        """
        if not event_ids:
            return []

        events = []
        for event_id in event_ids:
            event = self.db.get_event(event_id)
            if event:
                events.append(event)
        
        return events

    @staticmethod
    def _event_timestamp_value(raw_value: Any) -> float:
        """Convert DB timestamp-like values to a comparable float."""
        if raw_value is None:
            return 0.0
        if hasattr(raw_value, "timestamp"):
            try:
                return float(raw_value.timestamp())
            except Exception:
                return 0.0
        return 0.0

    @staticmethod
    def _normalize_metadata_updates(updates: dict[str, Any]) -> dict[str, Any]:
        """Normalize metadata updates while preserving bool values."""
        normalized_updates: dict[str, Any] = {}
        for key, value in updates.items():
            if value is None:
                normalized_updates[key] = None
                continue
            if isinstance(value, bool):
                normalized_updates[key] = value
                continue
            if isinstance(value, str):
                trimmed = value.strip()
                normalized_updates[key] = trimmed or None
                continue
            normalized_updates[key] = value
        return normalized_updates

    def _resolve_usernames_by_id(self, user_ids: set[str]) -> dict[str, str]:
        """Resolve user IDs to usernames for response display fields."""
        usernames_by_id: dict[str, str] = {}
        for user_id in user_ids:
            user = self.db.get_user_by_id(user_id)
            username = user.get("username") if user else None
            if isinstance(username, str) and username.strip():
                usernames_by_id[user_id] = username
        return usernames_by_id

    def _invalidate_event_cache_groups(self) -> None:
        """Invalidate cache groups affected by metadata writes."""
        self.cache.invalidate_prefix(CacheKeys.EVENTS)
        self.cache.invalidate_prefix(CacheKeys.EVENT_COUNT)
        self.cache.invalidate_prefix(CacheKeys.PROGRAM_IDS)
        self.cache.invalidate_prefix(CacheKeys.VERSIONS)

    def invalidate_event_caches(self) -> None:
        """Public entry point for external writers (e.g. delete/purge in the upload router)
        to invalidate the same cache groups affected by metadata writes."""
        self._invalidate_event_cache_groups()

    def update_event_metadata(
        self,
        event_id: str,
        *,
        updates: dict[str, Any],
        current_user: dict[str, str],
    ) -> dict[str, Any]:
        """Update one event metadata row and return refreshed view model data."""
        existing = self.db.get_event(event_id)
        if not existing or existing.get("is_deleted"):
            raise LookupError(f"Event '{event_id}' not found")

        is_admin = current_user.get("role") == "admin"
        if not is_admin and existing.get("uploaded_by_user_id") != current_user.get("id"):
            raise PermissionError("You can only update metadata for your own uploads")
        if "status" in updates and not is_admin:
            raise PermissionError("Only admins can update status")

        normalized_updates = self._normalize_metadata_updates(updates)
        normalized_updates = apply_derived_weight_ranges(normalized_updates, include_nulls=True)
        normalized_updates["last_updated_by_user_id"] = current_user["id"]

        self.db.update_event(event_id, **normalized_updates)
        self.db.log_audit(
            action="metadata_update",
            event_id=event_id,
            user_id=current_user["id"],
            details={"updated_fields": sorted(normalized_updates.keys())},
        )
        self._invalidate_event_cache_groups()

        updated = self.db.get_event(event_id)
        if not updated:
            raise LookupError(f"Event '{event_id}' not found after update")
        custom_fields = self.db.get_event_custom_field_values([event_id]).get(event_id, {})
        uploaded_by_user_id = updated.get("uploaded_by_user_id")
        last_updated_by_user_id = updated.get("last_updated_by_user_id")
        user_ids = {
            str(user_id)
            for user_id in (uploaded_by_user_id, last_updated_by_user_id)
            if isinstance(user_id, str) and user_id.strip()
        }
        usernames_by_id = self._resolve_usernames_by_id(user_ids)
        return {
            **updated,
            "custom_fields": custom_fields,
            "uploaded_by_username": usernames_by_id.get(uploaded_by_user_id),
            "last_updated_by_username": usernames_by_id.get(last_updated_by_user_id),
        }

    def update_program_version_metadata(
        self,
        *,
        program_id: str,
        version: str,
        updates: dict[str, Any],
        current_user: dict[str, str],
    ) -> dict[str, Any]:
        """Batch update metadata for a program/version and return summary payload."""
        events = self.db.get_events(program_id=program_id, version=version)
        if not events:
            raise LookupError(f"No events found for program '{program_id}' version '{version}'")

        is_admin = current_user.get("role") == "admin"
        if not is_admin:
            has_unowned_events = any(
                event.get("uploaded_by_user_id") != current_user.get("id") for event in events
            )
            if has_unowned_events:
                raise PermissionError("You can only update metadata for your own uploads")
        if "status" in updates and not is_admin:
            raise PermissionError("Only admins can update status")

        normalized_updates = self._normalize_metadata_updates(updates)
        normalized_updates = apply_derived_weight_ranges(normalized_updates, include_nulls=True)
        normalized_updates["last_updated_by_user_id"] = current_user["id"]

        affected_event_count = self.db.update_program_version_events(
            program_id, version, **normalized_updates
        )
        self.db.log_audit(
            action="program_version_metadata_update_batch",
            user_id=current_user["id"],
            details={
                "program_id": program_id,
                "version": version,
                "updated_fields": sorted(normalized_updates.keys()),
                "affected_event_count": affected_event_count,
            },
        )
        self._invalidate_event_cache_groups()

        refreshed_events = self.db.get_events(program_id=program_id, version=version)
        latest_updated_event = max(
            refreshed_events,
            key=lambda e: self._event_timestamp_value(e.get("updated_at") or e.get("created_at")),
        )
        latest_uploaded_event = max(
            refreshed_events,
            key=lambda e: self._event_timestamp_value(e.get("created_at")),
        )
        status_values = {
            str(event.get("status")).strip()
            for event in refreshed_events
            if event.get("status") is not None and str(event.get("status")).strip()
        }
        uploaded_by_user_id = latest_uploaded_event.get("uploaded_by_user_id")
        last_updated_by_user_id = latest_updated_event.get("last_updated_by_user_id")
        user_ids = {
            str(user_id)
            for user_id in (uploaded_by_user_id, last_updated_by_user_id)
            if isinstance(user_id, str) and user_id.strip()
        }
        usernames_by_id = self._resolve_usernames_by_id(user_ids)
        return {
            "program_id": program_id,
            "version": version,
            "updated_event_count": len(refreshed_events),
            "status": next(iter(status_values)) if len(status_values) == 1 else "Mixed",
            "uploaded_by_user_id": uploaded_by_user_id,
            "uploaded_by_username": usernames_by_id.get(uploaded_by_user_id),
            "last_updated_by_user_id": last_updated_by_user_id,
            "last_updated_by_username": usernames_by_id.get(last_updated_by_user_id),
            "uploaded_at": (
                str(latest_uploaded_event.get("created_at"))
                if latest_uploaded_event.get("created_at")
                else None
            ),
            "last_updated_at": (
                str(latest_updated_event.get("updated_at") or latest_updated_event.get("created_at"))
                if (latest_updated_event.get("updated_at") or latest_updated_event.get("created_at"))
                else None
            ),
        }

    def _get_filter_options_uncached(self, program_id: str | None = None) -> dict[str, dict[str, Any]]:
        """Build effective filter options from schema + server overrides."""
        schema_options = get_schema_loader().get_filter_options()
        overrides = self._load_filter_overrides()

        merged: dict[str, dict[str, Any]] = {}
        for display_name, config in schema_options.items():
            merged[display_name] = {
                "column": config["column"],
                "order": config["order"],
                "values": overrides.get(display_name, config.get("values", [])),
                "source": "core",
                "data_type": "string",
            }

        custom_definitions = self.db.get_custom_field_definitions(filterable_only=True)
        next_order = (
            max((entry.get("order", 0) for entry in merged.values()), default=0) + 1
        )
        for definition in custom_definitions:
            display_name = definition["display_name"]
            field_key = definition["field_key"]
            values = self.db.get_custom_filter_option_values(
                field_key=field_key,
                program_id=program_id,
            )
            merged[display_name] = {
                "column": field_key,
                "order": next_order,
                "values": values,
                "source": "custom",
                "data_type": definition.get("data_type") or "string",
            }
            next_order += 1
        return merged

    def _get_filter_overrides_path(self) -> Path:
        """Path for persisted server-global filter overrides."""
        return self.settings.data_root / "filter_option_overrides.json"

    def _load_filter_overrides(self) -> dict[str, list[str]]:
        """Load persisted filter overrides from disk."""
        override_path = self._get_filter_overrides_path()
        if not override_path.exists():
            return {}

        with open(override_path, "r", encoding="utf-8") as f:
            raw_data = json.load(f)

        if not isinstance(raw_data, dict):
            return {}

        parsed: dict[str, list[str]] = {}
        for key, value in raw_data.items():
            if isinstance(key, str) and isinstance(value, list):
                parsed[key] = [item for item in value if isinstance(item, str)]
        return parsed

    def _save_filter_overrides(self, overrides: dict[str, list[str]]) -> None:
        """Persist filter overrides to disk."""
        override_path = self._get_filter_overrides_path()
        override_path.parent.mkdir(parents=True, exist_ok=True)
        with open(override_path, "w", encoding="utf-8") as f:
            json.dump(overrides, f, indent=2)

