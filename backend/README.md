# NWIS-X Backend

FastAPI backend with Python 3.11, SQLAlchemy ORM, and Alembic migrations.

## Structure

- `app/api/` — API route handlers
- `app/core/` — Configuration, security, database session
- `app/models/` — SQLAlchemy ORM models
- `app/schemas/` — Pydantic request/response schemas
- `app/services/` — Business logic services
- `app/main.py` — FastAPI application entry point
- `alembic/` — Database migrations
- `tests/` — Test suite
