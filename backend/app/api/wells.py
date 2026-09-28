"""
Wells API Router — CRUD operations + spatial queries for wells.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text

from app.core.database import get_db
from app.models import Well, Formation, DrillingEvent
from app.schemas import WellCreate, WellResponse, WellListResponse

router = APIRouter(prefix="/wells")


@router.get("", response_model=WellListResponse)
async def list_wells(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    field_name: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    well_type: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """List wells with pagination and filtering."""
    query = select(Well)

    if field_name:
        query = query.where(Well.field_name == field_name)
    if status_filter:
        query = query.where(Well.status == status_filter)
    if well_type:
        query = query.where(Well.well_type == well_type)
    if search:
        query = query.where(
            Well.well_name.ilike(f"%{search}%") | Well.well_id_code.ilike(f"%{search}%")
        )

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Paginate
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    wells = result.scalars().all()

    return WellListResponse(
        wells=[WellResponse.model_validate(w) for w in wells],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{well_id}", response_model=WellResponse)
async def get_well(well_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get a well by ID with related counts."""
    result = await db.execute(select(Well).where(Well.id == well_id))
    well = result.scalar_one_or_none()
    if not well:
        raise HTTPException(status_code=404, detail="Well not found")
    return well


@router.post("", response_model=WellResponse, status_code=status.HTTP_201_CREATED)
async def create_well(well_data: WellCreate, db: AsyncSession = Depends(get_db)):
    """Create a new well."""
    # Create PostGIS geometry from lat/lon
    geom_wkt = f"SRID=4326;POINT({well_data.longitude} {well_data.latitude})"
    well = Well(
        **well_data.model_dump(),
        geom=geom_wkt,
        is_simulated=True,
    )
    db.add(well)
    await db.flush()
    await db.refresh(well)
    return well


@router.get("/{well_id}/nearby", response_model=list)
async def get_nearby_wells(
    well_id: UUID,
    radius_km: float = Query(50.0, ge=0.1, le=500),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Find wells within a radius (km) using PostGIS spatial query."""
    # Get the target well
    result = await db.execute(select(Well).where(Well.id == well_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Well not found")

    # PostGIS spatial query — find nearby wells
    nearby_query = (
        select(
            Well,
            func.ST_Distance(
                func.ST_Transform(Well.geom, 32646),
                func.ST_Transform(
                    func.ST_SetSRID(func.ST_MakePoint(target.longitude, target.latitude), 4326),
                    32646,
                ),
            ).label("distance_m"),
        )
        .where(Well.id != well_id)
        .where(
            func.ST_DWithin(
                Well.geom,
                func.ST_SetSRID(func.ST_MakePoint(target.longitude, target.latitude), 4326),
                radius_km / 111.0,  # approximate degrees
            )
        )
        .order_by("distance_m")
        .limit(limit)
    )

    result = await db.execute(nearby_query)
    rows = result.all()

    return [
        {
            "well": WellResponse.model_validate(row[0]),
            "distance_km": round(row[1] / 1000, 2) if row[1] else None,
        }
        for row in rows
    ]
