# Developer Contributing & Architecture Guide

Welcome to the AgentGate developer documentation.

For a full navigation directory, please refer to the [AgentGate Documentation Index](INDEX.md).

---

## 🛠️ Quick Directory of Developer Docs

* **[Getting Started & Local Setup](GETTING_STARTED.md):** How to run the entire system via Docker Compose, configure environment variables, and run load tests.
* **[System Architecture](ARCHITECTURE.md):** Fastify Proxy interception, Postgres pub/sub (`LISTEN`/`pg_notify`), exact BPE tokenization, and fail-closed security.
* **[Unsloth Decision Engine](DECISION_ENGINE.md):** Clef classification heads, 4-bit LoRA training, and GPU inference.
* **[Policy Engine & Replay Guide](POLICY_ENGINE.md):** Writing rules in YAML, conflict resolution, and dry-run historical replaying.
* **[API Reference](API_REFERENCE.md):** HTTP REST endpoints, Zod payload schemas, and SSE streaming.
* **[Design & CSS Specifications](DESIGN.md):** The Vercel/Linear style guide, color tokens, and layout guidelines.

---

## 💻 Local Codebase Structure

```
├── proxy/             # TypeScript Fastify proxy (BPE tokenization, Policy engine, SSE)
│   ├── src/api/       # HTTP routes, Zod schemas, Postgres LISTEN/pg_notify
│   ├── src/audit/     # Deterministic JSON stringify & argument redaction
│   └── src/context/   # Exact BPE token counting via gpt-tokenizer
├── decision/          # Python Decision Server (FastAPI + Unsloth)
│   ├── src/app.py     # FastAPI decision routes
│   ├── src/model_loader.py # FastDecisionModel integration + Clef head
│   └── train_decision_model.py # 60-step fast calibration fine-tuning
├── dashboard/         # React + Vite frontend (Tailwind tokens, Data tables, EventSource)
│   ├── src/features/feed/      # Decisions table, Approvals queue, Decision detail
│   ├── src/features/policy/    # YAML Policy editor & historical diff preview
│   └── src/styles/tokens.css   # Single source of truth CSS design tokens
├── test_scripts/      # Automated verification & load test suites
└── docs/              # Master architectural specifications & user guides
```
