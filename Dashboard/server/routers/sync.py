"""Cross-user sync endpoints."""

from fastapi import APIRouter

from server.dependencies import CurrentUserDep, DatabaseDep

router = APIRouter(prefix="/sync")


@router.get("/version")
async def get_sync_version(
    _: CurrentUserDep,
    db: DatabaseDep,
) -> dict[str, int]:
    """Return current monotonic data version for polling clients."""
    return {"data_version": db.get_data_version()}
