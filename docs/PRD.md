# AgentGate: Product Requirements Document

Version 0.1 · Status: Draft · Owner: project author

## 1. Summary

AgentGate is an open-source runtime guard for AI agents. It intercepts tool calls, scores them with a fine-tuned decision model, and applies a configurable policy to allow, deny, or escalate to a human. It is both a usable developer tool and a portfolio project demonstrating backend, systems, and applied-ML engineering.

## 2. Problem

Agents combine untrusted input with real authority (shell, email, payments, databases). Failure modes:

1. **Prompt injection:** instructions hidden in tool output cause actions the user never requested.
2. **Over-reach:** the agent takes irreversible or high-impact actions without confirmation.
3. **Data exfiltration:** sensitive data is sent to external destinations.

Current approaches: static allowlists (cannot judge intent), LLM-as-judge per call (adds latency, produces unparseable text, gives no calibrated confidence).

## 3. Goals

| ID | Goal |
|---|---|
| G1 | Reduce attack success rate on public agent-security benchmarks while keeping most benign tasks working |
| G2 | Add low, measured latency per tool call |
| G3 | Expose calibrated probabilities and let operators set cost-based thresholds per tool |
| G4 | Route uncertain calls to humans and capture their decisions as labels |
| G5 | Be reproducible: open weights, open data builders, one-command demo |

## 4. Non-goals

- Not a complete agent sandbox or OS-level isolation.
- Not a general content-moderation system.
- Not a guarantee against adaptive attackers.
- No multi-tenant SaaS, billing, or SSO in v1.
- No custom model training UI (training is scripted).

## 5. Users

| Persona | Need |
|---|---|
| **Agent developer** | Drop-in guard for an agent without rewriting it |
| **Security reviewer** | Auditable log of every decision and policy version |
| **Approver** | Fast queue to review uncertain calls with enough context |
| **Evaluator** (recruiter/engineer) | Clear README, benchmark table, runnable demo |

## 6. User stories

- As a developer, I point my MCP agent at the proxy and tool calls are checked with no code change.
- As a developer on another framework, I call `POST /v1/assess` before executing a tool.
- As a security reviewer, I write per-tool rules in YAML and replay last week's traffic against a new policy before activating it.
- As an approver, I see the goal, the proposed action, the model's probabilities and the recent steps, and click approve or deny.
- As a maintainer, I retrain from approved/denied labels and compare the new model to the current one before promoting it.

## 7. Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| FR1 | MCP proxy mode: act as an MCP server to the agent and an MCP client to upstream tool servers | P0 |
| FR2 | HTTP API `POST /v1/assess` returning verdict, per-head probabilities, reason codes, versions | P0 |
| FR3 | Decision model returns answers for 4 heads in one call (untrusted influence, goal alignment, reversibility, external send) | P0 |
| FR4 | YAML policy with structured conditions over probabilities; strictest matching action wins | P0 |
| FR5 | Abstain rule: if the top probability of any configured head is below a threshold, verdict is `ask` | P0 |
| FR6 | Approval queue with timeout; timeout defaults to deny | P0 |
| FR7 | Append-only audit log of every decision with model and policy versions | P0 |
| FR8 | Per-tool fail-open / fail-closed behavior when the model is unavailable | P0 |
| FR9 | Dashboard: live feed, approval queue, per-head reliability diagram | P1 |
| FR10 | Policy replay: evaluate a draft policy on stored decisions and show verdict changes | P1 |
| FR11 | Argument redaction before storage (secrets, tokens) | P1 |
| FR12 | Prometheus metrics endpoint | P1 |
| FR13 | Threshold selection tool that targets a maximum attack miss rate on a calibration set | P1 |
| FR14 | Fifth head `sensitive_data` and trajectory-level `progress` head | P2 |
| FR15 | Slack approval integration | P2 |

## 8. Non-functional requirements

Targets are hypotheses to verify, not measured results.

| ID | Requirement | Target |
|---|---|---|
| NFR1 | Proxy overhead excluding model call | p95 < 10 ms |
| NFR2 | Model call per decision (GPU) | p95 < 100 ms |
| NFR3 | Throughput on one GPU | measure and report; aim for 50+ decisions/sec |
| NFR4 | Availability behavior | Defined per tool; default fail-closed |
| NFR5 | Auditability | Every verdict reproducible from stored inputs + versions |
| NFR6 | Security | Auth on all APIs; secrets redacted; model server not publicly exposed |
| NFR7 | Reproducibility | `docker compose up` brings up full stack; benchmark script reproduces README table |

## 9. Success metrics

Primary:

- **Attack success rate (ASR)** with vs without AgentGate on a held-out benchmark suite.
- **Benign utility retained:** fraction of benign tasks that still complete.

Secondary: false-positive rate at fixed false-negative rate; per-head ECE; coverage-risk curve for the ask path; approvals per 100 steps (approval fatigue); latency percentiles; throughput.

Baselines: no defense, regex allowlist, small-LLM JSON judge, text-level injection classifier.

## 10. Milestones (6 weeks)

| Week | Deliverable | Exit criterion |
|---|---|---|
| 1 | Training recipe running; ~500 rows from benchmark traces; first model | **Go/no-go:** `untrusted_influence` head clearly beats regex and LLM-judge baselines on a held-out suite |
| 2 | Proxy skeleton, decision server, allow/deny path | End-to-end call blocked in demo |
| 3 | Policy engine, calibration, thresholds | Policy tests pass; ECE reported |
| 4 | Approval queue, audit log, dashboard | Human can resolve an ask |
| 5 | Benchmarks, baselines, load tests | Results table filled with measured numbers |
| 6 | Hardening, docs, demo GIF, write-up | Fresh-clone quickstart works |

Fallback if week 1 fails: switch the product to a database-migration risk checker, reusing the proxy, policy and approval infrastructure.

## 11. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Model does not beat baselines | Core claim fails | Week-1 go/no-go; fallback project |
| Small context window truncates histories | Missed signal | Token-budgeted context builder; larger base model if needed |
| Label noise from heuristic annotators | Misleading metrics | Hand-label a hard subset; report on it separately |
| Benchmark leakage | Inflated results | Split by suite and attack template |
| Guard is itself manipulated | Bypass | Structured provenance, escaped delimiters, adversarial training |
| Approval fatigue | Tool unusable | Track approvals per 100 steps; tune abstain thresholds |
| Scope creep | Unfinished | P2 items cut first |

## 12. Open questions

1. Exact Unsloth fine-tuning entry point and dataset row format for Laya checkpoints (confirm from docs / Hugging Face dataset).
2. How the user's goal reaches the proxy in MCP mode (see HLD decision D4).
3. Which benchmark suite is held out for final evaluation.
4. Whether to publish the trained weights and dataset builders (license review of source benchmarks).
