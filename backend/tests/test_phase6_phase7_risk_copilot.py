"""
Pytest suite for NWIS-X Phase 6 (Deterministic Risk Engine & Alerts)
and Phase 7 (RAG Copilot & Mandatory Citations).

Verifies:
1. Deterministic Risk Assessment:
   - Evaluates geological, pressure, mechanical, historical factors.
   - Confidence score derived from evidence sample size.
   - Zero hallucination / 0% LLM scoring.
2. Non-Negotiable Principle 4 — Every alert must show:
   - WHY
   - WHICH WELLS
   - DEPTH
   - FORMATION
   - EVIDENCE
   - SOURCE DOC + PAGE
   - SIMILARITY
   - CONFIDENCE
3. Correlated Risk Cluster alert verification (Wells A, B, C in Barail F3).
4. Alert acknowledgment.
5. RAG Copilot endpoint (/copilot/ask):
   - Strict institutional narration.
   - Mandatory verified citations with document_title, page_number, excerpt.
   - Clear simulated data disclaimer.
"""

import json
import os
import pytest
from fastapi.testclient import TestClient

from app.main import app

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
# 1. RISK ASSESSMENT TESTS
# =============================================================================

def test_risk_assessment_endpoint(dataset):
    well_id = dataset["wells"][0]["well_id"]
    response = client.get(f"/risk/assess/{well_id}")
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["well_id"] == well_id
    assert 0.0 <= data["overall_risk_score"] <= 1.0
    assert 0.5 <= data["confidence"] <= 1.0
    assert 0.0 <= data["geological_risk"] <= 1.0
    assert 0.0 <= data["mechanical_risk"] <= 1.0
    assert 0.0 <= data["pressure_risk"] <= 1.0
    assert 0.0 <= data["historical_risk"] <= 1.0
    assert len(data["risk_factors"]) > 0
    assert "evidence_summary" in data
    assert data["is_simulated"] is True


def test_risk_assessment_depth_filter(dataset):
    well_id = dataset["wells"][0]["well_id"]
    response = client.get(f"/risk/assess/{well_id}?depth_m=2755.0")
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["depth_m"] == 2755.0
    assert data["assessment_type"] == "while_drilling"


# =============================================================================
# 2. ALERTS & NON-NEGOTIABLE 8-POINT BREAKDOWN
# =============================================================================

def test_alerts_non_negotiable_8_points(dataset):
    """
    NON-NEGOTIABLE: Every alert must show:
    WHY, WHICH WELLS, DEPTH, FORMATION, EVIDENCE, SOURCE DOC+PAGE, SIMILARITY, CONFIDENCE.
    """
    response = client.get("/risk/alerts?limit=20")
    assert response.status_code == 200, response.text
    alerts = response.json()

    assert isinstance(alerts, list)
    assert len(alerts) > 0

    for a in alerts:
        # 1. WHY
        assert "why" in a and len(a["why"].strip()) > 0, "Missing WHY in alert"
        # 2. WHICH WELLS
        assert "which_wells" in a and isinstance(a["which_wells"], list) and len(a["which_wells"]) > 0, (
            "Missing WHICH WELLS in alert"
        )
        # 3. DEPTH
        assert "depth_m" in a and a["depth_m"] > 0, "Missing DEPTH in alert"
        # 4. FORMATION
        assert "formation_name" in a and len(a["formation_name"].strip()) > 0, "Missing FORMATION in alert"
        # 5. EVIDENCE
        assert "evidence" in a and len(a["evidence"].strip()) > 0, "Missing EVIDENCE in alert"
        # 6. SOURCE DOC + PAGE
        assert "source_doc" in a and len(a["source_doc"].strip()) > 0, "Missing SOURCE DOC in alert"
        assert "source_page" in a and a["source_page"] >= 1, "Missing SOURCE PAGE in alert"
        # 7. SIMILARITY
        assert "similarity_score" in a and 0.0 <= a["similarity_score"] <= 1.0, "Missing SIMILARITY in alert"
        # 8. CONFIDENCE
        assert "confidence_score" in a and 0.0 <= a["confidence_score"] <= 1.0, "Missing CONFIDENCE in alert"


def test_correlated_risk_cluster_alert(dataset):
    """
    Verify that the intentionally injected Correlated Risk Cluster (Wells A, B, C in
    Formation F3 at 2745-2770m) generates high-priority alerts with full evidence.
    """
    response = client.get("/risk/alerts?severity=critical")
    assert response.status_code == 200, response.text
    alerts = response.json()

    assert len(alerts) > 0
    cluster_alerts = [a for a in alerts if "Correlated offset cluster" in a["why"]]
    assert len(cluster_alerts) > 0, "Correlated cluster alert not triggered"

    ca = cluster_alerts[0]
    assert "F3" in ca["formation_name"] or "Barail" in ca["formation_name"]
    assert 2740.0 <= ca["depth_m"] <= 2780.0
    assert len(ca["which_wells"]) == 3
    assert ca["similarity_score"] >= 0.80
    assert ca["confidence_score"] >= 0.90


def test_acknowledge_alert():
    response = client.get("/risk/alerts?limit=1")
    assert response.status_code == 200
    alerts = response.json()
    assert len(alerts) > 0

    alert_id = alerts[0]["alert_id"]
    ack_res = client.patch(f"/risk/alerts/{alert_id}/acknowledge")
    assert ack_res.status_code == 200
    ack_data = ack_res.json()
    assert ack_data["status"] == "acknowledged"
    assert ack_data["alert_id"] == alert_id


# =============================================================================
# 3. RAG COPILOT & MANDATORY CITATIONS
# =============================================================================

def test_copilot_ask_with_citations(dataset):
    well_id = dataset["wells"][0]["well_id"]
    payload = {
        "question": "What are the primary hazards when drilling through Barail Coal-Shale, and what mitigations were used in offset wells?",
        "well_id": well_id,
        "depth_m": 2750.0,
    }
    response = client.post("/copilot/ask", json=payload)
    assert response.status_code == 200, response.text
    data = response.json()

    # Answer must not be empty and must mention institutional analysis
    assert "answer" in data and len(data["answer"]) > 100
    assert "Institutional Memory" in data["answer"] or "Barail" in data["answer"]

    # Citations MUST be provided (well, document, page, excerpt)
    assert "citations" in data
    assert len(data["citations"]) > 0
    first_cit = data["citations"][0]
    assert "well_name" in first_cit
    assert "document_title" in first_cit
    assert "page_number" in first_cit and first_cit["page_number"] >= 1
    assert "excerpt" in first_cit and len(first_cit["excerpt"]) > 0

    # Risk score and confidence must be present
    assert data["risk_score"] is not None
    assert data["confidence"] >= 0.70

    # Disclaimer must be present
    assert "SIMULATED DATA" in data["disclaimer"]
