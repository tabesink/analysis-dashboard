"""Session management endpoints."""

from fastapi import APIRouter, HTTPException, status

from server.dependencies import CurrentUserDep, SessionManagerDep
from server.models.session import (
    InspectDamageState,
    PartitionState,
    SessionCreate,
    SessionResponse,
    SessionUpdate,
    UIPreferences,
)

router = APIRouter(prefix="/session")


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    request: SessionCreate,
    session_manager: SessionManagerDep,
    current_user: CurrentUserDep,
) -> SessionResponse:
    """Create a new session."""
    session_data = {
        "data_state": request.data_state.model_dump() if request.data_state else None,
        "global_filters": request.global_filters,
        "rendered_event_ids": request.rendered_event_ids,
        "ui_preferences": request.ui_preferences.model_dump() if request.ui_preferences else None,
        "inspect_damage_state": (
            request.inspect_damage_state.model_dump()
            if request.inspect_damage_state
            else None
        ),
    }

    session_id = session_manager.create(current_user["id"], session_data)
    session = session_manager.get(session_id, current_user["id"])

    if not session:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create session",
        )

    return _session_to_response(session)


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    session_manager: SessionManagerDep,
    current_user: CurrentUserDep,
) -> SessionResponse:
    """Get session by ID."""
    session = session_manager.get(session_id, current_user["id"])

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session not found: {session_id}",
        )

    return _session_to_response(session)


@router.put("/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: str,
    request: SessionUpdate,
    session_manager: SessionManagerDep,
    current_user: CurrentUserDep,
) -> SessionResponse:
    """Update session data."""
    # Build update data (only include non-None fields)
    update_data = {}

    if request.data_state is not None:
        update_data["data_state"] = request.data_state.model_dump()

    if request.global_filters is not None:
        update_data["global_filters"] = request.global_filters

    if request.rendered_event_ids is not None:
        update_data["rendered_event_ids"] = request.rendered_event_ids

    if request.ui_preferences is not None:
        update_data["ui_preferences"] = request.ui_preferences.model_dump()

    if request.inspect_damage_state is not None:
        update_data["inspect_damage_state"] = request.inspect_damage_state.model_dump()

    if not session_manager.update(session_id, current_user["id"], update_data):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session not found: {session_id}",
        )

    session = session_manager.get(session_id, current_user["id"])
    if not session:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve updated session",
        )

    return _session_to_response(session)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: str,
    session_manager: SessionManagerDep,
    current_user: CurrentUserDep,
) -> None:
    """Delete a session."""
    if not session_manager.delete(session_id, current_user["id"]):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session not found: {session_id}",
        )


def _session_to_response(session: dict) -> SessionResponse:
    """Convert session dict to response model."""
    data_state = None
    if session.get("data_state"):
        data_state = PartitionState(**session["data_state"])

    ui_preferences = None
    if session.get("ui_preferences"):
        ui_preferences = UIPreferences(**session["ui_preferences"])

    inspect_damage_state = None
    if session.get("inspect_damage_state"):
        inspect_damage_state = InspectDamageState(**session["inspect_damage_state"])

    return SessionResponse(
        session_id=session["session_id"],
        data_state=data_state,
        global_filters=session.get("global_filters") or {},
        rendered_event_ids=session.get("rendered_event_ids") or [],
        ui_preferences=ui_preferences,
        inspect_damage_state=inspect_damage_state,
        created_at=session.get("created_at"),
        updated_at=session.get("updated_at"),
        expires_at=session.get("expires_at"),
    )

