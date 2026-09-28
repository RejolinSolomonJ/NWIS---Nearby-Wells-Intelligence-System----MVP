"""
Reports API Router — PDF report generation + document management.
Outputs PDF reports with mandatory SIMULATED DATA banner and audit citations.
"""

from typing import Optional
from uuid import UUID
import io

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models import Well, Formation, DrillingEvent, RiskAssessment, Document
from app.services.reports import generate_well_pdf
from app.services.risk_engine import compute_deterministic_risk

router = APIRouter(prefix="/reports")


@router.get("/well/{well_id}/pdf")
async def generate_well_report(
    well_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Generate an audit-ready PDF well report with risk assessment and event history."""
    well_res = await db.execute(select(Well).where(Well.id == well_id))
    well = well_res.scalar_one_or_none()
    if not well:
        raise HTTPException(status_code=404, detail="Well not found")

    forms_res = await db.execute(select(Formation).where(Formation.well_id == well_id))
    formations = [
        {"formation_name": f.formation_name, "top_depth_m": f.top_depth_m, "bottom_depth_m": f.bottom_depth_m, "lithology": f.lithology, "fluid_type": f.fluid_type}
        for f in forms_res.scalars().all()
    ]

    evts_res = await db.execute(select(DrillingEvent).where(DrillingEvent.well_id == well_id))
    events = [
        {"event_type": e.event_type, "severity": e.severity, "depth_m": e.depth_m, "npt_hours": e.npt_hours, "root_cause": e.root_cause, "action_taken": e.action_taken}
        for e in evts_res.scalars().all()
    ]

    risk_res = await db.execute(
        select(RiskAssessment).where(RiskAssessment.well_id == well_id).order_by(RiskAssessment.created_at.desc()).limit(1)
    )
    risk_obj = risk_res.scalar_one_or_none()
    if risk_obj:
        risk_data = {
            "overall_risk_score": risk_obj.overall_risk_score,
            "confidence": risk_obj.confidence,
            "geological_risk": risk_obj.geological_risk,
            "mechanical_risk": risk_obj.mechanical_risk,
            "pressure_risk": risk_obj.pressure_risk,
            "historical_risk": risk_obj.historical_risk,
        }
    else:
        risk_data = compute_deterministic_risk(
            well={"id": str(well.id), "well_name": well.well_name, "well_id_code": well.well_id_code, "total_depth_m": well.total_depth_m},
            formations=formations,
            events=events,
            similar_wells=[],
        )

    well_dict = {
        "well_name": well.well_name,
        "well_id_code": well.well_id_code,
        "field_name": well.field_name,
        "block_name": well.block_name,
        "status": well.status,
        "total_depth_m": well.total_depth_m,
        "operator": well.operator,
        "latitude": well.latitude,
        "longitude": well.longitude,
        "spud_date": well.spud_date,
    }

    pdf_bytes = generate_well_pdf(
        well=well_dict,
        formations=formations,
        events=events,
        risk_assessment=risk_data
    )

    filename = f"{well.well_id_code}_drilling_intelligence_report_simulated.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/documents")
async def list_documents(
    well_id: Optional[UUID] = None,
    doc_type: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """List uploaded/generated documents."""
    query = select(Document)
    if well_id:
        query = query.where(Document.well_id == well_id)
    if doc_type:
        query = query.where(Document.doc_type == doc_type)

    query = query.offset((page - 1) * page_size).limit(page_size)
    res = await db.execute(query)
    docs = res.scalars().all()

    return [
        {
            "id": d.id,
            "well_id": d.well_id,
            "title": d.title,
            "doc_type": d.doc_type,
            "file_path": d.file_path,
            "page_count": d.page_count,
            "ocr_status": d.ocr_status,
            "is_simulated": d.is_simulated,
            "created_at": d.created_at,
        }
        for d in docs
    ]
