"""
Drilling Events API Router — CRUD + filtering by well, depth, type, severity.
"""

from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.models import DrillingEvent
from app.schemas import DrillingEventCreate, DrillingEventResponse

router = APIRouter(prefix="/events")


@router.get("", response_model=List[DrillingEventResponse])
async def list_events(
    well_id: Optional[UUID] = None,
    event_type: Optional[str] = None,
    severity: Optional[str] = None,
    depth_min: Optional[float] = None,
    depth_max: Optional[float] = None,
    formation: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """List drilling events with depth-aware filtering."""
    query = select(DrillingEvent)

    if well_id:
        query = query.where(DrillingEvent.well_id == well_id)
    if event_type:
        query = query.where(DrillingEvent.event_type == event_type)
    if severity:
        query = query.where(DrillingEvent.severity == severity)
    if depth_min is not None:
        query = query.where(DrillingEvent.depth_m >= depth_min)
    if depth_max is not None:
        query = query.where(DrillingEvent.depth_m <= depth_max)
    if formation:
        query = query.where(DrillingEvent.formation_name.ilike(f"%{formation}%"))

    query = query.order_by(DrillingEvent.depth_m).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    events = result.scalars().all()

    return [DrillingEventResponse.model_validate(e) for e in events]


@router.get("/summary")
async def events_summary(
    well_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
):
    """Get event statistics — counts by type and severity."""
    base = select(DrillingEvent)
    if well_id:
        base = base.where(DrillingEvent.well_id == well_id)

    # By type
    type_query = (
        select(DrillingEvent.event_type, func.count().label("count"))
        .group_by(DrillingEvent.event_type)
    )
    if well_id:
        type_query = type_query.where(DrillingEvent.well_id == well_id)
    type_result = await db.execute(type_query)

    # By severity
    severity_query = (
        select(DrillingEvent.severity, func.count().label("count"))
        .group_by(DrillingEvent.severity)
    )
    if well_id:
        severity_query = severity_query.where(DrillingEvent.well_id == well_id)
    severity_result = await db.execute(severity_query)

    return {
        "by_type": {row[0]: row[1] for row in type_result.all()},
        "by_severity": {row[0]: row[1] for row in severity_result.all()},
    }


@router.get("/{event_id}", response_model=DrillingEventResponse)
async def get_event(event_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get a single drilling event by ID."""
    result = await db.execute(select(DrillingEvent).where(DrillingEvent.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Drilling event not found")
    return event
