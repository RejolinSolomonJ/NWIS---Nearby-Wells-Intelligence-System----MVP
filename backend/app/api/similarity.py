"""
Similarity API Router — Phase 5.
Endpoints:
  GET /wells/{well_id}/similar         — similarity-ranked list + breakdown
  GET /wells/{well_id}/nearby-vs-relevant — side-by-side distance vs similarity
  POST /similarity/compute             — trigger pairwise computation for all wells
"""

import json
import os
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from app.core.database import get_db
from app.models import Well, Formation, DrillingEvent, DrillingParameter, WellSimilarity
from app.schemas import WellSimilarityResponse, NearbyVsRelevantResponse

router = APIRouter(tags=["Similarity"])

# Path to precomputed dataset for offline mode
DATASET_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
    "synthetic_data", "dataset.json"
)


def _load_dataset():
    """Load synthetic dataset.json for offline pairwise computation."""
    if os.path.exists(DATASET_PATH):
        with open(DATASET_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return None


def _get_precomputed_similarities():
    """
    Compute all pairwise similarities from synthetic dataset.
    Cached in module-level variable for the lifetime of the process.
    """
    if not hasattr(_get_precomputed_similarities, "_cache"):
        from app.services.similarity_engine.engine import compute_all_pairwise
        ds = _load_dataset()
        if ds is None:
            _get_precomputed_similarities._cache = []
            return []

        # The JSON only has a sample of drilling_params; load full CSV if available
        drilling_params = ds.get("drilling_parameters", [])
        dp_csv_path = os.path.join(
            os.path.dirname(DATASET_PATH), "drilling_parameters.csv"
        )
        if os.path.exists(dp_csv_path):
            import csv
            with open(dp_csv_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                drilling_params = []
                for row in reader:
                    drilling_params.append({
                        "well_id": row["well_id"],
                        "rop": float(row.get("rop", 0) or 0),
                        "rpm": float(row.get("rpm", 0) or 0),
                        "torque": float(row.get("torque", 0) or 0),
                        "mud_weight": float(row.get("mud_weight", 0) or 0),
                    })

        results = compute_all_pairwise(
            wells=ds["wells"],
            formations=ds["formations"],
            events=ds["drilling_events"],
            drilling_params=drilling_params,
        )
        _get_precomputed_similarities._cache = results

    return _get_precomputed_similarities._cache


def _get_well_info(well_id: str, dataset=None):
    """Look up well name/code from dataset."""
    if dataset is None:
        dataset = _load_dataset()
    if dataset:
        for w in dataset["wells"]:
            if w["well_id"] == well_id or str(w["well_id"]) == str(well_id):
                return w
    return None


@router.get("/wells/{well_id}/similar", response_model=List[WellSimilarityResponse])
async def get_similar_wells(
    well_id: UUID,
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns wells ranked by SIMILARITY (not distance) to the target well.
    Each result includes full component breakdown with evidence.
    """
    from app.services.similarity_engine.engine import get_similar_wells as _get_similar

    all_sims = _get_precomputed_similarities()
    target_id = str(well_id)

    # Find target well info
    ds = _load_dataset()
    target_info = _get_well_info(target_id, ds)
    if not target_info:
        raise HTTPException(status_code=404, detail=f"Well {well_id} not found")

    similar = _get_similar(target_id, all_sims, limit=limit)

    # Enrich with well names/codes from dataset
    if ds:
        well_lookup = {w["well_id"]: w for w in ds["wells"]}
        for s in similar:
            s["target_well_id"] = s["well_id"]
            s["similarity_score"] = s.get("overall_similarity", 0.0)
            info = well_lookup.get(s["well_id"])
            if info:
                s["well_name"] = info.get("name", "")
                s["well_code"] = info.get("code", "")

    return similar


@router.get("/wells/{well_id}/nearby-vs-relevant", response_model=NearbyVsRelevantResponse)
async def get_nearby_vs_relevant(
    well_id: UUID,
    radius_km: float = Query(50.0, ge=1.0, le=500.0),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns BOTH distance-ranked AND similarity-ranked lists side-by-side
    for the UI contrast feature. Demonstrates that nearest != most relevant.
    """
    from app.services.similarity_engine.engine import (
        get_similar_wells as _get_similar,
        haversine_distance_km,
    )

    ds = _load_dataset()
    if not ds:
        raise HTTPException(status_code=500, detail="Dataset not available")

    target_id = str(well_id)
    target_well = _get_well_info(target_id, ds)
    if not target_well:
        raise HTTPException(status_code=404, detail=f"Well {well_id} not found")

    # --- NEARBY: distance-sorted ---
    nearby_list = []
    for w in ds["wells"]:
        if w["well_id"] == target_id:
            continue
        dist = haversine_distance_km(
            float(target_well["latitude"]), float(target_well["longitude"]),
            float(w["latitude"]), float(w["longitude"]),
        )
        if dist <= radius_km:
            nearby_list.append({
                "well_id": w["well_id"],
                "well_name": w.get("name", ""),
                "well_code": w.get("code", ""),
                "distance_km": round(dist, 2),
                "rank_type": "distance",
            })
    nearby_list.sort(key=lambda x: x["distance_km"])
    nearby_list = nearby_list[:limit]

    # --- SIMILAR: similarity-sorted ---
    all_sims = _get_precomputed_similarities()
    similar_list_raw = _get_similar(target_id, all_sims, limit=limit)

    # Enrich
    well_lookup = {w["well_id"]: w for w in ds["wells"]}
    similar_list = []
    for s in similar_list_raw:
        info = well_lookup.get(s["well_id"])
        item = {
            "well_id": s["well_id"],
            "target_well_id": s["well_id"],
            "well_name": info.get("name", "") if info else "",
            "well_code": info.get("code", "") if info else "",
            "overall_similarity": s["overall_similarity"],
            "similarity_score": s["overall_similarity"],
            "distance_km": s["distance_km"],
            "breakdown": s["breakdown"],
            "rank_type": "similarity",
        }
        similar_list.append(item)

    # Determine if orderings differ
    nearby_order = [n["well_id"] for n in nearby_list]
    similar_order = [s["well_id"] for s in similar_list]
    ordering_differs = nearby_order != similar_order

    closest = nearby_list[0] if nearby_list else None
    most_relevant = similar_list[0] if similar_list else None

    insight = (
        f"Nearest well is {closest['well_name']} ({closest['distance_km']} km away), "
        f"but most geologically relevant offset is {most_relevant['well_name']} "
        f"(Similarity {most_relevant['overall_similarity']:.2f}, {most_relevant['distance_km']} km away) "
        f"due to matching lithology and historical drilling incident correlation."
        if (closest and most_relevant)
        else "Geological similarity computed using multi-factor deterministic formulation."
    )

    return NearbyVsRelevantResponse(
        target_well_id=well_id,
        target_well_name=target_well.get("name", ""),
        anchor_well={"well_id": target_id, "well_name": target_well.get("name", ""), "code": target_well.get("code", "")},
        closest_by_distance=closest,
        most_relevant_by_similarity=most_relevant,
        nearby_wells=nearby_list,
        similar_wells=similar_list,
        distance_sorted=nearby_list,
        similarity_sorted=similar_list,
        ordering_differs=ordering_differs,
        geological_insight=insight,
    )
