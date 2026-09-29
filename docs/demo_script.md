# NWIS-X Demo Script — SIH26121 (Oil India Ltd)
## Nearby Wells Intelligence & Risk eXplorer

> **Duration**: 12–15 minutes  
> **Audience**: SIH Judges, Oil India SMEs, Technical Evaluators  
> **Prerequisite**: `docker compose up` or `make demo` (backend on :8000, frontend on :5173)

---

## Pre-Demo Checklist (30 seconds)

- [ ] Backend running: `http://localhost:8000/health` returns `{"status":"healthy"}`
- [ ] Frontend running: `http://localhost:5173` shows green **"Connected"** beacon
- [ ] Simulated Data Banner visible at top (mandatory SIH26121 compliance)
- [ ] Default user: **admin** (role badge visible in header)

---

## Section 1 — Platform Overview & KPIs (1 minute)

1. **Open Dashboard** — point out the 6 KPI cards at the top:
   - Wells Monitored | Reports Processed | Active Alerts | Events Indexed | Active Rigs | Mean Risk Index
2. Emphasize: *"Every number you see is computed deterministically from our PostGIS + pgvector database — zero hallucination."*
3. Note the **Confidence Threshold Slider** below the alert feed:
   - Slide from **50%** → **30%**: more alerts appear (increased sensitivity)
   - Slide to **80%**: only highest-confidence corroborated alerts survive
   - *"This gives field engineers calibration control — no black box."*

---

## Section 2 — Map & "Nearest vs Relevant" (2 minutes)

1. Click **Map** in sidebar
2. Show all well markers on the Leaflet map
3. **Toggle "Nearest Wells"** — markers sorted by physical distance
4. **Toggle "Most Relevant Wells"** — markers recolor by similarity score gradient
   - *"This is key: well NWIS-F3-C is only 4th nearest but ranks #1 relevant because it shares the same Barail Coal-Shale formation and identical incident history."*
5. Click a well marker → popup shows: name, distance, similarity, formation list, incident count
6. Show risk-zone circle overlay around active well

---

## Section 3 — Depth Radar & Live Drilling Simulation (3 minutes) ⭐ KEY DEMO

1. Click **Depth Radar** in sidebar
2. Point out the horizontal depth slider (2600–2900m range)
3. **Click "▶ Auto-Play"** — slider animates, simulating live drilling at 5m/800ms
4. Watch the status banner transition:
   - **2600–2700m**: 🟢 NORMAL (green)
   - **~2710m**: 🟡 WATCH (yellow) — *"System detects similar well had event nearby"*
   - **~2730m**: 🟠 CAUTION (amber) — *"Now within lookahead window"*
   - **~2740m**: 🔴 HIGH_EVIDENCE_RISK (red) — **Toast notification fires** 🔔
   - *"Two independent wells corroborate mud loss at exactly this depth band."*
5. Point to the **multi-well depth timeline chart** (Recharts):
   - Active well depth marker vs historical event markers
   - *"Visual proof — you can see we're approaching the historical risk band."*
6. Scroll to **Evidence Table**: well, distance, event, depth, formation, similarity, source

---

## Section 4 — Alert Explainability (2 minutes) ⭐ NON-NEGOTIABLE

1. Click any **CAUTION** or **HIGH_EVIDENCE_RISK** alert card
2. **AlertDetailModal** opens — walk through all **9 mandatory fields**:
   | # | Field | What to Show |
   |---|-------|-------------|
   | 1 | WHY | Deterministic rule that triggered |
   | 2 | WHICH WELLS | Corroborating offset well badges |
   | 3 | DEPTH | Target depth in meters |
   | 4 | FORMATION | Geological formation name |
   | 5 | EVENT TYPE | Incident type badge (MUD LOSS, etc.) |
   | 6 | EVIDENCE SNIPPET | Verbatim OCR-extracted text |
   | 7 | SOURCE DOC + PAGE | Clickable → opens PDF viewer |
   | 8 | SIMILARITY SCORE | 5-factor breakdown bar chart |
   | 9 | CONFIDENCE | Low/Med/High badge with well count |
3. Show the **Mini Explainability Graph**: Well → Formation → Event → Mitigation → Report
4. Click **"Open Page in PDF Viewer"** → EvidenceViewer opens, jumps to correct page

---

## Section 5 — RAG Copilot with Citations (2 minutes)

1. Click **Copilot** in sidebar
2. Click preset: *"What mud losses occurred in the Barail formation?"*
3. Show the response with **inline citation chips** `[Well · Doc · Page]`
4. Click a citation → opens EvidenceViewer to the source page
5. Ask an out-of-scope question: *"What is the weather in Delhi?"*
   - Copilot responds: *"Insufficient evidence in the indexed drilling corpus…"*
   - *"No hallucination — the system explicitly refuses to answer beyond evidence."*

---

## Section 6 — Institutional Memory & Compare Wells (1.5 minutes)

1. Click **Institutional Memory** → show multi-factor search filters
2. Filter by formation "Barail" → events appear with clickable evidence
3. Click **Compare Wells** → select two wells side-by-side
4. Show: formation comparison, dual event lists, 5-factor similarity bars, ROP/MW charts

---

## Section 7 — Admin Panel & Security (1.5 minutes)

1. Click **Admin** in sidebar — show dual tabs:
   - **OCR Review Queue**: low-confidence extracted events for human approval
   - Edit depth/formation/event type inline → click Approve
   - **Audit Log**: every upload, alert view, copilot query timestamped
2. Click user badge in header → **Login Modal** opens
3. Switch to **Viewer** role → note write endpoints are restricted
4. Switch back to **Admin**

---

## Section 8 — PDF Export & Final Wow (30 seconds)

1. On Dashboard, click **"Export Brief (PDF)"** for selected well
2. PDF opens in new tab — executive-formatted risk summary generated via ReportLab
3. *"One-click briefing document for field management — no manual report writing."*

---

## Closing Statements (30 seconds)

> *"NWIS-X transforms 50+ years of Oil India's drilling archives into a live, explainable early warning system. Every alert is traceable to source documents, every risk score is deterministic — zero hallucination, full transparency. The system works offline, on-premise, with no cloud dependency. Thank you."*

---

## Quick Recovery Commands

```bash
# Full reset in <10 seconds
python scripts/reset_demo.py

# Restart services
docker compose restart

# Check health
curl http://localhost:8000/health
```

---

> ⚠️ **SIMULATED DATA DISCLAIMER**: All well names, coordinates, formations, and drilling events shown are synthetic. No Oil India Ltd proprietary data is used.
