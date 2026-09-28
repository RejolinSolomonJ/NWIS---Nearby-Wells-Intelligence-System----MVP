"""
Drilling Events API Router — Structured filtering + depth lookahead querying.
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models import DrillingEvent, Formation, Well
from app.schemas import DrillingEventResponse

router = APIRouter(prefix="/events", tags=["Drilling Events"])


@router.get("/by-depth", response_model=List[DrillingEventResponse])
async def get_events_by_depth_lookahead(
    well_id: UUID = Query(..., description="Target Well UUID"),
    depth: float = Query(..., ge=0, description="Current bit depth in meters"),
    lookahead_m: float = Query(150.0, ge=0, le=1000.0, description="Lookahead window in meters"),
    db: AsyncSession = Depends(get_db),
):
    """
    Early Warning Lookahead: Retrieve offset/well drilling incidents occurring
    between [depth, depth + lookahead_m].
    Used by deterministic risk engine to flag upcoming hazards ahead of the drill bit.
    """
    # Verify well exists
    well_res = await db.execute(select(Well.well_id).where(Well.well_id == well_id))
    if not well_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail=f"Well with ID {well_id} not found")

    depth_start = depth
    depth_end = depth + lookahead_m

    query = (
        select(DrillingEvent, Formation.name.label("formation_name"))
        .outerjoin(Formation, DrillingEvent.formation_id == Formation.formation_id)
        .where(
            DrillingEvent.well_id == well_id,
            DrillingEvent.depth_m >= depth_start,
            DrillingEvent.depth_m <= depth_end,
        )
        .order_by(DrillingEvent.depth_m.asc())
    )

    result = await db.execute(query)
    rows = result.all()

    response = []
    for event, form_name in rows:
        resp = DrillingEventResponse.model_validate(event)
        resp.formation_name = form_name
        response.append(resp)

    return response


@router.get("", response_model=List[DrillingEventResponse])
async def search_events(
    well_id: Optional[UUID] = Query(None, description="Filter by Well UUID"),
    formation: Optional[str] = Query(None, description="Filter by Formation name (substring match)"),
    depth_min: Optional[float] = Query(None, description="Minimum depth in meters"),
    depth_max: Optional[float] = Query(None, description="Maximum depth in meters"),
    event_type: Optional[str] = Query(None, description="Filter by event type (e.g. mud_loss, kick, stuck_pipe)"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Structured filter search for drilling incidents."""
    query = (
        select(DrillingEvent, Formation.name.label("formation_name"))
        .outerjoin(Formation, DrillingEvent.formation_id == Formation.formation_id)
    )

    if well_id:
        query = query.where(DrillingEvent.well_id == well_id)
    if event_type:
        query = query.where(DrillingEvent.event_type == event_type)
    if depth_min is not None:
        query = query.where(DrillingEvent.depth_m >= depth_min)
    if depth_max is not None:
        query = query.where(DrillingEvent.depth_m <= depth_max)
    if formation:
        query = query.where(Formation.name.ilike(f"%{formation}%"))

    query = query.order_by(DrillingEvent.depth_m.asc().nulls_last()).offset(offset).limit(limit)

    result = await db.execute(query)
    rows = result.all()

    response = []
    for event, form_name in rows:
        resp = DrillingEventResponse.model_validate(event)
        resp.formation_name = form_name
        response.append(resp)

    return response
