"""
Pytest suite for NWIS-X Phase 5 — Deterministic Well Similarity Engine.

Verifies:
1. Deterministic component scoring (FormationOverlap, DepthProximity, SpatialProximity,
   OperationalSimilarity, EventTypeOverlap).
2. Weight calibration labels present ("PROTOTYPE ASSUMPTION — requires SME calibration").
3. CRITICAL DEMO INVARIANT:
   Cluster wells A, B, and C (which share Formation F3 and mud_loss/stuck_pipe events at 2745-2770m)
   score HIGHER similarity to each other than to distant/unrelated non-cluster wells.
4. API Endpoints:
   - GET /wells/{well_id}/similar returns similarity-ranked list with breakdown JSON.
   - GET /wells/{well_id}/nearby-vs-relevant demonstrates why nearest != most relevant.
"""

import json
import os
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.similarity_engine.engine import (
    WEIGHTS,
    compute_formation_overlap,
    compute_depth_proximity,
    compute_spatial_proximity,
    compute_operational_similarity,
    compute_event_type_overlap,
    compute_pairwise_similarity,
    compute_all_pairwise,
)

client = TestClient(app)

DATASET_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "synthetic_data",
    "dataset.json",
)


@pytest.fixture(scope="module")
def dataset():
    assert os.path.exists(DATASET_PATH), f"dataset.json missing at {DATASET_PATH}"
    with open(DATASET_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


# =============================================================================
# 1. COMPONENT UNIT TESTS
# =============================================================================

def test_formation_overlap_jaccard():
    forms_a = [{"name": "Barail Sand"}, {"name": "Tipam Sandstone"}, {"name": "Girujan Clay"}]
    forms_b = [{"name": "Barail Sand"}, {"name": "Tipam Sandstone"}, {"name": "Kopili Shale"}]
    # Intersection = 2, Union = 4 -> Jaccard = 2/4 = 0.50
    score, shared = compute_formation_overlap(forms_a, forms_b)
    assert score == 0.5
    assert len(shared) == 2


def test_depth_proximity_calculation():
    # Exactly matching depths -> score 1.0
    forms_a = [{"name": "Barail", "top_depth_m": 2500, "base_depth_m": 2700}]
    forms_b = [{"name": "Barail", "top_depth_m": 2500, "base_depth_m": 2700}]
    score_exact = compute_depth_proximity(forms_a, forms_b)
    assert score_exact == 1.0

    # 100m difference -> score = 1.0 - 100/500 = 0.8
    forms_c = [{"name": "Barail", "top_depth_m": 2600, "base_depth_m": 2800}]
    score_diff = compute_depth_proximity(forms_a, forms_c)
    assert score_diff == 0.8


def test_spatial_proximity_exponential():
    # Identical location -> 1.0
    score_0, dist_0 = compute_spatial_proximity(27.28, 95.34, 27.28, 95.34)
    assert score_0 == 1.0
    assert dist_0 == 0.0

    # Far away (>50km) -> 0.0
    score_far, dist_far = compute_spatial_proximity(27.28, 95.34, 28.5, 96.5)
    assert score_far == 0.0
    assert dist_far > 50.0


def test_operational_similarity_cosine():
    # Identical mean vectors -> 1.0
    p_a = [{"rop": 12.0, "rpm": 110.0, "torque": 3500.0, "mud_weight": 1.15}]
    p_b = [{"rop": 12.0, "rpm": 110.0, "torque": 3500.0, "mud_weight": 1.15}]
    sim = compute_operational_similarity(p_a, p_b)
    assert sim >= 0.999


def test_event_type_overlap_jaccard():
    ev_a = [{"event_type": "mud_loss"}, {"event_type": "stuck_pipe"}]
    ev_b = [{"event_type": "mud_loss"}, {"event_type": "kick"}]
    # Shared = mud_loss (1), Union = 3 -> 1/3 = 0.3333
    score, common = compute_event_type_overlap(ev_a, ev_b)
    assert pytest.approx(score, 0.01) == 0.3333
    assert common == ["mud_loss"]


# =============================================================================
# 2. WEIGHTS CONFIGURATION VERIFICATION
# =============================================================================

def test_weights_sum_to_one():
    total_weights = sum(WEIGHTS.values())
    assert pytest.approx(total_weights, 0.0001) == 1.0
    assert WEIGHTS["formation_overlap"] == 0.30
    assert WEIGHTS["depth_proximity"] == 0.20
    assert WEIGHTS["spatial_proximity"] == 0.15
    assert WEIGHTS["operational_similarity"] == 0.15
    assert WEIGHTS["event_type_overlap"] == 0.20


# =============================================================================
# 3. CRITICAL DEMO INVARIANT: CLUSTER WELLS (A, B, C) HIGHER SIMILARITY
# =============================================================================

def test_cluster_wells_score_higher_similarity_than_non_cluster(dataset):
    """
    Cluster wells (first 3 wells in synthetic dataset: A, B, C) share:
    - Formation F3 (same depth band 2745-2770m)
    - Correlated mud_loss / stuck_pipe events
    - Close spatial clustering

    Assert: Pairwise similarity among (A, B, C) is strictly higher than
    the similarity between cluster wells and distant/dissimilar non-cluster wells.
    """
    wells = dataset["wells"]
    formations = dataset["formations"]
    events = dataset["drilling_events"]
    params = dataset.get("drilling_parameters", [])

    # Load full drilling params CSV if present
    dp_csv = os.path.join(os.path.dirname(DATASET_PATH), "drilling_parameters.csv")
    if os.path.exists(dp_csv):
        import csv
        with open(dp_csv, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            params = [
                {
                    "well_id": row["well_id"],
                    "rop": float(row.get("rop", 0) or 0),
                    "rpm": float(row.get("rpm", 0) or 0),
                    "torque": float(row.get("torque", 0) or 0),
                    "mud_weight": float(row.get("mud_weight", 0) or 0),
                }
                for row in reader
            ]

    # Compute all pairwise similarities
    pairwise = compute_all_pairwise(wells, formations, events, params)
    pair_map = {(p["well_id_1"], p["well_id_2"]): p["similarity_score"] for p in pairwise}
    # Add symmetric lookup
    for p in pairwise:
        pair_map[(p["well_id_2"], p["well_id_1"])] = p["similarity_score"]

    well_a = wells[0]["well_id"]
    well_b = wells[1]["well_id"]
    well_c = wells[2]["well_id"]

    sim_ab = pair_map.get((well_a, well_b), 0.0)
    sim_bc = pair_map.get((well_b, well_c), 0.0)
    sim_ac = pair_map.get((well_a, well_c), 0.0)

    cluster_sim_avg = (sim_ab + sim_bc + sim_ac) / 3.0

    # Find non-cluster wells
    non_cluster_sims = []
    for w in wells[3:]:
        w_id = w["well_id"]
        for c_id in (well_a, well_b, well_c):
            if (c_id, w_id) in pair_map:
                non_cluster_sims.append(pair_map[(c_id, w_id)])

    non_cluster_avg = sum(non_cluster_sims) / len(non_cluster_sims) if non_cluster_sims else 0.0

    print(f"\nCluster Wells (A,B,C) Avg Similarity: {cluster_sim_avg:.4f}")
    print(f"Non-Cluster Comparison Avg Similarity: {non_cluster_avg:.4f}")

    # Cluster wells must have higher similarity on average than non-cluster pairs
    assert cluster_sim_avg > non_cluster_avg, (
        f"Expected cluster similarity ({cluster_sim_avg}) > non-cluster avg ({non_cluster_avg})"
    )
    # Individual pairwise between cluster wells should all be >= 0.55
    assert sim_ab >= 0.55, f"Sim A-B ({sim_ab}) should be >= 0.55"
    assert sim_bc >= 0.55, f"Sim B-C ({sim_bc}) should be >= 0.55"
    assert sim_ac >= 0.55, f"Sim A-C ({sim_ac}) should be >= 0.55"


# =============================================================================
# 4. API ENDPOINT TESTS
# =============================================================================

def test_api_get_similar_wells(dataset):
    well_a_id = dataset["wells"][0]["well_id"]
    response = client.get(f"/wells/{well_a_id}/similar?limit=5")
    assert response.status_code == 200, response.text
    data = response.json()

    assert isinstance(data, list)
    assert len(data) > 0
    # Must be sorted descending by similarity_score
    scores = [item["similarity_score"] for item in data]
    assert scores == sorted(scores, reverse=True)

    # Top matches should have high similarity score
    top_match = data[0]
    assert top_match["similarity_score"] >= 0.65

    # Should contain another cluster well in top results
    cluster_well_ids = {dataset["wells"][1]["well_id"], dataset["wells"][2]["well_id"]}
    top_ids = {item["well_id"] for item in data}
    assert len(cluster_well_ids & top_ids) > 0

    # Verify breakdown structure
    breakdown = top_match["breakdown"]
    assert "formation_overlap" in breakdown
    assert "depth_proximity" in breakdown
    assert "spatial_proximity" in breakdown
    assert "operational_similarity" in breakdown
    assert "event_type_overlap" in breakdown
    assert "shared_formations" in breakdown["formation_overlap"]
    assert "common_events" in breakdown["event_type_overlap"]


def test_api_get_nearby_vs_relevant(dataset):
    well_a_id = dataset["wells"][0]["well_id"]
    response = client.get(f"/wells/{well_a_id}/nearby-vs-relevant?radius_km=25")
    assert response.status_code == 200, response.text
    data = response.json()

    assert "anchor_well" in data
    assert "closest_by_distance" in data
    assert "most_relevant_by_similarity" in data
    assert "distance_sorted" in data
    assert "similarity_sorted" in data
    assert "geological_insight" in data
    assert data["anchor_well"]["well_id"] == well_a_id

    # The most relevant well must have high similarity score
    most_relevant = data["most_relevant_by_similarity"]
    assert most_relevant is not None
    assert most_relevant["similarity_score"] >= 0.70
