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
from typing import Optional, List, Any, Dict
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


# ─── Similarity Schemas (Phase 5) ───
class SimilarityBreakdownComponent(BaseModel):
    score: float
    weight: float
    weighted: float
    shared_formations: Optional[List[str]] = None
    common_events: Optional[List[str]] = None
    distance_km: Optional[float] = None


class SimilarityBreakdown(BaseModel):
    formation_overlap: SimilarityBreakdownComponent
    depth_proximity: SimilarityBreakdownComponent
    spatial_proximity: SimilarityBreakdownComponent
    operational_similarity: SimilarityBreakdownComponent
    event_type_overlap: SimilarityBreakdownComponent


class WellSimilarityResponse(BaseModel):
    well_id: uuid.UUID
    target_well_id: Optional[uuid.UUID] = None
    well_name: Optional[str] = None
    well_code: Optional[str] = None
    overall_similarity: float
    similarity_score: Optional[float] = None
    distance_km: float
    breakdown: SimilarityBreakdown

    model_config = ConfigDict(from_attributes=True)


class NearbyVsRelevantResponse(BaseModel):
    target_well_id: uuid.UUID
    target_well_name: Optional[str] = None
    anchor_well: Optional[Dict[str, Any]] = None
    closest_by_distance: Optional[Dict[str, Any]] = None
    most_relevant_by_similarity: Optional[Dict[str, Any]] = None
    nearby_wells: List[Any]          # distance-sorted
    similar_wells: List[Any]         # similarity-sorted
    distance_sorted: Optional[List[Any]] = None
    similarity_sorted: Optional[List[Any]] = None
    ordering_differs: bool           # True if nearest != most-relevant
    geological_insight: Optional[str] = None
    disclaimer: str = "SIMULATED DATA - PROTOTYPE ASSUMPTION weights require SME calibration"


# ─── Risk & Alert Schemas (Phase 6 / Non-Negotiable) ───
class RiskFactor(BaseModel):
    factor: str
    score: float
    evidence: str
    source: str


class SourceDocInfo(BaseModel):
    doc_id: Optional[str] = None
    page: Optional[int] = 1
    excerpt: Optional[str] = None


class RiskAssessmentResponse(BaseModel):
    well_id: uuid.UUID
    assessment_type: str = "pre_drill"
    overall_risk_score: float
    confidence: float
    depth_m: float
    formation_name: Optional[str] = None
    geological_risk: float
    mechanical_risk: float
    pressure_risk: float
    historical_risk: float
    risk_factors: List[RiskFactor] = []
    similar_well_ids: List[str] = []
    evidence_summary: str
    source_documents: List[SourceDocInfo] = []
    is_simulated: bool = True

    model_config = ConfigDict(from_attributes=True)


class AlertResponse(BaseModel):
    alert_id: uuid.UUID
    well_id: uuid.UUID
    depth_m: float
    formation_name: Optional[str] = "Barail Coal-Shale"
    alert_type: str = "mud_loss"
    severity: str = "critical"
    why: str
    which_wells: List[str] = []
    evidence: str
    source_doc: Optional[str] = "Daily Drilling Report"
    source_page: Optional[int] = 3
    similarity_score: Optional[float] = 0.85
    confidence_score: Optional[float] = 0.92
    is_read: bool = False
    is_acknowledged: bool = False
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ─── Depth-Aware Risk Engine Schemas (Phase 6 Flagship) ───
class RiskEvidenceItem(BaseModel):
    well: str
    distance: float
    event: str
    depth: float
    formation: str
    similarity: float
    source_doc: Optional[str] = None
    page: Optional[int] = 1
    snippet: Optional[str] = None
    event_id: Optional[str] = None


class CurrentRiskResponse(BaseModel):
    well_id: uuid.UUID
    current_depth: float
    current_formation: Optional[str] = None
    lookahead_m: float = 50.0
    risk_level: str  # NORMAL, WATCH, CAUTION, HIGH_EVIDENCE_RISK
    risk_score: float  # 0 - 100
    confidence: str  # Low, Med, High
    evidence: List[RiskEvidenceItem] = []
    why_text: str
    evidence_ids: List[str] = []
    corroborating_wells_count: int = 0
    disclaimer: str = "⚠️ SIMULATED DATA — NOT OIL INDIA DATA"


# ─── Copilot Schemas (Phase 7 / RAG) ───
class Citation(BaseModel):
    well_name: Optional[str] = None
    document_title: str
    page_number: int
    excerpt: str
    confidence: float = 0.95


class CopilotQuery(BaseModel):
    question: str
    well_id: Optional[uuid.UUID] = None
    depth_m: Optional[float] = None
    formation_name: Optional[str] = None


class CopilotResponse(BaseModel):
    answer: str
    citations: List[Citation] = []
    risk_score: Optional[float] = None
    confidence: float = 0.95
    evidence_wells: List[str] = []
    disclaimer: str = "⚠️ SIMULATED DATA — Institutional memory generated without proprietary Oil India data."


# ─── User & Auth Schemas ───
class UserBase(BaseModel):
    username: str
    role: str = "viewer"


class UserCreate(UserBase):
    password: str
    email: Optional[str] = None
    full_name: Optional[str] = None


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(UserBase):
    user_id: Optional[uuid.UUID] = None
    email: Optional[str] = None
    full_name: Optional[str] = None
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"




