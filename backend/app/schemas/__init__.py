"""
NWIS-X Pydantic Schemas — request/response models for all API endpoints.
"""

import uuid
from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, Field, EmailStr


# ─── Auth Schemas ───
class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    email: str = Field(..., max_length=255)
    password: str = Field(..., min_length=8)
    full_name: Optional[str] = None
    role: str = Field(default="viewer")


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: uuid.UUID
    username: str
    email: str
    full_name: Optional[str]
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    username: Optional[str] = None


# ─── Well Schemas ───
class WellBase(BaseModel):
    well_name: str
    well_id_code: str
    field_name: str
    block_name: Optional[str] = None
    operator: str = "Oil India Ltd (Simulated)"
    well_type: Optional[str] = None
    status: Optional[str] = None
    total_depth_m: Optional[float] = None
    latitude: float
    longitude: float
    elevation_m: Optional[float] = None


class WellCreate(WellBase):
    spud_date: Optional[datetime] = None
    completion_date: Optional[datetime] = None


class WellResponse(WellBase):
    id: uuid.UUID
    spud_date: Optional[datetime]
    completion_date: Optional[datetime]
    is_simulated: bool
    created_at: datetime
    formation_count: Optional[int] = None
    event_count: Optional[int] = None
    risk_score: Optional[float] = None

    class Config:
        from_attributes = True


class WellListResponse(BaseModel):
    wells: List[WellResponse]
    total: int
    page: int
    page_size: int


# ─── Formation Schemas ───
class FormationBase(BaseModel):
    formation_name: str
    top_depth_m: float
    bottom_depth_m: float
    lithology: Optional[str] = None
    age: Optional[str] = None
    porosity_pct: Optional[float] = None
    permeability_md: Optional[float] = None
    pressure_psi: Optional[float] = None
    temperature_c: Optional[float] = None
    fluid_type: Optional[str] = None
    remarks: Optional[str] = None


class FormationCreate(FormationBase):
    well_id: uuid.UUID


class FormationResponse(FormationBase):
    id: uuid.UUID
    well_id: uuid.UUID
    is_simulated: bool

    class Config:
        from_attributes = True


# ─── Drilling Event Schemas ───
class DrillingEventBase(BaseModel):
    event_type: str
    severity: str
    depth_m: float
    depth_end_m: Optional[float] = None
    formation_name: Optional[str] = None
    event_date: Optional[datetime] = None
    duration_hours: Optional[float] = None
    description: str
    root_cause: Optional[str] = None
    action_taken: Optional[str] = None
    mud_weight_ppg: Optional[float] = None
    mud_type: Optional[str] = None
    npt_hours: Optional[float] = None
    cost_usd: Optional[float] = None


class DrillingEventCreate(DrillingEventBase):
    well_id: uuid.UUID


class DrillingEventResponse(DrillingEventBase):
    id: uuid.UUID
    well_id: uuid.UUID
    source_document_id: Optional[uuid.UUID]
    source_page: Optional[int]
    is_simulated: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Risk Assessment Schemas ───
class RiskFactor(BaseModel):
    factor: str
    score: float
    evidence: str
    source: str


class RiskAssessmentResponse(BaseModel):
    id: uuid.UUID
    well_id: uuid.UUID
    assessment_type: str
    overall_risk_score: float
    confidence: float
    depth_m: Optional[float]
    formation_name: Optional[str]
    geological_risk: float
    mechanical_risk: float
    pressure_risk: float
    historical_risk: float
    risk_factors: List[RiskFactor]
    similar_well_ids: List[str]
    evidence_summary: Optional[str]
    source_documents: List[dict]
    is_simulated: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Similarity Schemas ───
class SimilarWell(BaseModel):
    well_id: uuid.UUID
    well_name: str
    well_id_code: str
    spatial_score: float = Field(..., ge=0, le=1)
    depth_score: float = Field(..., ge=0, le=1)
    formation_score: float = Field(..., ge=0, le=1)
    event_score: float = Field(..., ge=0, le=1)
    semantic_score: float = Field(..., ge=0, le=1)
    overall_similarity: float = Field(..., ge=0, le=1)
    distance_km: float
    shared_formations: List[str]
    common_events: List[str]


class SimilarityRequest(BaseModel):
    well_id: uuid.UUID
    depth_range_m: Optional[tuple[float, float]] = None
    max_distance_km: float = 50.0
    limit: int = 10


class SimilarityResponse(BaseModel):
    query_well_id: uuid.UUID
    similar_wells: List[SimilarWell]
    computation_method: str = "deterministic_multi_factor"


# ─── Alert Schemas ───
class AlertResponse(BaseModel):
    id: uuid.UUID
    well_id: uuid.UUID
    alert_type: str
    severity: str
    title: str
    message: str
    why: str
    related_well_ids: List[str]
    depth_m: Optional[float]
    formation_name: Optional[str]
    evidence: List[dict]
    source_document_id: Optional[uuid.UUID]
    source_page: Optional[int]
    similarity_score: Optional[float]
    confidence: Optional[float]
    is_read: bool
    is_acknowledged: bool
    is_simulated: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Copilot Schemas ───
class CopilotQuery(BaseModel):
    query: str = Field(..., min_length=5, max_length=2000)
    well_id: Optional[uuid.UUID] = None
    include_similar_wells: bool = True


class Citation(BaseModel):
    well_id: Optional[uuid.UUID]
    well_name: Optional[str]
    document_id: Optional[uuid.UUID]
    document_title: Optional[str]
    page: Optional[int]
    excerpt: Optional[str]
    relevance: float


class CopilotResponse(BaseModel):
    query: str
    response: str
    citations: List[Citation]
    well_context: Optional[dict]
    disclaimer: str = "⚠️ SIMULATED DATA — This response is generated from synthetic data for demonstration only. LLM narration with cited sources."


# ─── KPI / Dashboard Schemas ───
class DashboardKPIs(BaseModel):
    total_wells: int
    active_wells: int
    total_events: int
    critical_alerts: int
    avg_risk_score: float
    wells_at_risk: int
    total_documents: int
    recent_events: List[DrillingEventResponse]


# ─── Health Check ───
class HealthResponse(BaseModel):
    status: str
    version: str
    database: str
    timestamp: datetime
