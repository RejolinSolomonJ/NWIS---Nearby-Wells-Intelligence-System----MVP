"""
Embedding Generation Service for Report Chunks.
Generates 384-dimensional embeddings (compatible with sentence-transformers all-MiniLM-L6-v2 and pgvector).
Gracefully falls back to deterministic text hashing if sentence-transformers is not installed.
"""

import math
import hashlib
from typing import List

_model = None

def get_embedding_model():
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer
            _model = SentenceTransformer("all-MiniLM-L6-v2")
        except Exception:
            _model = "fallback"
    return _model


def generate_embedding(text: str, dim: int = 384) -> List[float]:
    """
    Generate normalized dim-length embedding for input text.
    """
    model = get_embedding_model()
    if model != "fallback":
        try:
            vec = model.encode(text)
            return [round(float(x), 5) for x in vec]
        except Exception:
            pass

    # Deterministic fallback embedding derived from SHA-256 + text ngram hashes
    vec = [0.0] * dim
    for i, word in enumerate(text.lower().split()):
        h = int(hashlib.sha256(f"{i}_{word}".encode()).hexdigest(), 16)
        idx = h % dim
        val = ((h >> 8) % 1000) / 500.0 - 1.0  # -1.0 to 1.0
        vec[idx] += val

    # L2 normalize
    norm = math.sqrt(sum(x * x for x in vec))
    if norm > 0:
        return [round(x / norm, 5) for x in vec]
    else:
        # Uniform unit vector
        val = round(1.0 / math.sqrt(dim), 5)
        return [val] * dim
