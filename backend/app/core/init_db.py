"""
NWIS-X Database Auto-Initialization & Seeding Service.
Executes safely without transaction abortion.
"""

import os
import logging
from sqlalchemy import text
from app.core.database import engine

logger = logging.getLogger("nwis.init_db")


def _find_file(filename: str) -> str:
    candidates = [
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "database", filename),
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "database", filename),
        os.path.join(os.getcwd(), "database", filename),
        os.path.join(os.getcwd(), "backend", "database", filename),
        os.path.join("/app", "database", filename),
    ]
    for c in candidates:
        if os.path.exists(c):
            return os.path.abspath(c)
    return ""


async def initialize_and_seed_db() -> dict:
    """Initialize schema, extensions, and seed data safely."""
    summary = {
        "status": "pending",
        "extensions_enabled": [],
        "schema_created": False,
        "seeded": False,
        "wells_count": 0,
        "errors": []
    }

    schema_file = _find_file("schema.sql")
    seed_file = _find_file("seed.sql")

    # Step 1: Safe non-failing check if wells table already exists
    try:
        async with engine.connect() as conn:
            check_query = text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'wells');")
            res = await conn.execute(check_query)
            table_exists = res.scalar()
            if table_exists:
                res_count = await conn.execute(text("SELECT COUNT(*) FROM wells;"))
                count = res_count.scalar()
                if count and count > 0:
                    summary["status"] = "already_initialized"
                    summary["wells_count"] = count
                    logger.info(f"Database already initialized with {count} wells.")
                    return summary
    except Exception as e:
        logger.warning(f"Safe table existence check encountered: {e}")

    # Step 2: Fresh connection for extensions, DDL and DML
    try:
        async with engine.connect() as conn:
            raw_conn = await conn.get_raw_connection()
            driver_conn = getattr(raw_conn, "driver_connection", raw_conn)

            # 1. Enable Extensions
            for ext in ['"uuid-ossp"', 'postgis', 'vector']:
                try:
                    await driver_conn.execute(f"CREATE EXTENSION IF NOT EXISTS {ext};")
                    summary["extensions_enabled"].append(ext)
                except Exception as e:
                    logger.warning(f"Could not enable extension {ext}: {e}")
                    summary["errors"].append(f"extension_{ext}: {str(e)}")

            # 2. Execute schema.sql
            if schema_file and os.path.exists(schema_file):
                try:
                    with open(schema_file, "r", encoding="utf-8") as f:
                        schema_sql = f.read()
                    await driver_conn.execute(schema_sql)
                    summary["schema_created"] = True
                    logger.info("Schema tables created successfully.")
                except Exception as e:
                    logger.error(f"Error executing schema.sql: {e}")
                    summary["errors"].append(f"schema: {str(e)}")

            # 3. Execute seed.sql
            if seed_file and os.path.exists(seed_file):
                try:
                    with open(seed_file, "r", encoding="utf-8") as f:
                        seed_sql = f.read()
                    await driver_conn.execute(seed_sql)
                    summary["seeded"] = True
                    logger.info("Demo dataset seeded successfully.")
                except Exception as e:
                    logger.error(f"Error executing seed.sql: {e}")
                    summary["errors"].append(f"seed: {str(e)}")

            # 4. Verify well count after seed
            try:
                res = await conn.execute(text("SELECT COUNT(*) FROM wells;"))
                summary["wells_count"] = res.scalar() or 0
                summary["status"] = "success"
            except Exception as e:
                summary["errors"].append(f"count_verify: {str(e)}")

    except Exception as e:
        logger.error(f"Fatal error during initialize_and_seed_db: {e}")
        summary["status"] = "failed"
        summary["errors"].append(f"fatal: {str(e)}")

    return summary
