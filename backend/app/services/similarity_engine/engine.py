"""
NWIS-X Phase 5 — Deterministic Well Similarity Engine

Computes multi-factor pairwise similarity between wells using ONLY deterministic
mathematical formulations — ZERO LLM involvement for scoring.

SimilarityScore = 0.30*FormationOverlap + 0.20*DepthProximity + 0.15*SpatialProximity
                + 0.15*OperationalSimilarity + 0.20*EventTypeOverlap

PROTOTYPE ASSUMPTION — All weights below require SME (Subject Matter Expert) calibration.
These defaults are engineering estimates; actual field deployment must tune them with
domain experts from Oil India Ltd.

All data is SIMULATED — NOT OIL INDIA DATA.
"""

import math
from typing import List, Dict, Any, Optional, Tuple, Set
from collections import defaultdict


# =============================================================================
# WEIGHT CONFIGURATION
# PROTOTYPE ASSUMPTION — requires SME calibration
# =============================================================================
WEIGHTS = {
    "formation_overlap": 0.30,     # PROTOTYPE ASSUMPTION — requires SME calibration
    "depth_proximity": 0.20,       # PROTOTYPE ASSUMPTION — requires SME calibration
    "spatial_proximity": 0.15,     # PROTOTYPE ASSUMPTION — requires SME calibration
    "operational_similarity": 0.15, # PROTOTYPE ASSUMPTION — requires SME calibration
    "event_type_overlap": 0.20,    # PROTOTYPE ASSUMPTION — requires SME calibration
}


# =============================================================================
# HELPER: Haversine distance (km)
# =============================================================================
def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two lat/lon points in kilometers."""
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lam = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2.0) ** 2
    return r * 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


# =============================================================================
# COMPONENT 1: FormationOverlap — Jaccard index of formation name sets
# =============================================================================
def compute_formation_overlap(
    forms_a: List[Dict[str, Any]],
    forms_b: List[Dict[str, Any]],
) -> Tuple[float, List[str]]:
    """
    Jaccard index J(A, B) = |A ∩ B| / |A ∪ B| on formation name sets.
    Returns (score, list_of_shared_formation_names).
    """
    names_a = {f["name"].strip().lower() for f in forms_a if f.get("name")}
    names_b = {f["name"].strip().lower() for f in forms_b if f.get("name")}

    if not names_a and not names_b:
        return 0.5, []
    if not names_a or not names_b:
        return 0.0, []

    intersection = names_a & names_b
    union = names_a | names_b
    score = len(intersection) / len(union) if union else 0.0

    # Return original-cased names of shared formations
    shared_names = []
    seen = set()
    for f in forms_a:
        n = f["name"].strip().lower()
        if n in intersection and n not in seen:
            shared_names.append(f["name"])
            seen.add(n)

    return round(score, 4), shared_names


# =============================================================================
# COMPONENT 2: DepthProximity — normalized inverse distance of matched formation
#              depth intervals
# =============================================================================
def compute_depth_proximity(
    forms_a: List[Dict[str, Any]],
    forms_b: List[Dict[str, Any]],
    max_depth_diff_m: float = 500.0,
) -> float:
    """
    For each formation present in both wells, compute how close their depth
    intervals are. Average across all matched formations.
    Score = 1.0 when all depths match exactly; 0.0 when diff >= max_depth_diff_m.
    """
    by_name_a: Dict[str, Dict] = {}
    for f in forms_a:
        by_name_a[f["name"].strip().lower()] = f
    by_name_b: Dict[str, Dict] = {}
    for f in forms_b:
        by_name_b[f["name"].strip().lower()] = f

    common = set(by_name_a.keys()) & set(by_name_b.keys())
    if not common:
        return 0.0

    scores = []
    for name in common:
        fa, fb = by_name_a[name], by_name_b[name]
        top_a = fa.get("top_depth_m", 0) or 0
        top_b = fb.get("top_depth_m", 0) or 0
        base_a = fa.get("base_depth_m", 0) or 0
        base_b = fb.get("base_depth_m", 0) or 0

        # Average absolute difference of top and base depths
        diff = (abs(top_a - top_b) + abs(base_a - base_b)) / 2.0
        s = max(0.0, 1.0 - diff / max_depth_diff_m)
        scores.append(s)

    return round(sum(scores) / len(scores), 4) if scores else 0.0


# =============================================================================
# COMPONENT 3: SpatialProximity — normalized inverse geographic distance
# =============================================================================
def compute_spatial_proximity(
    lat_a: float, lon_a: float,
    lat_b: float, lon_b: float,
    max_dist_km: float = 50.0,
) -> Tuple[float, float]:
    """
    Returns (score, distance_km).
    Score: exponential decay — 1.0 at 0 km, ~0.5 at ~10 km, ~0 at max_dist_km.
    """
    dist = haversine_distance_km(lat_a, lon_a, lat_b, lon_b)
    if dist <= 0.001:
        return 1.0, round(dist, 3)
    if dist >= max_dist_km:
        return 0.0, round(dist, 2)

    # Exponential decay with half-life of ~10 km
    score = math.exp(-dist / 10.0)
    return round(score, 4), round(dist, 2)


# =============================================================================
# COMPONENT 4: OperationalSimilarity — cosine similarity of mean [rop, rpm,
#              torque, mud_weight] vectors from drilling_parameters
# =============================================================================
def compute_operational_similarity(
    params_a: List[Dict[str, Any]],
    params_b: List[Dict[str, Any]],
) -> float:
    """
    Compute mean operational vector [rop, rpm, torque, mud_weight] for each well,
    then return cosine similarity between them.
    """
    def mean_vector(params: List[Dict]) -> Optional[List[float]]:
        if not params:
            return None
        keys = ["rop", "rpm", "torque", "mud_weight"]
        sums = [0.0] * len(keys)
        count = 0
        for p in params:
            vals = [float(p.get(k, 0) or 0) for k in keys]
            if any(v > 0 for v in vals):
                for i, v in enumerate(vals):
                    sums[i] += v
                count += 1
        if count == 0:
            return None
        return [s / count for s in sums]

    vec_a = mean_vector(params_a)
    vec_b = mean_vector(params_b)

    if vec_a is None or vec_b is None:
        return 0.5  # Neutral when no operational data available

    # Cosine similarity
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    mag_a = math.sqrt(sum(a * a for a in vec_a))
    mag_b = math.sqrt(sum(b * b for b in vec_b))

    if mag_a < 1e-9 or mag_b < 1e-9:
        return 0.0

    cos_sim = dot / (mag_a * mag_b)
    # Cosine similarity is in [-1, 1]; normalize to [0, 1]
    return round(max(0.0, min(1.0, (cos_sim + 1.0) / 2.0)), 4)


# =============================================================================
# COMPONENT 5: EventTypeOverlap — Jaccard index of event_type sets
# =============================================================================
def compute_event_type_overlap(
    events_a: List[Dict[str, Any]],
    events_b: List[Dict[str, Any]],
) -> Tuple[float, List[str]]:
    """
    Jaccard index over the set of distinct event_type values for each well.
    Returns (score, list_of_common_event_types).
    """
    types_a = {e["event_type"].strip().lower() for e in events_a if e.get("event_type")}
    types_b = {e["event_type"].strip().lower() for e in events_b if e.get("event_type")}

    if not types_a and not types_b:
        return 0.5, []  # Both wells event-free = moderate baseline
    if not types_a or not types_b:
        return 0.0, []

    intersection = types_a & types_b
    union = types_a | types_b
    score = len(intersection) / len(union) if union else 0.0
    return round(score, 4), sorted(intersection)


# =============================================================================
# MAIN SIMILARITY FUNCTION
# =============================================================================
def compute_pairwise_similarity(
    well_a: Dict[str, Any],
    well_b: Dict[str, Any],
    formations_a: List[Dict[str, Any]],
    formations_b: List[Dict[str, Any]],
    events_a: List[Dict[str, Any]],
    events_b: List[Dict[str, Any]],
    params_a: List[Dict[str, Any]],
    params_b: List[Dict[str, Any]],
    weights: Optional[Dict[str, float]] = None,
) -> Dict[str, Any]:
    """
    Compute multi-factor deterministic similarity score between two wells.

    Returns dict with overall score, component breakdown, and evidence.
    """
    w = weights or WEIGHTS

    # --- Component scores ---
    form_score, shared_formations = compute_formation_overlap(formations_a, formations_b)
    depth_score = compute_depth_proximity(formations_a, formations_b)
    spatial_score, distance_km = compute_spatial_proximity(
        float(well_a["latitude"]), float(well_a["longitude"]),
        float(well_b["latitude"]), float(well_b["longitude"]),
    )
    ops_score = compute_operational_similarity(params_a, params_b)
    event_score, common_events = compute_event_type_overlap(events_a, events_b)

    # --- Weighted combination ---
    # PROTOTYPE ASSUMPTION — requires SME calibration
    overall = (
        w["formation_overlap"] * form_score
        + w["depth_proximity"] * depth_score
        + w["spatial_proximity"] * spatial_score
        + w["operational_similarity"] * ops_score
        + w["event_type_overlap"] * event_score
    )
    overall = round(max(0.0, min(1.0, overall)), 4)

    return {
        "well_a_id": well_a["well_id"],
        "well_b_id": well_b["well_id"],
        "well_id_1": well_a["well_id"],
        "well_id_2": well_b["well_id"],
        "well_b_name": well_b.get("name", well_b.get("code", "")),
        "well_b_code": well_b.get("code", ""),
        "overall_similarity": overall,
        "similarity_score": overall,
        "distance_km": distance_km,
        "breakdown": {
            "formation_overlap": {
                "score": form_score,
                "weight": w["formation_overlap"],
                "weighted": round(w["formation_overlap"] * form_score, 4),
                "shared_formations": shared_formations,
            },
            "depth_proximity": {
                "score": depth_score,
                "weight": w["depth_proximity"],
                "weighted": round(w["depth_proximity"] * depth_score, 4),
            },
            "spatial_proximity": {
                "score": spatial_score,
                "weight": w["spatial_proximity"],
                "weighted": round(w["spatial_proximity"] * spatial_score, 4),
                "distance_km": distance_km,
            },
            "operational_similarity": {
                "score": ops_score,
                "weight": w["operational_similarity"],
                "weighted": round(w["operational_similarity"] * ops_score, 4),
            },
            "event_type_overlap": {
                "score": event_score,
                "weight": w["event_type_overlap"],
                "weighted": round(w["event_type_overlap"] * event_score, 4),
                "common_events": common_events,
            },
        },
        "disclaimer": "SIMULATED DATA - PROTOTYPE ASSUMPTION weights require SME calibration",
    }


# =============================================================================
# BATCH: Compute all pairwise similarities for a dataset
# =============================================================================
def compute_all_pairwise(
    wells: List[Dict[str, Any]],
    formations: List[Dict[str, Any]],
    events: List[Dict[str, Any]],
    drilling_params: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Compute pairwise similarity for every unique well pair.
    Returns list of similarity result dicts ready for well_similarity table insertion.
    """
    # Index data by well_id
    forms_by_well: Dict[str, List] = defaultdict(list)
    for f in formations:
        forms_by_well[f["well_id"]].append(f)

    events_by_well: Dict[str, List] = defaultdict(list)
    for e in events:
        events_by_well[e["well_id"]].append(e)

    params_by_well: Dict[str, List] = defaultdict(list)
    for p in drilling_params:
        params_by_well[p["well_id"]].append(p)

    results = []
    n = len(wells)
    for i in range(n):
        for j in range(i + 1, n):
            wa, wb = wells[i], wells[j]
            result = compute_pairwise_similarity(
                well_a=wa,
                well_b=wb,
                formations_a=forms_by_well[wa["well_id"]],
                formations_b=forms_by_well[wb["well_id"]],
                events_a=events_by_well[wa["well_id"]],
                events_b=events_by_well[wb["well_id"]],
                params_a=params_by_well[wa["well_id"]],
                params_b=params_by_well[wb["well_id"]],
            )
            results.append(result)

    return results


def get_similar_wells(
    target_well_id: str,
    all_similarities: List[Dict[str, Any]],
    limit: int = 10,
) -> List[Dict[str, Any]]:
    """
    Return similarity-ranked list for a given target well.
    Searches both well_a and well_b positions in all_similarities.
    """
    matches = []
    for sim in all_similarities:
        if sim["well_a_id"] == target_well_id:
            matches.append({
                "well_id": sim["well_b_id"],
                "well_name": sim.get("well_b_name", ""),
                "well_code": sim.get("well_b_code", ""),
                "overall_similarity": sim["overall_similarity"],
                "similarity_score": sim["overall_similarity"],
                "distance_km": sim["distance_km"],
                "breakdown": sim["breakdown"],
            })
        elif sim["well_b_id"] == target_well_id:
            matches.append({
                "well_id": sim["well_a_id"],
                "well_name": sim.get("well_a_name", sim.get("well_b_name", "")),
                "well_code": sim.get("well_a_code", ""),
                "overall_similarity": sim["overall_similarity"],
                "similarity_score": sim["overall_similarity"],
                "distance_km": sim["distance_km"],
                "breakdown": sim["breakdown"],
            })

    # Sort by similarity descending
    matches.sort(key=lambda x: x["overall_similarity"], reverse=True)
    return matches[:limit]
