-- ============================================================
-- NWIS-X Database Initialization Script
-- Enables PostGIS + pgvector extensions
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
