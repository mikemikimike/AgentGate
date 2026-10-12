#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "=========================================================="
echo " Starting AgentGate System"
echo "=========================================================="

# 1. Start Docker containers (PostgreSQL, Proxy, Dashboard)
echo "[1/3] Starting Docker services (PostgreSQL, Proxy, Dashboard)..."
docker compose up -d postgres proxy dashboard

# 2. Start GPU Decision Server if not already running
echo "[2/3] Checking GPU Decision Server (Unsloth on RTX 2050)..."
if curl -s http://localhost:9000/health > /dev/null 2>&1; then
    echo "       GPU Decision Server is already running on port 9000."
else
    echo "       Launching GPU Decision Server on port 9000..."
    nohup env USE_UNSLOTH=1 "$DIR/decision/.venv_unsloth/bin/python" -m uvicorn src.app:app --host 0.0.0.0 --port 9000 --app-dir "$DIR/decision" > "$DIR/decision.log" 2>&1 &
    
    echo -n "       Waiting for neural model to load into VRAM..."
    for i in {1..40}; do
        if curl -s http://localhost:9000/health > /dev/null 2>&1; then
            echo " Ready!"
            break
        fi
        echo -n "."
        sleep 1
    done
fi

# 3. Verify System Health
echo "[3/3] Verifying stack health..."
sleep 2

MODEL_INFO=$(curl -s http://localhost:8080/v1/model || echo '{"is_stub": true}')
echo "       Model status: $MODEL_INFO"

echo ""
echo "=========================================================="
echo " AgentGate is running successfully!"
echo "=========================================================="
echo " - Dashboard:         http://localhost:5173"
echo " - Approvals Queue:   http://localhost:5173/approvals"
echo " - Policy Editor:     http://localhost:5173/policy"
echo " - Proxy API Gateway: http://localhost:8080"
echo " - GPU Engine:        http://localhost:9000"
echo " - Logs:              tail -f decision.log"
echo "=========================================================="
