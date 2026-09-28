"""
NWIS-X Query Parser — Phase 7.
Extracts well, depth, formation, and event_type filters from natural language questions
using regex and controlled vocabulary mapping (lightweight, deterministic keyword parser).
"""

import re
from typing import Dict, Any, Optional, List

# Controlled vocabulary synonyms (aligned with Phase 4 NLP pipeline)
EVENT_TYPE_PATTERNS = {
    "mud_loss": [
        r"mud\s*loss(?:es)?",
        r"lost\s*circulation",
        r"loss\s*of\s*circulation",
        r"fluid\s*loss(?:es)?",
        r"lcm\b",
        r"seepage",
        r"pit\s*volume\s*drop",
    ],
    "stuck_pipe": [
        r"stuck\s*pipe",
        r"pipe\s*sticking",
        r"differential\s*sticking",
        r"mechanical\s*sticking",
        r"overpull",
        r"jarring",
        r"tight\s*hole",
        r"string\s*stuck",
    ],
    "kick": [
        r"\bkick\b",
        r"well\s*kick",
        r"influx",
        r"gas\s*show",
        r"sidpp",
        r"shut[- ]?in",
        r"well\s*control",
    ],
    "pressure_anomaly": [
        r"pressure\s*anomaly",
        r"abnormal\s*pressure",
        r"overpressure",
        r"pore\s*pressure",
        r"surge\s*pressure",
    ],
    "torque_anomaly": [
        r"torque\s*anomaly",
        r"stick[- ]?slip",
        r"torsional",
        r"rotational\s*vibration",
        r"high\s*torque",
    ],
}

# Formation patterns matching Assam-Arakan stratigraphy
FORMATION_PATTERNS = {
    "Formation F3": [
        r"\bformation\s*f3\b",
        r"\bf3\b",
        r"barail\s*coal[- ]?shale",
        r"barail",
    ],
    "Formation F1": [
        r"\bformation\s*f1\b",
        r"\bf1\b",
        r"alluvium",
        r"dihing",
    ],
    "Formation F2": [
        r"\bformation\s*f2\b",
        r"\bf2\b",
        r"tipam\s*sandstone",
        r"tipam",
    ],
    "Formation F4": [
        r"\bformation\s*f4\b",
        r"\bf4\b",
        r"kopili\s*shale",
        r"kopili",
    ],
    "Formation F5": [
        r"\bformation\s*f5\b",
        r"\bf5\b",
        r"sylhet\s*limestone",
        r"sylhet",
    ],
    "Formation F6": [
        r"\bformation\s*f6\b",
        r"\bf6\b",
        r"basement",
    ],
}


def parse_query(question: str) -> Dict[str, Any]:
    """
    Parses natural language drilling query into structured criteria.

    Returns dict:
      {
        "event_type": Optional[str],
        "formation": Optional[str],
        "depth_min": Optional[float],
        "depth_max": Optional[float],
        "well_reference": Optional[str],
        "is_out_of_scope": bool
      }
    """
    q_lower = question.lower()
    filters: Dict[str, Any] = {
        "event_type": None,
        "formation": None,
        "depth_min": None,
        "depth_max": None,
        "well_reference": None,
        "is_out_of_scope": False,
    }

    # 1. Event Type Extraction
    for evt_type, patterns in EVENT_TYPE_PATTERNS.items():
        if any(re.search(pat, q_lower) for pat in patterns):
            filters["event_type"] = evt_type
            break

    # 2. Formation Extraction
    for form_name, patterns in FORMATION_PATTERNS.items():
        if any(research := re.search(pat, q_lower) for pat in patterns):
            filters["formation"] = form_name
            break

    # 3. Depth Extraction
    # Pattern: "between 2700 and 2800" or "2700-2800m"
    range_match = re.search(r"(?:between\s+)?(\d{3,5})\s*(?:and|to|-)\s*(\d{3,5})\s*(?:m|meters)?", q_lower)
    if range_match:
        d1, d2 = float(range_match.group(1)), float(range_match.group(2))
        filters["depth_min"] = min(d1, d2)
        filters["depth_max"] = max(d1, d2)
    else:
        # Single depth: "at 2740m" or "depth 2740"
        single_match = re.search(r"(?:at\s+|depth\s+|near\s+|around\s+)?(\d{3,5})\s*(?:m|meters)", q_lower)
        if single_match:
            d = float(single_match.group(1))
            filters["depth_min"] = max(0.0, d - 50.0)
            filters["depth_max"] = d + 50.0

    # 4. Well Reference Extraction
    well_match = re.search(r"(?:well[- ]?([a-c]|\d{1,3})|demo[- ]?well[- ]?(\d{1,3}))", q_lower)
    if well_match:
        val = well_match.group(1) or well_match.group(2)
        if val in ["a", "1", "101"]:
            filters["well_reference"] = "DEMO-WELL-101"
        elif val in ["b", "2", "102"]:
            filters["well_reference"] = "DEMO-WELL-102"
        elif val in ["c", "3", "103"]:
            filters["well_reference"] = "DEMO-WELL-103"
        else:
            filters["well_reference"] = f"DEMO-WELL-{val}"

    # 5. Out of scope detection: queries unrelated to petroleum / drilling / stratigraphy
    drilling_keywords = [
        "well", "drill", "depth", "formation", "mud", "loss", "stuck", "kick",
        "pressure", "torque", "casing", "f3", "barail", "kopili", "tipam", "hazard", "offset"
    ]
    if not any(k in q_lower for k in drilling_keywords):
        filters["is_out_of_scope"] = True

    return filters
