# NWIS-X — Nearby Wells Intelligence & Risk eXplorer

> **SIH26121 — Oil India Ltd**
> Depth-aware drilling institutional-memory and early-warning platform.

⚠️ **All data in this application is SIMULATED DATA for demonstration purposes only.**

## Quick Start

```bash
# Clone the repository
git clone https://github.com/VeeraVaishnaviK/NWIS---Nearby-Wells-Intelligence-System----MVP.git
cd NWIS-X

# Start all services (PostgreSQL + Backend + Frontend)
docker-compose up --build

# Access:
# - Frontend: http://localhost:5173
# - Backend API: http://localhost:8000
# - API Docs: http://localhost:8000/docs
```

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11, FastAPI, SQLAlchemy, Alembic |
| Database | PostgreSQL 15 + PostGIS + pgvector |
| OCR | PaddleOCR (fallback: pytesseract) |
| NLP | spaCy + regex rules |
| Embeddings | sentence-transformers (all-MiniLM-L6-v2) |
| LLM | Pluggable (OpenAI / Gemini / Ollama) |
| Frontend | React 18 + TypeScript + Vite + TailwindCSS |
| Map | Leaflet + react-leaflet |
| Charts | Recharts |
| Auth | JWT (python-jose) + bcrypt |

## Architecture

See [docs/architecture.md](docs/architecture.md) for detailed architecture documentation.

## License

This project is developed for Smart India Hackathon 2026.
