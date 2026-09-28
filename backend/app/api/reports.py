"""
Reports API Router — PDF report generation + document management.
"""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

router = APIRouter(prefix="/reports")


@router.get("/well/{well_id}/pdf")
async def generate_well_report(
    well_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Generate a PDF well report with risk assessment and event history."""
    # TODO: Implement with reportlab in Phase 1
    raise HTTPException(
        status_code=501,
        detail="PDF report generation will be implemented in Phase 1.",
    )


@router.get("/documents")
async def list_documents(
    well_id: UUID = None,
    doc_type: str = None,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """List uploaded/generated documents."""
    # TODO: Implement in Phase 1
    raise HTTPException(status_code=501, detail="Coming in Phase 1.")
