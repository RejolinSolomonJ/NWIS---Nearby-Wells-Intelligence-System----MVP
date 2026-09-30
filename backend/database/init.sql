-- ==============================================================================
-- NWIS-X Database Initialization Script
-- Enables PostGIS + pgvector extensions
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;

-- Verification
SELECT postgis_version();
SELECT extname, extversion FROM pg_extension WHERE extname IN ('postgis', 'vector', 'uuid-ossp');
