"""
Controlled Vocabulary Map for Drilling Events and Operational Concepts.
Normalizes synonyms and technical terminology into standard categories:
- mud_loss
- kick
- stuck_pipe
- pressure_anomaly
- torque_anomaly
- other
"""

from typing import Dict, List, Tuple

# Mapping from canonical category to list of triggering phrases/synonyms
CONTROLLED_VOCABULARY: Dict[str, List[str]] = {
    "mud_loss": [
        "mud loss", "mud losses", "lost circulation", "fluid loss", "fluid losses",
        "loss zone", "seepage", "partial loss", "total loss", "pit volume drop",
        "lcm required", "lcm pill", "lost returns", "loss of returns", "dynamic mud loss"
    ],
    "kick": [
        "kick", "gas kick", "influx", "gas influx", "water influx", "sidpp", "sicp",
        "pit gain", "pit volume gain", "well flow", "flow check positive", "shut in",
        "annular bop", "wait and weight", "kill mud", "kill weight"
    ],
    "stuck_pipe": [
        "stuck pipe", "stuck", "differential sticking", "mechanical sticking",
        "overpull", "tight hole", "jarring", "jarred downward", "jarred upward",
        "freeing pill", "pipe stuck", "drag", "high drag", "keyseat"
    ],
    "pressure_anomaly": [
        "pressure anomaly", "pressure spike", "standpipe pressure spike",
        "spp spike", "abnormal pressure", "pore pressure increase",
        "pressure fluctuation", "spp drop", "washout"
    ],
    "torque_anomaly": [
        "torque anomaly", "torque spike", "torque oscillation", "torsional vibration",
        "stick-slip", "stick slip", "erratic torque", "high torque"
    ],
    "other": [
        "equipment failure", "telemetry drop", "mwd failure", "lwd failure",
        "pulser failure", "twist off", "bit failure", "casing wear"
    ],
}


def normalize_event_type(text: str) -> Tuple[str, float]:
    """
    Evaluates text against controlled vocabulary.
    Returns (canonical_event_type, confidence_score).
    """
    text_clean = text.lower().replace("_", " ").replace("-", " ")
    
    # Check for direct canonical match
    for canonical in CONTROLLED_VOCABULARY.keys():
        canonical_clean = canonical.replace("_", " ")
        if canonical == text.lower() or canonical_clean == text_clean:
            return canonical, 0.98

    matches = {}
    for canonical, synonyms in CONTROLLED_VOCABULARY.items():
        score = 0
        canonical_clean = canonical.replace("_", " ")
        if canonical_clean in text_clean:
            score += 2.0
            
        for syn in synonyms:
            syn_clean = syn.replace("_", " ")
            if syn_clean in text_clean:
                # Longer, more specific phrases get higher weight
                weight = 1.0 + (len(syn.split()) * 0.5)
                score += weight
        if score > 0:
            matches[canonical] = score

    if not matches:
        return "other", 0.35

    best_match = max(matches, key=matches.get)
    max_score = matches[best_match]

    # Calculate confidence based on match strength
    confidence = min(0.98, 0.70 + (max_score * 0.08))
    return best_match, round(confidence, 2)

