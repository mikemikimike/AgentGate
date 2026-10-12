# Operations and Deployment Guide

This guide covers operational best practices, health checks, monitoring metrics, and configuration options for running AgentGate in production environments.

---

## Production Deployment with Docker Compose

A standard production deployment utilizes `docker-compose.yml`:

```bash
# Pull images and boot stack in detached mode
docker compose up -d

# Inspect live container health
docker compose ps
```

### Resource Allocation Recommendations

| Service | CPU (Min / Rec) | RAM (Min / Rec) | Storage |
| :--- | :--- | :--- | :--- |
| `proxy` | 0.5 core / 2 cores | 512 MB / 2 GB | Ephemeral |
| `decision` (GPU) | 2 cores / 4 cores | 4 GB / 8 GB (plus 4GB VRAM) | Model weights (approx. 2 GB) |
| `decision` (CPU stub) | 0.5 core / 1 core | 512 MB / 1 GB | Ephemeral |
| `postgres` | 1 core / 2 cores | 1 GB / 4 GB | Persistent volume for audit trails |
| `dashboard` | 0.2 core / 0.5 core | 256 MB / 512 MB | Ephemeral |

---

## Observability & Metrics

AgentGate exposes a standard Prometheus metrics endpoint on the proxy gateway.

### Prometheus Metrics Endpoint
* **Path**: `GET http://localhost:8080/metrics`
* **Scrape Interval**: 10s recommended

Key metrics include:
* `agentgate_assess_requests_total`: Total number of assessment requests processed, partitioned by verdict (`allow`, `deny`, `ask`).
* `agentgate_decision_latency_ms`: Histogram of decision model inference latencies.
* `agentgate_policy_eval_duration_ms`: Duration of deterministic policy rule evaluation.

### Health Probes
Configure your container orchestrator (Kubernetes / ECS / Nomad) with the following probes:

* **Proxy Liveness / Readiness**:
  ```http
  GET http://localhost:8080/metrics
  ```
  Expected: HTTP 200

* **Decision Engine Health**:
  ```http
  GET http://localhost:9000/health
  ```
  Expected: HTTP 200 `{"status": "ok"}`

---

## Fail-Closed Operational Drills

### Decision Engine Disconnection Drill
If the decision engine becomes partitioned or crashes:
1. The proxy waits up to `AG_DECISION_DEADLINE_MS` (default 5000ms).
2. Upon timeout, the proxy invokes `defaults.on_model_error: ask`.
3. The proposed action is withheld from execution and enqueued in PostgreSQL.
4. The agent is halted safely without allowing unchecked access to production infrastructure.

---

## Dry-Run Policy Replay

Before promoting changes to `policy.yaml` in production, use the replay endpoint:

```bash
curl -X POST http://localhost:8080/v1/policy/replay \
  -H "Content-Type: application/json" \
  -d '{
    "yaml": "version: 2\ntools:\n  bash_exec:\n    default: deny\n  \"*\":\n    default: ask",
    "limit": 500
  }'
```

The replay engine tests your proposed rule changes against the last 500 historic decisions stored in PostgreSQL, returning a breakdown of verdict diffs (`allow -> deny`, `ask -> deny`) without affecting live traffic.
