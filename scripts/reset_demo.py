#!/usr/bin/env python3
"""
NWIS-X Demo Reset Script — SIH26121
Resets all mutable state to pristine demo baseline in <10 seconds.
Run: python scripts/reset_demo.py
"""

import json
import os
import sys
import time

# Resolve project root
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")
DATASET_PATH = os.path.join(PROJECT_ROOT, "synthetic_data", "dataset.json")
if not os.path.exists(DATASET_PATH):
    DATASET_PATH = os.path.join(BACKEND_DIR, "synthetic_data", "dataset.json")

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

sys.path.insert(0, BACKEND_DIR)

def reset_demo():
    """Reset all in-memory state and verify dataset integrity."""
    start = time.time()
    print("=" * 60)
    print("  NWIS-X DEMO RESET — SIH26121 (Oil India Ltd)")
    print("=" * 60)

    # 1. Verify synthetic dataset exists and is valid
    print("\n[1/5] Verifying synthetic dataset...")
    assert os.path.exists(DATASET_PATH), f"Dataset not found: {DATASET_PATH}"
    with open(DATASET_PATH, "r", encoding="utf-8") as f:
        dataset = json.load(f)
    
    well_count = len(dataset.get("wells", []))
    event_count = len(dataset.get("drilling_events", []))
    formation_count = len(dataset.get("formations", []))
    report_count = len(dataset.get("reports", []))
    
    print(f"  ✅ Wells: {well_count}")
    print(f"  ✅ Drilling Events: {event_count}")
    print(f"  ✅ Formations: {formation_count}")
    print(f"  ✅ Reports: {report_count}")

    # 2. Reset in-memory audit logs
    print("\n[2/5] Resetting audit log buffer...")
    try:
        from app.core.auth_deps import _IN_MEMORY_AUDIT_LOGS
        original_len = len(_IN_MEMORY_AUDIT_LOGS)
        # Keep only system init entries
        _IN_MEMORY_AUDIT_LOGS[:] = [
            entry for entry in _IN_MEMORY_AUDIT_LOGS
            if entry.get("username") == "system"
        ]
        print(f"  ✅ Cleared {original_len - len(_IN_MEMORY_AUDIT_LOGS)} user audit entries")
    except ImportError:
        print("  ⚠️  Audit module not importable (standalone reset mode)")

    # 3. Reset any modified events (needs_review flags)
    print("\n[3/5] Restoring event review flags to baseline...")
    events = dataset.get("drilling_events", [])
    reset_count = 0
    for ev in events:
        if ev.get("needs_review") is False and ev.get("confidence", 1.0) < 0.7:
            ev["needs_review"] = True
            reset_count += 1
    
    # Write back
    with open(DATASET_PATH, "w", encoding="utf-8") as f:
        json.dump(dataset, f, indent=2, ensure_ascii=False)
    print(f"  ✅ Reset {reset_count} review flags")

    # 4. Verify PDF evidence files exist
    print("\n[4/5] Verifying evidence PDF files...")
    reports_dir = os.path.join(PROJECT_ROOT, "frontend", "public", "reports")
    if os.path.isdir(reports_dir):
        pdf_files = [f for f in os.listdir(reports_dir) if f.endswith(".pdf")]
        print(f"  ✅ {len(pdf_files)} archival PDFs present in frontend/public/reports/")
    else:
        print(f"  ⚠️  Reports directory not found: {reports_dir}")

    # 5. Verify backend health endpoint
    print("\n[5/5] Checking backend health...")
    try:
        import urllib.request
        req = urllib.request.urlopen("http://localhost:8000/health", timeout=3)
        health = json.loads(req.read().decode())
        print(f"  ✅ Backend status: {health.get('status', 'unknown')}")
    except Exception as e:
        print(f"  ⚠️  Backend not reachable (start with `uvicorn app.main:app`): {e}")

    elapsed = time.time() - start
    print(f"\n{'=' * 60}")
    print(f"  ✅ DEMO RESET COMPLETE in {elapsed:.1f}s")
    print(f"  Ready for presentation. Run `npm run dev` + `uvicorn app.main:app`")
    print(f"{'=' * 60}")

    if elapsed > 10:
        print("  ⚠️  Reset took >10s — investigate dataset size or I/O latency")
    
    return 0


if __name__ == "__main__":
    sys.exit(reset_demo())
