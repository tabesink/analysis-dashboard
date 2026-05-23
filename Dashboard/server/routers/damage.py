"""Damage inspection endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from server.dependencies import QueryServiceDep, get_current_user
from server.models.damage import (
    DamageCell,
    DamageChannelMetadata,
    DamageInspectRequest,
    DamageInspectResponse,
    DamageInspectRow,
)
from server.services.fatigue_damage import ChannelSeries, FatigueDamageCalculator


router = APIRouter(prefix="/damage", dependencies=[Depends(get_current_user)])


@router.post("/inspect", response_model=DamageInspectResponse)
async def inspect_damage(
    request: DamageInspectRequest,
    query_service: QueryServiceDep,
) -> DamageInspectResponse:
    if not request.event_ids:
        return DamageInspectResponse(channels=[], rows=[])
    series = query_service.get_damage_channel_series(request.event_ids)
    calculator = FatigueDamageCalculator()

    channels_by_key: dict[str, DamageChannelMetadata] = {}
    rows_by_event: dict[str, DamageInspectRow] = {}
    for event_id in request.event_ids:
        event = query_service.db.get_event(event_id)
        if event is None:
            continue
        rows_by_event[event_id] = DamageInspectRow(
            event_id=event_id,
            job_number=event.get("job_number"),
            work_order=event.get("work_order"),
            program_id=event["program_id"],
            damages={},
        )

    for item in series:
        event_id = item["event_id"]
        row = rows_by_event.get(event_id)
        if row is None:
            continue

        channel_key = item["channel_key"]
        channels_by_key.setdefault(
            channel_key,
            DamageChannelMetadata(
                channel_key=channel_key,
                channel_name=item["channel_name"],
                unit=item.get("unit"),
            ),
        )
        if item.get("status") == "unavailable":
            row.damages[channel_key] = DamageCell(
                damage=None,
                status="unavailable",
                error=item.get("error") or "Damage channel is unavailable",
            )
            continue

        result = calculator.calculate_channel(
            ChannelSeries(
                channel_key=channel_key,
                channel_name=item["channel_name"],
                unit=item.get("unit"),
                values=item["values"],
            )
        )
        row.damages[channel_key] = DamageCell(
            damage=result.damage,
            status=result.status,
            error=result.error,
        )

    channels = list(channels_by_key.values())
    rows = [rows_by_event[event_id] for event_id in request.event_ids if event_id in rows_by_event]
    return DamageInspectResponse(channels=channels, rows=rows)
