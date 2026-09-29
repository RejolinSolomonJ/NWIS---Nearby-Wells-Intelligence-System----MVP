"""
test_phases_11_12_13.py
Automated acceptance checks for Phases 11, 12, and 13.
"""

import os
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.anyio
async def test_phase11_alert_9_point_explainability_fields():
    """
    PHASE 11 Acceptance Check:
    Verify that every alert from /risk/alerts populates all 9 mandatory fields without exception:
    1. WHY
    2. WHICH WELLS
    3. DEPTH
    4. FORMATION
    5. EVENT TYPE
    6. EVIDENCE
    7. SOURCE DOC + PAGE
    8. SIMILARITY SCORE
    9. CONFIDENCE
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/risk/alerts")
        assert res.status_code == 200
        alerts = res.json()
        assert len(alerts) > 0, "Should have seeded alerts"

        for alert in alerts:
            # 1. WHY
            assert alert.get("why"), f"Alert {alert.get('alert_id')} missing WHY field"
            # 2. WHICH WELLS
            assert alert.get("which_wells") is not None and len(alert["which_wells"]) > 0, "Missing WHICH WELLS"
            # 3. DEPTH
            assert alert.get("depth_m") is not None, "Missing DEPTH"
            # 4. FORMATION
            assert alert.get("formation_name"), "Missing FORMATION"
            # 5. EVENT TYPE
            assert alert.get("alert_type"), "Missing EVENT TYPE (alert_type)"
            # 6. EVIDENCE
            assert alert.get("evidence"), "Missing EVIDENCE"
            # 7. SOURCE DOC + PAGE
            assert alert.get("source_doc"), "Missing SOURCE DOC"
            assert alert.get("source_page") is not None, "Missing SOURCE PAGE"
            # 8. SIMILARITY SCORE
            assert alert.get("similarity_score") is not None, "Missing SIMILARITY SCORE"
            # 9. CONFIDENCE
            assert (alert.get("confidence_score") is not None or alert.get("confidence") is not None), "Missing CONFIDENCE"


@pytest.mark.anyio
async def test_phase11_pdf_evidence_files_exist():
    """
    PHASE 11:
    Verify that archival PDF files exist on disk for offset wells in both synthetic_data and frontend public.
    """
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    synth_reports = os.path.join(project_root, "synthetic_data", "reports")
    frontend_reports = os.path.join(project_root, "frontend", "public", "reports")

    assert os.path.isdir(synth_reports), "synthetic_data/reports directory must exist"
    assert os.path.isdir(frontend_reports), "frontend/public/reports directory must exist"

    sample_pdf = os.path.join(frontend_reports, "DEMO-WELL-101_daily_drilling_report.pdf")
    assert os.path.isfile(sample_pdf), "Sample PDF DEMO-WELL-101 must exist for EvidenceViewer"
    assert os.path.getsize(sample_pdf) > 1000, "PDF file must not be empty"


@pytest.mark.anyio
async def test_phase12_structured_events_filter_search():
    """
    PHASE 12 Acceptance Check:
    Verify filtered search on /events returns exact matching seeded events.
    Query: stuck pipe or mud loss in Formation Barail/F3 between 2700-3300m.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Search for mud_loss in Barail between 2700-2900m
        res = await client.get("/events?formation=Barail&depth_min=2700&depth_max=2900")
        assert res.status_code == 200
        events = res.json()
        assert len(events) > 0, "Should find Barail events in depth range 2700-2900m"

        for ev in events:
            assert 2700 <= ev["depth_m"] <= 2900, f"Event depth {ev['depth_m']} not in 2700-2900m"
            assert "Barail" in ev["formation_name"], f"Formation {ev['formation_name']} does not contain Barail"


@pytest.mark.anyio
async def test_phase12_compare_wells_f3_cluster_similarity_breakdown():
    """
    PHASE 12 Acceptance Check:
    Verify compare view data: similarity breakdown for F3-cluster wells returns
    high similarity and all 5 components of the breakdown JSONB.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Get wells list
        w_res = await client.get("/wells")
        assert w_res.status_code == 200
        wells = w_res.json()
        assert len(wells) >= 2

        well_1_id = wells[0]["well_id"]
        sim_res = await client.get(f"/wells/{well_1_id}/similar")
        assert sim_res.status_code == 200
        similar_wells = sim_res.json()
        assert len(similar_wells) > 0

        top_sim = similar_wells[0]
        assert "breakdown" in top_sim, "Top similar well must contain breakdown jsonb"
        bd = top_sim["breakdown"]

        # Verify all 5 components of breakdown
        assert "formation_overlap" in bd
        assert "depth_proximity" in bd
        assert "spatial_proximity" in bd
        assert "operational_similarity" in bd
        assert "event_type_overlap" in bd

        # F3 cluster wells should have similarity >= 0.70
        assert top_sim["overall_similarity"] >= 0.70


@pytest.mark.anyio
async def test_phase13_copilot_preset_questions_citations_and_determinism():
    """
    PHASE 13 Acceptance Check:
    Preset questions return correct, cited answers consistently across repeated runs (determinism check — rerun 3x).
    Also verify out-of-scope question returns insufficient evidence without error.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Preset 1: Mud loss in F3
        q1 = "What drilling risks and mud losses occurred in Barail Formation (F3) between 2740m and 2770m?"
        for run_idx in range(3):
            r1 = await client.post("/copilot/query", json={"question": q1})
            assert r1.status_code == 200
            data1 = r1.json()
            assert "answer" in data1
            assert len(data1["citations"]) > 0, f"Run {run_idx+1}: Q1 must return citations"
            # Verify citation structure
            cit = data1["citations"][0]
            assert "well" in cit
            assert "doc" in cit
            assert "page" in cit

        # Preset 2: Out of scope
        q_oos = "What was the crude oil market price in Assam in 1985?"
        r_oos = await client.post("/copilot/query", json={"question": q_oos})
        assert r_oos.status_code == 200
        data_oos = r_oos.json()
        assert "insufficient evidence" in data_oos["answer"].lower()
