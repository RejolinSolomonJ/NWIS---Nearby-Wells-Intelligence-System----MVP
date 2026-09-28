"""
NWIS-X NLP Extraction Service
Deterministic regex and rule-based extraction for drilling logs and completion reports.
Extracts:
- Well Names & Codes (e.g. NHK-101, MRN-102)
- Depths (meters)
- Formations
- Incident Types
- Mud Weights & Operational Parameters
"""

import re
from typing import List, Dict, Any, Optional

WELL_CODE_REGEX = re.compile(r'\b([A-Z]{3,4}-\d{3,4})\b', re.IGNORECASE)
DEPTH_REGEX = re.compile(r'(\b\d{3,5}(?:\.\d{1,2})?)\s*(?:m|meters|mtrs)\b', re.IGNORECASE)
MUD_WEIGHT_REGEX = re.compile(r'(\b\d{1,2}(?:\.\d{1,2})?)\s*(?:ppg|lb/gal)\b', re.IGNORECASE)
PRESSURE_REGEX = re.compile(r'(\b\d{2,5}(?:\.\d{1,2})?)\s*(?:psi|bar)\b', re.IGNORECASE)

KNOWN_FORMATIONS = [
    "Alluvium", "Dihing", "Girujan Clay", "Tipam Sandstone", "Tipam",
    "Bokabil Formation", "Bokabil", "Barail Coal-Shale", "Barail",
    "Kopili Formation", "Kopili", "Sylhet Limestone", "Sylhet", "Basement Complex"
]

EVENT_KEYWORDS = {
    "kick": ["kick", "influx", "pit gain", "sidpp", "sicp", "well flow"],
    "lost_circulation": ["lost circulation", "mud loss", "partial loss", "total loss", "seepage"],
    "stuck_pipe": ["stuck pipe", "differential sticking", "mechanical sticking", "overpull", "jarring"],
    "gas_show": ["gas show", "background gas", "trip gas", "gas cut mud", "chromatograph"],
    "wellbore_instability": ["sloughing", "cavings", "tight hole", "hole collapse", "shale swelling"],
}


class NLPExtractor:
    @staticmethod
    def extract_drilling_entities(text: str) -> Dict[str, Any]:
        """Extract structured drilling entities from raw document text."""
        # 1. Well codes
        well_codes = list(set(WELL_CODE_REGEX.findall(text)))

        # 2. Depths
        depth_matches = DEPTH_REGEX.findall(text)
        depths = [float(d) for d in depth_matches if 100 <= float(d) <= 8000]

        # 3. Mud Weights
        mw_matches = MUD_WEIGHT_REGEX.findall(text)
        mud_weights = [float(m) for m in mw_matches if 7.0 <= float(m) <= 22.0]

        # 4. Formations mentioned
        matched_formations = []
        for form in KNOWN_FORMATIONS:
            if re.search(r'\b' + re.escape(form) + r'\b', text, re.IGNORECASE):
                matched_formations.append(form)

        # 5. Detected event types
        text_lower = text.lower()
        detected_events = []
        for ev_type, keywords in EVENT_KEYWORDS.items():
            if any(kw in text_lower for kw in keywords):
                detected_events.append(ev_type)

        return {
            "well_codes": well_codes,
            "depths_m": sorted(list(set(depths))),
            "mud_weights_ppg": sorted(list(set(mud_weights))),
            "formations": list(set(matched_formations)),
            "detected_event_types": detected_events,
            "char_count": len(text),
        }
