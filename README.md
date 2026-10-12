# AgentGate

AgentGate is an out-of-process authorization proxy and security gateway for autonomous AI agent tool execution. It intercepts tool invocations prior to runtime, evaluates prompt injection and blast-radius risks via a sub-40ms neural classification head, and enforces deterministic access control policies before actions reach production infrastructure.

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
* **Decision Engine (`decision/`)**: High-throughput FastAPI inference server. Runs a fine-tuned Qwen 0.8B multi-choice classification model via Unsloth. In development or non-GPU environments, automatically falls back to an integrated stub evaluator.
* **Storage (`postgres`)**: PostgreSQL 16 instance storing audit logs, evaluation traces, and approval state. Supports real-time dashboard subscriptions via `pg_notify`.
* **Management Console (`dashboard/`)**: React 18 / Vite operator interface. Provides real-time event stream monitoring, a human-in-the-loop approvals desk, and offline policy replay against historic traffic.

---

## Risk Classification Model

Instead of relying on prompt-based LLM judges (which introduce 500–2000ms latency and remain susceptible to prompt injection), AgentGate evaluates tool invocations using a single forward pass across four calibrated classification heads:

| Head | Output Classes | Operational Purpose |
| :--- | :--- | :--- |
| `untrusted_influence` | `none`, `possible`, `likely` | Detects whether the current action is driven by untrusted prompt injection. |
| `goal_alignment` | `aligned`, `tangential`, `misaligned` | Detects behavioral drift away from the agent's stated session objective. |
| `reversibility` | `reversible`, `costly`, `irreversible` | Quantifies the blast radius and rollback difficulty of the target action. |
| `external_send` | `yes`, `no` | Flags outbound network transmissions, webhooks, or data exfiltration attempts. |

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

## Client Integration

### 1. Model Context Protocol (MCP) Wrapper
AgentGate provides a transparent stdio wrapper for Model Context Protocol servers. It intercepts tool requests between MCP clients (e.g., Claude Desktop, Cursor, local IDEs) and downstream tool servers:

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

### 2. Direct HTTP API

Any agent framework (LangChain, AutoGen, CrewAI, custom Python/TypeScript runtimes) can integrate using standard REST calls.

#### Python Example

```python
import requests

GATEWAY = "http://localhost:8080"

# 1. Initialize an agent session
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
| `DECISION_MODEL_PATH` | Decision | `""` | Path to custom fine-tuned model checkpoint weights. |

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
