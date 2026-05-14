"""Data ingestion service with atomic transaction semantics."""

import logging
import os
import hashlib
import json
import threading
import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from server.config import Settings
from server.services.downsampling import LTTBDownsampler
from server.services.etl import (
    ChannelMapLoader,
    CSVParser,
    DataTransformer,
    DataValidator,
    RSPConverter,
    ValidationSeverity,
)
from server.storage.database import UnifiedStore
from server.utils.cache import CacheKeys, SimpleCache
from server.utils.weight_ranges import apply_derived_weight_ranges

logger = logging.getLogger(__name__)
UPLOAD_TASK_TTL_MINUTES = 30
FIXED_CHANNEL_MAP_PLOTS = [
    "bj_xy_force_plot",
    "bj_xz_force_plot",
    "shock_xy_force_plot",
    "shock_xz_force_plot",
    "bushing_f_xy_force_plot",
    "bushing_f_xz_force_plot",
    "bushing_r_xy_force_plot",
    "bushing_r_xz_force_plot",
]

@dataclass
class FileResult:
    """Result for a single file ingestion."""

    filename: str
    success: bool
    event_id: str | None = None
    error: str | None = None
    row_count: int = 0
    validation_issues: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class IngestionResult:
    """Result of the ingestion process."""

    success: bool
    files: list[FileResult] = field(default_factory=list)
    event_ids: list[str] = field(default_factory=list)
    error: str | None = None
    total_rows: int = 0
    pending_channel_map: bool = False


EventCommittedCallback = Callable[[str, int, int], None]
TaskPhaseCallback = Callable[[str], None]


class IngestionService:
    """
    Orchestrates file ingestion with parse/validate preflight and per-event commits.
    """

    def __init__(self, db: UnifiedStore, cache: SimpleCache, settings: Settings):
        self.db = db
        self.cache = cache
        self.settings = settings
        self.parser = CSVParser()
        self.channel_loader = ChannelMapLoader()
        self.rsp_converter = RSPConverter()
        self.transformer = DataTransformer()
        self.validator = DataValidator(settings.validation)
        self.downsampler = LTTBDownsampler(
            target_points=settings.lttb_resolution,
            inflection_eps=settings.lttb_inflection_eps,
            point_budget=settings.lttb_point_budget,
        )
        self.artifact_root = settings.data_root / "artifacts" / "channel-map"

    def _with_derived_weight_ranges(self, metadata: dict[str, Any]) -> dict[str, Any]:
        """Keep raw inputs and add derived range fields for filtering."""
        return apply_derived_weight_ranges(metadata)

    def _artifact_path_for(self, program_id: str, version: str, file_hash: str, filename: str) -> Path:
        """Build a stable managed artifact path for retained converted CSV bytes."""
        safe_program = "".join(c if c.isalnum() or c in "._-" else "_" for c in program_id)
        safe_version = "".join(c if c.isalnum() or c in "._-" else "_" for c in version)
        stem = Path(filename).stem
        safe_stem = "".join(c if c.isalnum() or c in "._-" else "_" for c in stem)[:80] or "upload"
        return self.artifact_root / safe_program / safe_version / f"{file_hash}_{safe_stem}.csv"

    def _relative_artifact_path(self, path: Path) -> str:
        try:
            return str(path.relative_to(self.settings.data_root))
        except ValueError:
            return str(path)

    def _absolute_artifact_path(self, artifact_path: str) -> Path:
        path = Path(artifact_path)
        if path.is_absolute():
            return path
        return self.settings.data_root / path

    def _preview_for_content(self, content: bytes) -> dict[str, Any]:
        text = content.decode("utf-8", errors="replace")
        return {"lines": text.splitlines()[:20]}

    def _store_artifact(
        self,
        *,
        program_id: str,
        version: str,
        filename: str,
        parse_content: bytes,
        validation_content: bytes,
        parsed: Any,
        status: str,
        uploaded_by_user_id: str | None,
        metadata: dict[str, Any],
        custom_field_values: dict[str, str],
        event_id: str | None = None,
        error: str | None = None,
    ) -> int:
        """Persist converted CSV bytes and DB metadata for later channel-map processing."""
        file_hash = hashlib.sha256(validation_content).hexdigest()[:16]
        artifact_path = self._artifact_path_for(program_id, version, file_hash, filename)
        artifact_path.parent.mkdir(parents=True, exist_ok=True)
        artifact_path.write_bytes(parse_content)
        artifact_kind = "converted_csv" if filename.lower().endswith(".rsp") else "csv"
        return self.db.upsert_ingestion_artifact(
            program_id=program_id,
            version=version,
            source_file=filename,
            artifact_path=self._relative_artifact_path(artifact_path),
            artifact_kind=artifact_kind,
            file_hash=file_hash,
            row_count=int(getattr(parsed, "row_count", 0) or 0),
            column_count=len(getattr(parsed, "dataframe").columns) if hasattr(parsed, "dataframe") else 0,
            preview_json=json.dumps(self._preview_for_content(parse_content)),
            metadata_json=json.dumps(metadata),
            custom_fields_json=json.dumps(custom_field_values),
            status=status,
            owner_user_id=uploaded_by_user_id,
            event_id=event_id,
            error=error,
        )

    def start_upload_task(
        self,
        files: list[tuple[str, bytes]],
        program_id: str,
        version: str,
        channel_map_content: bytes | None,
        status_value: str,
        is_admin: bool,
        uploaded_by_user_id: str,
        metadata: dict[str, Any],
        custom_field_values: dict[str, str],
    ) -> str:
        """Create task row and run ingestion in background thread."""
        self.db.delete_expired_upload_tasks()
        task_id = uuid.uuid4().hex
        total_events = sum(
            1
            for filename, _ in files
            if filename.lower().endswith((".csv", ".rsp"))
        )
        self.db.create_upload_task(
            task_id=task_id,
            created_by_user_id=uploaded_by_user_id,
            total_events=total_events,
            ttl_minutes=UPLOAD_TASK_TTL_MINUTES,
        )

        def _run() -> None:
            self.db.update_upload_task(task_id, status="running", phase="upload_received")
            try:
                result = self.ingest(
                    files=files,
                    program_id=program_id,
                    version=version,
                    channel_map_content=channel_map_content,
                    status_value=status_value,
                    is_admin=is_admin,
                    uploaded_by_user_id=uploaded_by_user_id,
                    metadata=metadata,
                    custom_field_values=custom_field_values,
                    on_phase_changed=lambda phase: self.db.update_upload_task(
                        task_id,
                        phase=phase,
                    ),
                    on_event_committed=lambda event_id, completed, total: self.db.update_upload_task(
                        task_id,
                        phase="writing",
                        completed_events=completed,
                        total_events=total,
                        current_event=event_id,
                    ),
                )
                self.db.update_upload_task(
                    task_id,
                    status="completed" if result.success else "failed",
                    phase="completed" if result.success else "failed",
                    completed_events=len(result.event_ids),
                    total_events=max(total_events, len(result.files)),
                    current_event=None,
                    error=result.error,
                    result={
                        "success": result.success,
                        "files": [f.__dict__ for f in result.files],
                        "event_ids": result.event_ids,
                        "error": result.error,
                        "total_rows": result.total_rows,
                        "pending_channel_map": result.pending_channel_map,
                    },
                )
            except Exception as exc:  # pragma: no cover
                logger.exception("Upload task failed unexpectedly: %s", task_id)
                self.db.update_upload_task(
                    task_id,
                    status="failed",
                    phase="failed",
                    current_event=None,
                    error=str(exc),
                )

        threading.Thread(target=_run, daemon=True).start()
        return task_id

    def ingest(
        self,
        files: list[tuple[str, bytes]],  # (filename, content)
        program_id: str,
        version: str,
        channel_map_content: bytes | None,
        status_value: str = "Pending",
        is_admin: bool = False,
        uploaded_by_user_id: str | None = None,
        metadata: dict[str, Any] | None = None,
        custom_field_values: dict[str, str] | None = None,
        on_phase_changed: TaskPhaseCallback | None = None,
        on_event_committed: EventCommittedCallback | None = None,
    ) -> IngestionResult:
        """
        Ingest files with per-event commit semantics.

        Args:
            files: List of (filename, content) tuples
            program_id: Program identifier
            version: Version identifier
            channel_map_content: Raw bytes of channel_map.yaml
            status_value: Status value (default Pending if not specified)
            is_admin: Whether requester has admin privileges
            metadata: Additional metadata fields for events

        Returns:
            IngestionResult with success status and details
        """
        # Phase 1: Parse and validate (no side effects)
        parsed_files = []
        channel_map = None
        effective_status = status_value if is_admin else "Pending"
        metadata = self._with_derived_weight_ranges(metadata or {})
        custom_field_values = custom_field_values or {}

        try:
            normalized_files = self._normalize_files(files, on_phase_changed)
            if not normalized_files:
                return IngestionResult(success=False, error="No valid CSV or RSP files found")

            if on_phase_changed:
                on_phase_changed("validating")

            if not channel_map_content:
                file_results: list[FileResult] = []
                total_rows = 0
                self.db.upsert_program(program_id, name=program_id)
                for filename, parse_content, validation_content in normalized_files:
                    parsed = self.parser.parse(parse_content, filename)
                    if not parsed.is_valid:
                        return IngestionResult(
                            success=False,
                            error=f"Parse failed for {filename}: {parsed.error}",
                        )
                    artifact_id = self._store_artifact(
                        program_id=program_id,
                        version=version,
                        filename=filename,
                        parse_content=parse_content,
                        validation_content=validation_content,
                        parsed=parsed,
                        status="pending",
                        uploaded_by_user_id=uploaded_by_user_id,
                        metadata={**metadata, "status": effective_status},
                        custom_field_values=custom_field_values,
                    )
                    total_rows += parsed.row_count
                    file_results.append(
                        FileResult(
                            filename=filename,
                            success=True,
                            row_count=parsed.row_count,
                            validation_issues=[
                                {
                                    "severity": "info",
                                    "code": "PENDING_CHANNEL_MAP",
                                    "message": "Upload retained pending channel-map setup",
                                    "details": {"artifact_id": artifact_id},
                                }
                            ],
                        )
                    )
                self._invalidate_cache()
                return IngestionResult(
                    success=True,
                    files=file_results,
                    total_rows=total_rows,
                    pending_channel_map=True,
                )

            channel_map = self.channel_loader.load(channel_map_content)

            # Get existing file hashes for duplicate detection
            existing_hashes = self.db.get_file_hashes(program_id, version)

            for filename, parse_content, validation_content in normalized_files:
                # Parse file
                parsed = self.parser.parse(parse_content, filename)
                if not parsed.is_valid:
                    return IngestionResult(
                        success=False,
                        error=f"Parse failed for {filename}: {parsed.error}",
                    )

                # Validate data
                validation = self.validator.validate(
                    df=parsed.dataframe,
                    channel_map=channel_map,
                    file_content=validation_content,
                    existing_hashes=existing_hashes,
                )

                if not validation.is_valid:
                    error_msg = validation.errors[0].message if validation.errors else "Validation failed"
                    return IngestionResult(
                        success=False,
                        error=f"Validation failed for {filename}: {error_msg}",
                    )

                # Store validation results with parsed file
                parsed_files.append((parsed, validation, parse_content, validation_content, filename))

        except Exception as e:
            logger.error(f"Pre-flight validation failed: {e}")
            return IngestionResult(success=False, error=f"Validation error: {str(e)}")

        if not parsed_files:
            return IngestionResult(success=False, error="No valid CSV or RSP files found")

        # Phase 2: Write data with per-event commits
        created_events: list[str] = []
        file_results: list[FileResult] = []
        total_rows = 0

        # Get existing event IDs to ensure uniqueness
        existing_event_ids = self._get_existing_event_ids()

        try:
            # Ensure program exists
            self.db.upsert_program(program_id, name=program_id)

            with self.db.write_connection() as conn:
                # Upsert channel map once per program/version.
                for i, (plot_key, mapping) in enumerate(channel_map.items()):
                    conn.execute(
                        """
                        INSERT INTO dim_channel_map
                            (program_id, version, plot_key, x_col, y_col, x_channel, y_channel,
                             plot_order, x_scale_factor, y_scale_factor, x_unit, y_unit)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT (program_id, version, plot_key) DO UPDATE SET
                            x_col = EXCLUDED.x_col,
                            y_col = EXCLUDED.y_col,
                            x_channel = EXCLUDED.x_channel,
                            y_channel = EXCLUDED.y_channel,
                            plot_order = EXCLUDED.plot_order,
                            x_scale_factor = EXCLUDED.x_scale_factor,
                            y_scale_factor = EXCLUDED.y_scale_factor,
                            x_unit = EXCLUDED.x_unit,
                            y_unit = EXCLUDED.y_unit
                        """,
                        [
                            program_id,
                            version,
                            plot_key,
                            mapping.get("x_col", 0),
                            mapping.get("y_col", 1),
                            mapping.get("x_channel", f"col_{mapping.get('x_col', 0)}"),
                            mapping.get("y_channel", f"col_{mapping.get('y_col', 1)}"),
                            mapping.get("plot_order", i),
                            mapping.get("x_scale_factor", 1.0),
                            mapping.get("y_scale_factor", 1.0),
                            mapping.get("x_unit"),
                            mapping.get("y_unit"),
                        ],
                    )

            for parsed, validation, parse_content, validation_content, original_filename in parsed_files:
                event_id = self._generate_event_id(parsed.filename, existing_event_ids)
                try:
                    with self.db.write_connection() as conn:
                        existing_event_ids.add(event_id)

                        event_metadata = {
                            "status": effective_status,
                            "source_file": parsed.filename,
                            "file_hash": validation.file_hash,
                            "row_count": len(parsed.dataframe),
                            "uploaded_by_user_id": uploaded_by_user_id,
                            "last_updated_by_user_id": uploaded_by_user_id,
                            **metadata,
                        }
                        columns = ["event_id", "program_id", "version"] + list(
                            event_metadata.keys()
                        )
                        placeholders = ", ".join(["?"] * len(columns))
                        values = [event_id, program_id, version] + list(
                            event_metadata.values()
                        )

                        conn.execute(
                            f"INSERT INTO dim_event ({', '.join(columns)}) "
                            f"VALUES ({placeholders})",
                            values,
                        )
                        self.db.upsert_event_custom_field_values(
                            event_id=event_id,
                            custom_values=custom_field_values,
                            conn=conn,
                        )

                        df_long = self.transformer.transform_to_long(
                            parsed.dataframe, channel_map
                        )
                        if not df_long.empty:
                            df_long["event_id"] = event_id
                            conn.execute("""
                                INSERT INTO measurements_raw
                                    (event_id, timestamp, channel_name, value)
                                SELECT event_id, timestamp, channel_name, value
                                FROM df_long
                            """)

                        for plot_key, mapping in channel_map.items():
                            x_col = mapping.get("x_col", 0)
                            y_col = mapping.get("y_col", 1)
                            plot_df = self.transformer.extract_plot_data(
                                parsed.dataframe, x_col, y_col
                            )
                            if not plot_df.empty:
                                lttb_df = self.downsampler.downsample(plot_df)
                                lttb_df["event_id"] = event_id
                                lttb_df["plot_key"] = plot_key
                                conn.execute("""
                                    INSERT INTO measurements_lttb
                                        (event_id, plot_key, x, y)
                                    SELECT event_id, plot_key, x, y
                                    FROM lttb_df
                                """)
                except Exception as exc:
                    logger.error("Failed ingesting %s: %s", parsed.filename, exc)
                    file_results.append(
                        FileResult(
                            filename=parsed.filename,
                            success=False,
                            event_id=event_id,
                            error=f"Ingestion failed: {exc}",
                        )
                    )
                    if created_events:
                        self._invalidate_cache()
                    return IngestionResult(
                        success=False,
                        files=file_results,
                        event_ids=created_events,
                        total_rows=total_rows,
                        error=f"Ingestion failed for {parsed.filename}: {exc}",
                    )

                created_events.append(event_id)
                total_rows += len(df_long)
                validation_issues = [
                    {
                        "severity": issue.severity.value,
                        "code": issue.code,
                        "message": issue.message,
                        "details": issue.details,
                    }
                    for issue in validation.issues
                    if issue.severity == ValidationSeverity.WARNING
                ]
                file_results.append(
                    FileResult(
                        filename=parsed.filename,
                        success=True,
                        event_id=event_id,
                        row_count=len(df_long),
                        validation_issues=validation_issues,
                    )
                )
                self._store_artifact(
                    program_id=program_id,
                    version=version,
                    filename=original_filename,
                    parse_content=parse_content,
                    validation_content=validation_content,
                    parsed=parsed,
                    status="processed",
                    uploaded_by_user_id=uploaded_by_user_id,
                    metadata={**metadata, "status": effective_status},
                    custom_field_values=custom_field_values,
                    event_id=event_id,
                )
                if on_event_committed:
                    on_event_committed(event_id, len(created_events), len(parsed_files))

            with self.db.write_connection() as conn:
                import json

                conn.execute(
                    """
                    INSERT INTO audit_log (action, user_id, event_id, details)
                    VALUES (?, ?, ?, ?)
                    """,
                    [
                        "INGESTION_SUCCESS",
                        uploaded_by_user_id,
                        created_events[0] if created_events else None,
                        json.dumps(
                            {
                                "program_id": program_id,
                                "version": version,
                                "event_ids": created_events,
                                "total_rows": total_rows,
                                "file_count": len(file_results),
                            }
                        ),
                    ],
                )

            # Invalidate cache after successful ingestion
            self._invalidate_cache()

            logger.info(
                f"Ingestion complete: {len(created_events)} events, "
                f"{total_rows} rows for {program_id}/{version}"
            )

            return IngestionResult(
                success=True,
                files=file_results,
                event_ids=created_events,
                total_rows=total_rows,
            )

        except Exception as e:
            logger.error(f"Ingestion failed before completion: {e}")
            if created_events:
                self._invalidate_cache()
            return IngestionResult(
                success=False,
                files=file_results,
                error=f"Ingestion failed: {str(e)}",
            )

    def validate_fixed_channel_map(
        self,
        entries: list[dict[str, Any]],
        column_count: int,
    ) -> dict[str, dict[str, Any]]:
        """Validate the fixed 8-row channel-map editor payload."""
        by_key = {str(entry.get("plot_key")): entry for entry in entries}
        expected = set(FIXED_CHANNEL_MAP_PLOTS)
        actual = set(by_key)
        if actual != expected:
            missing = sorted(expected - actual)
            extra = sorted(actual - expected)
            msg = "Channel map must contain exactly the fixed 8 plot definitions"
            if missing:
                msg += f"; missing: {', '.join(missing)}"
            if extra:
                msg += f"; unexpected: {', '.join(extra)}"
            raise ValueError(msg)

        channel_map: dict[str, dict[str, Any]] = {}
        for order, plot_key in enumerate(FIXED_CHANNEL_MAP_PLOTS):
            entry = by_key[plot_key]
            try:
                x_col = int(entry.get("x_col"))
                y_col = int(entry.get("y_col"))
            except (TypeError, ValueError) as exc:
                raise ValueError(f"{plot_key} requires numeric x_col and y_col") from exc
            if x_col < 0 or y_col < 0:
                raise ValueError(f"{plot_key} column indexes must be zero-based and non-negative")
            if x_col >= column_count or y_col >= column_count:
                raise ValueError(
                    f"{plot_key} references a column outside the preview CSV "
                    f"(x_col={x_col}, y_col={y_col}, columns={column_count})"
                )
            channel_map[plot_key] = {
                "x_col": x_col,
                "y_col": y_col,
                "x_channel": f"col_{x_col}",
                "y_channel": f"col_{y_col}",
                "plot_order": order,
                "x_scale_factor": 1.0,
                "y_scale_factor": 1.0,
                "x_unit": None,
                "y_unit": None,
            }
        return channel_map

    def save_channel_map_and_process_artifacts(
        self,
        *,
        program_id: str,
        version: str,
        entries: list[dict[str, Any]],
        user_id: str,
    ) -> dict[str, Any]:
        """Save a fixed channel map and reprocess retained artifacts for the version."""
        artifacts = self.db.list_ingestion_artifacts(program_id=program_id, version=version)
        preview_artifact = artifacts[0] if artifacts else None
        if preview_artifact is None:
            raise ValueError("No retained CSV artifacts are available for this program/version")
        column_count = int(preview_artifact.get("column_count") or 0)
        channel_map = self.validate_fixed_channel_map(entries, column_count)

        with self.db.write_connection() as conn:
            for plot_key, mapping in channel_map.items():
                conn.execute(
                    """
                    INSERT INTO dim_channel_map
                        (program_id, version, plot_key, x_col, y_col, x_channel, y_channel,
                         plot_order, x_scale_factor, y_scale_factor, x_unit, y_unit)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT (program_id, version, plot_key) DO UPDATE SET
                        x_col = EXCLUDED.x_col,
                        y_col = EXCLUDED.y_col,
                        x_channel = EXCLUDED.x_channel,
                        y_channel = EXCLUDED.y_channel,
                        plot_order = EXCLUDED.plot_order,
                        x_scale_factor = EXCLUDED.x_scale_factor,
                        y_scale_factor = EXCLUDED.y_scale_factor,
                        x_unit = EXCLUDED.x_unit,
                        y_unit = EXCLUDED.y_unit
                    """,
                    [
                        program_id,
                        version,
                        plot_key,
                        mapping["x_col"],
                        mapping["y_col"],
                        mapping["x_channel"],
                        mapping["y_channel"],
                        mapping["plot_order"],
                        1.0,
                        1.0,
                        None,
                        None,
                    ],
                )

        existing_event_ids = self._get_existing_event_ids()
        processed: list[dict[str, Any]] = []
        failed: list[dict[str, Any]] = []
        total_rows = 0

        for artifact in artifacts:
            artifact_id = int(artifact["artifact_id"])
            source_file = str(artifact["source_file"])
            try:
                artifact_path = self._absolute_artifact_path(str(artifact["artifact_path"]))
                parse_content = artifact_path.read_bytes()
                parsed = self.parser.parse(parse_content, source_file)
                if not parsed.is_valid:
                    raise ValueError(f"Parse failed: {parsed.error}")

                event_id = artifact.get("event_id")
                if event_id:
                    event_id = str(event_id)
                    existing_event_ids.discard(event_id)
                else:
                    event_id = self._generate_event_id(source_file, existing_event_ids)
                existing_event_ids.add(event_id)

                metadata = json.loads(artifact.get("metadata_json") or "{}")
                custom_field_values = json.loads(artifact.get("custom_fields_json") or "{}")
                event_status = metadata.pop("status", "Pending")
                metadata = self._with_derived_weight_ranges(metadata)

                with self.db.write_connection() as conn:
                    self.db.hard_delete_event_data(event_id, conn)
                    event_metadata = {
                        "status": event_status,
                        "source_file": source_file,
                        "file_hash": artifact.get("file_hash"),
                        "row_count": len(parsed.dataframe),
                        "uploaded_by_user_id": artifact.get("owner_user_id"),
                        "last_updated_by_user_id": user_id,
                        **metadata,
                    }
                    columns = ["event_id", "program_id", "version"] + list(event_metadata.keys())
                    placeholders = ", ".join(["?"] * len(columns))
                    values = [event_id, program_id, version] + list(event_metadata.values())
                    conn.execute(
                        f"INSERT INTO dim_event ({', '.join(columns)}) VALUES ({placeholders})",
                        values,
                    )
                    self.db.upsert_event_custom_field_values(
                        event_id=event_id,
                        custom_values=custom_field_values,
                        conn=conn,
                    )

                    df_long = self.transformer.transform_to_long(parsed.dataframe, channel_map)
                    if not df_long.empty:
                        df_long["event_id"] = event_id
                        conn.execute("""
                            INSERT INTO measurements_raw
                                (event_id, timestamp, channel_name, value)
                            SELECT event_id, timestamp, channel_name, value
                            FROM df_long
                        """)

                    for plot_key, mapping in channel_map.items():
                        plot_df = self.transformer.extract_plot_data(
                            parsed.dataframe,
                            mapping["x_col"],
                            mapping["y_col"],
                        )
                        if not plot_df.empty:
                            lttb_df = self.downsampler.downsample(plot_df)
                            lttb_df["event_id"] = event_id
                            lttb_df["plot_key"] = plot_key
                            conn.execute("""
                                INSERT INTO measurements_lttb
                                    (event_id, plot_key, x, y)
                                SELECT event_id, plot_key, x, y
                                FROM lttb_df
                            """)

                self.db.update_ingestion_artifact_status(
                    artifact_id,
                    status="processed",
                    event_id=event_id,
                    error=None,
                )
                row_count = len(parsed.dataframe)
                total_rows += row_count
                processed.append(
                    {"artifact_id": artifact_id, "event_id": event_id, "row_count": row_count}
                )
            except Exception as exc:
                logger.error("Failed processing retained artifact %s: %s", artifact_id, exc)
                self.db.update_ingestion_artifact_status(
                    artifact_id,
                    status="failed",
                    error=str(exc),
                )
                failed.append(
                    {"artifact_id": artifact_id, "source_file": source_file, "error": str(exc)}
                )

        self._invalidate_cache()
        return {
            "program_id": program_id,
            "version": version,
            "processed": processed,
            "failed": failed,
            "processed_count": len(processed),
            "failed_count": len(failed),
            "total_rows": total_rows,
        }

    def _get_existing_event_ids(self) -> set[str]:
        """Get all existing event IDs from the database."""
        query = "SELECT event_id FROM dim_event"
        result = self.db.read_connection.execute(query).fetchall()
        return {row[0] for row in result}

    def _generate_event_id(self, filename: str, existing_ids: set[str]) -> str:
        """Generate event ID from filename without extension.

        If the base name already exists, appends a numeric suffix.
        """
        # Strip directory path (folder uploads include relative path)
        filename = os.path.basename(filename)

        # Remove data-file extension to get base name
        lower_filename = filename.lower()
        if lower_filename.endswith(".csv") or lower_filename.endswith(".rsp"):
            base_name = filename[:-4]
        else:
            base_name = filename

        # Check for uniqueness and add suffix if needed
        event_id = base_name
        counter = 1
        while event_id in existing_ids:
            event_id = f"{base_name}_{counter}"
            counter += 1

        return event_id

    def _normalize_files(
        self,
        files: list[tuple[str, bytes]],
        on_phase_changed: TaskPhaseCallback | None = None,
    ) -> list[tuple[str, bytes, bytes]]:
        """Return files as CSV parse bytes while preserving original hash bytes."""
        data_files = [
            (filename, content)
            for filename, content in files
            if filename.lower().endswith((".csv", ".rsp"))
        ]
        kinds = {
            ".rsp" if filename.lower().endswith(".rsp") else ".csv"
            for filename, _ in data_files
        }
        if len(kinds) > 1:
            raise ValueError("Upload folders must contain only one data format: CSV or RSP")

        if ".rsp" not in kinds:
            return [(filename, content, content) for filename, content in data_files]

        if on_phase_changed:
            on_phase_changed("converting")

        normalized = []
        for filename, content in data_files:
            converted = self.rsp_converter.convert(filename, content)
            logger.info(
                "Converted %s to %s (%s rows, %s channels)",
                filename,
                converted.filename,
                converted.row_count,
                converted.channel_count,
            )
            normalized.append((filename, converted.content, content))
        return normalized

    def _invalidate_cache(self) -> None:
        """Invalidate cached data after ingestion."""
        self.cache.invalidate_prefix(CacheKeys.PROGRAM_IDS)
        self.cache.invalidate_prefix(CacheKeys.VERSIONS)
        self.cache.invalidate_prefix(CacheKeys.EVENTS)
        self.cache.invalidate_prefix(CacheKeys.EVENT_COUNT)

