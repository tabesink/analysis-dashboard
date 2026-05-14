"""Upload-related Pydantic models."""

from pydantic import BaseModel, Field


class ValidationIssue(BaseModel):
    """A single validation issue from data validation."""

    severity: str = Field(description="error, warning, or info")
    code: str = Field(description="Machine-readable error code")
    message: str = Field(description="Human-readable message")
    details: dict | None = None


class FileResult(BaseModel):
    """Result for a single file in an upload."""

    filename: str
    success: bool
    event_id: str | None = None
    error: str | None = None
    row_count: int = 0
    validation_issues: list[ValidationIssue] = Field(default_factory=list)


class UploadResponse(BaseModel):
    """Response for upload endpoint."""

    success: bool
    files: list[FileResult] = Field(default_factory=list)
    event_ids: list[str] = Field(default_factory=list)
    error: str | None = None
    total_rows: int = 0
    pending_channel_map: bool = False


class UploadTaskStartResponse(BaseModel):
    """Response for starting an async upload task."""

    task_id: str


class UploadTaskEvent(BaseModel):
    """SSE event payload for upload task progress."""

    task_id: str
    status: str = Field(description="queued, running, completed, or failed")
    phase: str = Field(
        description="upload_received, converting, validating, writing, completed, failed"
    )
    completed_events: int = 0
    total_events: int = 0
    current_event: str | None = None
    error: str | None = None
    result: UploadResponse | None = None


class DatasetInfo(BaseModel):
    """Dataset information for upload management table."""

    event_id: str
    program_id: str
    version: str
    source_file: str | None = None
    status: str | None = None
    job_number: str | None = None
    work_order: str | None = None
    rfq: bool | None = None
    dv: bool | None = None
    pv: bool | None = None
    post_prod: bool | None = None
    suspension_component: str | None = None
    axle_location: str | None = None
    gvw: str | None = None
    gross_vehicle_weight_range_lbs: str | None = None
    fgawr: str | None = None
    fgawr_range_lbs: str | None = None
    rgawr: str | None = None
    rgawr_range_lbs: str | None = None
    drive_type: str | None = None
    material_construction: str | None = None
    steering_position: str | None = None
    damper_type: str | None = None
    vehicle_type: str | None = None
    row_count: int = 0
    created_at: str | None = None


class ProgramVersionSummary(BaseModel):
    """Aggregate counts and statuses for a (program_id, version) pair.

    Computed across all non-deleted events, not just the current page, so the
    Database tree can reliably render the full program/version structure even
    when the paginated ``items`` list only contains a subset.
    """

    program_id: str
    version: str
    event_count: int
    statuses: list[str] = Field(
        default_factory=list,
        description="Distinct status values across events in this program/version group",
    )
    has_channel_map: bool = False
    missing_channel_map: bool = False
    pending_artifact_count: int = 0
    failed_artifact_count: int = 0


class DatasetListResponse(BaseModel):
    """Full dataset list with facets and program/version summary."""

    items: list[DatasetInfo]
    total: int = Field(description="Total events across all non-deleted rows")
    facets: dict[str, list[str]] = Field(
        default_factory=dict,
        description="Distinct values per filterable column, computed across all rows",
    )
    program_versions: list[ProgramVersionSummary] = Field(
        default_factory=list,
        description="Summary of every (program_id, version) pair across all non-deleted rows.",
    )


class DeleteEventsRequest(BaseModel):
    """Request body for bulk event deletion."""

    event_ids: list[str] = Field(
        ..., min_length=1, description="List of event IDs to delete"
    )


class DeleteEventsResponse(BaseModel):
    """Response for bulk event deletion."""

    deleted_count: int
    event_ids: list[str]


class DeleteProgramVersionScopeRequest(BaseModel):
    """Hard-delete a full program or program/version scope."""

    program_id: str = Field(min_length=1)
    version: str | None = None


class DeleteProgramVersionScopeResponse(BaseModel):
    """Result of hard-deleting a full program or program/version scope."""

    deleted: bool
    program_id: str
    version: str | None = None
    event_count: int = 0
    raw_rows: int = 0
    lttb_rows: int = 0
    event_custom_field_rows: int = 0
    artifact_count: int = 0
    channel_map_rows: int = 0
    deleted_files: int = 0
    skipped_files: list[str] = Field(default_factory=list)
    owner_user_ids: list[str] = Field(default_factory=list)


class DeleteEventResponse(BaseModel):
    """Response for single event deletion."""

    deleted: bool
    event_id: str


class PurgeDeletedEventsRequest(BaseModel):
    """Optional event scope for purging soft-deleted records."""

    event_ids: list[str] | None = Field(
        default=None,
        description="Specific soft-deleted event IDs to purge; defaults to all soft-deleted events",
    )


class PurgeDeletedEventsResponse(BaseModel):
    """Response for hard purge of soft-deleted events."""

    purged_events: int
    purged_raw_rows: int
    purged_lttb_rows: int
