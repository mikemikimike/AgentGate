# AgentGate Architecture & Engineering Principles

This document details the architectural decisions, data flow, concurrency patterns, and security guarantees built into AgentGate.

---

## 1. High-Level System Architecture

```
                                      ┌─────────────────────────────────────────┐
                                      │              Agent Runtime              │
                                      │    (LangChain / AutoGen / Claude / MCP) │
                                      └────────────────────┬────────────────────┘
                                                           │
                                        POST /v1/assess    │
                                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       AgentGate Fastify Proxy                                          │
│                                                                                                        │
│   ┌─────────────────────┐       ┌──────────────────────┐       ┌───────────────────────────────────┐   │
│   │   Zod Validation    │ ───▶  │ BPE Token Counting   │ ───▶  │      Context Builder              │   │
│   │ (AssessRequest)     │       │   (gpt-tokenizer)    │       │ (User Goal + Recent Steps + Tool) │   │
│   └─────────────────────┘       └──────────────────────┘       └─────────────────┬─────────────────┘   │
│                                                                                  │                     │
└──────────────────────────────────────────────────────────────────────────────────┼─────────────────────┘
                                                                                   │
                                           POST /decide (HTTP/JSON)                │
                                                                                   ▼
                                                             ┌───────────────────────────────────────────┐
                                                             │         Unsloth Decision Server           │
                                                             │                                           │
                                                             │   ┌───────────────────────────────────┐   │
                                                             │   │ Qwen3.5-0.8B (4-bit Transformer)  │   │
                                                             │   └─────────────────┬─────────────────┘   │
                                                             │                     │ (Hidden States)     │
                                                             │   ┌─────────────────▼─────────────────┐   │
                                                             │   │      Clef Multi-Choice Head       │   │
                                                             │   │ (4 Simultaneous Heads, Zero Text) │   │
                                                             │   └─────────────────┬─────────────────┘   │
                                                             └─────────────────────┼─────────────────────┘
                                                                                   │
                                           Calibrated Probabilities                │
                                                                                   ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       Policy Evaluation & Routing                                      │
│                                                                                                        │
│             ┌───────────────────┐              ┌───────────────────┐             ┌───────────────────┐ │
│             │       ALLOW       │              │       DENY        │             │        ASK        │ │
│             │  (Forward to tool)│              │  (Fail-closed err)│             │ (Approvals Queue) │ │
│             └───────────────────┘              └───────────────────┘             └─────────┬─────────┘ │
│                                                                                            │           │
│                                            Postgres Pub/Sub                                │           │
│                                          pg_notify('decisions') ◀──────────────────────────┘           │
└─────────────────────────────────────────────────────┬──────────────────────────────────────────────────┘
                                                      │
                                                      ▼
                                       ┌─────────────────────────────┐
                                       │     Postgres Database       │
                                       │ (Audit Log + Stored State)  │
                                       └──────────────┬──────────────┘
                                                      │
                                  SSE Broadcast       │ (LISTEN)
                                                      ▼
                                       ┌─────────────────────────────┐
                                       │     Operations Dashboard    │
                                       │   (React + EventSource)     │
                                       └─────────────────────────────┘
```

---

## 2. Core Architectural Pillars

### A. Stateless by Default & Horizontal Scaling
* The Fastify proxy stores **zero session or decision state in Node.js heap memory**.
* All state is written directly to Postgres with ACID guarantees.
* **Distributed Pub/Sub:** Earlier prototypes used in-process `EventEmitter`. In production, this breaks when scaling to multiple proxy pods behind a load balancer. We replaced `EventEmitter` with **Postgres `LISTEN` / `pg_notify`**. Any proxy instance that writes a decision automatically broadcasts an event that all other proxy instances relay to their connected SSE clients.

### B. Fail-Closed Security Guarantees (Rule #8)
* If the Decision Engine is unreachable, throws an error, or exceeds its timeout deadline (`AG_DECISION_DEADLINE_MS = 500ms`), the proxy **never falls back to allow**.
* It immediately logs the error and evaluates the default fallback action: either rejecting the action outright or escalating to a human in the Approvals Queue.

### C. Keyset / Cursor Pagination (No Quadratic `OFFSET` Traps)
* Traditional SQL queries like `SELECT * FROM decisions LIMIT 50 OFFSET 10000` degrade quadratically ($O(N)$ scanning), leading to high CPU usage under heavy write loads.
* The decisions API strictly uses **Keyset Cursor Pagination** based on the ISO-8601 timestamp:
  ```sql
  SELECT * FROM decisions 
  WHERE created_at < $1 
  ORDER BY created_at DESC 
  LIMIT $2;
  ```
* Every page response includes a `cursor` token that the client passes as `?cursor=<timestamp>` to fetch the next slice in $O(\log N)$ index-seek time.

### D. Exact BPE Token Counting
* Most proxies approximate token counts via `Math.ceil(text.length / 4)`. This creates vulnerabilities where large Unicode payloads or code scripts exceed the LLM's context window, silently truncating critical security instructions.
* AgentGate integrates `gpt-tokenizer`, performing exact BPE tokenization during the `buildContext` phase to guarantee that context bounds are strictly enforced before hitting the decision engine.

### E. Deterministic Argument Redaction & Hashing
* Sensitive fields in tool arguments (passwords, auth tokens, AWS secrets) are structurally scrubbed via `redactArguments()`.
* The `args_sha256` hash is computed using a **deterministic key-sorted JSON stringifier** (`deterministicStringify`), guaranteeing identical hash signatures regardless of object key ordering.
