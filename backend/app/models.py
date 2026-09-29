"""
NWIS-X SQLAlchemy ORM Models
Defines tables matching PostgreSQL schema:
- users
- wells
- formations
- reports
- report_chunks
- mitigations
- drilling_events
- drilling_parameters
- telemetry
- well_similarity
- risk_alerts
- audit_logs
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Float,
    Integer,
    Boolean,
    Text,
    DateTime,
    ForeignKey,
    CheckConstraint,
    JSON,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy.types import TypeDecorator, String as SQLString
from app.core.database import Base

# Safe imports for optional extensions (PostGIS & pgvector)
try:
    from geoalchemy2 import Geometry
except ImportError:
    # Graceful fallback type if geoalchemy2 is not installed
    class Geometry(TypeDecorator):
        impl = SQLString
        cache_ok = True

        def __init__(self, *args, **kwargs):
            super().__init__()

try:
    from pgvector.sqlalchemy import Vector
except ImportError:
    # Graceful fallback type if pgvector is not installed
    class Vector(TypeDecorator):
        impl = JSON
        cache_ok = True

        def __init__(self, *args, **kwargs):
            super().__init__()


class User(Base):
    __tablename__ = "users"

    user_id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(100), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), nullable=True)


class Well(Base):
    __tablename__ = "wells"

    well_id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    geom = Column(Geometry(geometry_type="POINT", srid=4326), nullable=True)
    spud_date = Column(DateTime, nullable=True)
    total_depth_m = Column(Float, nullable=True)
    status = Column(String(50), nullable=True)


class Formation(Base):
    __tablename__ = "formations"

    formation_id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    well_id = Column(PG_UUID(as_uuid=True), ForeignKey("wells.well_id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    top_depth_m = Column(Float, nullable=True)
    base_depth_m = Column(Float, nullable=True)
    lithology = Column(Text, nullable=True)


class Report(Base):
    __tablename__ = "reports"

    report_id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    well_id = Column(PG_UUID(as_uuid=True), ForeignKey("wells.well_id", ondelete="CASCADE"), nullable=False)
    report_type = Column(String(100), nullable=True)
    file_path = Column(Text, nullable=True)
    upload_date = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class ReportChunk(Base):
    __tablename__ = "report_chunks"

    chunk_id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_id = Column(PG_UUID(as_uuid=True), ForeignKey("reports.report_id", ondelete="CASCADE"), nullable=False)
    page_number = Column(Integer, nullable=True)
    raw_text = Column(Text, nullable=True)
    embedding = Column(Vector(384), nullable=True)


class Mitigation(Base):
    __tablename__ = "mitigations"

    mitigation_id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    action_text = Column(Text, nullable=True)
    outcome = Column(Text, nullable=True)


class DrillingEvent(Base):
    __tablename__ = "drilling_events"

    event_id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    well_id = Column(PG_UUID(as_uuid=True), ForeignKey("wells.well_id", ondelete="CASCADE"), nullable=False)
    formation_id = Column(PG_UUID(as_uuid=True), ForeignKey("formations.formation_id", ondelete="SET NULL"), nullable=True)
    depth_m = Column(Float, nullable=True)
    event_type = Column(String(50), nullable=False)
    severity = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)
    mitigation_id = Column(PG_UUID(as_uuid=True), ForeignKey("mitigations.mitigation_id", ondelete="SET NULL"), nullable=True)
    report_id = Column(PG_UUID(as_uuid=True), ForeignKey("reports.report_id", ondelete="SET NULL"), nullable=True)
    page_number = Column(Integer, nullable=True)
    needs_review = Column(Boolean, default=False, nullable=False)
    raw_text_snippet = Column(Text, nullable=True)

    __table_args__ = (
        CheckConstraint(
            "event_type IN ('mud_loss', 'kick', 'stuck_pipe', 'pressure_anomaly', 'torque_anomaly', 'other')",
            name="chk_drilling_event_type"
        ),
    )


class DrillingParameter(Base):
    __tablename__ = "drilling_parameters"

    param_id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    well_id = Column(PG_UUID(as_uuid=True), ForeignKey("wells.well_id", ondelete="CASCADE"), nullable=False)
    depth_m = Column(Float, nullable=True)
    rop = Column(Float, nullable=True)
    rpm = Column(Float, nullable=True)
    torque = Column(Float, nullable=True)
    mud_weight = Column(Float, nullable=True)
    pressure = Column(Float, nullable=True)
    ts = Column(DateTime, nullable=True)


class Telemetry(Base):
    __tablename__ = "telemetry"

    telemetry_id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    well_id = Column(PG_UUID(as_uuid=True), ForeignKey("wells.well_id", ondelete="CASCADE"), nullable=False)
    depth_m = Column(Float, nullable=True)
    params = Column(JSONB, nullable=True)
    ts = Column(DateTime, nullable=True)


class WellSimilarity(Base):
    __tablename__ = "well_similarity"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    well_a = Column(PG_UUID(as_uuid=True), ForeignKey("wells.well_id", ondelete="CASCADE"), nullable=False)
    well_b = Column(PG_UUID(as_uuid=True), ForeignKey("wells.well_id", ondelete="CASCADE"), nullable=False)
    score = Column(Float, nullable=False)
    breakdown = Column(JSONB, nullable=True)
    computed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class RiskAlert(Base):
    __tablename__ = "risk_alerts"

    alert_id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    well_id = Column(PG_UUID(as_uuid=True), ForeignKey("wells.well_id", ondelete="CASCADE"), nullable=False)
    depth_m = Column(Float, nullable=True)
    risk_level = Column(String(50), nullable=True)
    evidence_ids = Column(JSONB, nullable=True)
    confidence = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class AuditLog(Base):
    __tablename__ = "audit_logs"

    log_id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True)
    action = Column(String(100), nullable=True)
    entity = Column(String(100), nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
