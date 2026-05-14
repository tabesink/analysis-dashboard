"""Read-only upload dataset query service."""

from typing import Any

from server.storage.database import UnifiedStore

_FACET_COLUMNS = [
    "program_id",
    "version",
    "status",
    "suspension_component",
    "axle_location",
    "gross_vehicle_weight_range_lbs",
    "drive_type",
    "material_construction",
    "steering_position",
    "vehicle_type",
]


class UploadQueryService:
    """Read upload dataset rows and facets from the database."""

    def __init__(self, db: UnifiedStore):
        self.db = db

    def list_datasets(self) -> dict[str, Any]:
        """Return every non-deleted dataset plus global facets and program/version summary."""
        conn = self.db.read_connection

        total = conn.execute(
            "SELECT COUNT(*) FROM dim_event WHERE is_deleted = false"
        ).fetchone()[0]

        facet_parts = ", ".join(
            f"ARRAY_AGG(DISTINCT {col} ORDER BY {col}) FILTER ({col} IS NOT NULL) AS {col}"
            for col in _FACET_COLUMNS
        )
        facet_row = conn.execute(
            f"SELECT {facet_parts} FROM dim_event WHERE is_deleted = false"  # noqa: S608
        ).fetchone()
        facets: dict[str, list[str]] = {}
        for i, col in enumerate(_FACET_COLUMNS):
            values = facet_row[i]
            facets[col] = [str(v) for v in values] if values else []

        program_version_rows = conn.execute(
            """
            WITH event_groups AS (
                SELECT
                    program_id,
                    version,
                    COUNT(*) AS event_count,
                    ARRAY_AGG(DISTINCT status ORDER BY status) FILTER (status IS NOT NULL) AS statuses
                FROM dim_event
                WHERE is_deleted = false
                GROUP BY program_id, version
            ),
            artifact_groups AS (
                SELECT
                    program_id,
                    version,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_artifact_count,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_artifact_count
                FROM ingestion_artifacts
                WHERE status IN ('pending', 'failed')
                GROUP BY program_id, version
            ),
            channel_groups AS (
                SELECT DISTINCT program_id, version
                FROM dim_channel_map
            )
            SELECT
                COALESCE(e.program_id, a.program_id) AS program_id,
                COALESCE(e.version, a.version) AS version,
                COALESCE(e.event_count, 0) AS event_count,
                e.statuses,
                cg.program_id IS NOT NULL AS has_channel_map,
                cg.program_id IS NULL AND COALESCE(a.pending_artifact_count, 0) + COALESCE(a.failed_artifact_count, 0) > 0 AS missing_channel_map,
                COALESCE(a.pending_artifact_count, 0) AS pending_artifact_count,
                COALESCE(a.failed_artifact_count, 0) AS failed_artifact_count
            FROM event_groups e
            FULL OUTER JOIN artifact_groups a
                ON a.program_id = e.program_id AND a.version = e.version
            LEFT JOIN channel_groups cg
                ON cg.program_id = COALESCE(e.program_id, a.program_id)
                AND cg.version = COALESCE(e.version, a.version)
            ORDER BY program_id, version
            """
        ).fetchall()
        program_versions: list[dict[str, Any]] = []
        for row in program_version_rows:
            statuses = row[3]
            program_versions.append(
                {
                    "program_id": str(row[0]) if row[0] is not None else "",
                    "version": str(row[1]) if row[1] is not None else "",
                    "event_count": int(row[2] or 0),
                    "statuses": [str(s) for s in statuses] if statuses else [],
                    "has_channel_map": bool(row[4]),
                    "missing_channel_map": bool(row[5]),
                    "pending_artifact_count": int(row[6] or 0),
                    "failed_artifact_count": int(row[7] or 0),
                }
            )

        result = conn.execute(
            """
            SELECT
                event_id, program_id, version, source_file, status,
                job_number, work_order, rfq, dv, pv, post_prod,
                suspension_component, axle_location, gross_vehicle_weight_range_lbs,
                gvw, fgawr, fgawr_range_lbs, rgawr, rgawr_range_lbs,
                drive_type, material_construction, steering_position, damper_type, vehicle_type,
                row_count, created_at
            FROM dim_event
            WHERE is_deleted = false
            ORDER BY program_id, version, created_at DESC
            """
        ).fetchall()
        columns = [desc[0] for desc in conn.description]

        items: list[dict[str, Any]] = []
        for row in result:
            row_dict = dict(zip(columns, row))
            if row_dict.get("created_at"):
                row_dict["created_at"] = str(row_dict["created_at"])
            items.append(row_dict)

        return {
            "items": items,
            "total": total,
            "facets": facets,
            "program_versions": program_versions,
        }
