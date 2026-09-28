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

    import uuid
    new_report = Report(
        report_id=uuid.uuid4(),
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
    import uuid
    well_res = await db.execute(select(Well.well_id).where(Well.well_id == report_data.well_id))
    if not well_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail=f"Well with ID {report_data.well_id} not found")

    data = report_data.model_dump()
    if "report_id" not in data or not data["report_id"]:
        data["report_id"] = uuid.uuid4()
    new_report = Report(**data)
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


@router.post("/{report_id}/process")
async def process_report(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Phase 4 Pipeline:
    1. Run OCR page-by-page.
    2. Chunk text per page, generate 384-dim embeddings, store in report_chunks.
    3. Run NLP extraction with controlled vocabulary and confidence evaluation.
    4. Insert extracted rows into drilling_events with needs_review and raw_text_snippet.
    """
    from app.services.ocr_pipeline.service import ocr_service
    from app.services.nlp_extraction.engine import nlp_engine
    from app.models import ReportChunk, DrillingEvent, Formation
    import random
    import math

    result = await db.execute(select(Report).where(Report.report_id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail=f"Report with ID {report_id} not found")

    # 1. OCR Extraction
    try:
        pages = ocr_service.extract_pages(report.file_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"OCR Extraction failed: {str(e)}")

    # 2. Find formations for this well to link formation_id if depth matches
    form_res = await db.execute(select(Formation).where(Formation.well_id == report.well_id))
    formations = form_res.scalars().all()

    from app.services.ocr_pipeline.embeddings import generate_embedding

    total_chunks = 0
    extracted_events = []

    for page in pages:
        p_num = page["page_number"]
        p_text = page["text"]

        embedding = generate_embedding(p_text, dim=384)

        chunk = ReportChunk(
            report_id=report_id,
            page_number=p_num,
            raw_text=p_text,
            embedding=embedding,
        )
        db.add(chunk)
        total_chunks += 1

        # 3. NLP extraction
        events_on_page = nlp_engine.extract_from_page(p_text, p_num)
        for ev in events_on_page:
            # Map formation
            matched_form_id = None
            for f in formations:
                if (f.top_depth_m or 0) <= ev["depth_m"] <= (f.base_depth_m or 99999):
                    matched_form_id = f.formation_id
                    break

            new_event = DrillingEvent(
                well_id=report.well_id,
                formation_id=matched_form_id,
                depth_m=ev["depth_m"],
                event_type=ev["event_type"],
                severity=ev["severity"],
                description=ev["description"],
                report_id=report_id,
                page_number=p_num,
                needs_review=ev["needs_review"],
                raw_text_snippet=ev["raw_text_snippet"],
            )
            db.add(new_event)
            extracted_events.append({
                "depth_m": ev["depth_m"],
                "event_type": ev["event_type"],
                "severity": ev["severity"],
                "page_number": p_num,
                "needs_review": ev["needs_review"],
                "snippet": ev["raw_text_snippet"][:100] + "...",
            })

    await db.flush()

    return {
        "status": "success",
        "report_id": str(report_id),
        "pages_processed": len(pages),
        "chunks_created": total_chunks,
        "events_extracted_count": len(extracted_events),
        "extracted_events": extracted_events,
    }

