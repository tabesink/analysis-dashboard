"""Dashboard data endpoints."""

import base64
import json
import logging
import time
from typing import Annotated, Any, AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response, StreamingResponse

from server.dependencies import (
    CurrentUserDep,
    CustomFieldServiceDep,
    IngestionServiceDep,
    QueryServiceDep,
    SettingsDep,
    WriteUserDep,
    get_current_user,
)
from server.models.dashboard import (
    ChannelMapEntry,
    ChannelMapEditorResponse,
    ChannelMapProcessResult,
    ChannelMapSaveRequest,
    ClickQueryRequest,
    ClickQueryResponse,
    CustomFieldDefinitionRequest,
    CustomFieldDefinitionResponse,
    CurveData,
    EventCountRequest,
    EventCountResponse,
    EventMetadata,
    EventMetadataUpdateRequest,
    EventsRequest,
    EventsResponse,
    EventsByIdsRequest,
    FilterOptionsUpdateRequest,
    MetadataResponse,
    PlotDataRequest,
    PlotDataResponse,
    PlotPoint,
    PlotSeries,
    ProgramVersionMetadataUpdateRequest,
    ProgramVersionMetadataUpdateResponse,
    ProgramCustomFieldValuesResponse,
    ProgramCustomFieldValuesUpdateRequest,
    ProgramIdsResponse,
    RenderGridRequest,
    RenderInteractiveRequest,
    RenderInteractiveResponse,
    SVGCurveData,
    SVGPlotCurvesData,
    SVGPlotDataResponse,
    SVGPlotMetadata,
    SVGPoint,
    VersionsResponse,
)
from server.services.plot_image import PlotImageService
from server.services.query import OptimisticConcurrencyError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dashboard", dependencies=[Depends(get_current_user)])


def _event_record_to_metadata(event: dict[str, Any]) -> EventMetadata:
    return EventMetadata(
        event_id=event["event_id"],
        program_id=event["program_id"],
        version=event["version"],
        uploaded_by_user_id=event.get("uploaded_by_user_id"),
        uploaded_by_username=event.get("uploaded_by_username"),
        last_updated_by_user_id=event.get("last_updated_by_user_id"),
        last_updated_by_username=event.get("last_updated_by_username"),
        status=event.get("status"),
        job_number=event.get("job_number"),
        work_order=event.get("work_order"),
        rfq=event.get("rfq"),
        dv=event.get("dv"),
        pv=event.get("pv"),
        post_prod=event.get("post_prod"),
        suspension_component=event.get("suspension_component"),
        axle_location=event.get("axle_location"),
        gvw=event.get("gvw"),
        gross_vehicle_weight_range_lbs=event.get("gross_vehicle_weight_range_lbs"),
        fgawr=event.get("fgawr"),
        fgawr_range_lbs=event.get("fgawr_range_lbs"),
        rgawr=event.get("rgawr"),
        rgawr_range_lbs=event.get("rgawr_range_lbs"),
        drive_type=event.get("drive_type"),
        material_construction=event.get("material_construction"),
        steering_position=event.get("steering_position"),
        damper_type=event.get("damper_type"),
        vehicle_type=event.get("vehicle_type"),
        custom_fields=event.get("custom_fields") or {},
        source_file=event.get("source_file"),
        row_count=event.get("row_count"),
        has_channel_map=bool(event.get("has_channel_map", True)),
        missing_channel_map=bool(event.get("missing_channel_map", False)),
        selectable_for_plotting=bool(event.get("selectable_for_plotting", True)),
        created_at=str(event.get("created_at")) if event.get("created_at") else None,
        updated_at=str(event.get("updated_at")) if event.get("updated_at") else None,
    )


@router.get("/program-ids", response_model=ProgramIdsResponse)
async def get_program_ids(
    query_service: QueryServiceDep,
    exclude_pending_only: Annotated[bool, Query()] = False,
    pending_only: Annotated[bool, Query()] = False,
    # Global filter params for bidirectional filtering
    suspension_component: Annotated[list[str] | None, Query()] = None,
    axle_location: Annotated[list[str] | None, Query()] = None,
    rfq: Annotated[list[str] | None, Query()] = None,
    dv: Annotated[list[str] | None, Query()] = None,
    pv: Annotated[list[str] | None, Query()] = None,
    post_prod: Annotated[list[str] | None, Query()] = None,
    drive_type: Annotated[list[str] | None, Query()] = None,
    material_construction: Annotated[list[str] | None, Query()] = None,
    steering_position: Annotated[list[str] | None, Query()] = None,
    damper_type: Annotated[list[str] | None, Query()] = None,
    vehicle_type: Annotated[list[str] | None, Query()] = None,
    gross_vehicle_weight_range_lbs: Annotated[list[str] | None, Query()] = None,
    fgawr_range_lbs: Annotated[list[str] | None, Query()] = None,
    rgawr_range_lbs: Annotated[list[str] | None, Query()] = None,
    event_id_query: Annotated[str | None, Query()] = None,
) -> ProgramIdsResponse:
    """
    Get all unique program IDs.
    
    Args:
        exclude_pending_only: If True, only return programs with Approved/Obsolete events
        pending_only: If True, only return programs with Pending events
        suspension_component: Filter by suspension component values
        axle_location: Filter by axle location values
        drive_type: Filter by drive type values
        material: Filter by material values
        steering_position: Filter by steering position values
        vehicle_type: Filter by vehicle type values
        gross_vehicle_weight_range_lbs: Filter by GVW range values
    """
    # Build global_filters dict from query params
    global_filters: dict[str, list[str] | str] = {}
    if suspension_component:
        global_filters["suspension_component"] = suspension_component
    if axle_location:
        global_filters["axle_location"] = axle_location
    if rfq:
        global_filters["rfq"] = rfq
    if dv:
        global_filters["dv"] = dv
    if pv:
        global_filters["pv"] = pv
    if post_prod:
        global_filters["post_prod"] = post_prod
    if drive_type:
        global_filters["drive_type"] = drive_type
    if material_construction:
        global_filters["material_construction"] = material_construction
    if steering_position:
        global_filters["steering_position"] = steering_position
    if damper_type:
        global_filters["damper_type"] = damper_type
    if vehicle_type:
        global_filters["vehicle_type"] = vehicle_type
    if gross_vehicle_weight_range_lbs:
        global_filters["gross_vehicle_weight_range_lbs"] = gross_vehicle_weight_range_lbs
    if fgawr_range_lbs:
        global_filters["fgawr_range_lbs"] = fgawr_range_lbs
    if rgawr_range_lbs:
        global_filters["rgawr_range_lbs"] = rgawr_range_lbs
    if event_id_query and event_id_query.strip():
        global_filters["event_id_query"] = event_id_query.strip()
    
    program_ids = query_service.get_program_ids(
        exclude_pending_only,
        pending_only,
        global_filters if global_filters else None,
    )
    return ProgramIdsResponse(program_ids=program_ids)


@router.get("/versions", response_model=VersionsResponse)
async def get_versions(
    query_service: QueryServiceDep,
    program_id: Annotated[str | None, Query()] = None,
    status_values: Annotated[list[str] | None, Query()] = None,
    # Multi-program support
    program_ids: Annotated[list[str] | None, Query()] = None,
    # Global filter params for bidirectional filtering
    suspension_component: Annotated[list[str] | None, Query()] = None,
    axle_location: Annotated[list[str] | None, Query()] = None,
    rfq: Annotated[list[str] | None, Query()] = None,
    dv: Annotated[list[str] | None, Query()] = None,
    pv: Annotated[list[str] | None, Query()] = None,
    post_prod: Annotated[list[str] | None, Query()] = None,
    drive_type: Annotated[list[str] | None, Query()] = None,
    material_construction: Annotated[list[str] | None, Query()] = None,
    steering_position: Annotated[list[str] | None, Query()] = None,
    damper_type: Annotated[list[str] | None, Query()] = None,
    vehicle_type: Annotated[list[str] | None, Query()] = None,
    gross_vehicle_weight_range_lbs: Annotated[list[str] | None, Query()] = None,
    fgawr_range_lbs: Annotated[list[str] | None, Query()] = None,
    rgawr_range_lbs: Annotated[list[str] | None, Query()] = None,
    event_id_query: Annotated[str | None, Query()] = None,
) -> VersionsResponse:
    """
    Get all versions, optionally filtered by program(s), status, and global filters.
    
    Args:
        program_id: Single program ID (for backwards compatibility)
        status_values: Filter versions by status values
        program_ids: List of program IDs (for multi-program support)
        suspension_component: Filter by suspension component values
        axle_location: Filter by axle location values
        drive_type: Filter by drive type values
        material: Filter by material values
        steering_position: Filter by steering position values
        vehicle_type: Filter by vehicle type values
        gross_vehicle_weight_range_lbs: Filter by GVW range values
    """
    # Build global_filters dict from query params
    global_filters: dict[str, list[str] | str] = {}
    if suspension_component:
        global_filters["suspension_component"] = suspension_component
    if axle_location:
        global_filters["axle_location"] = axle_location
    if rfq:
        global_filters["rfq"] = rfq
    if dv:
        global_filters["dv"] = dv
    if pv:
        global_filters["pv"] = pv
    if post_prod:
        global_filters["post_prod"] = post_prod
    if drive_type:
        global_filters["drive_type"] = drive_type
    if material_construction:
        global_filters["material_construction"] = material_construction
    if steering_position:
        global_filters["steering_position"] = steering_position
    if damper_type:
        global_filters["damper_type"] = damper_type
    if vehicle_type:
        global_filters["vehicle_type"] = vehicle_type
    if gross_vehicle_weight_range_lbs:
        global_filters["gross_vehicle_weight_range_lbs"] = gross_vehicle_weight_range_lbs
    if fgawr_range_lbs:
        global_filters["fgawr_range_lbs"] = fgawr_range_lbs
    if rgawr_range_lbs:
        global_filters["rgawr_range_lbs"] = rgawr_range_lbs
    if event_id_query and event_id_query.strip():
        global_filters["event_id_query"] = event_id_query.strip()
    
    versions = query_service.get_versions(
        program_id=program_id,
        status_values=status_values,
        program_ids=program_ids,
        global_filters=global_filters if global_filters else None,
    )
    # Return first program_id for backwards compatibility, or empty string if none provided
    response_program_id = program_id or (program_ids[0] if program_ids else "")
    return VersionsResponse(program_id=response_program_id, versions=versions)


@router.get("/filter-options")
async def get_filter_options(
    query_service: QueryServiceDep,
    program_id: Annotated[str | None, Query()] = None,
) -> dict[str, dict[str, Any]]:
    """
    Get available filter options for the dashboard UI.

    Returns filter options with column mapping, display order, and values.
    Each entry has: column (DB column name), order (UI display order), values (dropdown options).
    Frontend should fetch these on startup rather than hardcoding them.
    """
    return query_service.get_filter_options(program_id=program_id)


@router.put("/filter-options")
async def update_filter_options(
    request: FilterOptionsUpdateRequest,
    query_service: QueryServiceDep,
    current_user: CurrentUserDep,
) -> dict[str, dict[str, Any]]:
    """Update filter values globally; status values remain admin-protected."""
    if current_user["role"] != "admin":
        existing_options = query_service.get_filter_options()
        for display_name, entry in request.options.items():
            if entry.column != "status":
                continue
            existing_values = existing_options.get(display_name, {}).get("values", [])
            if entry.values != existing_values:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only admins can update status values",
                )
    return query_service.update_filter_options(
        {
            key: value.model_dump()
            for key, value in request.options.items()
        }
    )


@router.post("/filter-options/reset")
async def reset_filter_options(
    query_service: QueryServiceDep,
    _: WriteUserDep,
) -> dict[str, dict[str, Any]]:
    """Reset global filter value overrides. Requires write access."""
    return query_service.reset_filter_options()


@router.get("/custom-fields", response_model=list[CustomFieldDefinitionResponse])
async def list_custom_fields(
    custom_field_service: CustomFieldServiceDep,
    filterable_only: Annotated[bool, Query()] = False,
) -> list[CustomFieldDefinitionResponse]:
    """List custom field definitions."""
    definitions = custom_field_service.list_definitions(filterable_only=filterable_only)
    return [
        CustomFieldDefinitionResponse(
            field_key=row["field_key"],
            display_name=row["display_name"],
            data_type=row.get("data_type") or "string",
            is_filterable=bool(row.get("is_filterable", True)),
            created_by_user_id=row.get("created_by_user_id"),
            created_at=str(row.get("created_at")) if row.get("created_at") else None,
            updated_at=str(row.get("updated_at")) if row.get("updated_at") else None,
        )
        for row in definitions
    ]


@router.post("/custom-fields", response_model=CustomFieldDefinitionResponse)
async def create_or_update_custom_field(
    request: CustomFieldDefinitionRequest,
    custom_field_service: CustomFieldServiceDep,
    query_service: QueryServiceDep,
    write_user: WriteUserDep,
) -> CustomFieldDefinitionResponse:
    """Create or update a custom field definition (write access required)."""
    try:
        row = custom_field_service.create_or_update_definition(
            field_key=request.field_key,
            display_name=request.display_name,
            data_type=request.data_type,
            is_filterable=request.is_filterable,
            created_by_user_id=write_user["id"],
        )
        query_service.invalidate_filter_option_caches()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    return CustomFieldDefinitionResponse(
        field_key=row["field_key"],
        display_name=row["display_name"],
        data_type=row.get("data_type") or "string",
        is_filterable=bool(row.get("is_filterable", True)),
        created_by_user_id=row.get("created_by_user_id"),
        created_at=str(row.get("created_at")) if row.get("created_at") else None,
        updated_at=str(row.get("updated_at")) if row.get("updated_at") else None,
    )


@router.get("/custom-fields/program-values/{program_id}", response_model=ProgramCustomFieldValuesResponse)
async def get_program_custom_field_values(
    program_id: str,
    custom_field_service: CustomFieldServiceDep,
) -> ProgramCustomFieldValuesResponse:
    """Get program-scoped custom field value options."""
    values_by_field = custom_field_service.get_program_allowed_values(program_id)
    return ProgramCustomFieldValuesResponse(
        program_id=program_id,
        values_by_field=values_by_field,
    )


@router.put("/custom-fields/{field_key}/program-values/{program_id}", response_model=ProgramCustomFieldValuesResponse)
async def update_program_custom_field_values(
    field_key: str,
    program_id: str,
    request: ProgramCustomFieldValuesUpdateRequest,
    custom_field_service: CustomFieldServiceDep,
    query_service: QueryServiceDep,
    _: WriteUserDep,
) -> ProgramCustomFieldValuesResponse:
    """Replace program-scoped custom field values for a field (write access required)."""
    try:
        custom_field_service.update_program_allowed_values(
            field_key=field_key,
            program_id=program_id,
            values=request.values,
        )
        query_service.invalidate_filter_option_caches()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    values_by_field = custom_field_service.get_program_allowed_values(program_id)
    return ProgramCustomFieldValuesResponse(
        program_id=program_id,
        values_by_field=values_by_field,
    )


@router.post("/events", response_model=EventsResponse)
async def get_events(
    request: EventsRequest,
    query_service: QueryServiceDep,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> EventsResponse:
    """
    Get events matching the global filters.
    """
    result = query_service.get_all_events(
        program_ids=request.program_ids or None,
        versions=request.versions or None,
        global_filters=request.global_filters,
        limit=limit,
        offset=offset,
    )

    events_list = [_event_record_to_metadata(e) for e in result["events"]]

    return EventsResponse(
        events=events_list,
        total_count=result["total_count"],
        has_more=result["has_more"],
    )


@router.post("/events/by-ids", response_model=EventsResponse)
async def get_events_by_ids(
    request: EventsByIdsRequest,
    query_service: QueryServiceDep,
    settings: SettingsDep,
) -> EventsResponse:
    """Get event metadata for explicit event IDs (ignores global filters)."""
    event_ids = request.event_ids
    if len(event_ids) > settings.max_events_per_query:
        event_ids = event_ids[: settings.max_events_per_query]

    events = query_service.get_events_by_ids(event_ids)
    events_list = [_event_record_to_metadata(e) for e in events]

    return EventsResponse(
        events=events_list,
        total_count=len(events_list),
        has_more=False,
    )


@router.put("/events/{event_id}/metadata", response_model=EventMetadata)
async def update_event_metadata(
    event_id: str,
    request: EventMetadataUpdateRequest,
    query_service: QueryServiceDep,
    current_user: CurrentUserDep,
) -> EventMetadata:
    """Update editable metadata fields for a single event."""
    updates = request.model_dump(exclude={"if_unmodified_since"}, exclude_unset=True)
    try:
        updated = query_service.update_event_metadata(
            event_id,
            updates=updates,
            current_user=current_user,
            if_unmodified_since=request.if_unmodified_since,
        )
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc
    except OptimisticConcurrencyError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    return EventMetadata(
        event_id=updated["event_id"],
        program_id=updated["program_id"],
        version=updated["version"],
        uploaded_by_user_id=updated.get("uploaded_by_user_id"),
        uploaded_by_username=updated.get("uploaded_by_username"),
        last_updated_by_user_id=updated.get("last_updated_by_user_id"),
        last_updated_by_username=updated.get("last_updated_by_username"),
        status=updated.get("status"),
        job_number=updated.get("job_number"),
        work_order=updated.get("work_order"),
        rfq=updated.get("rfq"),
        dv=updated.get("dv"),
        pv=updated.get("pv"),
        post_prod=updated.get("post_prod"),
        suspension_component=updated.get("suspension_component"),
        axle_location=updated.get("axle_location"),
        gvw=updated.get("gvw"),
        gross_vehicle_weight_range_lbs=updated.get("gross_vehicle_weight_range_lbs"),
        fgawr=updated.get("fgawr"),
        fgawr_range_lbs=updated.get("fgawr_range_lbs"),
        rgawr=updated.get("rgawr"),
        rgawr_range_lbs=updated.get("rgawr_range_lbs"),
        drive_type=updated.get("drive_type"),
        material_construction=updated.get("material_construction"),
        steering_position=updated.get("steering_position"),
        damper_type=updated.get("damper_type"),
        vehicle_type=updated.get("vehicle_type"),
        custom_fields=updated.get("custom_fields") or {},
        source_file=updated.get("source_file"),
        row_count=updated.get("row_count"),
        created_at=str(updated.get("created_at")) if updated.get("created_at") else None,
        updated_at=str(updated.get("updated_at")) if updated.get("updated_at") else None,
    )


@router.put("/program-version/metadata", response_model=ProgramVersionMetadataUpdateResponse)
async def update_program_version_metadata(
    request: ProgramVersionMetadataUpdateRequest,
    query_service: QueryServiceDep,
    current_user: CurrentUserDep,
) -> ProgramVersionMetadataUpdateResponse:
    """Update editable metadata fields for all events in a program/version."""
    updates = request.updates.model_dump(exclude_unset=True)
    try:
        summary = query_service.update_program_version_metadata(
            program_id=request.program_id,
            version=request.version,
            updates=updates,
            current_user=current_user,
        )
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc

    return ProgramVersionMetadataUpdateResponse(**summary)


@router.post("/event-count", response_model=EventCountResponse)
async def get_event_count(
    request: EventCountRequest,
    query_service: QueryServiceDep,
) -> EventCountResponse:
    """
    Get event counts before rendering.

    Fast COUNT query without fetching full event data.
    """
    result = query_service.get_event_count(
        global_filters=request.global_filters,
    )

    return EventCountResponse(
        total=result["total"],
    )


@router.post("/plot-data", response_model=PlotDataResponse)
async def get_plot_data(
    request: PlotDataRequest,
    query_service: QueryServiceDep,
    settings: SettingsDep,
) -> PlotDataResponse:
    """Get LTTB plot data for specified events and plot keys."""
    # Enforce query limits
    event_ids = request.event_ids
    if len(event_ids) > settings.max_events_per_query:
        event_ids = event_ids[: settings.max_events_per_query]

    data = query_service.get_plot_data(
        event_ids=event_ids,
        plot_keys=request.plot_keys,
    )

    # Convert to response models
    series = [
        PlotSeries(
            event_id=s["event_id"],
            plot_key=s["plot_key"],
            status=s.get("status"),
            points=[PlotPoint(x=p["x"], y=p["y"]) for p in s["points"]],
        )
        for s in data
    ]

    return PlotDataResponse(
        series=series,
        plot_keys=request.plot_keys,
        event_count=len(set(s.event_id for s in series)),
    )


def _build_svg_plot_data_response(
    query_service: QueryServiceDep,
    settings: SettingsDep,
    event_ids: list[str],
    plot_keys: list[str],
) -> SVGPlotDataResponse:
    # Enforce query limits
    if len(event_ids) > settings.max_events_per_query:
        event_ids = event_ids[: settings.max_events_per_query]
    
    # Get plot data using existing service
    series_data = query_service.get_plot_data(
        event_ids=event_ids,
        plot_keys=plot_keys,
    )

    # Group by plot_key and build response
    plots: dict[str, SVGPlotCurvesData] = {}
    total_points = 0
    
    # Group series by plot_key
    series_by_plot: dict[str, list[dict]] = {}
    for s in series_data:
        plot_key = s["plot_key"]
        if plot_key not in series_by_plot:
            series_by_plot[plot_key] = []
        series_by_plot[plot_key].append(s)
    
    # Build response for each plot_key
    for plot_key in plot_keys:
        series_list = series_by_plot.get(plot_key, [])
        
        curves = []
        for s in series_list:
            points = [
                SVGPoint(x=p["x"], y=p["y"]) 
                for p in s["points"]
            ]
            total_points += len(points)
            
            curves.append(SVGCurveData(
                event_id=s["event_id"],
                points=points,
            ))
        
        # Parse axis labels from plot_key
        parts = plot_key.split("_vs_")
        if len(parts) == 2:
            y_label = parts[0].replace("_", " ").title()
            x_label = parts[1].replace("_", " ").title()
        else:
            x_label = "X"
            y_label = "Y"
        
        plots[plot_key] = SVGPlotCurvesData(
            curves=curves,
            x_label=x_label,
            y_label=y_label,
            x_unit="",
            y_unit="",
        )
    
    return SVGPlotDataResponse(
        plots=plots,
        metadata=SVGPlotMetadata(
            total_events=len(set(event_ids)),
            total_points=total_points,
            scale_factor=1000,
        ),
    )


@router.post("/plots/data", response_model=SVGPlotDataResponse)
async def get_svg_plot_data_post(
    query_service: QueryServiceDep,
    settings: SettingsDep,
    request: PlotDataRequest,
) -> SVGPlotDataResponse:
    """
    Get LTTB-downsampled plot data for client-side SVG rendering (POST).

    Uses request body payload to avoid URL length limits with large event selections.
    """
    return _build_svg_plot_data_response(
        query_service=query_service,
        settings=settings,
        event_ids=request.event_ids,
        plot_keys=request.plot_keys,
    )


@router.get("/plots/data", response_model=SVGPlotDataResponse)
async def get_svg_plot_data(
    query_service: QueryServiceDep,
    settings: SettingsDep,
    event_ids: Annotated[list[str], Query(description="Event IDs to include")],
    plot_keys: Annotated[list[str], Query(description="Plot keys to fetch")],
) -> SVGPlotDataResponse:
    """
    Get LTTB-downsampled plot data for client-side SVG rendering (GET).

    Kept for backward compatibility; POST is preferred for large selections.
    """
    return _build_svg_plot_data_response(
        query_service=query_service,
        settings=settings,
        event_ids=event_ids,
        plot_keys=plot_keys,
    )


def _build_binary_plot_data_response(
    query_service: QueryServiceDep,
    settings: SettingsDep,
    event_ids: list[str],
    plot_keys: list[str],
) -> Response:
    """
    Get LTTB plot data as binary Float32Arrays.
    
    Returns raw binary data for efficient client-side decoding.
    Binary format:
    - Header: num_curves (uint32)
    - Per curve: 
      - event_id_len (uint16), event_id (bytes)
      - plot_key_len (uint16), plot_key (bytes)
      - num_points (uint32)
      - x_values (float32[num_points])
      - y_values (float32[num_points])
    
    ~8x smaller than JSON, ~10x faster to parse client-side.
    """
    import struct
    
    # Enforce query limits
    if len(event_ids) > settings.max_events_per_query:
        event_ids = event_ids[: settings.max_events_per_query]
    
    # Get binary-optimized data (returns numpy arrays)
    series_data = query_service.get_plot_data_binary(
        event_ids=event_ids,
        plot_keys=plot_keys,
    )
    
    # Build binary buffer
    buffer = bytearray()
    
    # Header: number of curves
    buffer.extend(struct.pack('<I', len(series_data)))  # uint32, little-endian
    
    for s in series_data:
        # Event ID (length-prefixed string)
        event_id_bytes = s["event_id"].encode('utf-8')
        buffer.extend(struct.pack('<H', len(event_id_bytes)))  # uint16
        buffer.extend(event_id_bytes)
        
        # Plot key (length-prefixed string)
        plot_key_bytes = s["plot_key"].encode('utf-8')
        buffer.extend(struct.pack('<H', len(plot_key_bytes)))  # uint16
        buffer.extend(plot_key_bytes)
        
        # Number of points
        x_arr = s["x"]
        y_arr = s["y"]
        buffer.extend(struct.pack('<I', len(x_arr)))  # uint32
        
        # X values as Float32 array
        buffer.extend(x_arr.tobytes())
        
        # Y values as Float32 array
        buffer.extend(y_arr.tobytes())
    
    return Response(
        content=bytes(buffer),
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": "inline",
            "Cache-Control": "public, max-age=600",  # 10 minutes (immutable data)
        },
    )


@router.post("/plots/data/binary")
async def get_plot_data_binary_post(
    query_service: QueryServiceDep,
    settings: SettingsDep,
    request: PlotDataRequest,
) -> Response:
    """Binary LTTB endpoint using request body payload (preferred for large selections)."""
    return _build_binary_plot_data_response(
        query_service=query_service,
        settings=settings,
        event_ids=request.event_ids,
        plot_keys=request.plot_keys,
    )


@router.get("/plots/data/binary")
async def get_plot_data_binary(
    query_service: QueryServiceDep,
    settings: SettingsDep,
    event_ids: Annotated[list[str], Query(description="Event IDs to include")],
    plot_keys: Annotated[list[str], Query(description="Plot keys to fetch")],
) -> Response:
    """Binary LTTB endpoint kept for backward compatibility."""
    return _build_binary_plot_data_response(
        query_service=query_service,
        settings=settings,
        event_ids=event_ids,
        plot_keys=plot_keys,
    )


@router.get("/metadata/{program_id}", response_model=MetadataResponse)
async def get_metadata(
    program_id: str,
    query_service: QueryServiceDep,
    version: Annotated[str | None, Query()] = None,
) -> MetadataResponse:
    """Get metadata for a program/version including channel map."""
    if not version:
        # Get first available version
        versions = query_service.get_versions(program_id)
        if not versions:
            return MetadataResponse(
                program_id=program_id,
                version="",
                channel_map=[],
                event_count=0,
            )
        version = versions[0]

    channel_map = query_service.get_channel_map(program_id, version)

    # Get event count for this program/version
    events, total = query_service.get_events(
        program_ids=[program_id],
        versions=[version],
        limit=0,
    )

    return MetadataResponse(
        program_id=program_id,
        version=version,
        channel_map=[
            ChannelMapEntry(
                plot_key=cm["plot_key"],
                x_col=cm.get("x_col"),
                y_col=cm.get("y_col"),
                x_channel=cm["x_channel"],
                y_channel=cm["y_channel"],
                plot_order=cm.get("plot_order", 0),
                x_scale_factor=cm.get("x_scale_factor", 1.0),
                y_scale_factor=cm.get("y_scale_factor", 1.0),
                x_unit=cm.get("x_unit"),
                y_unit=cm.get("y_unit"),
            )
            for cm in channel_map
        ],
        event_count=total,
    )


@router.get(
    "/channel-map/{program_id}/{version}",
    response_model=ChannelMapEditorResponse,
)
async def get_channel_map_editor(
    program_id: str,
    version: str,
    query_service: QueryServiceDep,
) -> ChannelMapEditorResponse:
    """Return saved channel-map rows plus retained CSV preview for the editor."""
    channel_map = query_service.get_channel_map(program_id, version)
    artifacts = query_service.db.list_ingestion_artifacts(program_id=program_id, version=version)
    pending_count = sum(1 for a in artifacts if a.get("status") == "pending")
    failed_count = sum(1 for a in artifacts if a.get("status") == "failed")
    first_artifact = artifacts[0] if artifacts else None
    preview_lines: list[str] = []
    column_count = 0
    if first_artifact:
        column_count = int(first_artifact.get("column_count") or 0)
        raw_preview = first_artifact.get("preview_json")
        if raw_preview:
            try:
                preview = json.loads(raw_preview) if isinstance(raw_preview, str) else raw_preview
                preview_lines = [str(line) for line in preview.get("lines", [])]
            except (TypeError, json.JSONDecodeError):
                preview_lines = []

    entries = [
        {
            "plot_key": row["plot_key"],
            "x_col": int(row["x_col"] if row.get("x_col") is not None else 0),
            "y_col": int(row["y_col"] if row.get("y_col") is not None else 1),
        }
        for row in channel_map
        if row.get("x_col") is not None and row.get("y_col") is not None
    ]

    has_channel_map = len(channel_map) > 0
    return ChannelMapEditorResponse(
        program_id=program_id,
        version=version,
        has_channel_map=has_channel_map,
        missing_channel_map=(not has_channel_map and (pending_count + failed_count) > 0),
        entries=entries,
        preview_lines=preview_lines,
        column_count=column_count,
        pending_artifact_count=pending_count,
        failed_artifact_count=failed_count,
    )


@router.put(
    "/program-version/channel-map",
    response_model=ChannelMapProcessResult,
)
async def save_program_version_channel_map(
    request: ChannelMapSaveRequest,
    ingestion_service: IngestionServiceDep,
    write_user: WriteUserDep,
) -> ChannelMapProcessResult:
    """Save the fixed channel map and process retained artifacts."""
    can_edit = ingestion_service.db.user_can_edit_program_version(
        request.program_id,
        request.version,
        write_user["id"],
        write_user["role"] == "admin",
    )
    if not can_edit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit channel maps for uploads you own",
        )
    try:
        result = ingestion_service.save_channel_map_and_process_artifacts(
            program_id=request.program_id,
            version=request.version,
            entries=[entry.model_dump() for entry in request.entries],
            user_id=write_user["id"],
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return ChannelMapProcessResult(**result)


@router.post("/render-grid")
async def render_grid(
    request: RenderGridRequest,
    query_service: QueryServiceDep,
    settings: SettingsDep,
) -> StreamingResponse:
    """
    Stream grid plot images via Server-Sent Events (SSE).
    
    Generates static plot images for the grid layout, streaming each
    image as it's generated for progressive loading.
    
    Color Grouping:
    - When color_grouping is provided, baseline data is colored by category
    - New data is ALWAYS rendered in black regardless of grouping
    
    SSE Event Types:
    - plot_image: Individual plot rendered (includes base64 image)
    - progress: Render progress update
    - complete: All plots rendered
    - error: Error occurred
    """
    import pandas as pd
    
    image_service = PlotImageService()
    
    async def generate_ndjson() -> AsyncGenerator[str, None]:
        start_time = time.time()
        total_plots = len(request.plot_keys)
        
        # Check if image service is available
        if not image_service.is_available():
            error_event = {
                "type": "error",
                "message": "Image generation not available - matplotlib not installed"
            }
            yield json.dumps(error_event) + "\n"
            return
        
        # Get plot data for all events
        try:
            series_data = query_service.get_plot_data(
                event_ids=request.event_ids,
                plot_keys=request.plot_keys,
            )
        except Exception as e:
            logger.error(f"Failed to get plot data: {e}")
            error_event = {
                "type": "error",
                "message": f"Failed to get plot data: {str(e)}"
            }
            yield json.dumps(error_event) + "\n"
            return
        
        # Fetch event metadata if color grouping is enabled
        event_metadata: dict[str, dict] = {}
        color_grouping_dict = None
        
        if request.color_grouping and request.color_grouping.mode == "filter_category":
            color_grouping_dict = {
                "mode": request.color_grouping.mode,
                "filter_category": request.color_grouping.filter_category,
                "custom_colors": request.color_grouping.custom_colors or {},
            }
            
            # Get metadata for all events to enable category-based coloring
            try:
                events_info = query_service.get_events_by_ids(request.event_ids)
                for event in events_info:
                    event_metadata[event["event_id"]] = event
            except Exception as e:
                logger.warning(f"Failed to get event metadata for color grouping: {e}")
                # Continue without color grouping
                color_grouping_dict = None
        
        # Group series by plot_key
        plot_data_by_key: dict[str, list[dict]] = {}
        for s in series_data:
            plot_key = s["plot_key"]
            if plot_key not in plot_data_by_key:
                plot_data_by_key[plot_key] = []
            plot_data_by_key[plot_key].append(s)
        
        # Generate images for each plot_key
        for idx, plot_key in enumerate(request.plot_keys):
            # Send progress event
            progress_event = {
                "type": "progress",
                "current": idx + 1,
                "total": total_plots,
                "plot_key": plot_key,
            }
            yield json.dumps(progress_event) + "\n"
            
            # Get data for this plot_key
            series_list = plot_data_by_key.get(plot_key, [])
            
            if not series_list:
                logger.warning(f"No data for plot_key: {plot_key}")
                continue
            
            # Convert to DataFrame for image generation
            rows = []
            for s in series_list:
                for point in s["points"]:
                    rows.append({
                        "event_id": s["event_id"],
                        "x": point["x"],
                        "y": point["y"],
                    })
            
            if not rows:
                continue
            
            plot_df = pd.DataFrame(rows)
            
            # Generate image
            try:
                # Use axis labels from request if provided, otherwise parse from plot_key
                if request.axis_labels and plot_key in request.axis_labels:
                    axis_config = request.axis_labels[plot_key]
                    x_channel = axis_config.x_label
                    y_channel = axis_config.y_label
                    title = axis_config.title
                else:
                    # Fallback: Parse plot_key to get x and y channel names
                    parts = plot_key.split("_vs_")
                    if len(parts) == 2:
                        y_channel = parts[0].replace("_", " ").title()
                        x_channel = parts[1].replace("_", " ").title()
                    else:
                        x_channel = "X"
                        y_channel = "Y"
                    
                    title = plot_key.replace("_", " ").title()
                
                # Get axis settings for this plot if provided
                axis_settings_dict = None
                if request.plot_settings and plot_key in request.plot_settings:
                    ps = request.plot_settings[plot_key]
                    axis_settings_dict = {
                        "x_min": ps.x_min,
                        "x_max": ps.x_max,
                        "y_min": ps.y_min,
                        "y_max": ps.y_max,
                        "grid_count": ps.grid_count,
                    }
                
                # Build curve colors dict from request
                curve_colors_dict = None
                if request.curve_colors:
                    curve_colors_dict = {
                        "baseline_color": request.curve_colors.baseline_color,
                        "new_data_color": request.curve_colors.new_data_color,
                        "filter_colors": request.curve_colors.filter_colors or {},
                    }
                
                img_bytes = image_service.generate_grid_cell_image(
                    plot_data=plot_df,
                    x_channel=x_channel,
                    y_channel=y_channel,
                    title=title,
                    width=400,
                    height=300,
                    format="png",
                    color_grouping=color_grouping_dict,
                    event_metadata=event_metadata,
                    axis_settings=axis_settings_dict,
                    curve_colors=curve_colors_dict,
                )
                
                if img_bytes:
                    img_base64 = base64.b64encode(img_bytes).decode('utf-8')
                    plot_event = {
                        "type": "plot_image",
                        "plot_key": plot_key,
                        "image_base64": f"data:image/png;base64,{img_base64}",
                        "color_groups": [],
                    }
                    yield json.dumps(plot_event) + "\n"
                    
            except Exception as e:
                logger.error(f"Failed to generate image for {plot_key}: {e}")
                error_event = {
                    "type": "error",
                    "message": f"Failed to generate image for {plot_key}: {str(e)}",
                    "plot_key": plot_key,
                }
                yield json.dumps(error_event) + "\n"
        
        # Send complete event
        render_time_ms = int((time.time() - start_time) * 1000)
        complete_event = {
            "type": "complete",
            "total_plots": total_plots,
            "render_time_ms": render_time_ms,
            "color_groups": [],
        }
        yield json.dumps(complete_event) + "\n"
    
    return StreamingResponse(
        generate_ndjson(),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )


@router.post("/render-interactive", response_model=RenderInteractiveResponse)
async def render_interactive(
    request: RenderInteractiveRequest,
    query_service: QueryServiceDep,
) -> RenderInteractiveResponse:
    """
    Render a single interactive plot with visibility control.
    """
    import pandas as pd
    
    image_service = PlotImageService()
    
    if not image_service.is_available():
        raise ValueError("Image generation not available - matplotlib not installed")
    
    series_data = query_service.get_plot_data(
        event_ids=request.event_ids,
        plot_keys=[request.plot_key],
    )
    
    if not series_data:
        raise ValueError(f"No data found for plot_key: {request.plot_key}")
    
    rows = []
    for s in series_data:
        for point in s["points"]:
            rows.append({
                "event_id": s["event_id"],
                "x": point["x"],
                "y": point["y"],
            })
    
    if not rows:
        raise ValueError("No data points found")
    
    plot_df = pd.DataFrame(rows)
    
    # Use axis labels from request if provided, otherwise parse from plot_key
    if request.x_label and request.y_label:
        x_channel = request.x_label
        y_channel = request.y_label
    else:
        # Fallback: Parse plot_key to get x and y channel names
        parts = request.plot_key.split("_vs_")
        if len(parts) == 2:
            y_channel = parts[0].replace("_", " ").title()
            x_channel = parts[1].replace("_", " ").title()
        else:
            x_channel = "X"
            y_channel = "Y"
    
    # Use title from request if provided, otherwise format from plot_key
    title = request.plot_key.replace("_", " ").title()
    
    # Get axis settings if provided
    axis_settings_dict = None
    if request.plot_settings:
        axis_settings_dict = {
            "x_min": request.plot_settings.x_min,
            "x_max": request.plot_settings.x_max,
            "y_min": request.plot_settings.y_min,
            "y_max": request.plot_settings.y_max,
            "grid_count": request.plot_settings.grid_count,
        }
    
    # Get curve colors if provided
    curve_colors_dict = None
    if request.curve_colors:
        curve_colors_dict = {
            "baseline_color": request.curve_colors.baseline_color,
            "new_data_color": request.curve_colors.new_data_color,
            "filter_colors": request.curve_colors.filter_colors or {},
        }
    
    result = image_service.generate_interactive_image(
        plot_data=plot_df,
        visible_event_ids=request.visible_event_ids,
        x_channel=x_channel,
        y_channel=y_channel,
        title=title,
        width=request.width,
        height=request.height,
        opacity=request.baseline_opacity,
        axis_settings=axis_settings_dict,
        curve_colors=curve_colors_dict,
    )
    
    if not result:
        raise ValueError("Failed to generate image")
    
    img_base64 = base64.b64encode(result["image_bytes"]).decode('utf-8')
    
    curves = [
        CurveData(event_id=c["event_id"], color=c["color"])
        for c in result["curves"]
    ]
    
    return RenderInteractiveResponse(
        plot_key=request.plot_key,
        image_base64=f"data:image/png;base64,{img_base64}",
        image_width=result["image_width"],
        image_height=result["image_height"],
        visible_count=len(request.visible_event_ids),
        total_count=len(request.event_ids),
        curves=curves,
    )


@router.post("/click-query", response_model=ClickQueryResponse)
async def click_query(
    request: ClickQueryRequest,
    query_service: QueryServiceDep,
) -> ClickQueryResponse:
    """
    Find the nearest curve value at a click position.
    
    Takes normalized click coordinates (0-1) and returns the
    nearest curve's interpolated value at that X position.
    """
    import pandas as pd
    
    image_service = PlotImageService()
    
    if not image_service.is_available():
        raise ValueError("Image generation not available")
    
    series_data = query_service.get_plot_data(
        event_ids=request.event_ids,
        plot_keys=[request.plot_key],
    )
    
    if not series_data:
        return ClickQueryResponse(found=False)
    
    rows = []
    for s in series_data:
        for point in s["points"]:
            rows.append({
                "event_id": s["event_id"],
                "x": point["x"],
                "y": point["y"],
            })
    
    if not rows:
        return ClickQueryResponse(found=False)
    
    plot_df = pd.DataFrame(rows)
    
    # We need the same axis limits and plot area as the rendered image
    # Generate a dummy image to get the geometry
    parts = request.plot_key.split("_vs_")
    if len(parts) == 2:
        y_channel = parts[0].replace("_", " ").title()
        x_channel = parts[1].replace("_", " ").title()
    else:
        x_channel = "X"
        y_channel = "Y"
    
    title = request.plot_key.replace("_", " ").title()
    
    # Generate to get geometry (we don't use the image)
    result = image_service.generate_interactive_image(
        plot_data=plot_df,
        visible_event_ids=request.event_ids,
        x_channel=x_channel,
        y_channel=y_channel,
        title=title,
    )
    
    if not result:
        return ClickQueryResponse(found=False)
    
    # Find nearest curve value
    nearest = image_service.find_nearest_curve_value(
        plot_data=plot_df,
        visible_event_ids=request.event_ids,
        click_x_norm=request.click_x,
        click_y_norm=request.click_y,
        axis_limits=result["axis_limits"],
        plot_area=result["plot_area"],
        threshold=request.threshold,
    )
    
    if not nearest:
        return ClickQueryResponse(found=False)
    
    return ClickQueryResponse(
        found=True,
        event_id=nearest["event_id"],
        color=nearest["color"],
        data_x=nearest["data_x"],
        data_y=nearest["data_y"],
        distance=nearest["distance"],
    )

