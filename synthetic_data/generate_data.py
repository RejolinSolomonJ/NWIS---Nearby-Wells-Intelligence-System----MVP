"""
NWIS-X Synthetic Data Generator
Generates realistic, geologically sound synthetic drilling data for the Assam-Arakan Basin:
- 50+ Wells (Nahorkatiya, Moran, Digboi, Jorhat, Kumchai, Baghjan, Barekuri fields)
- Formations with realistic depths (Dihing, Tipam, Girujan, Barail, Kopili, Sylhet)
- 200+ Drilling events (kicks, stuck pipe, lost circulation, gas shows)
- Synthetic document records and chunks with 384-dim mock embeddings
- Deterministic risk assessments with transparent evidence trails
- High-priority drilling warning alerts

Outputs:
1. `database/seed.sql`
2. `synthetic_data/simulated_dataset.json`
"""

import json
import math
import os
import random
import uuid
from datetime import datetime, timedelta, timezone

# Ensure deterministic generation
random.seed(42)

FIELDS = [
    {"name": "Nahorkatiya", "lat_center": 27.28, "lon_center": 95.34, "block": "Block NHK-A"},
    {"name": "Moran", "lat_center": 27.18, "lon_center": 94.92, "block": "Block MRN-B"},
    {"name": "Digboi", "lat_center": 27.38, "lon_center": 95.63, "block": "Block DGB-C"},
    {"name": "Baghjan", "lat_center": 27.59, "lon_center": 95.37, "block": "Block BGJ-A"},
    {"name": "Barekuri", "lat_center": 27.52, "lon_center": 95.42, "block": "Block BRK-B"},
    {"name": "Kumchai", "lat_center": 27.35, "lon_center": 95.92, "block": "Block KMC-D"},
    {"name": "Jorhat", "lat_center": 26.75, "lon_center": 94.22, "block": "Block JRT-A"},
]

FORMATIONS_TEMPLATE = [
    {"name": "Alluvium / Dihing", "lithology": "Unconsolidated sand, gravel, clay", "age": "Pleistocene", "fluid": "freshwater", "risk_kick": 0.05, "risk_loss": 0.35, "thickness": (300, 500)},
    {"name": "Girujan Clay", "lithology": "Mottled claystone with minor siltstone", "age": "Miocene", "fluid": "water", "risk_kick": 0.10, "risk_loss": 0.15, "thickness": (400, 700)},
    {"name": "Tipam Sandstone", "lithology": "Coarse to medium grained sandstone", "age": "Miocene", "fluid": "oil", "risk_kick": 0.40, "risk_loss": 0.45, "thickness": (600, 900)},
    {"name": "Bokabil Formation", "lithology": "Alternating shale, siltstone, sandstone", "age": "Early Miocene", "fluid": "gas", "risk_kick": 0.50, "risk_loss": 0.25, "thickness": (400, 600)},
    {"name": "Barail Coal-Shale", "lithology": "Carbonaceous shale, coal seams, sandstone", "age": "Oligocene", "fluid": "oil/gas", "risk_kick": 0.75, "risk_loss": 0.60, "thickness": (450, 750)},
    {"name": "Kopili Formation", "lithology": "Splintery dark grey shale, calcareous silt", "age": "Late Eocene", "fluid": "gas", "risk_kick": 0.70, "risk_loss": 0.50, "thickness": (350, 550)},
    {"name": "Sylhet Limestone", "lithology": "Fossiliferous hard limestone with vugs", "age": "Early-Mid Eocene", "fluid": "oil/gas", "risk_kick": 0.85, "risk_loss": 0.80, "thickness": (300, 500)},
    {"name": "Basement Complex", "lithology": "Granitic gneiss / quartzite", "age": "Precambrian", "fluid": "dry", "risk_kick": 0.05, "risk_loss": 0.20, "thickness": (200, 400)},
]

EVENT_PROFILES = [
    {
        "type": "kick",
        "severities": ["medium", "high", "critical"],
        "desc_tpl": "Unexpected influx of high-pressure formation gas/oil while drilling through {formation} at {depth}m. Pit volume gain of {gain} bbls observed within 8 minutes. SIDPP reached {sidpp} psi.",
        "root_tpl": "Encountered undercompacted overpressured sand lens; mud weight of {mw} ppg was insufficient against pore pressure gradient {ppg_grad} ppg equivalent.",
        "action_tpl": "Immediate shut-in via annular BOP. Circulated out kick using Wait & Weight method. Weighted up drilling mud from {mw} ppg to {new_mw} ppg with barite.",
        "formations": ["Barail Coal-Shale", "Kopili Formation", "Sylhet Limestone", "Bokabil Formation"],
        "cost_range": (35000, 180000),
        "npt_range": (14.0, 72.0)
    },
    {
        "type": "lost_circulation",
        "severities": ["medium", "high", "critical"],
        "desc_tpl": "Severe lost circulation encountered at {depth}m in {formation}. Dynamic mud loss rate exceeded {loss_rate} bbl/hr. Total pit volume drop of {loss_total} bbls.",
        "root_tpl": "Induced hydraulic fracturing in vuggy fractured carbonate matrix exceeding the rock fracture gradient (estimated {frac_grad} ppg EMW).",
        "action_tpl": "Stopped drilling, pulled back 3 stands off bottom. Pumped 60 bbl LCM pill containing coarse nut-plug, mica, and fibrous sealants. Monitored static wellbore.",
        "formations": ["Sylhet Limestone", "Tipam Sandstone", "Alluvium / Dihing"],
        "cost_range": (25000, 120000),
        "npt_range": (10.0, 48.0)
    },
    {
        "type": "stuck_pipe",
        "severities": ["high", "critical"],
        "desc_tpl": "Differential stuck pipe incident occurred during connection at {depth}m while traversing {formation}. Overpull reached {overpull} klbs with zero pipe rotation.",
        "root_tpl": "High differential pressure ({diff_psi} psi) across thick permeable sandstone filter cake coupled with prolonged static pipe duration during survey.",
        "action_tpl": "Spotted 40 bbl oil-based lubricating / freeing pill around BHA. Worked string with maximum allowable torque and jarred downward for {jar_hrs} hrs until string freed.",
        "formations": ["Tipam Sandstone", "Barail Coal-Shale"],
        "cost_range": (45000, 220000),
        "npt_range": (20.0, 96.0)
    },
    {
        "type": "gas_show",
        "severities": ["low", "medium"],
        "desc_tpl": "Elevated background gas show of {gas_units} units (C1 to C4 chromatograph breakdown) recorded in mud logging unit at {depth}m in {formation}.",
        "root_tpl": "Penetrating hydrocarbon-bearing transition zone with gas-cut mud reducing density from {mw} ppg to {cut_mw} ppg at shaker.",
        "action_tpl": "Flow checked well for 15 minutes; well static. Increased degasser run speed and conditioned mud system to maintain uniform bottom hole pressure.",
        "formations": ["Bokabil Formation", "Barail Coal-Shale", "Kopili Formation"],
        "cost_range": (5000, 20000),
        "npt_range": (2.0, 8.0)
    },
    {
        "type": "wellbore_instability",
        "severities": ["medium", "high"],
        "desc_tpl": "Severe tight hole and sloughing shale cavings observed at shaker screen while reaming {formation} at {depth}m. Torque fluctuations up to {torque} ft-lbs.",
        "root_tpl": "Reactive smectite/illite shale hydration and tectonic stress anisotropy causing compressive shear failure of borehole wall.",
        "action_tpl": "Added glycol shale inhibitor and PAC-LV polymers to fluid system. Increased mud weight by 0.6 ppg to provide mechanical borehole support.",
        "formations": ["Girujan Clay", "Kopili Formation", "Barail Coal-Shale"],
        "cost_range": (18000, 65000),
        "npt_range": (8.0, 30.0)
    },
]

def generate_mock_embedding(seed_str: str, dim: int = 384) -> list[float]:
    """Generate deterministic normalized vector of size 384."""
    rng = random.Random(seed_str)
    raw = [rng.gauss(0, 1) for _ in range(dim)]
    norm = math.sqrt(sum(x * x for x in raw)) or 1.0
    return [round(x / norm, 6) for x in raw]

def escape_sql(val) -> str:
    if val is None:
        return "NULL"
    if isinstance(val, (int, float)):
        return str(val)
    if isinstance(val, bool):
        return "TRUE" if val else "FALSE"
    if isinstance(val, (dict, list)):
        return "'" + json.dumps(val).replace("'", "''") + "'::jsonb"
    s = str(val).replace("'", "''")
    return f"'{s}'"

def run_generator():
    wells = []
    formations = []
    events = []
    documents = []
    chunks = []
    risk_assessments = []
    alerts = []
    
    well_count = 55
    total_events_target = 230
    
    well_id_codes = []
    for i in range(1, well_count + 1):
        f = FIELDS[(i - 1) % len(FIELDS)]
        prefix = f["name"][:3].upper()
        code = f"{prefix}-{100 + i}"
        well_id_codes.append((code, f))

    base_time = datetime(2023, 1, 15, tzinfo=timezone.utc)

    # 1. Create Wells
    for idx, (code, field_info) in enumerate(well_id_codes):
        well_uuid = str(uuid.uuid4())
        lat_jitter = random.uniform(-0.06, 0.06)
        lon_jitter = random.uniform(-0.06, 0.06)
        lat = round(field_info["lat_center"] + lat_jitter, 5)
        lon = round(field_info["lon_center"] + lon_jitter, 5)
        
        target_td = round(random.uniform(3200, 4600), 1)
        spud = base_time + timedelta(days=idx * 14 + random.randint(0, 5))
        duration = random.randint(60, 120)
        completion = spud + timedelta(days=duration) if idx < 45 else None
        status = "completed" if completion else ("drilling" if idx < 52 else "suspended")
        
        well = {
            "id": well_uuid,
            "well_name": f"{field_info['name']} Well {code}",
            "well_id_code": code,
            "field_name": field_info["name"],
            "block_name": field_info["block"],
            "operator": "Oil India Ltd (Simulated)",
            "well_type": random.choice(["exploration", "development", "appraisal"]),
            "status": status,
            "spud_date": spud.isoformat(),
            "completion_date": completion.isoformat() if completion else None,
            "total_depth_m": target_td,
            "latitude": lat,
            "longitude": lon,
            "elevation_m": round(random.uniform(95.0, 150.0), 1),
            "kelly_bushing_m": round(random.uniform(9.0, 12.5), 1),
            "metadata_json": {
                "rig_name": f"OIL-Rig-{random.randint(1, 12)}",
                "target_reservoir": "Barail / Tipam Sandstone",
                "casing_program": "30in CP, 20in CSG @ 450m, 13-3/8in CSG @ 1650m, 9-5/8in CSG @ 3400m, 7in Liner @ TD"
            },
            "is_simulated": True
        }
        wells.append(well)
        
        # 2. Create Formations for this well
        curr_top = 0.0
        for form_tmpl in FORMATIONS_TEMPLATE:
            thick = random.uniform(*form_tmpl["thickness"])
            bottom = min(target_td, round(curr_top + thick, 1))
            if curr_top >= target_td:
                break
            
            form_uuid = str(uuid.uuid4())
            porosity = round(random.uniform(12.0, 26.0), 1) if "sandstone" in form_tmpl["lithology"].lower() or "limestone" in form_tmpl["lithology"].lower() else round(random.uniform(2.0, 8.0), 1)
            perm = round(random.uniform(20.0, 450.0), 1) if porosity > 15 else round(random.uniform(0.1, 5.0), 2)
            pres = round((bottom * 0.1) * random.uniform(1.05, 1.45), 1) # bar approx to psi * 14.5
            pres_psi = round(pres * 14.5, 0)
            temp = round(25.0 + (bottom / 100.0) * 2.8, 1) # geothermal gradient ~2.8C/100m
            
            formations.append({
                "id": form_uuid,
                "well_id": well_uuid,
                "formation_name": form_tmpl["name"],
                "top_depth_m": curr_top,
                "bottom_depth_m": bottom,
                "lithology": form_tmpl["lithology"],
                "age": form_tmpl["age"],
                "porosity_pct": porosity,
                "permeability_md": perm,
                "pressure_psi": pres_psi,
                "temperature_c": temp,
                "fluid_type": form_tmpl["fluid"],
                "remarks": f"Simulated geological markers for {form_tmpl['name']} in {well['well_name']}.",
                "is_simulated": True
            })
            curr_top = bottom

        # 3. Create Well Documents
        doc_uuid = str(uuid.uuid4())
        doc_title = f"{code} Well Completion & Post-Drilling Geological Report"
        doc = {
            "id": doc_uuid,
            "well_id": well_uuid,
            "title": doc_title,
            "doc_type": "well_completion_report",
            "file_path": f"/reports/{code}_completion_report_simulated.pdf",
            "page_count": random.randint(18, 45),
            "ocr_status": "completed",
            "extraction_status": "completed",
            "metadata_json": {
                "author": "OIL Geological & Drilling Division (Simulated)",
                "classification": "Synthetic Research Dataset"
            },
            "is_simulated": True
        }
        documents.append(doc)

        # Chunks for document
        chunk_snippets = [
            f"Executive Summary for Well {code}: Spudded on {spud.strftime('%Y-%m-%d')}, reached total depth of {target_td}m in {field_info['name']} field.",
            f"Lithological intervals: Tipam formation exhibited hydrocarbon saturation between 2100m and 2750m. Overpressure encountered in Barail sequence.",
            f"Drilling Incident Record: Kick and loss mitigation records analyzed. Managed pressure drilling parameters logged across pages 12-24.",
            f"Casing and cementing integrity evaluation: TOC confirmed at designed depths with ultrasonic cement bond logs.",
        ]
        for c_idx, snippet in enumerate(chunk_snippets):
            chunks.append({
                "id": str(uuid.uuid4()),
                "document_id": doc_uuid,
                "chunk_index": c_idx,
                "page_number": c_idx * 4 + 1,
                "content": snippet,
                "embedding": generate_mock_embedding(f"{code}_{c_idx}"),
                "metadata_json": {"source": "reportlab_simulated"},
            })

    # 4. Create Drilling Events (target ~230)
    for well in wells:
        well_id = well["id"]
        well_formations = [f for f in formations if f["well_id"] == well_id]
        event_count_for_well = random.randint(3, 6)
        
        for _ in range(event_count_for_well):
            profile = random.choice(EVENT_PROFILES)
            # pick matching formation or random formation
            matching_forms = [f for f in well_formations if any(p_f in f["formation_name"] for p_f in profile["formations"])]
            target_form = random.choice(matching_forms) if matching_forms else random.choice(well_formations)
            
            depth = round(random.uniform(target_form["top_depth_m"] + 10, target_form["bottom_depth_m"] - 10), 1)
            severity = random.choice(profile["severities"])
            mw = round(random.uniform(9.5, 12.8), 2)
            npt = round(random.uniform(*profile["npt_range"]), 1)
            cost = round(random.uniform(*profile["cost_range"]), 2)
            
            desc = profile["desc_tpl"].format(
                formation=target_form["formation_name"],
                depth=depth,
                gain=random.randint(12, 45),
                sidpp=random.randint(250, 780),
                loss_rate=random.randint(40, 160),
                loss_total=random.randint(180, 520),
                overpull=random.randint(80, 160),
                gas_units=random.randint(350, 2400),
                torque=random.randint(18000, 32000)
            )
            root = profile["root_tpl"].format(
                formation=target_form["formation_name"],
                depth=depth,
                mw=mw,
                cut_mw=round(mw - random.uniform(0.4, 0.9), 2),
                ppg_grad=round(mw + random.uniform(0.8, 1.8), 2),
                frac_grad=round(mw + random.uniform(0.5, 1.2), 2),
                diff_psi=random.randint(800, 1900)
            )
            action = profile["action_tpl"].format(
                mw=mw,
                new_mw=round(mw + random.uniform(0.8, 1.6), 2),
                jar_hrs=round(random.uniform(4.0, 16.0), 1)
            )
            
            well_docs = [d for d in documents if d["well_id"] == well_id]
            doc_id = well_docs[0]["id"] if well_docs else None
            page = random.randint(4, 25)

            events.append({
                "id": str(uuid.uuid4()),
                "well_id": well_id,
                "event_type": profile["type"],
                "severity": severity,
                "depth_m": depth,
                "depth_end_m": round(depth + random.uniform(5, 40), 1) if random.random() > 0.6 else None,
                "formation_name": target_form["formation_name"],
                "event_date": well["spud_date"],
                "duration_hours": npt,
                "description": desc,
                "root_cause": root,
                "action_taken": action,
                "mud_weight_ppg": mw,
                "mud_type": "Water-Based Potassium Chloride Polymer Mud",
                "npt_hours": npt,
                "cost_usd": cost,
                "source_document_id": doc_id,
                "source_page": page,
                "metadata_json": {
                    "tool_string": "12-1/4in PDC Bit + Motor + RSS + MWD/LWD",
                    "casing_shoe_depth_m": round(depth * 0.7, 1)
                },
                "is_simulated": True
            })

    # 5. Deterministic Risk Assessment & Alerts for each well
    for well in wells:
        well_id = well["id"]
        w_events = [e for e in events if e["well_id"] == well_id]
        
        # Calculate deterministic component scores:
        crit_count = sum(1 for e in w_events if e["severity"] == "critical")
        high_count = sum(1 for e in w_events if e["severity"] == "high")
        med_count = sum(1 for e in w_events if e["severity"] == "medium")
        
        geo_risk = round(min(1.0, 0.25 + 0.15 * len([e for e in w_events if e["event_type"] in ["wellbore_instability", "gas_show"]])), 2)
        mech_risk = round(min(1.0, 0.20 + 0.25 * len([e for e in w_events if e["event_type"] in ["stuck_pipe"]])), 2)
        press_risk = round(min(1.0, 0.30 + 0.22 * len([e for e in w_events if e["event_type"] in ["kick", "lost_circulation"]])), 2)
        hist_risk = round(min(1.0, (crit_count * 0.35 + high_count * 0.20 + med_count * 0.08)), 2)
        
        overall = round(0.30 * press_risk + 0.25 * hist_risk + 0.25 * geo_risk + 0.20 * mech_risk, 2)
        confidence = round(0.85 + 0.02 * min(5, len(w_events)), 2)

        # Find 3 nearby offset wells
        other_wells = [ow for ow in wells if ow["id"] != well_id and ow["field_name"] == well["field_name"]]
        sim_ids = [ow["id"] for ow in other_wells[:3]]

        risk_factors = [
            {"factor": "Abnormal Pore Pressure Gradient", "score": press_risk, "evidence": f"{len([e for e in w_events if e['event_type'] == 'kick'])} kicks recorded in Barail/Kopili formations.", "source": f"{well['well_id_code']} End of Well Report Page 14"},
            {"factor": "Shale Instability & Sloughing", "score": geo_risk, "evidence": "High smectite clay swelling leading to tight hole.", "source": f"{well['well_id_code']} Mud Logging Log Page 8"},
            {"factor": "Differential Sticking Probability", "score": mech_risk, "evidence": "Permeable Tipam sandstone section with >1000 psi overbalance.", "source": f"{well['well_id_code']} Drillers Log Page 22"},
            {"factor": "Historical Offset Incidents", "score": hist_risk, "evidence": f"Total {len(w_events)} drilling incidents logged in offset well records.", "source": "OIL Institutional Memory Archive"}
        ]

        well_docs = [d for d in documents if d["well_id"] == well_id]
        doc_id = well_docs[0]["id"] if well_docs else None

        risk_assessments.append({
            "id": str(uuid.uuid4()),
            "well_id": well_id,
            "assessment_type": "while_drilling",
            "overall_risk_score": overall,
            "confidence": confidence,
            "depth_m": well["total_depth_m"],
            "formation_name": "Barail Coal-Shale",
            "geological_risk": geo_risk,
            "mechanical_risk": mech_risk,
            "pressure_risk": press_risk,
            "historical_risk": hist_risk,
            "risk_factors": risk_factors,
            "similar_well_ids": sim_ids,
            "evidence_summary": f"Deterministic risk evaluation derived from {len(w_events)} offset events in {well['field_name']} field. Highest vulnerability lies in narrow mud window across Barail Coal-Shale.",
            "source_documents": [{"doc_id": doc_id, "page": 14, "excerpt": "Overpressure kick observed requiring 1.2 ppg kill weight increase."}],
            "is_simulated": True
        })

        # Generate Alert if overall risk > 0.50 or critical event exists
        if overall >= 0.52 or crit_count > 0:
            crit_e = next((e for e in w_events if e["severity"] in ["critical", "high"]), None)
            alert_depth = crit_e["depth_m"] if crit_e else 2850.0
            alert_form = crit_e["formation_name"] if crit_e else "Barail Coal-Shale"
            alert_sev = "critical" if (overall >= 0.70 or crit_count > 0) else "warning"
            
            alerts.append({
                "id": str(uuid.uuid4()),
                "well_id": well_id,
                "alert_type": "risk_threshold",
                "severity": alert_sev,
                "title": f"EARLY WARNING: High {crit_e['event_type'].replace('_', ' ').title() if crit_e else 'Pore Pressure'} Risk in {alert_form}",
                "message": f"Deterministic model detected high danger zone at {alert_depth}m based on {len(sim_ids)} adjacent offset wells.",
                "why": f"Offset wells within 4.8 km in {well['field_name']} suffered severe {crit_e['event_type'] if crit_e else 'kick'} incidents at this exact formation depth due to sudden pore pressure influx.",
                "related_well_ids": sim_ids,
                "depth_m": alert_depth,
                "formation_name": alert_form,
                "evidence": [
                    {
                        "type": "offset_drilling_incident",
                        "description": crit_e["description"] if crit_e else "Kick event with 25 bbl pit gain requiring shut-in.",
                        "source_doc": f"{well['well_id_code']} Geological Report",
                        "page": 16
                    }
                ],
                "source_document_id": doc_id,
                "source_page": 16,
                "similarity_score": round(random.uniform(0.82, 0.96), 2),
                "confidence": confidence,
                "is_read": False,
                "is_acknowledged": False,
                "is_simulated": True
            })

    print(f"Generated: {len(wells)} Wells, {len(formations)} Formations, {len(events)} Events, {len(documents)} Docs, {len(chunks)} Chunks, {len(risk_assessments)} Risks, {len(alerts)} Alerts.")

    # Write JSON bundle
    json_path = os.path.join(os.path.dirname(__file__), "simulated_dataset.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump({
            "disclaimer": "SYNTHETIC SIMULATED DATA ONLY - NO OIL INDIA PROPRIETARY DATA",
            "wells": wells,
            "formations": formations,
            "drilling_events": events,
            "documents": documents,
            "document_chunks": chunks,
            "risk_assessments": risk_assessments,
            "alerts": alerts
        }, f, indent=2)
    print(f"Wrote simulated dataset to {json_path}")

    # Write SQL Seed
    sql_path = os.path.join(os.path.dirname(__file__), "..", "database", "seed.sql")
    with open(sql_path, "w", encoding="utf-8") as f:
        f.write("-- ==============================================================================\n")
        f.write("-- NWIS-X Seed Data (SIMULATED DATA ONLY)\n")
        f.write("-- Generated for SIH26121 - Oil India Ltd Demonstration\n")
        f.write("-- ==============================================================================\n\n")

        # Insert Default Users
        f.write("-- Default Users (password: 'Drilling@2026')\n")
        f.write("INSERT INTO users (id, username, email, hashed_password, full_name, role, is_active) VALUES\n")
        # bcrypt hash for "Drilling@2026"
        pwd_hash = "$2b$12$K1r6KqY8H77lXp7sE5t7O.uNn79H5Jb0w7x6eXy/9.13dK0K1b1G6"
        f.write(f"  ('{uuid.uuid4()}', 'admin', 'admin@oilindia-simulated.in', '{pwd_hash}', 'Senior Drilling Superintendent', 'admin', TRUE),\n")
        f.write(f"  ('{uuid.uuid4()}', 'engineer', 'engineer@oilindia-simulated.in', '{pwd_hash}', 'Operations Geologist', 'engineer', TRUE),\n")
        f.write(f"  ('{uuid.uuid4()}', 'viewer', 'viewer@oilindia-simulated.in', '{pwd_hash}', 'Rig HSE Officer', 'viewer', TRUE)\n")
        f.write("ON CONFLICT (username) DO NOTHING;\n\n")

        # Insert Wells
        f.write("-- Wells (50+)\n")
        f.write("INSERT INTO wells (id, well_name, well_id_code, field_name, block_name, operator, well_type, status, spud_date, completion_date, total_depth_m, latitude, longitude, geom, elevation_m, kelly_bushing_m, metadata_json, is_simulated) VALUES\n")
        well_lines = []
        for w in wells:
            w_geom = f"ST_SetSRID(ST_MakePoint({w['longitude']}, {w['latitude']}), 4326)"
            well_lines.append(
                f"  ('{w['id']}', {escape_sql(w['well_name'])}, {escape_sql(w['well_id_code'])}, {escape_sql(w['field_name'])}, {escape_sql(w['block_name'])}, {escape_sql(w['operator'])}, {escape_sql(w['well_type'])}, {escape_sql(w['status'])}, {escape_sql(w['spud_date'])}, {escape_sql(w['completion_date'])}, {escape_sql(w['total_depth_m'])}, {w['latitude']}, {w['longitude']}, {w_geom}, {escape_sql(w['elevation_m'])}, {escape_sql(w['kelly_bushing_m'])}, {escape_sql(w['metadata_json'])}, TRUE)"
            )
        f.write(",\n".join(well_lines) + ";\n\n")

        # Insert Formations
        f.write("-- Formations\n")
        f.write("INSERT INTO formations (id, well_id, formation_name, top_depth_m, bottom_depth_m, lithology, age, porosity_pct, permeability_md, pressure_psi, temperature_c, fluid_type, remarks, is_simulated) VALUES\n")
        form_lines = []
        for form in formations:
            form_lines.append(
                f"  ('{form['id']}', '{form['well_id']}', {escape_sql(form['formation_name'])}, {form['top_depth_m']}, {form['bottom_depth_m']}, {escape_sql(form['lithology'])}, {escape_sql(form['age'])}, {escape_sql(form['porosity_pct'])}, {escape_sql(form['permeability_md'])}, {escape_sql(form['pressure_psi'])}, {escape_sql(form['temperature_c'])}, {escape_sql(form['fluid_type'])}, {escape_sql(form['remarks'])}, TRUE)"
            )
        f.write(",\n".join(form_lines) + ";\n\n")

        # Insert Documents
        f.write("-- Documents\n")
        f.write("INSERT INTO documents (id, well_id, title, doc_type, file_path, page_count, ocr_status, extraction_status, metadata_json, is_simulated) VALUES\n")
        doc_lines = []
        for d in documents:
            doc_lines.append(
                f"  ('{d['id']}', '{d['well_id']}', {escape_sql(d['title'])}, {escape_sql(d['doc_type'])}, {escape_sql(d['file_path'])}, {d['page_count']}, {escape_sql(d['ocr_status'])}, {escape_sql(d['extraction_status'])}, {escape_sql(d['metadata_json'])}, TRUE)"
            )
        f.write(",\n".join(doc_lines) + ";\n\n")

        # Insert Chunks
        f.write("-- Document Chunks with Vector Embeddings\n")
        f.write("INSERT INTO document_chunks (id, document_id, chunk_index, page_number, content, embedding, metadata_json) VALUES\n")
        chunk_lines = []
        for c in chunks:
            vec_str = "'[" + ",".join(str(x) for x in c['embedding']) + "]'::vector"
            chunk_lines.append(
                f"  ('{c['id']}', '{c['document_id']}', {c['chunk_index']}, {c['page_number']}, {escape_sql(c['content'])}, {vec_str}, {escape_sql(c['metadata_json'])})"
            )
        f.write(",\n".join(chunk_lines) + ";\n\n")

        # Insert Drilling Events
        f.write("-- Drilling Events (200+)\n")
        f.write("INSERT INTO drilling_events (id, well_id, event_type, severity, depth_m, depth_end_m, formation_name, event_date, duration_hours, description, root_cause, action_taken, mud_weight_ppg, mud_type, npt_hours, cost_usd, source_document_id, source_page, metadata_json, is_simulated) VALUES\n")
        event_lines = []
        for e in events:
            event_lines.append(
                f"  ('{e['id']}', '{e['well_id']}', {escape_sql(e['event_type'])}, {escape_sql(e['severity'])}, {e['depth_m']}, {escape_sql(e['depth_end_m'])}, {escape_sql(e['formation_name'])}, {escape_sql(e['event_date'])}, {escape_sql(e['duration_hours'])}, {escape_sql(e['description'])}, {escape_sql(e['root_cause'])}, {escape_sql(e['action_taken'])}, {escape_sql(e['mud_weight_ppg'])}, {escape_sql(e['mud_type'])}, {escape_sql(e['npt_hours'])}, {escape_sql(e['cost_usd'])}, {escape_sql(e['source_document_id'])}, {escape_sql(e['source_page'])}, {escape_sql(e['metadata_json'])}, TRUE)"
            )
        f.write(",\n".join(event_lines) + ";\n\n")

        # Insert Risk Assessments
        f.write("-- Risk Assessments (Deterministic Rule Engine Output)\n")
        f.write("INSERT INTO risk_assessments (id, well_id, assessment_type, overall_risk_score, confidence, depth_m, formation_name, geological_risk, mechanical_risk, pressure_risk, historical_risk, risk_factors, similar_well_ids, evidence_summary, source_documents, is_simulated) VALUES\n")
        risk_lines = []
        for r in risk_assessments:
            risk_lines.append(
                f"  ('{r['id']}', '{r['well_id']}', {escape_sql(r['assessment_type'])}, {r['overall_risk_score']}, {r['confidence']}, {escape_sql(r['depth_m'])}, {escape_sql(r['formation_name'])}, {r['geological_risk']}, {r['mechanical_risk']}, {r['pressure_risk']}, {r['historical_risk']}, {escape_sql(r['risk_factors'])}, {escape_sql(r['similar_well_ids'])}, {escape_sql(r['evidence_summary'])}, {escape_sql(r['source_documents'])}, TRUE)"
            )
        f.write(",\n".join(risk_lines) + ";\n\n")

        # Insert Alerts
        f.write("-- Alerts\n")
        f.write("INSERT INTO alerts (id, well_id, alert_type, severity, title, message, why, related_well_ids, depth_m, formation_name, evidence, source_document_id, source_page, similarity_score, confidence, is_read, is_acknowledged, is_simulated) VALUES\n")
        alert_lines = []
        for a in alerts:
            alert_lines.append(
                f"  ('{a['id']}', '{a['well_id']}', {escape_sql(a['alert_type'])}, {escape_sql(a['severity'])}, {escape_sql(a['title'])}, {escape_sql(a['message'])}, {escape_sql(a['why'])}, {escape_sql(a['related_well_ids'])}, {escape_sql(a['depth_m'])}, {escape_sql(a['formation_name'])}, {escape_sql(a['evidence'])}, {escape_sql(a['source_document_id'])}, {escape_sql(a['source_page'])}, {escape_sql(a['similarity_score'])}, {escape_sql(a['confidence'])}, FALSE, FALSE, TRUE)"
            )
        f.write(",\n".join(alert_lines) + ";\n\n")

    print(f"Wrote SQL seed script to {sql_path}")

if __name__ == "__main__":
    run_generator()
