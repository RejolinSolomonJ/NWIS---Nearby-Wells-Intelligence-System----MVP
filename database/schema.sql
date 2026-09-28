-- ==============================================================================
-- NWIS-X: Nearby Wells Intelligence & Risk eXplorer
-- Database Schema (PostgreSQL 15 + PostGIS + pgvector)
-- SIH26121 — Oil India Ltd
-- SIMULATED DATA ONLY
-- ==============================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'viewer', -- admin, engineer, viewer
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Wells Table (with PostGIS Geometry)
CREATE TABLE IF NOT EXISTS wells (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    well_name VARCHAR(200) NOT NULL,
    well_id_code VARCHAR(100) UNIQUE NOT NULL,
    field_name VARCHAR(200) NOT NULL,
    block_name VARCHAR(200),
    operator VARCHAR(200) DEFAULT 'Oil India Ltd (Simulated)',
    well_type VARCHAR(50), -- exploration, development, appraisal
    status VARCHAR(50), -- drilling, completed, abandoned, suspended
    spud_date TIMESTAMP WITH TIME ZONE,
    completion_date TIMESTAMP WITH TIME ZONE,
    total_depth_m FLOAT,
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    geom geometry(Point, 4326),
    elevation_m FLOAT,
    kelly_bushing_m FLOAT,
    metadata_json JSONB DEFAULT '{}'::jsonb,
    is_simulated BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wells_geom ON wells USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_wells_field ON wells (field_name);
CREATE INDEX IF NOT EXISTS idx_wells_name ON wells (well_name);

-- 3. Formations Table
CREATE TABLE IF NOT EXISTS formations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    well_id UUID NOT NULL REFERENCES wells(id) ON DELETE CASCADE,
    formation_name VARCHAR(200) NOT NULL,
    top_depth_m FLOAT NOT NULL,
    bottom_depth_m FLOAT NOT NULL,
    lithology VARCHAR(200),
    age VARCHAR(200),
    porosity_pct FLOAT,
    permeability_md FLOAT,
    pressure_psi FLOAT,
    temperature_c FLOAT,
    fluid_type VARCHAR(100),
    remarks TEXT,
    is_simulated BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_formations_well ON formations (well_id);
CREATE INDEX IF NOT EXISTS idx_formations_depth ON formations (top_depth_m, bottom_depth_m);
CREATE INDEX IF NOT EXISTS idx_formations_name ON formations (formation_name);

-- 4. Documents Table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    well_id UUID REFERENCES wells(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    doc_type VARCHAR(100), -- well_completion_report, mud_log, daily_drilling_report, geological_evaluation
    file_path VARCHAR(1000),
    file_hash VARCHAR(64),
    page_count INTEGER,
    ocr_status VARCHAR(50) DEFAULT 'completed',
    extraction_status VARCHAR(50) DEFAULT 'completed',
    metadata_json JSONB DEFAULT '{}'::jsonb,
    is_simulated BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_documents_well ON documents (well_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents (doc_type);

-- 5. Document Chunks (with pgvector 384-dimensional embeddings for all-MiniLM-L6-v2)
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    page_number INTEGER,
    content TEXT NOT NULL,
    embedding vector(384),
    metadata_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chunks_document ON document_chunks (document_id);
-- ivfflat index created after initial population or conditionally

-- 6. Drilling Events Table
CREATE TABLE IF NOT EXISTS drilling_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    well_id UUID NOT NULL REFERENCES wells(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL, -- kick, lost_circulation, stuck_pipe, gas_show, wellbore_instability, mud_loss
    severity VARCHAR(20) NOT NULL, -- low, medium, high, critical
    depth_m FLOAT NOT NULL,
    depth_end_m FLOAT,
    formation_name VARCHAR(200),
    event_date TIMESTAMP WITH TIME ZONE,
    duration_hours FLOAT,
    description TEXT NOT NULL,
    root_cause TEXT,
    action_taken TEXT,
    mud_weight_ppg FLOAT,
    mud_type VARCHAR(100),
    npt_hours FLOAT,
    cost_usd FLOAT,
    source_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    source_page INTEGER,
    metadata_json JSONB DEFAULT '{}'::jsonb,
    is_simulated BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_events_well ON drilling_events (well_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON drilling_events (event_type);
CREATE INDEX IF NOT EXISTS idx_events_severity ON drilling_events (severity);
CREATE INDEX IF NOT EXISTS idx_events_depth ON drilling_events (depth_m);

-- 7. Risk Assessments Table (Deterministic Rule-Engine Output)
CREATE TABLE IF NOT EXISTS risk_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    well_id UUID NOT NULL REFERENCES wells(id) ON DELETE CASCADE,
    assessment_type VARCHAR(100) NOT NULL, -- pre_drill, while_drilling, post_drill
    overall_risk_score FLOAT NOT NULL,
    confidence FLOAT NOT NULL,
    depth_m FLOAT,
    formation_name VARCHAR(200),
    geological_risk FLOAT DEFAULT 0.0,
    mechanical_risk FLOAT DEFAULT 0.0,
    pressure_risk FLOAT DEFAULT 0.0,
    historical_risk FLOAT DEFAULT 0.0,
    risk_factors JSONB DEFAULT '[]'::jsonb,
    similar_well_ids JSONB DEFAULT '[]'::jsonb,
    evidence_summary TEXT,
    source_documents JSONB DEFAULT '[]'::jsonb,
    is_simulated BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_risk_well ON risk_assessments (well_id);
CREATE INDEX IF NOT EXISTS idx_risk_score ON risk_assessments (overall_risk_score);

-- 8. Alerts Table
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    well_id UUID NOT NULL REFERENCES wells(id) ON DELETE CASCADE,
    alert_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL, -- info, warning, critical
    title VARCHAR(500) NOT NULL,
    message TEXT NOT NULL,
    why TEXT NOT NULL,
    related_well_ids JSONB DEFAULT '[]'::jsonb,
    depth_m FLOAT,
    formation_name VARCHAR(200),
    evidence JSONB DEFAULT '[]'::jsonb,
    source_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    source_page INTEGER,
    similarity_score FLOAT,
    confidence FLOAT,
    is_read BOOLEAN DEFAULT FALSE,
    is_acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by UUID REFERENCES users(id),
    is_simulated BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alerts_well ON alerts (well_id);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts (severity);
CREATE INDEX IF NOT EXISTS idx_alerts_read ON alerts (is_read);

-- 9. Copilot Conversations Table (Audit Log)
CREATE TABLE IF NOT EXISTS copilot_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    well_id UUID REFERENCES wells(id) ON DELETE SET NULL,
    query TEXT NOT NULL,
    response TEXT NOT NULL,
    citations JSONB DEFAULT '[]'::jsonb,
    is_approved BOOLEAN,
    reviewed_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_copilot_user ON copilot_conversations (user_id);
CREATE INDEX IF NOT EXISTS idx_copilot_well ON copilot_conversations (well_id);
