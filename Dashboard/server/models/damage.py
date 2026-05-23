"""Pydantic models for damage inspection."""

from pydantic import BaseModel, Field


class DamageInspectRequest(BaseModel):
    event_ids: list[str] = Field(default_factory=list)


class DamageChannelMetadata(BaseModel):
    channel_key: str
    channel_name: str
    unit: str | None = None


class DamageCell(BaseModel):
    damage: float | None
    status: str
    error: str | None = None


class DamageInspectRow(BaseModel):
    event_id: str
    job_number: str | None = None
    work_order: str | None = None
    program_id: str
    damages: dict[str, DamageCell]


class DamageInspectResponse(BaseModel):
    channels: list[DamageChannelMetadata]
    rows: list[DamageInspectRow]
