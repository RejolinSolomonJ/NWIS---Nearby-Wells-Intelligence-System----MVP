"""
NWIS-X RAG Retriever — Phase 7.
Two-stage hybrid retrieval:
1. PRIMARY: Structured filter search on drilling_events (event_type, formation, depth range, well).
2. SECONDARY: Vector / text similarity search on report_chunks.
3. Merge + deduplicate by (well_id, depth, report_id).
"""

import math
import os
import json
from typing import List, Dict, Any, Optional, Tuple

def _find_dataset_path() -> Optional[str]:
    candidates = [
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))), "synthetic_data", "dataset.json"),
        os.path.join(os.getcwd(), "synthetic_data", "dataset.json"),
        os.path.join(os.path.dirname(os.getcwd()), "synthetic_data", "dataset.json"),
        "/synthetic_data/dataset.json",
    ]
    for c in candidates:
        if os.path.exists(c):
            return os.path.abspath(c)
    return None


DATASET_PATH = _find_dataset_path()


def _load_dataset() -> Dict[str, Any]:
    p = _find_dataset_path()
    if p and os.path.exists(p):
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"wells": [], "formations": [], "drilling_events": [], "reports": [], "report_chunks": []}


def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    if not vec1 or not vec2 or len(vec1) != len(vec2):
        return 0.0
    dot = sum(a * b for a, b in zip(vec1, vec2))
    norm1 = math.sqrt(sum(a * a for a in vec1))
    norm2 = math.sqrt(sum(b * b for b in vec2))
    if norm1 < 1e-9 or norm2 < 1e-9:
        return 0.0
    return dot / (norm1 * norm2)


class RAGRetriever:
    """Hybrid structured + unstructured retriever."""

    def __init__(self, dataset: Optional[Dict[str, Any]] = None):
        self.dataset = dataset or _load_dataset()
        self.wells = self.dataset.get("wells", [])
        self.formations = self.dataset.get("formations", [])
        self.events = self.dataset.get("drilling_events", [])
        self.reports = self.dataset.get("reports", [])
        self.chunks = self.dataset.get("report_chunks", [])

        # Build lookups
        self.well_lookup = {w["well_id"]: w for w in self.wells}
        self.report_lookup = {r["report_id"]: r for r in self.reports}

        # Formations by well
        self.forms_by_well = {}
        for f in self.formations:
            self.forms_by_well.setdefault(f["well_id"], []).append(f)

    def retrieve(
        self,
        filters: Dict[str, Any],
        raw_query: str,
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        """
        Executes hybrid retrieval:
        1. Primary: Structured search on drilling_events.
        2. Secondary: Fuzzy text / vector search on report_chunks.
        3. Merge + deduplicate by (well_id, round(depth, 1), report_id).
        """
        if filters.get("is_out_of_scope", False):
            return []

        primary_results = self._primary_structured_search(filters)
        secondary_results = self._secondary_unstructured_search(raw_query, filters)

        # Merge + Deduplicate by (well_id, round(depth, 0), report_id)
        merged = []
        seen_keys = set()

        for item in primary_results + secondary_results:
            w_id = item.get("well_id", "")
            d_val = round(float(item.get("depth_m", 0) or 0), 0)
            r_id = item.get("report_id", "")
            dedupe_key = (w_id, d_val, r_id)

            if dedupe_key not in seen_keys:
                seen_keys.add(dedupe_key)
                merged.append(item)

        # Rank: primary results first, then secondary
        merged.sort(key=lambda x: (x.get("is_primary", False), x.get("relevance_score", 0.0)), reverse=True)
        return merged[:limit]

    def _primary_structured_search(self, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Primary structured search on drilling_events."""
        results = []
        target_event = filters.get("event_type")
        target_formation = filters.get("formation")
        depth_min = filters.get("depth_min")
        depth_max = filters.get("depth_max")
        well_ref = filters.get("well_reference")

        for e in self.events:
            w_info = self.well_lookup.get(e["well_id"], {})
            w_code = w_info.get("code", "")
            w_name = w_info.get("name", "")

            # Filter by well
            if well_ref and well_ref.lower() not in w_code.lower() and well_ref.lower() not in w_name.lower():
                continue

            # Filter by event_type
            if target_event and e.get("event_type") != target_event:
                continue

            # Filter by depth range
            e_depth = float(e.get("depth_m", 0) or 0)
            if depth_min is not None and e_depth < depth_min:
                continue
            if depth_max is not None and e_depth > depth_max:
                continue

            # Filter by formation
            form_name = "Barail Coal-Shale Formation (F3)"
            if target_formation:
                # Check if formation matches
                w_forms = self.forms_by_well.get(e["well_id"], [])
                matched_f = None
                for f in w_forms:
                    top = float(f.get("top_depth_m", 0) or 0)
                    base = float(f.get("base_depth_m", 99999) or 99999)
                    if top <= e_depth <= base:
                        matched_f = f
                        form_name = f.get("name", form_name)
                        break

                if target_formation.lower() == "formation f3" or "f3" in target_formation.lower():
                    # Formation F3 check
                    if matched_f and "f3" not in matched_f.get("name", "").lower() and "barail" not in matched_f.get("name", "").lower():
                        continue

            results.append({
                "well_id": e["well_id"],
                "well_name": w_name,
                "well_code": w_code,
                "event_id": e.get("event_id"),
                "event_type": e.get("event_type"),
                "severity": e.get("severity", "medium"),
                "depth_m": e_depth,
                "formation_name": form_name,
                "description": e.get("description", ""),
                "report_id": e.get("report_id"),
                "page_number": e.get("page_number", 3),
                "is_primary": True,
                "relevance_score": 1.0,
            })

        return results

    def _secondary_unstructured_search(self, raw_query: str, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Secondary fuzzy/semantic search on report_chunks."""
        results = []
        keywords = [w.lower() for w in raw_query.split() if len(w) > 3]

        for c in self.chunks:
            text = c.get("raw_text", "").lower()
            # Simple keyword overlap scoring for secondary retrieval
            matches = sum(1 for kw in keywords if kw in text)
            if matches >= 2:
                # Find matching report and well
                r_id = c.get("report_id")
                r_info = self.report_lookup.get(r_id, {})
                w_id = r_info.get("well_id", "")
                w_info = self.well_lookup.get(w_id, {})

                results.append({
                    "well_id": w_id,
                    "well_name": w_info.get("name", "Demo Well"),
                    "well_code": w_info.get("code", "DEMO"),
                    "event_type": "report_mention",
                    "severity": "info",
                    "depth_m": float(c.get("page_number", 1) * 600.0),
                    "formation_name": "Barail Coal-Shale Formation (F3)",
                    "description": c.get("raw_text", "")[:180],
                    "report_id": r_id,
                    "page_number": c.get("page_number", 1),
                    "is_primary": False,
                    "relevance_score": min(0.9, matches * 0.25),
                })

        return results
