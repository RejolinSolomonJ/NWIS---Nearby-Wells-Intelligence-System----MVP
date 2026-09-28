"""
Pytest suite for Phase 7 — RAG Copilot (Citation-Enforced).

Verifies:
1. Query Parser:
   - Extracts well, depth, formation, and event_type filters from natural language questions.
2. Retrieval:
   - Primary structured search on drilling_events.
   - Secondary search on report_chunks.
   - Merging and deduplication by (well_id, depth, report_id).
3. Prompt Template & Citation Enforcement:
   - Strict template: Answer ONLY using provided evidence.
   - Answers must contain [WellID, Document, Page] citations for every factual claim.
4. Target Question:
   - "Did any nearby well experience mud loss in Formation F3?"
   - Must cite Well A / Well C (or DEMO-WELL-101 / DEMO-WELL-103) with correct page numbers (p. 3).
5. Acceptance Check:
   - Out-of-scope question returns "insufficient evidence" rather than a fabricated answer.
6. API Endpoint:
   - POST /copilot/query -> returns { answer, citations: [{well, doc, page, snippet}] }.
"""

import json
import os
import re
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.rag_copilot.query_parser import parse_query
from app.services.rag_copilot.retriever import RAGRetriever
from app.services.rag_copilot.service import rag_service

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
# 1. QUERY PARSER TESTS
# =============================================================================

def test_query_parser_extraction():
    q = "Did any nearby well experience mud loss in Formation F3 between 2700 and 2800m?"
    filters = parse_query(q)

    assert filters["event_type"] == "mud_loss"
    assert filters["formation"] == "Formation F3"
    assert filters["depth_min"] == 2700.0
    assert filters["depth_max"] == 2800.0
    assert filters["is_out_of_scope"] is False


def test_query_parser_well_reference():
    q = "Show stuck pipe events in Well-B near 2760m"
    filters = parse_query(q)

    assert filters["event_type"] == "stuck_pipe"
    assert filters["well_reference"] == "DEMO-WELL-102"
    assert filters["is_out_of_scope"] is False


def test_query_parser_out_of_scope():
    q = "What is the capital of France and what is the current weather on Mars?"
    filters = parse_query(q)
    assert filters["is_out_of_scope"] is True


# =============================================================================
# 2. RETRIEVAL & DEDUPLICATION TESTS
# =============================================================================

def test_retriever_structured_and_deduplication(dataset):
    retriever = RAGRetriever(dataset=dataset)
    filters = {
        "event_type": "mud_loss",
        "formation": "Formation F3",
        "depth_min": 2740.0,
        "depth_max": 2780.0,
        "is_out_of_scope": False,
    }
    results = retriever.retrieve(filters, raw_query="mud loss in Formation F3")

    assert len(results) > 0
    # Must retrieve cluster wells (A and/or C)
    well_codes = [r["well_code"] for r in results]
    assert any("101" in wc or "103" in wc for wc in well_codes)

    # Check deduplication
    keys = [(r["well_id"], round(r["depth_m"], 0), r["report_id"]) for r in results]
    assert len(keys) == len(set(keys)), "Retriever returned duplicate entries"


# =============================================================================
# 3. CORE DEMO TEST: "Did any nearby well experience mud loss in Formation F3?"
# =============================================================================

def test_copilot_mud_loss_in_f3_citations():
    """
    CRITICAL REQUIREMENT:
    Test with question "Did any nearby well experience mud loss in Formation F3?"
    against seeded data — verify answer cites Well-A/B/C with correct pages. Show output.
    """
    question = "Did any nearby well experience mud loss in Formation F3?"
    res = rag_service.answer_query(question)

    print("\n" + "=" * 70)
    print(f"RAG COPILOT QUERY: \"{question}\"")
    print("=" * 70)
    print("ANSWER:")
    print(res["answer"])
    print("\nSTRUCTURED CITATIONS RETURNED:")
    for idx, c in enumerate(res["citations"], 1):
        print(f"  [{idx}] Well: {c['well']} | Doc: {c['doc']} (Page {c['page']})")
        print(f"      Snippet: {c['snippet'][:90]}...")
    print("=" * 70 + "\n")

    # 1. Answer must not be empty
    assert len(res["answer"]) > 50

    # 2. Citations must be provided in answer body
    citation_regex = r"\[.*?,\s*.*?,\s*(?:Page|p\.)\s*\d+\]"
    assert re.search(citation_regex, res["answer"]), "Answer is missing [WellID, Document, Page] citations"

    # 3. Must cite cluster wells (Well A / Well C / DEMO-WELL-101 / 103)
    cited_wells = [c["well"] for c in res["citations"]]
    assert any("101" in w or "103" in w or "WELL-A" in w.upper() or "WELL-C" in w.upper() for w in cited_wells), (
        f"Expected Well A or Well C in citations, got: {cited_wells}"
    )

    # 4. Correct page number verification (seeded events are on page 3)
    cited_pages = [c["page"] for c in res["citations"]]
    assert 3 in cited_pages, f"Expected page 3 in citations, got: {cited_pages}"


# =============================================================================
# 4. ACCEPTANCE CHECK: OUT-OF-SCOPE INSUFFICIENT EVIDENCE TEST
# =============================================================================

def test_copilot_out_of_scope_insufficient_evidence():
    """
    Acceptance Check:
    Test with an out-of-scope question returns "insufficient evidence"
    rather than a fabricated answer.
    """
    out_of_scope_query = "What is the average surface temperature of Jupiter and how many moons does it have?"
    res = rag_service.answer_query(out_of_scope_query)

    print("\nOUT-OF-SCOPE QUERY TEST:")
    print(f"Question: \"{out_of_scope_query}\"")
    print(f"Answer  : {res['answer']}")
    print(f"Citations: {res['citations']}")

    # Must explicitly state insufficient evidence
    assert "insufficient evidence" in res["answer"].lower()
    # Must NOT fabricate citations
    assert len(res["citations"]) == 0


# =============================================================================
# 5. API ENDPOINT TEST: POST /copilot/query
# =============================================================================

def test_api_copilot_query_endpoint():
    payload = {
        "question": "Did any nearby well experience mud loss in Formation F3?"
    }
    response = client.post("/copilot/query", json=payload)
    assert response.status_code == 200, response.text
    data = response.json()

    assert "answer" in data
    assert "citations" in data
    assert isinstance(data["citations"], list)
    assert len(data["citations"]) > 0

    first_citation = data["citations"][0]
    assert "well" in first_citation
    assert "doc" in first_citation
    assert "page" in first_citation
    assert "snippet" in first_citation
    assert first_citation["page"] == 3
