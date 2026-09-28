"""
Reports API Router — CRUD + upload endpoint stub for Phase 4.
"""

import os
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models import Report, Well
from app.schemas import ReportCreate, ReportResponse

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.post("/upload", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def upload_report(
    well_id: UUID = Form(..., description="Target Well UUID"),
    report_type: str = Form("Daily Drilling Report", description="Type of report"),
    file: UploadFile = File(..., description="PDF or document file to upload"),
    db: AsyncSession = Depends(get_db),
):
    """
    Report Upload Endpoint Stub (Phase 4 OCR & Ingestion Pipeline).
    Saves uploaded file to disk and creates the report database record.
    """
    # Verify well exists
    well_res = await db.execute(select(Well.well_id).where(Well.well_id == well_id))
    if not well_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail=f"Well with ID {well_id} not found")

    upload_dir = os.path.join("synthetic_data", "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, f"{well_id}_{file.filename}")

    # Read and save content stub
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    new_report = Report(
        well_id=well_id,
        report_type=report_type,
        file_path=file_path,
    )
    db.add(new_report)
    await db.flush()
    await db.refresh(new_report)

    return new_report


@router.post("", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    report_data: ReportCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create report metadata entry."""
    well_res = await db.execute(select(Well.well_id).where(Well.well_id == report_data.well_id))
    if not well_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail=f"Well with ID {report_data.well_id} not found")

    new_report = Report(**report_data.model_dump())
    db.add(new_report)
    await db.flush()
    await db.refresh(new_report)
    return new_report


@router.get("", response_model=List[ReportResponse])
async def list_reports(
    well_id: Optional[UUID] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List reports with optional well_id filter."""
    query = select(Report)
    if well_id:
        query = query.where(Report.well_id == well_id)
    query = query.offset(offset).limit(limit)

    result = await db.execute(query)
    reports = result.scalars().all()
    return [ReportResponse.model_validate(r) for r in reports]


@router.get("/{report_id}", response_model=ReportResponse)
async def get_report(report_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get single report by UUID."""
    result = await db.execute(select(Report).where(Report.report_id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail=f"Report with ID {report_id} not found")
    return report


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_report(report_id: UUID, db: AsyncSession = Depends(get_db)):
    """Delete a report by UUID."""
    result = await db.execute(select(Report).where(Report.report_id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail=f"Report with ID {report_id} not found")

    await db.delete(report)
    await db.flush()
    return None
