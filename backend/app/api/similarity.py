"""
Similarity API Router — multi-factor well similarity scoring.
Scores are 100% deterministic (spatial + depth + formation + event + semantic).
ZERO LLM INVOLVEMENT FOR SCORING.
"""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models import Well, Formation, DrillingEvent
from app.schemas import SimilarityRequest, SimilarityResponse, SimilarWell
from app.services.similarity_engine import (
    calculate_well_similarity,
    haversine_distance_km
)

router = APIRouter(prefix="/similarity")


@router.post("/find", response_model=SimilarityResponse)
async def find_similar_wells(
    request: SimilarityRequest,
    db: AsyncSession = Depends(get_db),
):
    """Find similar wells using multi-factor deterministic scoring.

    Scoring factors (all deterministic, not LLM):
    - Spatial proximity (Haversine decay)
    - Depth profile similarity
    - Formation sequence overlap (Jaccard)
    - Historical event pattern matching
    - Semantic alignment
    """
    # 1. Fetch Target Well
    target_res = await db.execute(select(Well).where(Well.id == request.well_id))
    target = target_res.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Target well not found")

    # Target Formations & Events
    t_forms_res = await db.execute(
        select(Formation.formation_name).where(Formation.well_id == target.id)
    )
    target_formations = [row[0] for row in t_forms_res.all()]

    t_evts_res = await db.execute(
        select(DrillingEvent.event_type).where(DrillingEvent.well_id == target.id)
    )
    target_events = [row[0] for row in t_evts_res.all()]

    # 2. Fetch Candidate Wells (excluding target well)
    cand_res = await db.execute(select(Well).where(Well.id != target.id))
    candidates = cand_res.scalars().all()

    target_dict = {
        "id": str(target.id),
        "well_name": target.well_name,
        "well_id_code": target.well_id_code,
        "field_name": target.field_name,
        "block_name": target.block_name,
        "latitude": target.latitude,
        "longitude": target.longitude,
        "total_depth_m": target.total_depth_m,
    }

    scored_candidates = []
    for cand in candidates:
        # Quick spatial pre-filter
        dist = haversine_distance_km(target.latitude, target.longitude, cand.latitude, cand.longitude)
        if dist > request.max_distance_km * 2:  # allow generous initial bounding
            continue

        c_forms_res = await db.execute(
            select(Formation.formation_name).where(Formation.well_id == cand.id)
        )
        c_formations = [row[0] for row in c_forms_res.all()]

        c_evts_res = await db.execute(
            select(DrillingEvent.event_type).where(DrillingEvent.well_id == cand.id)
        )
        c_events = [row[0] for row in c_evts_res.all()]

        cand_dict = {
            "id": str(cand.id),
            "well_name": cand.well_name,
            "well_id_code": cand.well_id_code,
            "field_name": cand.field_name,
            "block_name": cand.block_name,
            "latitude": cand.latitude,
            "longitude": cand.longitude,
            "total_depth_m": cand.total_depth_m,
        }

        sim_result = calculate_well_similarity(
            target_well=target_dict,
            candidate_well=cand_dict,
            target_formations=target_formations,
            candidate_formations=c_formations,
            target_events=target_events,
            candidate_events=c_events,
            max_distance_km=request.max_distance_km,
        )
        scored_candidates.append(sim_result)

    # Sort by overall similarity descending
    scored_candidates.sort(key=lambda x: x["overall_similarity"], reverse=True)
    top_candidates = scored_candidates[:request.limit]

    return SimilarityResponse(
        query_well_id=request.well_id,
        similar_wells=[SimilarWell(**item) for item in top_candidates],
        computation_method="deterministic_multi_factor (spatial, depth, formation, event, semantic)",
    )


@router.get("/compare/{well_id_a}/{well_id_b}")
async def compare_two_wells(
    well_id_a: UUID,
    well_id_b: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Compare two wells side-by-side with detailed similarity breakdown."""
    res_a = await db.execute(select(Well).where(Well.id == well_id_a))
    well_a = res_a.scalar_one_or_none()
    res_b = await db.execute(select(Well).where(Well.id == well_id_b))
    well_b = res_b.scalar_one_or_none()

    if not well_a or not well_b:
        raise HTTPException(status_code=404, detail="One or both wells not found")

    forms_a_res = await db.execute(select(Formation).where(Formation.well_id == well_id_a))
    forms_a = forms_a_res.scalars().all()
    forms_b_res = await db.execute(select(Formation).where(Formation.well_id == well_id_b))
    forms_b = forms_b_res.scalars().all()

    evts_a_res = await db.execute(select(DrillingEvent).where(DrillingEvent.well_id == well_id_a))
    evts_a = evts_a_res.scalars().all()
    evts_b_res = await db.execute(select(DrillingEvent).where(DrillingEvent.well_id == well_id_b))
    evts_b = evts_b_res.scalars().all()

    dist_km = round(haversine_distance_km(well_a.latitude, well_a.longitude, well_b.latitude, well_b.longitude), 2)

    sim = calculate_well_similarity(
        target_well={"id": str(well_a.id), "well_name": well_a.well_name, "well_id_code": well_a.well_id_code, "field_name": well_a.field_name, "block_name": well_a.block_name, "latitude": well_a.latitude, "longitude": well_a.longitude, "total_depth_m": well_a.total_depth_m},
        candidate_well={"id": str(well_b.id), "well_name": well_b.well_name, "well_id_code": well_b.well_id_code, "field_name": well_b.field_name, "block_name": well_b.block_name, "latitude": well_b.latitude, "longitude": well_b.longitude, "total_depth_m": well_b.total_depth_m},
        target_formations=[f.formation_name for f in forms_a],
        candidate_formations=[f.formation_name for f in forms_b],
        target_events=[e.event_type for e in evts_a],
        candidate_events=[e.event_type for e in evts_b],
    )

    return {
        "well_a": {
            "id": well_a.id,
            "name": well_a.well_name,
            "code": well_a.well_id_code,
            "field": well_a.field_name,
            "total_depth_m": well_a.total_depth_m,
            "formations": [f.formation_name for f in forms_a],
            "event_count": len(evts_a),
            "events": [{"type": e.event_type, "severity": e.severity, "depth_m": e.depth_m} for e in evts_a]
        },
        "well_b": {
            "id": well_b.id,
            "name": well_b.well_name,
            "code": well_b.well_id_code,
            "field": well_b.field_name,
            "total_depth_m": well_b.total_depth_m,
            "formations": [f.formation_name for f in forms_b],
            "event_count": len(evts_b),
            "events": [{"type": e.event_type, "severity": e.severity, "depth_m": e.depth_m} for e in evts_b]
        },
        "distance_km": dist_km,
        "similarity_analysis": sim,
        "disclaimer": "SIMULATED DATA — Comparison derived from deterministic scoring engine."
    }
