"""
Risk API Router — risk assessments from deterministic rule engine (NOT LLM).
Non-negotiable: Every alert shows WHY, WHICH WELLS, DEPTH, FORMATION, EVIDENCE, SOURCE, SIMILARITY, CONFIDENCE.
"""

from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models import Well, Formation, DrillingEvent, RiskAssessment, Alert
from app.schemas import RiskAssessmentResponse, AlertResponse
from app.services.risk_engine import compute_deterministic_risk

router = APIRouter(prefix="/risk")


@router.get("/assess/{well_id}", response_model=RiskAssessmentResponse)
async def get_risk_assessment(
    well_id: UUID,
    depth_m: Optional[float] = None,
    recalculate: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """Get the latest risk assessment for a well.
    All risk scores are computed by the deterministic rule engine — never by LLM.
    If not cached or recalculate=true, runs the deterministic engine live.
    """
    if not recalculate:
        query = select(RiskAssessment).where(RiskAssessment.well_id == well_id)
        if depth_m is not None:
            query = query.where(RiskAssessment.depth_m <= depth_m)
        query = query.order_by(RiskAssessment.created_at.desc()).limit(1)

        result = await db.execute(query)
        assessment = result.scalar_one_or_none()
        if assessment:
            return assessment

    # Compute deterministically on the fly
    well_res = await db.execute(select(Well).where(Well.id == well_id))
    well = well_res.scalar_one_or_none()
    if not well:
        raise HTTPException(status_code=404, detail="Well not found")

    forms_res = await db.execute(select(Formation).where(Formation.well_id == well_id))
    formations = [
        {"id": str(f.id), "formation_name": f.formation_name, "top_depth_m": f.top_depth_m, "bottom_depth_m": f.bottom_depth_m, "lithology": f.lithology, "pressure_psi": f.pressure_psi}
        for f in forms_res.scalars().all()
    ]

    evts_res = await db.execute(select(DrillingEvent).where(DrillingEvent.well_id == well_id))
    events = [
        {"id": str(e.id), "event_type": e.event_type, "severity": e.severity, "depth_m": e.depth_m, "formation_name": e.formation_name, "description": e.description, "root_cause": e.root_cause, "action_taken": e.action_taken, "source_document_id": str(e.source_document_id) if e.source_document_id else None, "source_page": e.source_page}
        for e in evts_res.scalars().all()
    ]

    # Similar nearby wells
    sim_res = await db.execute(
        select(Well.id, Well.well_name).where(Well.id != well_id, Well.field_name == well.field_name).limit(5)
    )
    sim_wells = [{"well_id": str(row[0]), "well_name": row[1]} for row in sim_res.all()]

    risk_dict = compute_deterministic_risk(
        well={"id": str(well.id), "well_name": well.well_name, "well_id_code": well.well_id_code, "total_depth_m": well.total_depth_m},
        formations=formations,
        events=events,
        similar_wells=sim_wells,
        target_depth_m=depth_m
    )

    new_assessment = RiskAssessment(
        well_id=well_id,
        assessment_type=risk_dict["assessment_type"],
        overall_risk_score=risk_dict["overall_risk_score"],
        confidence=risk_dict["confidence"],
        depth_m=risk_dict["depth_m"],
        formation_name=risk_dict["formation_name"],
        geological_risk=risk_dict["geological_risk"],
        mechanical_risk=risk_dict["mechanical_risk"],
        pressure_risk=risk_dict["pressure_risk"],
        historical_risk=risk_dict["historical_risk"],
        risk_factors=risk_dict["risk_factors"],
        similar_well_ids=risk_dict["similar_well_ids"],
        evidence_summary=risk_dict["evidence_summary"],
        source_documents=risk_dict["source_documents"],
        is_simulated=True,
    )
    db.add(new_assessment)
    await db.flush()
    await db.refresh(new_assessment)
    return new_assessment


@router.get("/alerts", response_model=List[AlertResponse])
async def list_alerts(
    well_id: Optional[UUID] = None,
    severity: Optional[str] = None,
    unread_only: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """List alerts — each includes WHY, WHICH WELLS, DEPTH, FORMATION, EVIDENCE,
    SOURCE DOC+PAGE, SIMILARITY, CONFIDENCE."""
    query = select(Alert)

    if well_id:
        query = query.where(Alert.well_id == well_id)
    if severity:
        query = query.where(Alert.severity == severity)
    if unread_only:
        query = query.where(Alert.is_read == False)  # noqa: E712

    query = query.order_by(Alert.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    alerts = result.scalars().all()

    return [AlertResponse.model_validate(a) for a in alerts]


@router.patch("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: UUID, db: AsyncSession = Depends(get_db)):
    """Acknowledge an alert."""
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.is_acknowledged = True
    alert.is_read = True
    await db.flush()
    return {"status": "acknowledged", "alert_id": str(alert_id)}
