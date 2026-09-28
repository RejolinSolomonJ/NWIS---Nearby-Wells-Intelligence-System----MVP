"""
Phase 4 — OCR & NLP Extraction Accuracy Benchmark.
Runs OCR + NLP extraction pipeline end-to-end on all synthetic PDF reports.
Compares extracted events vs ground-truth synthetic events from dataset.json.
Calculates Precision, Recall, and F1 metrics and prints an empirical accuracy summary.
"""

import os
import sys
import json
from collections import defaultdict

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.services.ocr_pipeline.service import ocr_service
from app.services.nlp_extraction.engine import nlp_engine

REPORTS_DIR = os.path.join("synthetic_data", "reports")
DATASET_PATH = os.path.join("synthetic_data", "dataset.json")


def run_benchmark():
    if not os.path.exists(DATASET_PATH):
        print(f"[ERROR] dataset.json not found at {DATASET_PATH}")
        return

    with open(DATASET_PATH, "r", encoding="utf-8") as f:
        dataset = json.load(f)

    wells = dataset["wells"]
    ground_truth_events = dataset["drilling_events"]

    # Map well_id -> well_code
    well_id_to_code = {w["well_id"]: w["code"] for w in wells}
    code_to_well_id = {w["code"]: w["well_id"] for w in wells}

    # Group ground truth events by well_id
    gt_by_well = defaultdict(list)
    for ev in ground_truth_events:
        gt_by_well[ev["well_id"]].append(ev)

    total_gt = len(ground_truth_events)
    total_extracted = 0
    true_positives = 0
    false_positives = 0
    false_negatives = 0

    print("=" * 78)
    print(" NWIS-X PHASE 4: DOCUMENT INTELLIGENCE (OCR + NLP) ACCURACY BENCHMARK")
    print(" Disclaimers: SIMULATED DATA -- NOT OIL INDIA DATA")
    print("=" * 78)

    pdf_files = sorted([f for f in os.listdir(REPORTS_DIR) if f.endswith(".pdf")])
    print(f"Discovered {len(pdf_files)} synthetic PDF reports in {REPORTS_DIR}.\n")

    per_well_results = []

    for pdf_name in pdf_files:
        code = pdf_name.split("_")[0]
        well_id = code_to_well_id.get(code)
        if not well_id:
            continue

        pdf_path = os.path.join(REPORTS_DIR, pdf_name)
        pages = ocr_service.extract_pages(pdf_path)

        extracted_events = []
        for p in pages:
            events = nlp_engine.extract_from_page(p["text"], p["page_number"])
            for e in events:
                e["well_id"] = well_id
                extracted_events.append(e)

        gt_events = gt_by_well.get(well_id, [])
        total_extracted += len(extracted_events)

        # Match extracted events against ground truth
        matched_gt_indices = set()
        matched_ext_indices = set()

        for ext_i, ext in enumerate(extracted_events):
            for gt_i, gt in enumerate(gt_events):
                if gt_i in matched_gt_indices:
                    continue
                # Match criteria: same event_type, same page, depth close within 1.0m
                type_match = ext["event_type"] == gt["event_type"]
                page_match = ext["page_number"] == gt["page_number"]
                depth_match = abs(ext["depth_m"] - gt["depth_m"]) < 1.0

                if type_match and page_match and depth_match:
                    matched_gt_indices.add(gt_i)
                    matched_ext_indices.add(ext_i)
                    break

        well_tp = len(matched_gt_indices)
        well_fp = len(extracted_events) - well_tp
        well_fn = len(gt_events) - well_tp

        true_positives += well_tp
        false_positives += well_fp
        false_negatives += well_fn

        per_well_results.append({
            "well_code": code,
            "gt_count": len(gt_events),
            "ext_count": len(extracted_events),
            "tp": well_tp,
            "fp": well_fp,
            "fn": well_fn,
        })

    # Summary table
    print(f"{'WELL CODE':<16} | {'GT EVENTS':<10} | {'EXTRACTED':<10} | {'MATCH (TP)':<10} | {'PRECISION':<10} | {'RECALL':<10}")
    print("-" * 78)
    for r in per_well_results:
        prec = (r["tp"] / r["ext_count"] * 100.0) if r["ext_count"] > 0 else 0.0
        rec = (r["tp"] / r["gt_count"] * 100.0) if r["gt_count"] > 0 else 0.0
        print(f"{r['well_code']:<16} | {r['gt_count']:<10} | {r['ext_count']:<10} | {r['tp']:<10} | {prec:>8.1f}% | {rec:>8.1f}%")

    print("-" * 78)
    overall_precision = (true_positives / total_extracted * 100.0) if total_extracted > 0 else 0.0
    overall_recall = (true_positives / total_gt * 100.0) if total_gt > 0 else 0.0
    f1_score = (2 * overall_precision * overall_recall / (overall_precision + overall_recall)) if (overall_precision + overall_recall) > 0 else 0.0

    print(f"\n[MEASURED PERFORMANCE SUMMARY]")
    print(f"  * Total Ground Truth Events  : {total_gt}")
    print(f"  * Total Extracted Events     : {total_extracted}")
    print(f"  * True Positives (Matches)   : {true_positives}")
    print(f"  * False Positives            : {false_positives}")
    print(f"  * False Negatives            : {false_negatives}")
    print(f"  * Empirical Precision        : {overall_precision:.2f}%")
    print(f"  * Empirical Recall           : {overall_recall:.2f}%")
    print(f"  * Empirical F1 Score         : {f1_score:.2f}%")
    print("=" * 78)


if __name__ == "__main__":
    run_benchmark()
