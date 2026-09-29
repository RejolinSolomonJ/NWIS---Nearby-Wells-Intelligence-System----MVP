# NWIS-X Makefile — SIH26121 (Oil India Ltd)
# Usage: make demo | make dev | make test | make reset | make clean

.PHONY: demo dev test reset clean build

# Full demo: build + start all containers
demo: build
	docker compose up -d
	@echo ""
	@echo "╔══════════════════════════════════════════════════════╗"
	@echo "║  NWIS-X Demo Ready — SIH26121                      ║"
	@echo "║  Frontend: http://localhost:5173                    ║"
	@echo "║  Backend:  http://localhost:8000/health             ║"
	@echo "║  Accounts: admin/admin123, engineer/engineer123     ║"
	@echo "╚══════════════════════════════════════════════════════╝"

# Build all images
build:
	docker compose build

# Local development (no Docker)
dev:
	@echo "Starting backend..."
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
	@echo "Starting frontend..."
	cd frontend && npm run dev

# Run all tests
test:
	cd backend && python -m pytest tests/ -v
	cd frontend && npx tsc --noEmit

# Reset demo data
reset:
	python scripts/reset_demo.py

# Tear down everything
clean:
	docker compose down -v --remove-orphans
	@echo "All containers and volumes removed."
