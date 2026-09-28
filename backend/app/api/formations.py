"""
Formations API Router — Get formations for a well.
"""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models import Formation, Well
from app.schemas import FormationResponse

router = APIRouter(prefix="/formations", tags=["Formations"])


@router.get("/{well_id}", response_model=List[FormationResponse])
async def get_formations_for_well(
    well_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve all formations for a specified well ordered by stratigraphic depth."""
    # Verify well exists
    well_res = await db.execute(select(Well.well_id).where(Well.well_id == well_id))
    if not well_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail=f"Well with ID {well_id} not found")

    query = (
        select(Formation)
        .where(Formation.well_id == well_id)
        .order_by(Formation.top_depth_m.asc().nulls_last())
    )
    result = await db.execute(query)
    formations = result.scalars().all()

    return [FormationResponse.model_validate(f) for f in formations]
