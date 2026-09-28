-- ==============================================================================
-- NWIS-X Database Schema (PostgreSQL 15 + PostGIS + pgvector)
-- Phase 1 Exact Tables, Types, and Foreign Keys
-- ==============================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. users
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    role VARCHAR(50)
);

-- 2. wells
CREATE TABLE IF NOT EXISTS wells (
    well_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    geom geometry(Point, 4326),
    spud_date TIMESTAMP,
    total_depth_m FLOAT,
    status VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_wells_geom ON wells USING GIST (geom);

-- 3. formations
CREATE TABLE IF NOT EXISTS formations (
    formation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    well_id UUID REFERENCES wells(well_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    top_depth_m FLOAT,
    base_depth_m FLOAT,
    lithology TEXT
);

CREATE INDEX IF NOT EXISTS idx_formations_well_id ON formations(well_id);

-- 4. reports
CREATE TABLE IF NOT EXISTS reports (
    report_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    well_id UUID REFERENCES wells(well_id) ON DELETE CASCADE,
    report_type VARCHAR(100),
    file_path TEXT,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reports_well_id ON reports(well_id);

-- 5. report_chunks
CREATE TABLE IF NOT EXISTS report_chunks (
    chunk_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID REFERENCES reports(report_id) ON DELETE CASCADE,
    page_number INT,
    raw_text TEXT,
    embedding vector(384)
);

CREATE INDEX IF NOT EXISTS idx_report_chunks_report_id ON report_chunks(report_id);

-- 6. mitigations
CREATE TABLE IF NOT EXISTS mitigations (
    mitigation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_text TEXT,
    outcome TEXT
);

-- 7. drilling_events
CREATE TABLE IF NOT EXISTS drilling_events (
    event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    well_id UUID REFERENCES wells(well_id) ON DELETE CASCADE,
    formation_id UUID REFERENCES formations(formation_id) ON DELETE SET NULL,
    depth_m FLOAT,
    event_type VARCHAR(50) CHECK (event_type IN ('mud_loss', 'kick', 'stuck_pipe', 'pressure_anomaly', 'torque_anomaly', 'other')),
    severity VARCHAR(50),
    description TEXT,
    mitigation_id UUID REFERENCES mitigations(mitigation_id) ON DELETE SET NULL,
    report_id UUID REFERENCES reports(report_id) ON DELETE SET NULL,
    page_number INT
);

CREATE INDEX IF NOT EXISTS idx_drilling_events_well_id ON drilling_events(well_id);
CREATE INDEX IF NOT EXISTS idx_drilling_events_formation_id ON drilling_events(formation_id);
CREATE INDEX IF NOT EXISTS idx_drilling_events_event_type ON drilling_events(event_type);

-- 8. drilling_parameters
CREATE TABLE IF NOT EXISTS drilling_parameters (
    param_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    well_id UUID REFERENCES wells(well_id) ON DELETE CASCADE,
    depth_m FLOAT,
    rop FLOAT,
    rpm FLOAT,
    torque FLOAT,
    mud_weight FLOAT,
    pressure FLOAT,
    ts TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_drilling_params_well_id ON drilling_parameters(well_id);

-- 9. telemetry
CREATE TABLE IF NOT EXISTS telemetry (
    telemetry_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    well_id UUID REFERENCES wells(well_id) ON DELETE CASCADE,
    depth_m FLOAT,
    params JSONB,
    ts TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_telemetry_well_id ON telemetry(well_id);

-- 10. well_similarity
CREATE TABLE IF NOT EXISTS well_similarity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    well_a UUID REFERENCES wells(well_id) ON DELETE CASCADE,
    well_b UUID REFERENCES wells(well_id) ON DELETE CASCADE,
    score FLOAT,
    breakdown JSONB,
    computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_well_similarity_wells ON well_similarity(well_a, well_b);

-- 11. risk_alerts
CREATE TABLE IF NOT EXISTS risk_alerts (
    alert_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    well_id UUID REFERENCES wells(well_id) ON DELETE CASCADE,
    depth_m FLOAT,
    risk_level VARCHAR(50),
    evidence_ids JSONB,
    confidence VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_risk_alerts_well_id ON risk_alerts(well_id);

-- 12. audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    action VARCHAR(100),
    entity VARCHAR(100),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
