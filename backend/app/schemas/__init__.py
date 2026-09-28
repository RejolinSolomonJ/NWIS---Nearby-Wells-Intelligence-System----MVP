"""
NWIS-X Pydantic Schemas
Matching Phase 1 ORM models:
- Wells & Geospatial Nearby
- Formations
- Drilling Events & Depth Filters
- Reports (CRUD & Upload Stub)
- Health & Error Responses
"""

import uuid
from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, Field, ConfigDict


# ─── Standard Error Response ───
class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
    code: int


# ─── Health Response ───
class HealthResponse(BaseModel):
    status: str
    version: str
    database: str
    timestamp: datetime
    simulated_data: bool = True


# ─── Well Schemas ───
class WellBase(BaseModel):
    name: str
    spud_date: Optional[datetime] = None
    total_depth_m: Optional[float] = None
    status: Optional[str] = None


class WellCreate(WellBase):
    latitude: float
    longitude: float


class WellResponse(WellBase):
    well_id: uuid.UUID
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class WellNearbyResponse(BaseModel):
    well_id: uuid.UUID
    name: str
    status: Optional[str] = None
    total_depth_m: Optional[float] = None
    latitude: float
    longitude: float
    distance_km: float

    model_config = ConfigDict(from_attributes=True)


# ─── Formation Schemas ───
class FormationBase(BaseModel):
    name: str
    top_depth_m: Optional[float] = None
    base_depth_m: Optional[float] = None
    lithology: Optional[str] = None


class FormationCreate(FormationBase):
    well_id: uuid.UUID


class FormationResponse(FormationBase):
    formation_id: uuid.UUID
    well_id: uuid.UUID

    model_config = ConfigDict(from_attributes=True)


# ─── Drilling Event Schemas ───
class DrillingEventBase(BaseModel):
    depth_m: Optional[float] = None
    event_type: str
    severity: Optional[str] = None
    description: Optional[str] = None
    page_number: Optional[int] = None
    needs_review: Optional[bool] = False
    raw_text_snippet: Optional[str] = None


class DrillingEventCreate(DrillingEventBase):
    well_id: uuid.UUID
    formation_id: Optional[uuid.UUID] = None
    mitigation_id: Optional[uuid.UUID] = None
    report_id: Optional[uuid.UUID] = None


class DrillingEventResponse(DrillingEventBase):
    event_id: uuid.UUID
    well_id: uuid.UUID
    formation_id: Optional[uuid.UUID] = None
    mitigation_id: Optional[uuid.UUID] = None
    report_id: Optional[uuid.UUID] = None
    formation_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ─── Report Schemas ───
class ReportBase(BaseModel):
    report_type: Optional[str] = None
    file_path: Optional[str] = None


class ReportCreate(ReportBase):
    well_id: uuid.UUID


class ReportResponse(ReportBase):
    report_id: uuid.UUID
    well_id: uuid.UUID
    upload_date: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
