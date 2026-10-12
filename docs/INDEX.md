# AgentGate Documentation Portal

Welcome to the **AgentGate** comprehensive documentation hub. This guide is organized for both developers extending the codebase and operators deploying AgentGate in production.

---

## Navigation & Documentation Index

* **Live GitHub Wiki**: [https://github.com/mohitdebian/AgentGate/wiki](https://github.com/mohitdebian/AgentGate/wiki)
* **REST API OpenAPI Specification**: [openapi.yaml](openapi.yaml)
* **Architecture Decision Records**: [adr/](adr/)

### 1. [Getting Started Guide](GETTING_STARTED.md)
* Prerequisites (Docker, GPU passthrough, `uv` runtime).
* One-command local startup via Docker Compose.
* Running live verification and stress test simulations.
* Accessing and navigating the web console.

### 2. [System Architecture](ARCHITECTURE.md)
* High-level request interception flow.
* Fastify Proxy & BPE Exact Tokenization (`gpt-tokenizer`).
* Horizontal Scaling via Postgres Pub/Sub (`LISTEN` / `pg_notify`).
* Real-time Server-Sent Events (SSE) streaming architecture.
* Fail-Closed Security Guarantees & Zod Schema Validation.

### 3. [Unsloth Decision Engine & ML](DECISION_ENGINE.md)
* Why Unsloth over generic LLMs (vLLM vs `FastDecisionModel`).
* The Clef classification head: Zero text generation, direct probability output.
* 4-bit LoRA fine-tuning on `LocalLLaMA/typed-decisions`.
* VRAM Budgeting on constrained consumer GPUs (e.g., NVIDIA RTX 2050 4GB).
* How to run the local training script (`train_decision_model.py`).

### 4. [Policy Engine & Replay Guide](POLICY_ENGINE.md)
* YAML policy specification syntax.
* Rule evaluation order & strictest-action resolution.
* Historical Dry-Run Replay engine: Evaluating draft rules on stored decisions without invoking the model.
* Dynamic policy activation with atomic DB transactions.

### 5. [API & SSE Reference](API_REFERENCE.md)
* Agent session endpoints (`POST /v1/sessions`).
* Action assessment endpoint (`POST /v1/assess`).
* Keyset cursor pagination on decisions (`GET /v1/decisions`).
* Real-time event streaming (`GET /v1/decisions/stream`).
* Human approval resolution (`POST /v1/approvals/:id`).

### 6. [UI & Design Specification](DESIGN.md)
* Design tokens and color system (`--bg`, `--pn`, `--ac`, etc.).
* Hairline borders, Inter & JetBrains Mono typography.
* No-drawer single-page philosophy.
