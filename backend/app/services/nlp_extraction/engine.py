"""
NLP Extraction Engine.
Extracts:
- Depths (meters)
- Mud weights (ppg)
- Normalizes event types using controlled vocabulary
- Evaluates confidence and sets needs_review flag
"""

import re
from typing import List, Dict, Any, Optional
from app.services.nlp_extraction.vocab import normalize_event_type

DEPTH_PATTERN = re.compile(r'(?:at|depth|depth of|interval[:\s]+)?\s*(\d+(?:\s*\.\s*\d+)?)\s*(?:m|meters|mtrs)\b', re.IGNORECASE)
MUD_WEIGHT_PATTERN = re.compile(r'(\d+(?:\s*\.\s*\d+)?)\s*(?:ppg|lb/gal)\b', re.IGNORECASE)
EVENT_MARKER_PATTERN = re.compile(r'(?:EVENT:\s*([A-Za-z_]+)\s*at\s*(\d+(?:\s*\.\s*\d+)?)\s*m\s*\(Severity:\s*([A-Za-z]+)\))', re.IGNORECASE)


class NLPExtractionEngine:
    @staticmethod
    def extract_from_page(page_text: str, page_number: int) -> List[Dict[str, Any]]:
        """
        Extract drilling incidents from text of a single document page.
        Returns list of extracted event dicts.
        """
        extracted_events = []

        # 1. First look for structured event blocks: "EVENT: MUD_LOSS at 2752.4m (Severity: CRITICAL)"
        for match in EVENT_MARKER_PATTERN.finditer(page_text):
            raw_event_type = match.group(1).strip()
            depth_val = float(match.group(2).replace(" ", ""))
            severity_val = match.group(3).strip().lower()

            canonical_type, conf = normalize_event_type(raw_event_type)

            # Capture event section as raw_text_snippet
            start_pos = match.start()
            remaining_text = page_text[start_pos:]
            next_event_match = EVENT_MARKER_PATTERN.search(remaining_text[10:])
            if next_event_match:
                snippet = remaining_text[:next_event_match.start() + 10].strip()
            else:
                snippet = remaining_text[:450].strip()

            # Extract clean description if "Description:" label present
            desc_match = re.search(r'Description:\s*(.*?)(?=\n(?:Mitigation|Outcome|EVENT|\x7f|$))', snippet, re.DOTALL | re.IGNORECASE)
            if desc_match:
                description = desc_match.group(1).replace('\n', ' ').strip()
            else:
                description = snippet.replace('\n', ' ')[:250].strip()

            needs_review = conf < 0.80

            extracted_events.append({
                "depth_m": depth_val,
                "event_type": canonical_type,
                "severity": severity_val,
                "description": description,
                "page_number": page_number,
                "raw_text_snippet": snippet,
                "confidence": conf,
                "needs_review": needs_review,
            })

        # 2. If no explicit marker, check for general narrative mentions of kick / loss / stuck
        if not extracted_events:
            event_type, conf = normalize_event_type(page_text)
            if event_type != "other" and conf >= 0.70:
                # Find depths
                depths = DEPTH_PATTERN.findall(page_text)
                depth_val = float(depths[0]) if depths else 2500.0
                
                # Severity heuristic
                sev = "critical" if any(w in page_text.lower() for w in ["critical", "severe", "total loss", "blowout"]) else ("high" if "high" in page_text.lower() else "medium")

                # Grab relevant sentences
                sentences = [s.strip() for s in page_text.split(".") if any(k in s.lower() for k in ["loss", "kick", "stuck", "pressure"])]
                snippet = ". ".join(sentences[:2]) if sentences else page_text[:200]

                needs_review = conf < 0.80 or not depths

                extracted_events.append({
                    "depth_m": depth_val,
                    "event_type": event_type,
                    "severity": sev,
                    "description": snippet[:250],
                    "page_number": page_number,
                    "raw_text_snippet": snippet,
                    "confidence": conf,
                    "needs_review": needs_review,
                })

        return extracted_events


nlp_engine = NLPExtractionEngine()
