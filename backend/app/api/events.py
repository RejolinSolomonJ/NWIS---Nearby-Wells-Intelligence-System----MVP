"""
Drilling Events API Router — Structured filtering + depth lookahead querying.
"""

import json
import os
import uuid
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models import DrillingEvent, Formation, Well
from app.schemas import DrillingEventResponse

router = APIRouter(prefix="/events", tags=["Drilling Events"])

DATASET_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
    "synthetic_data",
    "dataset.json",
)


def _load_dataset():
    if os.path.exists(DATASET_PATH):
        with open(DATASET_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return None


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
    """
    depth_start = depth
    depth_end = depth + lookahead_m

    try:
        # Verify well exists
        well_res = await db.execute(select(Well.well_id).where(Well.well_id == well_id))
        if not well_res.scalar_one_or_none():
            raise HTTPException(status_code=404, detail=f"Well with ID {well_id} not found")

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
    except HTTPException:
        raise
    except Exception:
        # Fallback to dataset.json
        ds = _load_dataset()
        if not ds:
            return []
        wid_str = str(well_id)
        events = ds.get("drilling_events", [])
        formations = {f["formation_id"]: f["name"] for f in ds.get("formations", [])}
        matched = []
        for e in events:
            if e["well_id"] == wid_str and depth_start <= e["depth_m"] <= depth_end:
                fname = formations.get(e.get("formation_id"), "Barail Coal-Shale Formation (F3)")
                matched.append(
                    DrillingEventResponse(
                        event_id=uuid.UUID(e["event_id"]),
                        well_id=uuid.UUID(e["well_id"]),
                        formation_id=uuid.UUID(e["formation_id"]) if e.get("formation_id") else None,
                        event_type=e["event_type"],
                        severity=e.get("severity", "critical"),
                        depth_m=e["depth_m"],
                        description=e["description"],
                        root_cause=e.get("root_cause"),
                        action_taken=e.get("action_taken"),
                        mud_weight_ppg=e.get("mud_weight_ppg", 11.2),
                        report_id=uuid.UUID(e["report_id"]) if e.get("report_id") else None,
                        page_number=e.get("page_number", 3),
                        needs_review=e.get("needs_review", False),
                        raw_text_snippet=e.get("raw_text_snippet"),
                        formation_name=fname,
                    )
                )
        return matched


@router.get("", response_model=List[DrillingEventResponse])
async def search_events(
    well_id: Optional[UUID] = Query(None, description="Filter by Well UUID"),
    formation: Optional[str] = Query(None, description="Filter by Formation name (substring match)"),
    depth_min: Optional[float] = Query(None, description="Minimum depth in meters"),
    depth_max: Optional[float] = Query(None, description="Maximum depth in meters"),
    event_type: Optional[str] = Query(None, description="Filter by event type (e.g. mud_loss, kick, stuck_pipe)"),
    severity: Optional[str] = Query(None, description="Filter by severity (e.g. critical, warning, high, medium, low)"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Structured filter search for drilling incidents with dataset fallback."""
    try:
        query = (
            select(DrillingEvent, Formation.name.label("formation_name"))
            .outerjoin(Formation, DrillingEvent.formation_id == Formation.formation_id)
        )

        if well_id:
            query = query.where(DrillingEvent.well_id == well_id)
        if event_type:
            query = query.where(DrillingEvent.event_type == event_type)
        if severity:
            query = query.where(DrillingEvent.severity.ilike(f"%{severity}%"))
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
    except Exception:
        # Fallback to synthetic dataset
        ds = _load_dataset()
        if not ds:
            return []
        events = ds.get("drilling_events", [])
        formations = {f["formation_id"]: f["name"] for f in ds.get("formations", [])}
        filtered = []

        wid_str = str(well_id) if well_id else None

        for e in events:
            if wid_str and e["well_id"] != wid_str:
                continue
            if event_type and e["event_type"].lower() != event_type.lower():
                continue
            if severity and severity.lower() not in e.get("severity", "").lower():
                continue
            if depth_min is not None and e["depth_m"] < depth_min:
                continue
            if depth_max is not None and e["depth_m"] > depth_max:
                continue
            fname = formations.get(e.get("formation_id"), "Barail Coal-Shale Formation (F3)")
            if formation and formation.lower() not in fname.lower():
                continue

            filtered.append(
                DrillingEventResponse(
                    event_id=uuid.UUID(e["event_id"]),
                    well_id=uuid.UUID(e["well_id"]),
                    formation_id=uuid.UUID(e["formation_id"]) if e.get("formation_id") else None,
                    event_type=e["event_type"],
                    severity=e.get("severity", "critical"),
                    depth_m=e["depth_m"],
                    description=e["description"],
                    root_cause=e.get("root_cause"),
                    action_taken=e.get("action_taken"),
                    mud_weight_ppg=e.get("mud_weight_ppg", 11.2),
                    report_id=uuid.UUID(e["report_id"]) if e.get("report_id") else None,
                    page_number=e.get("page_number", 3),
                    needs_review=e.get("needs_review", False),
                    raw_text_snippet=e.get("raw_text_snippet"),
                    formation_name=fname,
                )
            )

        filtered.sort(key=lambda x: x.depth_m)
        return filtered[offset : offset + limit]

