# System Architecture

AgentGate operates as an out-of-process security checkpoint positioned between autonomous AI agents and downstream execution tools.

---

## High-Level Topology

```
+-----------------------------------------------------------------------------+
|                               Agent Client                                  |
|               (Claude Desktop, Cursor, LangChain, CrewAI)                   |
+-----------------------------------------------------------------------------+
                                      |
                         POST /v1/assess { action }
                                      v
+-----------------------------------------------------------------------------+
|                         AgentGate Proxy (:8080)                             |
|                           [Fastify / Node.js]                               |
|                                                                             |
|  * Context Window Assembly (BPE Token Budgeting)                            |
|  * Deterministic Policy Evaluation (deny > ask > allow)                     |
|  * Event Streaming (SSE) & Prometheus Metrics (/metrics)                    |
+-----------------------------------------------------------------------------+
               |                                              |
      POST /decide (<40ms)                          Audit Log / Approval State
               v                                              v
+------------------------------+             +--------------------------------+
|   Decision Engine (:9000)    |             |       PostgreSQL 16 (:5432)    |
|      [FastAPI / Python]      |             |                                |
|                              |             |  * decisions & session traces  |
|  * Unsloth Qwen-0.8B Head    |             |  * approval queue & audit logs |
|  * Single Forward Pass       |             |  * pg_notify event bus         |
+------------------------------+             +--------------------------------+
                                                              ^
                                                              | SSE Live Stream
                                             +--------------------------------+
                                             |     Operator Console (:5173)   |
                                             |       [React 18 / Tailwind]    |
                                             +--------------------------------+
```

---

## Request Evaluation Pipeline

When an agent requests permission to execute a tool:

1. **Ingress & Authentication**: The proxy validates the incoming request payload (`session_id`, `action.tool`, `action.arguments`).
2. **Context Window Token Budgeting**: The proxy aggregates prior agent actions and environment outputs for the current session, trimming history to fit the model's token budget using BPE encoding.
3. **Inference Dispatch**: The compiled context and proposed action are forwarded to the decision service via `POST /decide`.
4. **Deadline Enforcement**: The proxy enforces a hard deadline (`AG_DECISION_DEADLINE_MS`, default 5000ms). If the decision engine fails or exceeds this deadline, the configured `defaults.on_model_error` policy (default: `ask`) is triggered.
5. **Deterministic Policy Matching**: The probability vector returned by the decision service is evaluated against `policy.yaml`.
6. **Persistence & Audit Log**: The decision record, input hashes, and model probability distribution are written to PostgreSQL.
7. **Verdict Return**:
   * `allow`: Agent proceeds to execute the tool directly.
   * `deny`: Execution is blocked immediately, returning specific error codes.
   * `ask`: The action is suspended in PostgreSQL, waiting for an operator decision via the dashboard or approval API.

---

## Component Specifications

### 1. Gateway Proxy (`proxy/`)
* **Runtime**: Node.js 22, Fastify, TypeScript.
* **Responsibilities**:
  * Exposes client REST API (`/v1/sessions`, `/v1/assess`).
  * Enforces deterministic YAML policy rules.
  * Streams real-time audit flight-recorder events via Server-Sent Events (SSE).
  * Serves Prometheus metrics on `/metrics`.

### 2. Decision Engine (`decision/`)
* **Runtime**: Python 3.11, FastAPI, Uvicorn.
* **Responsibilities**:
  * Hosts the fine-tuned Qwen 0.8B classification model loaded via Unsloth.
  * In CPU or non-GPU development environments, gracefully falls back to an integrated stub evaluator.
  * Exposes health probe on `/health` and model metadata on `/model`.

### 3. Event Store (`postgres`)
* **Runtime**: PostgreSQL 16 Alpine.
* **Responsibilities**:
  * Persists session state, decisions, audit logs, and approval queues.
  * Delivers low-latency real-time updates to connected dashboards using `LISTEN/NOTIFY`.

### 4. Operator Console (`dashboard/`)
* **Runtime**: React 18, Vite, Tailwind CSS.
* **Responsibilities**:
  * Live flight-recorder monitoring over SSE.
  * Human-in-the-loop approvals desk (`Approve` / `Deny` actions held with `ask`).
  * Dry-run policy replay engine testing rule modifications against historic production events.
