"""Phase 1 initial schema

Revision ID: 001_phase1_schema
Revises:
Create Date: 2026-09-28

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from geoalchemy2 import Geometry
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision = '001_phase1_schema'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Extensions
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    op.execute('CREATE EXTENSION IF NOT EXISTS postgis')
    op.execute('CREATE EXTENSION IF NOT EXISTS vector')

    # users
    op.create_table(
        'users',
        sa.Column('user_id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('username', sa.String(100), unique=True, nullable=False),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('role', sa.String(50)),
    )

    # wells
    op.create_table(
        'wells',
        sa.Column('well_id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('geom', Geometry(geometry_type='POINT', srid=4326)),
        sa.Column('spud_date', sa.DateTime()),
        sa.Column('total_depth_m', sa.Float()),
        sa.Column('status', sa.String(50)),
    )

    # formations
    op.create_table(
        'formations',
        sa.Column('formation_id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('well_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('wells.well_id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('top_depth_m', sa.Float()),
        sa.Column('base_depth_m', sa.Float()),
        sa.Column('lithology', sa.Text()),
    )

    # reports
    op.create_table(
        'reports',
        sa.Column('report_id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('well_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('wells.well_id', ondelete='CASCADE'), nullable=False),
        sa.Column('report_type', sa.String(100)),
        sa.Column('file_path', sa.Text()),
        sa.Column('upload_date', sa.DateTime()),
    )

    # report_chunks
    op.create_table(
        'report_chunks',
        sa.Column('chunk_id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('report_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('reports.report_id', ondelete='CASCADE'), nullable=False),
        sa.Column('page_number', sa.Integer()),
        sa.Column('raw_text', sa.Text()),
        sa.Column('embedding', Vector(384)),
    )

    # mitigations
    op.create_table(
        'mitigations',
        sa.Column('mitigation_id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('action_text', sa.Text()),
        sa.Column('outcome', sa.Text()),
    )

    # drilling_events
    op.create_table(
        'drilling_events',
        sa.Column('event_id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('well_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('wells.well_id', ondelete='CASCADE'), nullable=False),
        sa.Column('formation_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('formations.formation_id', ondelete='SET NULL')),
        sa.Column('depth_m', sa.Float()),
        sa.Column('event_type', sa.String(50), nullable=False),
        sa.Column('severity', sa.String(50)),
        sa.Column('description', sa.Text()),
        sa.Column('mitigation_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('mitigations.mitigation_id', ondelete='SET NULL')),
        sa.Column('report_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('reports.report_id', ondelete='SET NULL')),
        sa.Column('page_number', sa.Integer()),
        sa.CheckConstraint("event_type IN ('mud_loss', 'kick', 'stuck_pipe', 'pressure_anomaly', 'torque_anomaly', 'other')", name='chk_drilling_event_type'),
    )

    # drilling_parameters
    op.create_table(
        'drilling_parameters',
        sa.Column('param_id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('well_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('wells.well_id', ondelete='CASCADE'), nullable=False),
        sa.Column('depth_m', sa.Float()),
        sa.Column('rop', sa.Float()),
        sa.Column('rpm', sa.Float()),
        sa.Column('torque', sa.Float()),
        sa.Column('mud_weight', sa.Float()),
        sa.Column('pressure', sa.Float()),
        sa.Column('ts', sa.DateTime()),
    )

    # telemetry
    op.create_table(
        'telemetry',
        sa.Column('telemetry_id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('well_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('wells.well_id', ondelete='CASCADE'), nullable=False),
        sa.Column('depth_m', sa.Float()),
        sa.Column('params', postgresql.JSONB()),
        sa.Column('ts', sa.DateTime()),
    )

    # well_similarity
    op.create_table(
        'well_similarity',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('well_a', postgresql.UUID(as_uuid=True), sa.ForeignKey('wells.well_id', ondelete='CASCADE'), nullable=False),
        sa.Column('well_b', postgresql.UUID(as_uuid=True), sa.ForeignKey('wells.well_id', ondelete='CASCADE'), nullable=False),
        sa.Column('score', sa.Float(), nullable=False),
        sa.Column('breakdown', postgresql.JSONB()),
        sa.Column('computed_at', sa.DateTime()),
    )

    # risk_alerts
    op.create_table(
        'risk_alerts',
        sa.Column('alert_id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('well_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('wells.well_id', ondelete='CASCADE'), nullable=False),
        sa.Column('depth_m', sa.Float()),
        sa.Column('risk_level', sa.String(50)),
        sa.Column('evidence_ids', postgresql.JSONB()),
        sa.Column('confidence', sa.String(50)),
        sa.Column('created_at', sa.DateTime()),
    )

    # audit_logs
    op.create_table(
        'audit_logs',
        sa.Column('log_id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.user_id', ondelete='SET NULL')),
        sa.Column('action', sa.String(100)),
        sa.Column('entity', sa.String(100)),
        sa.Column('timestamp', sa.DateTime()),
    )


def downgrade() -> None:
    op.drop_table('audit_logs')
    op.drop_table('risk_alerts')
    op.drop_table('well_similarity')
    op.drop_table('telemetry')
    op.drop_table('drilling_parameters')
    op.drop_table('drilling_events')
    op.drop_table('mitigations')
    op.drop_table('report_chunks')
    op.drop_table('reports')
    op.drop_table('formations')
    op.drop_table('wells')
    op.drop_table('users')
