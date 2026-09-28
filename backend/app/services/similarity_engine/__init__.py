from app.services.similarity_engine.engine import (
    WEIGHTS,
    haversine_distance_km,
    compute_formation_overlap,
    compute_depth_proximity,
    compute_spatial_proximity,
    compute_operational_similarity,
    compute_event_type_overlap,
    compute_pairwise_similarity,
    compute_all_pairwise,
)

# Backwards compatibility alias
calculate_well_similarity = compute_pairwise_similarity
compute_spatial_score = compute_spatial_proximity
compute_depth_score = compute_depth_proximity
compute_formation_score = compute_formation_overlap
compute_event_score = compute_event_type_overlap

__all__ = [
    "WEIGHTS",
    "haversine_distance_km",
    "compute_formation_overlap",
    "compute_depth_proximity",
    "compute_spatial_proximity",
    "compute_operational_similarity",
    "compute_event_type_overlap",
    "compute_pairwise_similarity",
    "compute_all_pairwise",
    "calculate_well_similarity",
    "compute_spatial_score",
    "compute_depth_score",
    "compute_formation_score",
    "compute_event_score",
]
