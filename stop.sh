#!/usr/bin/env bash

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "Shutting down AgentGate..."

# 1. Stop GPU server
pkill -f "uvicorn src.app:app.*9000" || true

# 2. Stop Docker services
docker compose stop

echo "AgentGate stopped."
