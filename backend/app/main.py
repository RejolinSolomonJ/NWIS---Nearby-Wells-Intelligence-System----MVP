"""
NWIS-X — FastAPI Application Entry Point

Nearby Wells Intelligence & Risk eXplorer
SIH26121 — Oil India Ltd
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import settings
from app.core.database import engine
from app.api import wells, events, risk, similarity, copilot, reports, auth


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle manager."""
    # Startup: verify DB connection
    try:
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        print("✅ Database connection verified")
    except Exception as e:
        print(f"⚠️ Database connection failed: {e}")
        print("   Backend will start but DB-dependent routes may fail.")
    yield
    # Shutdown: dispose engine
    await engine.dispose()
    print("🔌 Database connection pool closed")


app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "Nearby Wells Intelligence & Risk eXplorer — "
        "Depth-aware drilling institutional-memory and early-warning platform. "
        "⚠️ All data is SIMULATED for demonstration purposes."
    ),
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── CORS ───
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health Check ───
@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint — verifies API + database connectivity."""
    db_status = "unknown"
    try:
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        db_status = "disconnected"

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "version": settings.APP_VERSION,
        "database": db_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "simulated_data": True,
    }


# ─── API v1 Routers ───
API_V1_PREFIX = "/api/v1"

app.include_router(auth.router, prefix=API_V1_PREFIX, tags=["Authentication"])
app.include_router(wells.router, prefix=API_V1_PREFIX, tags=["Wells"])
app.include_router(events.router, prefix=API_V1_PREFIX, tags=["Drilling Events"])
app.include_router(risk.router, prefix=API_V1_PREFIX, tags=["Risk Assessment"])
app.include_router(similarity.router, prefix=API_V1_PREFIX, tags=["Similarity Engine"])
app.include_router(copilot.router, prefix=API_V1_PREFIX, tags=["AI Copilot"])
app.include_router(reports.router, prefix=API_V1_PREFIX, tags=["Reports"])


@app.get("/", tags=["Root"])
async def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": "/health",
        "api": f"{API_V1_PREFIX}/",
        "disclaimer": "⚠️ SIMULATED DATA — No proprietary Oil India data is used.",
    }
