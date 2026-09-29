"""
Wells API Router — CRUD + Geospatial nearby search using PostGIS ST_DWithin / ST_Distance.
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from geoalchemy2.functions import ST_X, ST_Y, ST_DWithin, ST_Distance, ST_SetSRID, ST_MakePoint, ST_AsText

from app.core.database import get_db
from app.models import Well
from app.schemas import WellCreate, WellResponse, WellNearbyResponse

router = APIRouter(prefix="/wells", tags=["Wells"])


@router.get("/nearby", response_model=List[WellNearbyResponse])
async def get_nearby_wells(
    lat: float = Query(..., description="Target Latitude in degrees"),
    lon: float = Query(..., description="Target Longitude in degrees"),
    radius_km: float = Query(50.0, ge=0.1, le=500.0, description="Search radius in kilometers"),
    db: AsyncSession = Depends(get_db),
):
    """
    Geospatial Search: Find wells within radius_km sorted by distance ascending.
    Uses PostGIS ST_DWithin and ST_Distance over WGS84 geography.
    """
    try:
        # PostGIS query using geography cast for accurate spherical distance in meters
        query = text("""
            SELECT 
                well_id,
                name,
                status,
                total_depth_m,
                ST_Y(geom::geometry) AS latitude,
                ST_X(geom::geometry) AS longitude,
                ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography) / 1000.0 AS distance_km
            FROM wells
            WHERE geom IS NOT NULL
              AND ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography, :radius_m)
            ORDER BY distance_km ASC;
        """)

        result = await db.execute(query, {
            "lat": lat,
            "lon": lon,
            "radius_m": radius_km * 1000.0
        })
        rows = result.mappings().all()

        return [
            WellNearbyResponse(
                well_id=r["well_id"],
                name=r["name"],
                status=r["status"],
                total_depth_m=r["total_depth_m"],
                latitude=round(float(r["latitude"]), 6),
                longitude=round(float(r["longitude"]), 6),
                distance_km=round(float(r["distance_km"]), 2)
            )
            for r in rows
        ]

    except Exception:
        # Fallback query using Haversine formula if PostGIS geography functions are unavailable
        haversine_query = text("""
            SELECT 
                well_id,
                name,
                status,
                total_depth_m,
                ST_Y(geom::geometry) AS latitude,
                ST_X(geom::geometry) AS longitude,
                (6371.0 * acos(
                    cos(radians(:lat)) * cos(radians(ST_Y(geom::geometry))) *
                    cos(radians(ST_X(geom::geometry)) - radians(:lon)) +
                    sin(radians(:lat)) * sin(radians(ST_Y(geom::geometry)))
                )) AS distance_km
            FROM wells
            WHERE geom IS NOT NULL
            GROUP BY well_id, name, status, total_depth_m, geom
            HAVING (6371.0 * acos(
                    cos(radians(:lat)) * cos(radians(ST_Y(geom::geometry))) *
                    cos(radians(ST_X(geom::geometry)) - radians(:lon)) +
                    sin(radians(:lat)) * sin(radians(ST_Y(geom::geometry)))
                )) <= :radius_km
            ORDER BY distance_km ASC;
        """)

        result = await db.execute(haversine_query, {
            "lat": lat,
            "lon": lon,
            "radius_km": radius_km
        })
        rows = result.mappings().all()

        return [
            WellNearbyResponse(
                well_id=r["well_id"],
                name=r["name"],
                status=r["status"],
                total_depth_m=r["total_depth_m"],
                latitude=round(float(r["latitude"]), 6),
                longitude=round(float(r["longitude"]), 6),
                distance_km=round(float(r["distance_km"]), 2)
            )
            for r in rows
        ]


@router.get("", response_model=List[WellResponse])
async def list_wells(
    status: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List wells with optional status filtering with dataset fallback."""
    try:
        query = select(
            Well.well_id,
            Well.name,
            Well.spud_date,
            Well.total_depth_m,
            Well.status,
            ST_Y(Well.geom).label("latitude"),
            ST_X(Well.geom).label("longitude")
        )
        if status:
            query = query.where(Well.status == status)
        query = query.offset(offset).limit(limit)

        result = await db.execute(query)
        rows = result.mappings().all()

        return [
            WellResponse(
                well_id=r["well_id"],
                name=r["name"],
                spud_date=r["spud_date"],
                total_depth_m=r["total_depth_m"],
                status=r["status"],
                latitude=round(float(r["latitude"]), 6) if r["latitude"] is not None else None,
                longitude=round(float(r["longitude"]), 6) if r["longitude"] is not None else None,
            )
            for r in rows
        ]
    except Exception:
        import json, os, uuid
        dpath = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
            "synthetic_data",
            "dataset.json",
        )
        if os.path.exists(dpath):
            with open(dpath, "r", encoding="utf-8") as f:
                ds = json.load(f)
            wells_data = ds.get("wells", [])
            if status:
                wells_data = [w for w in wells_data if w.get("status", "").lower() == status.lower()]
            res = []
            for w in wells_data[offset : offset + limit]:
                res.append(
                    WellResponse(
                        well_id=uuid.UUID(w["well_id"]),
                        name=w["name"],
                        spud_date=w.get("spud_date"),
                        total_depth_m=w.get("total_depth_m", 3500.0),
                        status=w.get("status", "active"),
                        latitude=w.get("latitude", 27.28),
                        longitude=w.get("longitude", 95.34),
                    )
                )
            return res
        return []


@router.get("/{well_id}", response_model=WellResponse)
async def get_well(well_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get single well by UUID with dataset fallback."""
    try:
        query = select(
            Well.well_id,
            Well.name,
            Well.spud_date,
            Well.total_depth_m,
            Well.status,
            ST_Y(Well.geom).label("latitude"),
            ST_X(Well.geom).label("longitude")
        ).where(Well.well_id == well_id)

        result = await db.execute(query)
        row = result.mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail=f"Well with ID {well_id} not found")

        return WellResponse(
            well_id=row["well_id"],
            name=row["name"],
            spud_date=row["spud_date"],
            total_depth_m=row["total_depth_m"],
            status=row["status"],
            latitude=round(float(row["latitude"]), 6) if row["latitude"] is not None else None,
            longitude=round(float(row["longitude"]), 6) if row["longitude"] is not None else None,
        )
    except HTTPException:
        raise
    except Exception:
        import json, os, uuid
        dpath = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
            "synthetic_data",
            "dataset.json",
        )
        if os.path.exists(dpath):
            with open(dpath, "r", encoding="utf-8") as f:
                ds = json.load(f)
            wid_str = str(well_id)
            w = next((x for x in ds.get("wells", []) if x["well_id"] == wid_str), None)
            if w:
                return WellResponse(
                    well_id=uuid.UUID(w["well_id"]),
                    name=w["name"],
                    spud_date=w.get("spud_date"),
                    total_depth_m=w.get("total_depth_m", 3500.0),
                    status=w.get("status", "active"),
                    latitude=w.get("latitude", 27.28),
                    longitude=w.get("longitude", 95.34),
                )
        raise HTTPException(status_code=404, detail=f"Well with ID {well_id} not found")

