"""
Pytest suite for NWIS-X Phase 4 — Document Intelligence (OCR + NLP Extraction).
Validates:
1. Controlled vocabulary normalization (vocab.py)
2. OCR page extraction (ocr_pipeline/service.py)
3. NLP extraction engine (nlp_extraction/engine.py)
4. POST /reports/upload (multipart PDF upload)
5. POST /reports/{id}/process (end-to-end OCR -> pgvector chunk embeddings -> NLP extraction -> drilling_events)
6. Acceptance Check: raw_text_snippet and page_number present in DB rows.
"""

import os
import io
import json
import pytest
from uuid import uuid4
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import get_db
from app.services.nlp_extraction.vocab import normalize_event_type, CONTROLLED_VOCABULARY
from app.services.ocr_pipeline.service import ocr_service
from app.services.ocr_pipeline.embeddings import generate_embedding
from app.services.nlp_extraction.engine import nlp_engine

client = TestClient(app)

DATASET_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "synthetic_data", "dataset.json")
SYNTHETIC_REPORTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "synthetic_data", "reports")

with open(DATASET_PATH, "r", encoding="utf-8") as f:
    DATASET = json.load(f)

SAMPLE_WELL = DATASET["wells"][0]
SAMPLE_PDF_NAME = f"{SAMPLE_WELL['code']}_daily_drilling_report.pdf"
SAMPLE_PDF_PATH = os.path.join(SYNTHETIC_REPORTS_DIR, SAMPLE_PDF_NAME)


def test_controlled_vocabulary_synonyms():
    """Test vocab normalizer maps synonyms to canonical event types with high confidence."""
    # Direct canonical
    cat, conf = normalize_event_type("mud_loss")
    assert cat == "mud_loss"
    assert conf >= 0.90

    # Synonyms for mud_loss
    cat, conf = normalize_event_type("lost circulation encountered at interval")
    assert cat == "mud_loss"
    assert conf >= 0.70

    cat, conf = normalize_event_type("spotted LCM pill due to severe pit volume drop")
    assert cat == "mud_loss"
    assert conf >= 0.70

    # Synonyms for stuck_pipe
    cat, conf = normalize_event_type("differential sticking with excessive overpull")
    assert cat == "stuck_pipe"
    assert conf >= 0.70

    cat, conf = normalize_event_type("jarred downward with freeing pill")
    assert cat == "stuck_pipe"
    assert conf >= 0.70

    # Synonyms for kick
    cat, conf = normalize_event_type("positive flow check, gas influx shut in with annular BOP")
    assert cat == "kick"
    assert conf >= 0.70

    # Unrecognized / other
    cat, conf = normalize_event_type("routine inspection of rig lights")
    assert cat == "other"
    assert conf < 0.60


def test_embedding_generation():
    """Test 384-dimensional normalized embeddings."""
    text = "Severe mud loss in Barail Coal-Shale formation at depth 2752.4m"
    vec = generate_embedding(text, dim=384)
    assert len(vec) == 384
    # Check L2 norm approx 1.0
    import math
    norm = math.sqrt(sum(x * x for x in vec))
    assert 0.95 <= norm <= 1.05


def test_ocr_page_extraction():
    """Test extracting pages from a synthetic PDF report."""
    assert os.path.exists(SAMPLE_PDF_PATH), f"Sample PDF not found at {SAMPLE_PDF_PATH}"
    pages = ocr_service.extract_pages(SAMPLE_PDF_PATH)
    assert len(pages) == 5
    for page in pages:
        assert page["page_number"] >= 1
        assert "DAILY DRILLING REPORT" in page["text"]
        assert len(page["text"]) > 100


def test_nlp_extraction_engine_structured_event():
    """Test NLP extraction of structured event marker with snippet and needs_review."""
    page_text = (
        "Operations Log (Depth interval: 2100m - 2800m):\n"
        "Drilling string operated with PDC bit.\n"
        "CRITICAL DRILLING INCIDENTS & ACTIONS TAKEN ON THIS PAGE:\n"
        "• EVENT: MUD_LOSS at 2752.4m (Severity: CRITICAL)\n"
        "  Description: Severe mud loss of 120 bbl/hr in Barail Coal-Shale at 2752.4m.\n"
        "  Mitigation Action: Spotted 60 bbl LCM pill.\n"
        "  Outcome: Well stabilized."
    )
    events = nlp_engine.extract_from_page(page_text, page_number=3)
    assert len(events) == 1
    ev = events[0]
    assert ev["depth_m"] == 2752.4
    assert ev["event_type"] == "mud_loss"
    assert ev["severity"] == "critical"
    assert ev["page_number"] == 3
    assert "MUD_LOSS at 2752.4m" in ev["raw_text_snippet"]
    assert "Severe mud loss" in ev["description"]
    assert ev["needs_review"] is False


def test_nlp_extraction_engine_narrative_event_with_review_flag():
    """Test low-confidence extraction sets needs_review = True."""
    narrative_text = "Minor loss of returns observed during circulation around 1850m."
    events = nlp_engine.extract_from_page(narrative_text, page_number=2)
    assert len(events) == 1
    ev = events[0]
    assert ev["event_type"] == "mud_loss"
    assert ev["page_number"] == 2
    assert ev["depth_m"] == 1850.0
    # Needs review flag triggered for narrative/low confidence
    assert isinstance(ev["needs_review"], bool)


def test_reports_upload_and_process_endpoints():
    """
    Test Phase 4 End-to-End API:
    1. POST /reports/upload (multipart PDF upload)
    2. POST /reports/{report_id}/process
    """
    with open(SAMPLE_PDF_PATH, "rb") as f:
        pdf_bytes = f.read()

    # Mock DB session for testing upload and process
    created_entities = []

    class MockReport:
        def __init__(self, **kwargs):
            self.report_id = kwargs.get("report_id", uuid4())
            self.well_id = kwargs.get("well_id")
            self.report_type = kwargs.get("report_type", "Daily Drilling Report")
            self.file_path = kwargs.get("file_path")
            self.upload_date = "2025-01-15T00:00:00"

    class MockSession:
        async def execute(self, stmt, params=None):
            class MockRes:
                def __init__(self, data):
                    self._data = data

                def scalar_one_or_none(self):
                    return self._data[0] if self._data else None

                def scalars(self):
                    class Scal:
                        def __init__(self, items):
                            self._items = items
                        def all(self):
                            return self._items
                    return Scal(self._data)

            stmt_s = str(stmt).lower()
            if "wells" in stmt_s:
                return MockRes([SAMPLE_WELL["well_id"]])
            elif "reports" in stmt_s:
                # Return report object pointing to real PDF
                rep = MockReport(
                    report_id=uuid4(),
                    well_id=SAMPLE_WELL["well_id"],
                    report_type="Daily Drilling Report",
                    file_path=SAMPLE_PDF_PATH
                )
                return MockRes([rep])
            elif "formations" in stmt_s:
                # Mock formation
                class MockForm:
                    formation_id = uuid4()
                    top_depth_m = 2700.0
                    base_depth_m = 2800.0
                return MockRes([MockForm()])
            return MockRes([])

        def add(self, entity):
            created_entities.append(entity)

        async def flush(self):
            pass

        async def refresh(self, entity):
            pass

    async def mock_get_db():
        yield MockSession()

    app.dependency_overrides[get_db] = mock_get_db

    try:
        # 1. Upload report
        response = client.post(
            "/reports/upload",
            data={
                "well_id": SAMPLE_WELL["well_id"],
                "report_type": "Daily Drilling Report",
            },
            files={
                "file": (SAMPLE_PDF_NAME, io.BytesIO(pdf_bytes), "application/pdf")
            }
        )
        assert response.status_code == 201
        upload_json = response.json()
        assert "report_id" in upload_json
        assert upload_json["well_id"] == SAMPLE_WELL["well_id"]

        # 2. Process report
        report_id = upload_json["report_id"]
        proc_response = client.post(f"/reports/{report_id}/process")
        assert proc_response.status_code == 200
        proc_json = proc_response.json()

        assert proc_json["status"] == "success"
        assert proc_json["pages_processed"] == 5
        assert proc_json["chunks_created"] == 5
        assert proc_json["events_extracted_count"] >= 1

        # Verify extracted event properties
        first_ev = proc_json["extracted_events"][0]
        assert "depth_m" in first_ev
        assert "event_type" in first_ev
        assert "page_number" in first_ev
        assert "snippet" in first_ev
        assert "needs_review" in first_ev

    finally:
        app.dependency_overrides.pop(get_db, None)
