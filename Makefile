.PHONY: setup dev test lint up down

setup:
	@echo "Setting up AgentGate..."
	cd proxy && npx --yes pnpm install
	cd dashboard && npx --yes pnpm install
	cd decision && uv sync --extra dev

dev:
	@echo "Starting dev servers..."

test:
	@echo "Running tests..."
	cd proxy && npx --yes pnpm test
	cd dashboard && npx --yes pnpm test
	cd decision && uv run --extra dev pytest

lint:
	@echo "Running lint..."
	cd proxy && npx --yes pnpm lint
	cd dashboard && npx --yes pnpm lint
	cd decision && uv run --extra dev ruff check .

up:
	docker compose --profile stub up --build -d

down:
	docker compose down
