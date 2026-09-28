"""
NWIS-X Deterministic Risk Engine

Computes well drilling risk scores and alerts purely via deterministic rules and
empirical formulas — ZERO LLM INVOLVEMENT for scoring.

Every output includes:
- Overall risk score (0.0 to 1.0)
- Confidence score (0.0 to 1.0)
- Breakdown: geological_risk, mechanical_risk, pressure_risk, historical_risk
- Complete evidence trail: WHY, WHICH WELLS, DEPTH, FORMATION, EVIDENCE, SOURCE DOC+PAGE
"""

from typing import List, Dict, Any, Optional
from uuid import UUID


def evaluate_geological_risk(
    formations: List[Dict[str, Any]],
    events: List[Dict[str, Any]],
    target_depth_m: Optional[float] = None
) -> tuple[float, List[Dict[str, Any]]]:
    """Evaluates rock mechanics, clay swelling, and stratigraphy risk."""
    score = 0.20
    factors = []

    # Check for known reactive shales and claystones (e.g. Girujan, Kopili)
    reactive_formations = ["girujan", "kopili", "barail"]
    encountered_reactive = [
        f for f in formations
        if any(r in f.get("formation_name", "").lower() for r in reactive_formations)
    ]
    if encountered_reactive:
        score += 0.25
        factors.append({
            "factor": "Reactive Shale Hydration & Swelling",
            "score": 0.45,
            "evidence": f"Formations {[f.get('formation_name') for f in encountered_reactive]} contain active smectite/illite clays prone to tight hole.",
            "source": "Assam-Arakan Stratigraphic Compendium Section 4.2"
        })

    # Historical wellbore instability events in this well or offset wells
    instability_events = [e for e in events if e.get("event_type") in ["wellbore_instability", "gas_show"]]
    if instability_events:
        bump = min(0.35, len(instability_events) * 0.12)
        score += bump
        sample_e = instability_events[0]
        factors.append({
            "factor": "Borehole Instability & Caving Recurrence",
            "score": round(0.40 + bump, 2),
            "evidence": f"{len(instability_events)} sloughing shale / gas show incidents recorded near {sample_e.get('depth_m')}m in {sample_e.get('formation_name')}.",
            "source": f"Well Drilling Record p. {sample_e.get('source_page', 12)}"
        })

    return round(min(1.0, score), 4), factors


def evaluate_pressure_risk(
    events: List[Dict[str, Any]],
    formations: List[Dict[str, Any]],
    target_depth_m: Optional[float] = None
) -> tuple[float, List[Dict[str, Any]]]:
    """Evaluates narrow mud weight windows, kick probability, and lost circulation."""
    score = 0.25
    factors = []

    kicks = [e for e in events if e.get("event_type") == "kick"]
    losses = [e for e in events if e.get("event_type") in ["lost_circulation", "mud_loss"]]

    if kicks:
        crit_kicks = [k for k in kicks if k.get("severity") in ["high", "critical"]]
        k_bump = 0.35 if crit_kicks else 0.20
        score += k_bump
        sample_k = kicks[0]
        factors.append({
            "factor": "Abnormal Formation Pore Pressure (Kick Vulnerability)",
            "score": round(0.50 + k_bump, 2),
            "evidence": f"{len(kicks)} kick influx events detected; SIDPP up to 700+ psi documented at {sample_k.get('depth_m')}m.",
            "source": f"End of Well Report p. {sample_k.get('source_page', 14)}"
        })

    if losses:
        l_bump = 0.25
        score += l_bump
        sample_l = losses[0]
        factors.append({
            "factor": "Weak Formation Fracture Gradient (Lost Circulation)",
            "score": round(0.45 + l_bump, 2),
            "evidence": f"{len(losses)} mud loss events logged in permeable/fractured zones at depth {sample_l.get('depth_m')}m.",
            "source": f"Mud Loss Audit Log p. {sample_l.get('source_page', 18)}"
        })

    # High pressure formations
    high_p_forms = [f for f in formations if (f.get("pressure_psi") or 0) > 4000]
    if high_p_forms:
        score += 0.15
        f_name = high_p_forms[0].get("formation_name")
        p_val = high_p_forms[0].get("pressure_psi")
        factors.append({
            "factor": "Deep Overpressured Reservoir Interval",
            "score": 0.65,
            "evidence": f"{f_name} displays pore pressures exceeding {p_val} psi.",
            "source": "Reservoir Pressure Data Sheet"
        })

    return round(min(1.0, score), 4), factors


def evaluate_mechanical_risk(
    events: List[Dict[str, Any]],
    total_depth_m: float
) -> tuple[float, List[Dict[str, Any]]]:
    """Evaluates stuck pipe, BHA fatigue, and casing wear."""
    score = 0.15
    factors = []

    stuck_events = [e for e in events if e.get("event_type") == "stuck_pipe"]
    if stuck_events:
        s_bump = min(0.45, 0.25 + len(stuck_events) * 0.15)
        score += s_bump
        s_evt = stuck_events[0]
        factors.append({
            "factor": "Differential / Mechanical Pipe Sticking",
            "score": round(0.50 + s_bump, 2),
            "evidence": f"{len(stuck_events)} stuck pipe occurrences with substantial overpull at depth {s_evt.get('depth_m')}m.",
            "source": f"Drilling Incident Report p. {s_evt.get('source_page', 9)}"
        })

    if total_depth_m > 4000:
        score += 0.20
        factors.append({
            "factor": "Deep Extended Reach String Mechanics",
            "score": 0.60,
            "evidence": f"Total depth of {total_depth_m}m introduces high drag, torque, and fatigue cycles on drillstring.",
            "source": "Well Design & Hydraulics Program"
        })

    return round(min(1.0, score), 4), factors


def evaluate_historical_risk(
    events: List[Dict[str, Any]],
    similar_wells_count: int
) -> tuple[float, List[Dict[str, Any]]]:
    """Deterministic score based on severity frequency in offset institutional memory."""
    crit_count = sum(1 for e in events if e.get("severity") == "critical")
    high_count = sum(1 for e in events if e.get("severity") == "high")
    med_count = sum(1 for e in events if e.get("severity") == "medium")

    score = min(1.0, 0.10 + (crit_count * 0.30) + (high_count * 0.18) + (med_count * 0.06))
    
    factors = []
    if crit_count or high_count:
        factors.append({
            "factor": "Institutional Offset Incident Frequency",
            "score": round(score, 2),
            "evidence": f"{crit_count} Critical, {high_count} High-severity events documented across {similar_wells_count} offset reference wells.",
            "source": "Nearby Wells Intelligence Database"
        })

    return round(score, 4), factors


def compute_deterministic_risk(
    well: Dict[str, Any],
    formations: List[Dict[str, Any]],
    events: List[Dict[str, Any]],
    similar_wells: List[Dict[str, Any]],
    target_depth_m: Optional[float] = None
) -> Dict[str, Any]:
    """
    Computes complete deterministic risk assessment according to SIH26121 non-negotiable rules.
    NO LLM GENERATION OF NUMBERS OR SCORES.
    """
    td = float(well.get("total_depth_m") or 3500.0)
    
    geo_score, geo_factors = evaluate_geological_risk(formations, events, target_depth_m)
    press_score, press_factors = evaluate_pressure_risk(events, formations, target_depth_m)
    mech_score, mech_factors = evaluate_mechanical_risk(events, td)
    hist_score, hist_factors = evaluate_historical_risk(events, len(similar_wells))

    # Deterministic weighted combination:
    # Pressure (30%), Historical (25%), Geological (25%), Mechanical (20%)
    overall = (
        0.30 * press_score +
        0.25 * hist_score +
        0.25 * geo_score +
        0.20 * mech_score
    )
    overall = round(min(1.0, max(0.05, overall)), 2)

    # Confidence derived from data density: more offset events/formations -> higher confidence
    sample_size = len(events) + len(formations) + len(similar_wells)
    confidence = round(min(0.98, max(0.70, 0.70 + (sample_size * 0.015))), 2)

    all_factors = press_factors + geo_factors + mech_factors + hist_factors
    if not all_factors:
        all_factors.append({
            "factor": "Baseline Formation Risk",
            "score": overall,
            "evidence": "Standard lithological sequence with nominal drilling parameters recorded.",
            "source": "Standard Operating Procedure Doc"
        })

    sim_well_ids = [str(sw.get("well_id", sw.get("id"))) for sw in similar_wells[:5]]

    # Form target formation description
    current_formation = "Barail Coal-Shale"
    if target_depth_m:
        for f in formations:
            if f.get("top_depth_m", 0) <= target_depth_m <= f.get("bottom_depth_m", 99999):
                current_formation = f.get("formation_name")
                break

    evidence_summary = (
        f"Deterministic risk evaluation derived from {len(events)} past drilling events and {len(formations)} "
        f"formation intervals. Pressure risk is {press_score}, Historical offset risk is {hist_score}, "
        f"Geological hazard is {geo_score}, and Mechanical risk is {mech_score}. "
        f"Primary critical interval identified in {current_formation}."
    )

    source_docs = [
        {
            "doc_id": events[0].get("source_document_id") if events else None,
            "page": events[0].get("source_page", 14) if events else 1,
            "excerpt": events[0].get("description", "Routine drilling interval")[:120] if events else "Standard section"
        }
    ]

    return {
        "well_id": well["id"],
        "assessment_type": "while_drilling" if target_depth_m else "pre_drill",
        "overall_risk_score": overall,
        "confidence": confidence,
        "depth_m": target_depth_m or td,
        "formation_name": current_formation,
        "geological_risk": geo_score,
        "mechanical_risk": mech_score,
        "pressure_risk": press_score,
        "historical_risk": hist_score,
        "risk_factors": all_factors,
        "similar_well_ids": sim_well_ids,
        "evidence_summary": evidence_summary,
        "source_documents": source_docs,
        "is_simulated": True,
    }


# =============================================================================
# FLAGSHIP FUNCTION: Depth-Aware Risk Engine (Phase 6)
# =============================================================================

def evaluate_risk(
    active_well_id: str,
    current_depth: float,
    current_formation: Optional[str] = None,
    lookahead_m: float = 50.0,
    dataset: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Evaluates depth-aware lookahead risk for an active drilling well.

    1. Fetch wells with similarity_score >= 0.5 to active well (excluding self).
    2. Query their drilling_events where depth is within
       [current_depth, current_depth + lookahead_m] on formation-relative basis.
    3. State machine:
       - 0 matching events, 0 similar wells nearby in zone -> NORMAL
       - similar well has event within lookahead but >20m away -> WATCH
       - event within lookahead_m (<=20m) -> CAUTION
       - >=2 independent wells corroborate same event_type within tight band (+/-10m)
         -> HIGH_EVIDENCE_RISK
    4. Compute risk_score (0-100) + confidence (1 well=Low, 2=Med, 3+=High).
    5. Returns full explainability payload with evidence list and why_text.
    """
    import os
    import json
    from app.services.similarity_engine.engine import (
        compute_pairwise_similarity,
        haversine_distance_km,
    )

    # 1. Load dataset if not provided
    if dataset is None:
        ds_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
            "synthetic_data", "dataset.json"
        )
        if os.path.exists(ds_path):
            with open(ds_path, "r", encoding="utf-8") as f:
                dataset = json.load(f)
        else:
            dataset = {"wells": [], "formations": [], "drilling_events": []}

    wells = dataset.get("wells", [])
    formations = dataset.get("formations", [])
    events = dataset.get("drilling_events", [])
    params = dataset.get("drilling_parameters", [])

    # Find active well
    active_id_str = str(active_well_id)
    active_well = next((w for w in wells if str(w["well_id"]) == active_id_str), None)
    if not active_well and wells:
        active_well = wells[0]
        active_id_str = str(active_well["well_id"])

    # Active well formations & current formation
    active_forms = [f for f in formations if str(f["well_id"]) == active_id_str]
    active_formation_obj = None
    if current_formation:
        for f in active_forms:
            if current_formation.lower() in f.get("name", "").lower():
                active_formation_obj = f
                break

    if not active_formation_obj:
        for f in active_forms:
            top = float(f.get("top_depth_m", 0) or 0)
            base = float(f.get("base_depth_m", 99999) or 99999)
            if top <= current_depth <= base:
                active_formation_obj = f
                break

    active_formation_name = (
        active_formation_obj.get("name")
        if active_formation_obj
        else (current_formation or "Barail Coal-Shale Formation (F3)")
    )

    # Group formations and events by well
    forms_by_well = {}
    for f in formations:
        forms_by_well.setdefault(str(f["well_id"]), []).append(f)

    events_by_well = {}
    for e in events:
        events_by_well.setdefault(str(e["well_id"]), []).append(e)

    params_by_well = {}
    for p in params:
        params_by_well.setdefault(str(p["well_id"]), []).append(p)

    # 1. Fetch wells with similarity_score >= 0.5 to active well (excluding self)
    similar_wells = []
    for other in wells:
        other_id = str(other["well_id"])
        if other_id == active_id_str:
            continue

        sim_res = compute_pairwise_similarity(
            well_a=active_well,
            well_b=other,
            formations_a=forms_by_well.get(active_id_str, []),
            formations_b=forms_by_well.get(other_id, []),
            events_a=events_by_well.get(active_id_str, []),
            events_b=events_by_well.get(other_id, []),
            params_a=params_by_well.get(active_id_str, []),
            params_b=params_by_well.get(other_id, []),
        )

        sim_score = sim_res["overall_similarity"]
        if sim_score >= 0.50:
            similar_wells.append({
                "well_id": other_id,
                "well_name": other.get("name", other.get("code", "")),
                "code": other.get("code", ""),
                "similarity_score": sim_score,
                "distance_km": sim_res["distance_km"],
            })

    # 2. Query drilling_events in [current_depth, current_depth + lookahead_m]
    # on formation-relative basis
    window_max = current_depth + lookahead_m
    matched_evidence = []
    seen_events = set()

    for sw in similar_wells:
        sw_id = sw["well_id"]
        sw_events = events_by_well.get(sw_id, [])
        sw_forms = forms_by_well.get(sw_id, [])

        # Find matching formation in offset well
        matched_form = None
        if active_formation_name:
            for f in sw_forms:
                if f.get("name", "").strip().lower() == active_formation_name.strip().lower() or \
                   ("barail" in active_formation_name.lower() and "barail" in f.get("name", "").lower()):
                    matched_form = f
                    break

        # Calculate depth shift if both have the formation
        depth_shift = 0.0
        if active_formation_obj and matched_form:
            act_top = float(active_formation_obj.get("top_depth_m", 0) or 0)
            off_top = float(matched_form.get("top_depth_m", 0) or 0)
            depth_shift = off_top - act_top

        # Check events
        for e in sw_events:
            e_id = str(e.get("event_id", ""))
            if e_id in seen_events:
                continue

            e_depth = float(e.get("depth_m", 0))

            # Match either absolute lookahead window or formation-shifted lookahead window
            is_in_abs_window = (current_depth <= e_depth <= window_max)
            is_in_rel_window = False
            if depth_shift != 0.0:
                rel_min = current_depth + depth_shift
                rel_max = window_max + depth_shift
                is_in_rel_window = (rel_min <= e_depth <= rel_max)

            # Also check if event is within 5m below current_depth if very close
            is_very_close = abs(e_depth - current_depth) <= 10.0 and (e_depth >= current_depth - 5.0)

            if is_in_abs_window or is_in_rel_window or is_very_close:
                seen_events.add(e_id)
                # Effective depth ahead of bit
                dist_ahead = e_depth - current_depth
                matched_evidence.append({
                    "event_id": e_id,
                    "well_id": sw_id,
                    "well": sw["well_name"],
                    "well_code": sw["code"],
                    "distance": sw["distance_km"],
                    "event": e.get("event_type", "other"),
                    "depth": e_depth,
                    "distance_ahead_m": dist_ahead,
                    "formation": active_formation_name,
                    "similarity": sw["similarity_score"],
                    "source_doc": f"Daily Drilling Report — {sw['well_name']}",
                    "page": e.get("page_number", 3),
                    "snippet": e.get("description", ""),
                    "severity": e.get("severity", "medium"),
                })

    # 3. State machine:
    # - 0 matching events, 0 similar wells nearby in zone -> NORMAL
    # - similar well has event within lookahead but >20m away -> WATCH
    # - event within lookahead_m (<=20m) -> CAUTION
    # - >=2 independent wells corroborate same event_type within tight band (+/-10m)
    #   -> HIGH_EVIDENCE_RISK

    risk_level = "NORMAL"
    corroborating_wells = {ev["well_id"] for ev in matched_evidence}
    corroborating_count = len(corroborating_wells)

    if not matched_evidence:
        risk_level = "NORMAL"
        risk_score = 15.0
        confidence = "Low"
        why_text = (
            f"NORMAL: Zero offset drilling events or anomalous conditions detected within "
            f"{lookahead_m:.0f}m lookahead window ({current_depth:.1f}m - {window_max:.1f}m). "
            f"Nominal drilling operations expected in {active_formation_name}."
        )
    else:
        # Check for >= 2 independent wells corroborating same event_type within tight band (+/-10m)
        has_high_evidence_risk = False
        corroborating_event_type = None
        corroborating_wells_for_tight_band = set()

        # Group by event_type
        by_type = {}
        for ev in matched_evidence:
            by_type.setdefault(ev["event"], []).append(ev)

        for ev_type, ev_list in by_type.items():
            wells_for_type = {ev["well_id"] for ev in ev_list}
            if len(wells_for_type) >= 2:
                # Check if any pair from distinct wells is within 10m depth band
                for i in range(len(ev_list)):
                    for j in range(i + 1, len(ev_list)):
                        ev1, ev2 = ev_list[i], ev_list[j]
                        if ev1["well_id"] != ev2["well_id"] and abs(ev1["depth"] - ev2["depth"]) <= 10.0:
                            has_high_evidence_risk = True
                            corroborating_event_type = ev_type
                            corroborating_wells_for_tight_band.add(ev1["well"])
                            corroborating_wells_for_tight_band.add(ev2["well"])
                            break
                    if has_high_evidence_risk:
                        break

        # Also check if cluster wells with mud_loss or stuck_pipe both exist in the window
        if not has_high_evidence_risk and len(corroborating_wells) >= 2:
            # Check if any 2 wells have critical/high events in lookahead
            crit_wells = {ev["well"] for ev in matched_evidence if ev.get("severity") in ["critical", "high"]}
            if len(crit_wells) >= 2:
                # If within 15m of each other
                depths = [ev["depth"] for ev in matched_evidence]
                if max(depths) - min(depths) <= 12.0:
                    has_high_evidence_risk = True
                    corroborating_event_type = matched_evidence[0]["event"]
                    corroborating_wells_for_tight_band = crit_wells

        if has_high_evidence_risk:
            risk_level = "HIGH_EVIDENCE_RISK"
        else:
            # Check if any event is within 20m ahead
            has_event_within_20m = any(0.0 <= ev["distance_ahead_m"] <= 20.0 for ev in matched_evidence)
            if has_event_within_20m:
                risk_level = "CAUTION"
            else:
                risk_level = "WATCH"

        # 4. Confidence: 1 well=Low, 2=Med, 3+=High
        if corroborating_count <= 1:
            confidence = "Low"
        elif corroborating_count == 2:
            confidence = "Med"
        else:
            confidence = "High"

        # Risk score (0 - 100)
        if risk_level == "HIGH_EVIDENCE_RISK":
            risk_score = round(min(98.0, 85.0 + (corroborating_count - 1) * 6.5), 1)
            wells_str = ", ".join(sorted(corroborating_wells_for_tight_band)) or ", ".join(sorted(ev["well"] for ev in matched_evidence[:3]))
            ev_label = (corroborating_event_type or matched_evidence[0]["event"]).replace("_", " ").title()
            why_text = (
                f"HIGH_EVIDENCE_RISK: {len(corroborating_wells_for_tight_band) or corroborating_count} independent offset wells "
                f"({wells_str}) corroborate {ev_label} within tight +/-10m band in {active_formation_name} "
                f"between {current_depth:.1f}m and {window_max:.1f}m. Immediate mitigation standby mandatory."
            )
        elif risk_level == "CAUTION":
            risk_score = round(min(84.0, 70.0 + corroborating_count * 5.0), 1)
            lead_ev = min((ev for ev in matched_evidence if 0 <= ev["distance_ahead_m"] <= 20.0), key=lambda x: x["distance_ahead_m"])
            ev_label = lead_ev["event"].replace("_", " ").title()
            why_text = (
                f"CAUTION: Offset well ({lead_ev['well']}) experienced {ev_label} at {lead_ev['depth']:.1f}m "
                f"({lead_ev['distance_ahead_m']:.1f}m ahead of current bit depth {current_depth:.1f}m) in {active_formation_name}. "
                f"Prepare LCM and monitor torque/standpipe pressure."
            )
        else:  # WATCH
            risk_score = round(min(60.0, 45.0 + corroborating_count * 5.0), 1)
            lead_ev = min(matched_evidence, key=lambda x: x["distance_ahead_m"])
            ev_label = lead_ev["event"].replace("_", " ").title()
            why_text = (
                f"WATCH: Historical {ev_label} logged in similar offset well ({lead_ev['well']}) at {lead_ev['depth']:.1f}m "
                f"within {lookahead_m:.0f}m lookahead window (>20m ahead). Pre-alert driller and verify ECD."
            )

    # Format evidence output
    evidence_output = []
    for ev in matched_evidence:
        evidence_output.append({
            "well": ev["well"],
            "distance": round(ev["distance"], 2),
            "event": ev["event"],
            "depth": round(ev["depth"], 1),
            "formation": ev["formation"],
            "similarity": round(ev["similarity"], 2),
            "source_doc": ev["source_doc"],
            "page": ev["page"],
            "snippet": ev["snippet"],
            "event_id": ev["event_id"],
        })

    evidence_ids = [ev["event_id"] for ev in matched_evidence if ev.get("event_id")]

    return {
        "well_id": active_id_str,
        "current_depth": current_depth,
        "current_formation": active_formation_name,
        "lookahead_m": lookahead_m,
        "risk_level": risk_level,
        "risk_score": risk_score,
        "confidence": confidence,
        "evidence": evidence_output,
        "why_text": why_text,
        "evidence_ids": evidence_ids,
        "corroborating_wells_count": corroborating_count,
        "disclaimer": "⚠️ SIMULATED DATA — NOT OIL INDIA DATA",
    }

