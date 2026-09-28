# NWIS-X Architecture

> Nearby Wells Intelligence & Risk eXplorer — SIH26121

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
│  Dashboard │ Map │ RiskRadar │ Copilot │ CompareWells │ Admin   │
└──────────────────────────┬──────────────────────────────────────┘
                           │ REST API (JSON)
┌──────────────────────────▼──────────────────────────────────────┐
│                      Backend (FastAPI)                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ Auth     │ │ Wells    │ │ Risk     │ │ Copilot  │          │
│  │ Router   │ │ Router   │ │ Router   │ │ Router   │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│  ┌──────────────────────────────────────────────────┐          │
│  │              Service Layer                        │          │
│  │  OCR Pipeline │ NLP Extraction │ Similarity Engine│          │
│  │  Risk Engine  │ RAG Copilot    │ Embedding Service│          │
│  └──────────────────────────────────────────────────┘          │
└──────────────────────────┬──────────────────────────────────────┘
                           │ SQLAlchemy ORM
┌──────────────────────────▼──────────────────────────────────────┐
│                PostgreSQL 15 (Single DB)                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                       │
│  │ PostGIS  │ │ pgvector │ │ Core     │                       │
│  │ (spatial)│ │ (semantic│ │ Tables   │                       │
│  │          │ │ search)  │ │          │                       │
│  └──────────┘ └──────────┘ └──────────┘                       │
└─────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

1. **Single Database**: PostgreSQL handles spatial (PostGIS), semantic (pgvector), and relational data
2. **Deterministic Scoring**: Risk/similarity scores from rule engines, never from LLM
3. **LLM as Narrator**: LLM only generates human-readable explanations, always citing sources
4. **Evidence Trail**: Every alert traces back to specific well, depth, formation, document, and page

TODO: Expand with detailed component diagrams in Phase 0
