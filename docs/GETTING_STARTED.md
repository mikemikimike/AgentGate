# Getting Started with AgentGate

This guide walks you through setting up, running, testing, and developing on AgentGate from scratch.

---

## 1. System Requirements

* **Operating System:** Linux, macOS, or Windows (WSL2 recommended).
* **Docker & Docker Compose:** Docker v20.10+ with Compose v2+.
* **NVIDIA GPU (Optional but Recommended):** NVIDIA GPU with drivers + `nvidia-container-toolkit` for running the Unsloth Decision Engine. AgentGate automatically falls back to the low-latency stub if no GPU is available.
* **Node.js (Optional):** Node v20+ if modifying the test suite locally.

---

## 2. Quickstart via Docker Compose

AgentGate runs as four coordinated container services:
1. `postgres` (Port 5432 internal): Stores audit logs, sessions, decisions, approvals, and powers pub/sub notifications.
2. `decision` (Port 9000): Serves calibrated model decisions via FastAPI/Unsloth.
3. `proxy` (Port 8080): High-throughput Fastify proxy intercepting agent calls, applying policies, and publishing SSE events.
4. `dashboard` (Port 5173): Linear/Vercel-style operations console built in React + Vite.

### Start the Stack
```bash
docker compose up -d
```

Verify that all containers are healthy:
```bash
docker compose ps
```

All 4 services should report `healthy` or `Up`.

---

## 3. Accessing the Services

* **Dashboard Web UI:** [http://localhost:5173](http://localhost:5173)
* **Proxy Metrics & Health:** [http://localhost:8080/metrics](http://localhost:8080/metrics)
* **Decision Server Health:** [http://localhost:9000/health](http://localhost:9000/health)

---

## 4. Running the Verification Test Suite

AgentGate includes automated test scripts to stress-test the proxy and simulate live agent traffic.

### A. Concurrent Load & Keyset Pagination Test
Fires 100 concurrent mock agent actions simultaneously to benchmark proxy overhead and verify database locks:
```bash
node test_scripts/load_test.js
```
* **Expected Output:** 100% success rate, throughput >150 req/sec, p50 latency <100ms.

### B. Live Traffic & SSE Streaming Simulation
Spawns an active agent session and streams realistic benign and malicious commands in real time:
```bash
node test_scripts/stream_simulation.js
```
* **What to Watch:** Open [http://localhost:5173](http://localhost:5173) in your browser. You will see decisions populating the table live without any manual browser refresh.

---

## 5. Environment Variables Configuration

Configure your environment by passing variables in `docker-compose.yml` or a root `.env` file:

| Variable | Default | Service | Description |
|---|---|---|---|
| `DATABASE_URL` | `postgresql://user:pass@postgres:5432/agentgate` | `proxy` | Postgres connection string |
| `AG_DECISION_URL` | `http://decision:9000` | `proxy` | Address of the decision engine |
| `AG_DECISION_DEADLINE_MS` | `500` | `proxy` | Decision server timeout before fail-closed fallback |
| `USE_UNSLOTH` | `0` (or `1`) | `decision` | Set to `1` to enable GPU-accelerated Unsloth inference |
| `VITE_API_URL` | `http://proxy:8080` | `dashboard` | Proxy target used by Vite development server |

---

## 6. Troubleshooting Common Issues

### Vite Proxy Error: `getaddrinfo EAI_AGAIN proxy`
* **Cause:** The dashboard container started before the proxy container finished its initialization.
* **Fix:** Run `docker compose restart dashboard`.

### Host `npm install` socket timeouts (`ERR_SOCKET_TIMEOUT`)
* **Cause:** Host network throttling or MTU drops on the public npm registry.
* **Fix:** The dashboard is containerized in Docker and builds using an internal bridge network, completely bypassing host npm issues. Never run `npm install` on the host if network issues persist.
