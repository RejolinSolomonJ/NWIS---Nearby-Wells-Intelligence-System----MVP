"""
NWIS-X Deterministic Similarity Engine

Calculates multi-factor similarity between drilling wells using ONLY deterministic
mathematical formulations — ZERO LLM INVOLVEMENT for scoring.

Factors:
1. Spatial Proximity: Exponential decay over geographic distance (Haversine formula).
2. Depth Profile Similarity: Normalized difference in Total Depth and target formation depth.
3. Formation Sequence Match: Jaccard similarity of intercepted lithological formations.
4. Drilling Event Pattern: Cosine/overlap similarity of event types (kicks, losses, stuck pipe).
5. Semantic Profile: Text/embedding alignment on geological complexity.
"""

import math
from typing import List, Dict, Any, Optional
from uuid import UUID


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great circle distance between two points in kilometers."""
    r = 6371.0  # Earth's radius in km
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


def compute_spatial_score(distance_km: float, max_dist_km: float = 50.0) -> float:
    """Deterministic spatial score: 1.0 at distance 0, decaying with distance."""
    if distance_km <= 0.001:
        return 1.0
    if distance_km >= max_dist_km:
        return 0.0
    # Smooth half-decay function
    decay = math.exp(-distance_km / 15.0)
    return round(float(decay), 4)


def compute_depth_score(td_target: float, td_candidate: float) -> float:
    """Score matching total depths. 1.0 for exact match, degrades as depth divergence increases."""
    if not td_target or not td_candidate:
        return 0.5
    diff = abs(td_target - td_candidate)
    max_depth = max(td_target, td_candidate)
    ratio = diff / max_depth
    score = max(0.0, 1.0 - (ratio * 2.0))
    return round(float(score), 4)


def compute_formation_score(target_forms: List[str], cand_forms: List[str]) -> tuple[float, List[str]]:
    """Compute Jaccard similarity between formation sequences and return common formations."""
    s1 = set(f.strip().lower() for f in target_forms if f)
    s2 = set(f.strip().lower() for f in cand_forms if f)
    if not s1 or not s2:
        return 0.4, []
    
    inter = s1.intersection(s2)
    union = s1.union(s2)
    score = len(inter) / len(union) if union else 0.0
    
    # Return pretty names of shared formations
    shared = [f for f in target_forms if f.strip().lower() in inter]
    return round(float(score), 4), shared


def compute_event_score(target_events: List[str], cand_events: List[str]) -> tuple[float, List[str]]:
    """Match incident types (kicks, stuck pipe, lost circulation) between wells."""
    e1 = set(e.strip().lower() for e in target_events if e)
    e2 = set(e.strip().lower() for e in cand_events if e)
    if not e1 and not e2:
        return 0.6, []  # Both wells had clean runs
    if not e1 or not e2:
        return 0.3, []
    
    inter = e1.intersection(e2)
    union = e1.union(e2)
    score = len(inter) / len(union) if union else 0.0
    common = list(inter)
    return round(float(score), 4), common


def calculate_well_similarity(
    target_well: Dict[str, Any],
    candidate_well: Dict[str, Any],
    target_formations: List[str],
    candidate_formations: List[str],
    target_events: List[str],
    candidate_events: List[str],
    max_distance_km: float = 50.0,
    weights: Optional[Dict[str, float]] = None
) -> Dict[str, Any]:
    """
    Computes deterministic multi-factor similarity score between two wells.
    Weights default: Spatial (0.35), Formations (0.25), Depth (0.15), Events (0.15), Semantic (0.10).
    """
    if weights is None:
        weights = {
            "spatial": 0.35,
            "formation": 0.25,
            "depth": 0.15,
            "event": 0.15,
            "semantic": 0.10,
        }

    dist_km = haversine_distance_km(
        float(target_well["latitude"]),
        float(target_well["longitude"]),
        float(candidate_well["latitude"]),
        float(candidate_well["longitude"]),
    )

    spatial_s = compute_spatial_score(dist_km, max_dist_km=max_distance_km)
    depth_s = compute_depth_score(
        float(target_well.get("total_depth_m") or 3500),
        float(candidate_well.get("total_depth_m") or 3500)
    )
    form_s, shared_forms = compute_formation_score(target_formations, candidate_formations)
    event_s, common_evts = compute_event_score(target_events, candidate_events)
    
    # Semantic score: field & block alignment factor
    same_field = target_well.get("field_name") == candidate_well.get("field_name")
    same_block = target_well.get("block_name") == candidate_well.get("block_name")
    semantic_s = 0.95 if (same_field and same_block) else (0.75 if same_field else 0.35)

    overall = (
        weights["spatial"] * spatial_s +
        weights["formation"] * form_s +
        weights["depth"] * depth_s +
        weights["event"] * event_s +
        weights["semantic"] * semantic_s
    )

    return {
        "well_id": candidate_well["id"],
        "well_name": candidate_well["well_name"],
        "well_id_code": candidate_well["well_id_code"],
        "field_name": candidate_well.get("field_name"),
        "spatial_score": round(spatial_s, 4),
        "depth_score": round(depth_s, 4),
        "formation_score": round(form_s, 4),
        "event_score": round(event_s, 4),
        "semantic_score": round(semantic_s, 4),
        "overall_similarity": round(min(1.0, max(0.0, overall)), 4),
        "distance_km": round(dist_km, 2),
        "shared_formations": shared_forms,
        "common_events": common_evts,
    }
