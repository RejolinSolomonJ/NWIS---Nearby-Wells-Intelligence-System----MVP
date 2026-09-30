"""
NWIS-X Centralized Synthetic Dataset Loader & Graceful Fallback Helper
Ensures all API endpoints return rich data even when the database is empty or uninitialized.
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger("nwis.dataset")

_CACHED_DATASET: Optional[Dict[str, Any]] = None


def find_dataset_path() -> Optional[str]:
    """Search for synthetic_data/dataset.json in all known workspace and container paths."""
    candidates = [
        # Relative to backend/app/core/
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "synthetic_data", "dataset.json"),
        # Relative to project root
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "synthetic_data", "dataset.json"),
        # Current working dir
        os.path.join(os.getcwd(), "synthetic_data", "dataset.json"),
        os.path.join(os.getcwd(), "backend", "synthetic_data", "dataset.json"),
        # Linux / Docker container path
        "/app/synthetic_data/dataset.json",
        "/app/backend/synthetic_data/dataset.json",
    ]
    for c in candidates:
        if os.path.exists(c):
            return os.path.abspath(c)
    return None


def load_dataset() -> Dict[str, Any]:
    """Load and cache synthetic dataset."""
    global _CACHED_DATASET
    if _CACHED_DATASET is not None:
        return _CACHED_DATASET

    path = find_dataset_path()
    if path and os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                _CACHED_DATASET = json.load(f)
                logger.info(f"Loaded synthetic dataset from {path}")
                return _CACHED_DATASET
        except Exception as e:
            logger.error(f"Error reading dataset from {path}: {e}")

    logger.warning("dataset.json not found in any candidate path")
    return {"wells": [], "drilling_events": [], "formations": [], "reports": [], "mitigations": []}


def get_fallback_wells() -> List[Dict[str, Any]]:
    return load_dataset().get("wells", [])


def get_fallback_events() -> List[Dict[str, Any]]:
    return load_dataset().get("drilling_events", [])


def get_fallback_formations() -> List[Dict[str, Any]]:
    return load_dataset().get("formations", [])
