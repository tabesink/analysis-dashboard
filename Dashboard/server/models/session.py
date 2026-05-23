"""Session-related Pydantic models."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class UIPreferences(BaseModel):
    """User interface preferences."""

    grid_columns: int = Field(default=3, ge=1, le=8)
    active_tab: str = Field(default="grid")
    baseline_opacity: float = Field(default=0.5, ge=0.0, le=1.0)
    color_grouping: dict[str, Any] | None = None


class PartitionState(BaseModel):
    """State for a single partition."""

    program_ids: list[str] = Field(default_factory=list)
    versions: list[str] = Field(default_factory=list)
    selected_event_ids: list[str] = Field(default_factory=list)


class InspectDamageTablePreferencesState(BaseModel):
    """Inspect Damage table UI preferences."""

    visible_columns: dict[str, bool] = Field(default_factory=dict)
    column_widths: dict[str, int | float] = Field(default_factory=dict)
    expanded_programs: list[str] = Field(default_factory=list)
    expanded_versions: list[str] = Field(default_factory=list)
    sort_field: str = Field(default="job_number")
    sort_direction: str = Field(default="asc")
    column_filters: dict[str, list[str]] = Field(default_factory=dict)


class InspectDamageState(BaseModel):
    """Inspect Damage route work queue."""

    selected_event_ids: list[str] = Field(default_factory=list)
    table_preferences: InspectDamageTablePreferencesState | None = None


class SessionCreate(BaseModel):
    """Request body for creating a new session."""

    data_state: PartitionState | None = None
    global_filters: dict[str, list[str] | str] = Field(default_factory=dict)
    rendered_event_ids: list[str] = Field(default_factory=list)
    ui_preferences: UIPreferences | None = None
    inspect_damage_state: InspectDamageState | None = None


class SessionUpdate(BaseModel):
    """Request body for updating a session."""

    data_state: PartitionState | None = None
    global_filters: dict[str, list[str] | str] | None = None
    rendered_event_ids: list[str] | None = None
    ui_preferences: UIPreferences | None = None
    inspect_damage_state: InspectDamageState | None = None


class SessionResponse(BaseModel):
    """Response for session endpoints."""

    session_id: str
    data_state: PartitionState | None = None
    global_filters: dict[str, list[str] | str] = Field(default_factory=dict)
    rendered_event_ids: list[str] = Field(default_factory=list)
    ui_preferences: UIPreferences | None = None
    inspect_damage_state: InspectDamageState | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    expires_at: datetime | None = None


class SavedFilterCreate(BaseModel):
    """Request body for saving a filter preset."""

    name: str = Field(min_length=1, max_length=100)
    data_state: PartitionState | None = None
    global_filters: dict[str, list[str] | str] = Field(default_factory=dict)
    is_default: bool = False


class SavedFilterResponse(BaseModel):
    """Response for saved filter endpoints."""

    id: int
    name: str
    data_state: PartitionState | None = None
    global_filters: dict[str, list[str] | str] = Field(default_factory=dict)
    is_default: bool = False
    created_at: datetime | None = None

