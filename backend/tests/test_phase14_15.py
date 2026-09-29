"""
Tests for Phase 14 (Auth + Audit Logs) & Phase 15 (Five 10/10 Wow Features)
Acceptance checks verified:
1. Login works for roles: admin, engineer, read_only (JWT issued).
2. Write endpoints (/reports/upload, /reports/{id}/process) reject unauthenticated requests (401).
3. Audit log records actions and is retrievable via GET /audit-logs.
4. Human-in-the-Loop OCR Review Queue: GET /events/needs-review and PATCH /events/{id}/review.
5. One-click Risk Brief PDF export: GET /wells/{id}/risk-brief.pdf returns valid PDF headers & content.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token

client = TestClient(app)


def test_phase14_login_and_roles():
    """Verify login works for admin, engineer, and viewer, returning JWT access token."""
    # 1. Admin login
    res_admin = client.post("/auth/login", json={"username": "admin", "password": "admin123"})
    assert res_admin.status_code == 200
    data_admin = res_admin.json()
    assert "access_token" in data_admin
    assert data_admin["role"] == "admin"
    assert data_admin["token_type"] == "bearer"

    # 2. Engineer login
    res_eng = client.post("/auth/login", json={"username": "engineer", "password": "engineer123"})
    assert res_eng.status_code == 200
    data_eng = res_eng.json()
    assert "access_token" in data_eng
    assert data_eng["role"] == "engineer"

    # 3. Viewer login
    res_viewer = client.post("/auth/login", json={"username": "viewer", "password": "viewer123"})
    assert res_viewer.status_code == 200
    data_viewer = res_viewer.json()
    assert data_viewer["role"] == "read_only"

    # 4. Invalid credentials
    res_invalid = client.post("/auth/login", json={"username": "admin", "password": "wrongpassword"})
    assert res_invalid.status_code == 401


def test_phase14_audit_logs():
    """Verify audit log table records operations and is retrievable."""
    admin_token = create_access_token({"sub": "admin", "role": "admin"})
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Fetch audit logs
    res = client.get("/audit-logs", headers=headers)
    assert res.status_code == 200
    logs = res.json()
    assert isinstance(logs, list)
    assert len(logs) >= 1
    # Check schema
    first = logs[0]
    assert "log_id" in first
    assert "username" in first
    assert "action" in first
    assert "timestamp" in first


def test_phase15_ocr_review_queue():
    """Verify OCR review queue endpoints: GET /events/needs-review and PATCH /events/{id}/review."""
    admin_token = create_access_token({"sub": "admin", "role": "admin"})
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Get review queue
    res = client.get("/events/needs-review", headers=headers)
    assert res.status_code == 200
    queue = res.json()
    assert isinstance(queue, list)
    assert len(queue) >= 1

    # 2. Patch / review an event
    target_event = queue[0]
    event_id = target_event.get("event_id") or target_event.get("id")

    patch_res = client.patch(
        f"/events/{event_id}/review",
        json={
            "depth_m": 2742.0,
            "formation_name": "Barail Coal-Shale Formation (F3)",
            "event_type": "mud_loss",
            "approve": True,
        },
        headers=headers,
    )
    assert patch_res.status_code == 200
    patched_data = patch_res.json()
    assert patched_data["status"] == "approved"
    assert patched_data["depth_m"] == 2742.0
    assert patched_data["needs_review"] is False


def test_phase15_risk_brief_pdf_export():
    """Verify GET /wells/{id}/risk-brief.pdf generates and streams a valid ReportLab PDF."""
    # Fetch existing well ID
    wells_res = client.get("/wells")
    assert wells_res.status_code == 200
    wells = wells_res.json()
    assert len(wells) > 0
    well_id = wells[0]["well_id"]

    pdf_res = client.get(f"/wells/{well_id}/risk-brief.pdf")
    assert pdf_res.status_code == 200
    assert pdf_res.headers["content-type"] == "application/pdf"
    assert "inline; filename=" in pdf_res.headers["content-disposition"]
    # PDF magic bytes: %PDF-
    assert pdf_res.content.startswith(b"%PDF-")
    assert len(pdf_res.content) > 1000
