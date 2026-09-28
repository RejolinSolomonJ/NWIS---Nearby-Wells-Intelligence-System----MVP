"""
NWIS-X — FastAPI Application Entry Point
Phase 3 Core Backend API (CRUD + Geospatial)
SIH26121 — Oil India Ltd
"""

from datetime import datetime, timezone
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.core.config import settings
from app.core.database import engine
from app.api import wells, formations, events, reports
from app.schemas import HealthResponse, ErrorResponse

app = FastAPI(
    title="NWIS-X Core API",
    description="Nearby Wells Intelligence & Risk eXplorer — Geospatial & Depth-Aware API. ⚠️ SIMULATED DATA ONLY.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── CORS ───
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Structured JSON Error Responses ───
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail if isinstance(exc.detail, str) else "HTTP Exception",
            "detail": exc.detail,
            "code": exc.status_code,
        },
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal Server Error",
            "detail": str(exc),
            "code": 500,
        },
    )


# ─── Health Check ───
@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """System health check endpoint verifying API and DB connectivity."""
    db_status = "unknown"
    try:
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        db_status = "disconnected"

    return HealthResponse(
        status="healthy" if db_status == "connected" else "degraded",
        version="1.0.0",
        database=db_status,
        timestamp=datetime.now(timezone.utc),
        simulated_data=True,
    )


# ─── Register Routers ───
# Direct root paths (for /wells, /wells/nearby, /formations/{well_id}, /events, /reports)
app.include_router(wells.router)
app.include_router(formations.router)
app.include_router(events.router)
app.include_router(reports.router)

# Also register under /api/v1 for versioned frontend client access
app.include_router(wells.router, prefix="/api/v1")
app.include_router(formations.router, prefix="/api/v1")
app.include_router(events.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")


@app.get("/", tags=["Root"])
async def root():
    return {
        "app": "NWIS-X Nearby Wells Intelligence & Risk eXplorer",
        "docs": "/docs",
        "health": "/health",
        "wells_nearby": "/wells/nearby?lat=27.28&lon=95.34&radius_km=15",
        "disclaimer": "⚠️ SIMULATED DATA — NOT OIL INDIA DATA",
    }
