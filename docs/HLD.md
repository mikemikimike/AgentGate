# AgentGate: High-Level Design

Version 0.1 · Status: Draft

## 1. Context

AgentGate is a policy enforcement point between an AI agent and its tools. The agent's tool-call requests are intercepted, scored by a decision model, and resolved to allow / deny / ask by a policy engine.

```
 ┌────────┐   tool call    ┌────────────────────────────────────────────┐   allowed call   ┌──────────────┐
 │ Agent  │───────────────▶│               AgentGate                    │─────────────────▶│ Tool servers │
 │ (MCP / │◀───────────────│  proxy · policy · approvals · audit        │◀─────────────────│  (upstream)  │
 │  HTTP) │  result/error  └───────┬──────────────┬─────────────────────┘     result       └──────────────┘
 └────────┘                        │              │
                                   ▼              ▼
                           Decision server    Human approver
                          (fine-tuned model)   (dashboard)
```

## 2. Components

| Component | Language | Responsibility |
|---|---|---|
| **Gate proxy** | TypeScript (Node) | MCP server/client, HTTP API, session state, context building, policy evaluation, approval orchestration |
| **Decision server** | Python | Loads the fine-tuned decision model; exposes `/decide`; batching and timeouts |
| **Store** | PostgreSQL | Sessions, decisions, approvals, labels, policies, model registry |
| **Dashboard** | React (Vite) | Live feed, approval queue, reliability diagrams, policy editor + replay |
| **ML pipeline** | Python | Dataset builders, training, calibration, threshold selection, evaluation |
| **Bench harness** | Python | Runs benchmark agents with and without the gate, runs baselines |

Rationale for the split: the proxy is I/O-bound and benefits from Node's async model and the official MCP SDK; the model server must be Python because the training and inference libraries are Python.

## 3. Data flow (single tool call)

```
1. Agent ──tools/call──▶ Proxy
2. Proxy: load session (goal, recent steps) ──▶ Context builder
3. Context builder: token-budgeted prompt + question set
4. Proxy ──POST /decide──▶ Decision server
5. Decision server: one forward pass ──▶ probabilities per head
6. Proxy: policy engine ──▶ verdict + reason codes
7a. allow: forward to upstream tool, tag result by trust level, append to session history
7b. deny:  return MCP error result with reason code
7c. ask:   create approval, wait (bounded), then 7a or 7b; timeout ⇒ deny
8. Write decision record (inputs hash, heads, verdict, versions, latencies)
```

## 4. Key design decisions

| ID | Decision | Alternatives | Why |
|---|---|---|---|
| D1 | Decision model, not generative judge | LLM-as-judge | Closed-set outputs, calibrated probabilities, no parse failures, lower latency |
| D2 | Verdict comes from a **policy layer**, not the model | Model outputs allow/deny directly | Thresholds change per tool and per operator without retraining; auditable |
| D3 | Structured YAML conditions, no expression `eval` | CEL / JS expressions | No code-injection surface; simple to validate and replay |
| D4 | User goal supplied explicitly (session init API / header / reserved `agentgate.set_goal` call) | Infer goal from traffic | MCP does not carry the user's goal; inference would add a failure source |
| D5 | Small base model first (Laya fine-tune), larger Qwen-class if context limits hurt | Start large | Cheapest to train; escalate only on evidence |
| D6 | Default fail-closed | Fail-open | Safe default; read-only tools may opt into fail-open |
| D7 | Provenance as structured tags in the prompt | Free-text hints | Easier to train, harder to spoof when delimiters are escaped |
| D8 | Postgres for everything in v1 | Kafka, Redis | One moving part; approval wait via in-process promises (LISTEN/NOTIFY if scaled out) |

## 5. Decision model interface

Heads (questions) per call:

| Head | Type | Options |
|---|---|---|
| `untrusted_influence` | choice | none, possible, likely |
| `goal_alignment` | choice | aligned, tangential, misaligned |
| `reversibility` | choice | reversible, costly, irreversible |
| `external_send` | yes/no | yes, no |

Output per head: chosen option plus probability for every option. The model never generates text.

## 6. Policy model

- Rules are per tool, with a `*` default.
- Each rule has structured conditions (`all` / `any` over `{head, option, gt|lt}`), an action (`allow|ask|deny`), and a reason code.
- All matching rules are collected; the **strictest action wins** (deny > ask > allow).
- **Abstain rule:** if any configured head's maximum probability is below a threshold, the verdict is at least `ask`.
- Policies are versioned; activation validates schema first; replay shows how a draft would have changed past verdicts.

## 7. Calibration and thresholds

1. Train with the Unsloth recipe; run its built-in calibration on a held-out set.
2. Check reliability per head **and per tool bucket**; a global fit can hide per-tool miscalibration.
3. Choose operating thresholds with a split-conformal rule on a calibration set so the attack miss rate is bounded in expectation under exchangeability.
4. Record the calibration report with the model version. Recalibrate when a deployment's tool mix differs.

## 8. Deployment

```
docker compose
 ├─ proxy        (Node, port 8080)
 ├─ decision     (Python + GPU, internal network only)
 ├─ postgres
 └─ dashboard    (static, served by proxy or nginx)
```

- Single-node for v1. Decision server is the only GPU consumer.
- CPU fallback image for demos (slower; clearly documented).
- Config via environment variables and a mounted policy file.

## 9. Scalability and performance

- Proxy and decision servers are stateless apart from in-flight approvals; scale horizontally behind a load balancer.
- Decision server: dynamic batching with a small max-wait window; bounded queue; reject with 503 when saturated so the proxy applies fail-open/closed.
- Measure and report: p50/p95/p99 model latency, proxy overhead, decisions/sec, GPU memory.
- No claim of per-call latency or throughput is made until measured on the target hardware.

## 10. Reliability and failure modes

| Failure | Behavior |
|---|---|
| Decision server timeout/error | Apply per-tool `on_model_error` (default `ask`/deny); circuit breaker after N failures |
| Postgres unavailable | Proxy refuses new calls (fail-closed) unless tool is configured read-only fail-open; audit write is mandatory |
| Approval timeout | Deny |
| Upstream tool error | Pass through; log |
| Malformed context (too long) | Truncate by priority; if action itself exceeds budget, `ask` |
| Policy file invalid | Keep last good version; surface error |

## 11. Security and threat model

Assets: tools with real authority, session data, audit log.
Attacker: controls text the agent reads (tool outputs); may know the system exists.

| Threat | Control |
|---|---|
| Injection causing harmful action | The gate itself; provenance-tagged inputs |
| Attacker text spoofs the guard's prompt structure | Escape sentinel/delimiter strings in untrusted text; structured fields |
| Attacker crafts text that scores "aligned" | Adversarial examples in training; abstain rule; monitor head entropy |
| Secrets stored in audit log | Redaction before write; store truncated args + hash |
| Unauthorized approval or policy change | Bearer-token auth, approver identity recorded, policy changes audited |
| Model server abuse | Internal network only, no public port |
| Tampered model weights | Checksums recorded in model registry |

Non-guarantees: no formal safety proof; adaptive attackers are out of scope for v1 claims.

## 12. Observability

- Prometheus: `agentgate_decisions_total{verdict,tool}`, `agentgate_model_latency_seconds`, `agentgate_proxy_overhead_seconds`, `agentgate_approvals_pending`, `agentgate_model_errors_total`, head-entropy histograms.
- Structured JSON logs with `decision_id` correlation.
- Dashboard drift view: per-head entropy and ask-rate over time.
- Shadow mode: run a candidate model alongside the active one and compare verdicts without enforcing.

## 13. Evaluation architecture

```
 benchmark tasks ──▶ agent runner ──▶ [no gate | baselines | AgentGate] ──▶ results store
                                                                   │
                                          ASR · utility · FPR@FNR · ECE · coverage-risk · latency
```

Splits are by suite and attack template, never random by step. Baselines: no defense, regex allowlist, small-LLM JSON judge, text-level injection classifier.

## 14. Risks carried into LLD

1. Short context windows require strict token budgeting.
2. Heuristic labels for reversibility and external send add noise.
3. Goal delivery in MCP mode needs a clean convention.
4. Approval waits must not exhaust connections under load.
