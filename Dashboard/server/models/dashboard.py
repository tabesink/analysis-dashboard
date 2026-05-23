"""Dashboard-related Pydantic models."""

from typing import Any

from pydantic import BaseModel, Field


class ProgramIdsResponse(BaseModel):
    """Response for program IDs endpoint."""

    program_ids: list[str] = Field(description="List of unique program identifiers")


class VersionsResponse(BaseModel):
    """Response for versions endpoint."""

    program_id: str = Field(description="Program identifier")
    versions: list[str] = Field(description="List of versions for the program")


class FilterOptionEntry(BaseModel):
    """Single filter option definition for UI and server updates."""

    column: str = Field(description="Database column name for the filter")
    order: int = Field(description="Display order in the UI")
    values: list[str] = Field(default_factory=list, description="Allowed values")
    source: str | None = Field(default=None, description="core or custom field source")
    data_type: str | None = Field(default=None, description="Filter value data type")


class FilterOptionsUpdateRequest(BaseModel):
    """Admin payload for updating filter option values globally."""

    options: dict[str, FilterOptionEntry] = Field(
        default_factory=dict,
        description="Display-name keyed filter options",
    )


class PartitionState(BaseModel):
    """State for a single partition (baseline or new_data)."""

    program_ids: list[str] = Field(default_factory=list)
    versions: list[str] = Field(default_factory=list)
    selected_event_ids: list[str] = Field(default_factory=list)


class EventsRequest(BaseModel):
    """Request for events endpoint."""

    program_ids: list[str] = Field(
        default_factory=list,
        description="Optional explicit program scope for event queries",
    )
    versions: list[str] = Field(
        default_factory=list,
        description="Optional explicit version scope for event queries",
    )
    global_filters: dict[str, list[str] | str] = Field(
        default_factory=dict,
        description="Global filters applied to all events",
    )


class EventsByIdsRequest(BaseModel):
    """Request for event metadata lookup by ID."""

    event_ids: list[str] = Field(default_factory=list)


class EventMetadata(BaseModel):
    """Event metadata returned in responses."""

    event_id: str
    program_id: str
    version: str
    uploaded_by_user_id: str | None = None
    uploaded_by_username: str | None = None
    last_updated_by_user_id: str | None = None
    last_updated_by_username: str | None = None
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
    custom_fields: dict[str, str] = Field(default_factory=dict)
    source_file: str | None = None
    row_count: int | None = None
    has_channel_map: bool = True
    missing_channel_map: bool = False
    selectable_for_plotting: bool = True
    created_at: str | None = None
    updated_at: str | None = None


class EventMetadataUpdateFields(BaseModel):
    """Editable metadata fields for event updates."""

    job_number: str | None = None
    work_order: str | None = None
    rfq: bool | None = None
    dv: bool | None = None
    pv: bool | None = None
    post_prod: bool | None = None
    suspension_component: str | None = None
    axle_location: str | None = None
    gvw: str | None = None
    fgawr: str | None = None
    rgawr: str | None = None
    drive_type: str | None = None
    material_construction: str | None = None
    steering_position: str | None = None
    damper_type: str | None = None
    vehicle_type: str | None = None
    status: str | None = None


class EventMetadataUpdateRequest(EventMetadataUpdateFields):
    """Payload for updating one event with optimistic concurrency control."""

    if_unmodified_since: str | None = Field(
        ...,
        description="Expected current updated_at value for optimistic concurrency control",
    )


class ProgramVersionMetadataUpdateRequest(BaseModel):
    """Payload for updating metadata fields across a program/version."""

    program_id: str = Field(min_length=1)
    version: str = Field(min_length=1)
    updates: EventMetadataUpdateFields


class ProgramVersionMetadataUpdateResponse(BaseModel):
    """Summary of a program/version metadata bulk update."""

    program_id: str
    version: str
    updated_event_count: int
    status: str | None = None
    uploaded_by_user_id: str | None = None
    uploaded_by_username: str | None = None
    last_updated_by_user_id: str | None = None
    last_updated_by_username: str | None = None
    uploaded_at: str | None = None
    last_updated_at: str | None = None


class EventsResponse(BaseModel):
    """Response for events endpoint."""

    events: list[EventMetadata] = Field(default_factory=list)
    total_count: int = 0
    has_more: bool = False


class CustomFieldDefinitionRequest(BaseModel):
    """Admin payload for creating or updating a custom field definition."""

    field_key: str = Field(min_length=1, description="Stable key used in filters")
    display_name: str = Field(min_length=1, description="UI display name")
    data_type: str = Field(default="string", description="Data type (currently string)")
    is_filterable: bool = Field(default=True, description="Whether field is filterable")


class CustomFieldDefinitionResponse(BaseModel):
    """Custom field definition response payload."""

    field_key: str
    display_name: str
    data_type: str = "string"
    is_filterable: bool = True
    created_by_user_id: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class ProgramCustomFieldValuesUpdateRequest(BaseModel):
    """Admin payload for program-scoped custom field values."""

    values: list[str] = Field(default_factory=list, description="Allowed values for program")


class ProgramCustomFieldValuesResponse(BaseModel):
    """Program-scoped custom field values response."""

    program_id: str
    values_by_field: dict[str, list[str]] = Field(default_factory=dict)


class PlotDataRequest(BaseModel):
    """Request for plot data endpoint."""

    event_ids: list[str] = Field(description="List of event IDs to fetch data for")
    plot_keys: list[str] = Field(description="List of plot keys to fetch")


class PlotPoint(BaseModel):
    """Single data point for a plot."""

    x: float
    y: float


class PlotSeries(BaseModel):
    """Series data for a single event/plot combination."""

    event_id: str
    plot_key: str
    status: str | None = None
    points: list[PlotPoint] = Field(default_factory=list)


class PlotDataResponse(BaseModel):
    """Response for plot data endpoint."""

    series: list[PlotSeries] = Field(default_factory=list)
    plot_keys: list[str] = Field(default_factory=list)
    event_count: int = 0


class EventCountRequest(BaseModel):
    """Request for event count endpoint."""

    global_filters: dict[str, list[str] | str] = Field(default_factory=dict)


class EventCountResponse(BaseModel):
    """Response for event count endpoint."""

    total: int = 0


class ChannelMapEntry(BaseModel):
    """Channel map configuration entry."""

    plot_key: str
    x_col: int | None = None
    y_col: int | None = None
    x_channel: str
    y_channel: str
    plot_order: int = 0
    x_scale_factor: float = 1.0
    y_scale_factor: float = 1.0
    x_unit: str | None = None
    y_unit: str | None = None


class MetadataResponse(BaseModel):
    """Response for metadata endpoint."""

    program_id: str
    version: str
    channel_map: list[ChannelMapEntry] = Field(default_factory=list)
    event_count: int = 0


class ChannelMapEditorEntry(BaseModel):
    """Editable fixed channel-map row."""

    plot_key: str = Field(min_length=1)
    x_col: int = Field(ge=0)
    y_col: int = Field(ge=0)


class ChannelMapEditorResponse(BaseModel):
    """Payload for the channel-map editor."""

    program_id: str
    version: str
    has_channel_map: bool = False
    missing_channel_map: bool = False
    entries: list[ChannelMapEditorEntry] = Field(default_factory=list)
    preview_lines: list[str] = Field(default_factory=list)
    column_count: int = 0
    pending_artifact_count: int = 0
    failed_artifact_count: int = 0


class ChannelMapSaveRequest(BaseModel):
    """Save fixed channel-map rows and process retained artifacts."""

    program_id: str = Field(min_length=1)
    version: str = Field(min_length=1)
    entries: list[ChannelMapEditorEntry] = Field(min_length=8, max_length=8)


class ChannelMapProcessResult(BaseModel):
    """Result of saving a map and processing retained artifacts."""

    program_id: str
    version: str
    processed_count: int = 0
    failed_count: int = 0
    total_rows: int = 0
    processed: list[dict[str, Any]] = Field(default_factory=list)
    failed: list[dict[str, Any]] = Field(default_factory=list)


class PlotAxisLabels(BaseModel):
    """Axis labels configuration for a plot."""

    title: str = Field(description="Plot title")
    x_label: str = Field(description="X-axis label")
    y_label: str = Field(description="Y-axis label")


class PlotAxisSettings(BaseModel):
    """Per-plot axis limits and grid configuration.
    
    SOLID: Single Responsibility - only holds axis/grid settings.
    """

    x_min: float | None = Field(default=None, description="X-axis minimum (null = auto)")
    x_max: float | None = Field(default=None, description="X-axis maximum (null = auto)")
    y_min: float | None = Field(default=None, description="Y-axis minimum (null = auto)")
    y_max: float | None = Field(default=None, description="Y-axis maximum (null = auto)")
    grid_count: int = Field(default=7, ge=3, le=21, description="Number of grid lines")


class ColorGroupingConfig(BaseModel):
    """Configuration for color-coded curve grouping in plots."""

    mode: str = Field(
        default="none",
        description="Grouping mode: 'none' or 'filter_category'"
    )
    filter_category: str | None = Field(
        default=None,
        description="Filter category to group by (e.g., 'suspension_component', 'axle_location')"
    )
    custom_colors: dict[str, str] | None = Field(
        default=None,
        description="Custom color overrides for group keys (hex colors)"
    )


class CurveColorConfig(BaseModel):
    """User-selected colors for curve rendering."""

    baseline_color: str | None = Field(
        default=None,
        description="Default color for baseline/historical data curves (hex)"
    )
    new_data_color: str | None = Field(
        default=None,
        description="Default color for new data curves (hex)"
    )
    filter_colors: dict[str, str] | None = Field(
        default=None,
        description="Colors keyed by filter category (for future use)"
    )


class RenderGridRequest(BaseModel):
    """Request for grid rendering SSE endpoint."""

    event_ids: list[str] = Field(description="List of event IDs to render")
    plot_keys: list[str] = Field(description="List of plot keys to render")
    grid_columns: int = Field(default=3, ge=2, le=4, description="Number of grid columns")
    baseline_opacity: float = Field(default=0.5, ge=0.0, le=1.0, description="Opacity for baseline data")
    axis_labels: dict[str, PlotAxisLabels] | None = Field(
        default=None, description="Optional axis labels for each plot key"
    )
    color_grouping: ColorGroupingConfig | None = Field(
        default=None,
        description="Color grouping configuration for baseline data visualization"
    )
    curve_colors: CurveColorConfig | None = Field(
        default=None,
        description="User-selected colors for baseline and new data curves"
    )
    plot_settings: dict[str, PlotAxisSettings] | None = Field(
        default=None,
        description="Per-plot axis limits and grid configuration"
    )


class RenderInteractiveRequest(BaseModel):
    """Request for interactive plot rendering."""

    event_ids: list[str] = Field(description="All event IDs available for this plot")
    visible_event_ids: list[str] = Field(description="Event IDs currently visible (toggled on)")
    plot_key: str = Field(description="The plot key to render")
    width: int = Field(default=1200, ge=400, le=2400, description="Image width in pixels")
    height: int = Field(default=800, ge=300, le=1600, description="Image height in pixels")
    baseline_opacity: float = Field(default=0.5, ge=0.0, le=1.0, description="Opacity for baseline data")
    x_label: str | None = Field(default=None, description="Optional X-axis label")
    y_label: str | None = Field(default=None, description="Optional Y-axis label")
    plot_settings: PlotAxisSettings | None = Field(
        default=None,
        description="Axis limits and grid configuration for this plot"
    )
    curve_colors: CurveColorConfig | None = Field(
        default=None,
        description="User-selected colors for baseline and new data curves"
    )


class CurveData(BaseModel):
    """Curve data for display."""

    event_id: str
    color: str = Field(description="Hex color used for this curve")


class RenderInteractiveResponse(BaseModel):
    """Response for interactive plot rendering."""

    plot_key: str
    image_base64: str = Field(description="Base64-encoded PNG image")
    image_width: int = Field(description="Actual image width in pixels")
    image_height: int = Field(description="Actual image height in pixels")
    visible_count: int = Field(description="Number of visible curves")
    total_count: int = Field(description="Total number of curves available")
    curves: list[CurveData] = Field(description="Visible curve metadata")


class ClickQueryRequest(BaseModel):
    """Request to find nearest curve value at a click position."""

    plot_key: str = Field(description="The plot key")
    event_ids: list[str] = Field(description="Event IDs currently visible")
    click_x: float = Field(description="Click X position (0-1 normalized)")
    click_y: float = Field(description="Click Y position (0-1 normalized)")
    threshold: float = Field(default=0.05, description="Max distance threshold (normalized)")


class ClickQueryResponse(BaseModel):
    """Response with nearest curve value."""

    found: bool = Field(description="Whether a curve was found near the click")
    event_id: str | None = Field(default=None, description="Event ID of nearest curve")
    color: str | None = Field(default=None, description="Color of the curve")
    data_x: float | None = Field(default=None, description="X value at click position")
    data_y: float | None = Field(default=None, description="Interpolated Y (force) value")
    distance: float | None = Field(default=None, description="Distance to curve (normalized)")


# ============================================================================
# SVG Plot Data Models (Client-Side Rendering)
# ============================================================================


class SVGPoint(BaseModel):
    """Single data point for SVG rendering."""

    x: float
    y: float


class SVGCurveData(BaseModel):
    """Data for a single curve (one event on one plot) for SVG rendering."""

    event_id: str
    points: list[SVGPoint]
    color: str | None = None


class SVGPlotCurvesData(BaseModel):
    """All curves for a single plot for SVG rendering."""

    curves: list[SVGCurveData]
    x_label: str
    y_label: str
    x_unit: str = ""
    y_unit: str = ""


class SVGPlotMetadata(BaseModel):
    """Metadata about the SVG plot data response."""

    total_events: int
    total_points: int
    scale_factor: float = 1000


class SVGPlotDataResponse(BaseModel):
    """Response for SVG plot data endpoint - client-side rendering."""

    plots: dict[str, SVGPlotCurvesData]
    metadata: SVGPlotMetadata