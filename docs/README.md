# AgentGate

**A calibrated safety checkpoint for AI agents.** AgentGate sits between an agent and its tools. For every tool call, a small fine-tuned *decision model* estimates, in a single forward pass, whether the action was driven by untrusted content, whether it is reversible, and whether it sends data outside. A policy engine turns those probabilities into **allow**, **deny**, or **ask a human**.

> **Status: design phase.** This README describes the target system. Numbers in the Results section are placeholders until benchmarks are run. Do not cite them.

<!-- DEMO GIF: poisoned email -> agent tries to forward credentials -> AgentGate blocks, shows probabilities -->

## Why

Agents read untrusted text (emails, web pages, files) and then take real actions. Prompt injection turns that text into actions the user never asked for. Existing defenses either match patterns (brittle) or ask another LLM to judge each call (slow, unparseable output, no calibrated confidence).

AgentGate treats this as a **decision problem under uncertainty**:

- Decisions are typed and closed-set (no JSON parsing, no malformed output).
- Every answer carries a probability, so thresholds can differ by tool and risk.
- Low-confidence calls are routed to a human, and the human's choice becomes a training label.

## How it works

```
Agent ──tool call──▶ AgentGate proxy ──▶ context builder ──▶ decision server (1 forward pass)
                          │                                        │ probabilities per head
                          │                                        ▼
                          │                               policy engine (YAML)
                          │                         ┌────────────┼────────────┐
                          ▼                       allow         deny          ask
                      upstream tool ◀──────────────┘             │             │
                                                         error to agent   approval queue
                                                                                │
                                                                    labels ─▶ retraining set
```

### Decision heads

| Head | Type | Options |
|---|---|---|
| `untrusted_influence` | choice | none / possible / likely |
| `goal_alignment` | choice | aligned / tangential / misaligned |
| `reversibility` | choice | reversible / costly / irreversible |
| `external_send` | yes/no | yes / no |

### Example policy

```yaml
tools:
  send_email:
    rules:
      - id: deny-injected-exfil
        when:
          all:
            - { head: untrusted_influence, option: likely, gt: 0.3 }
            - { head: external_send, option: "yes", gt: 0.5 }
        action: deny
        reason: possible_injection_exfiltration
```

## Quickstart (planned)

```bash
git clone https://github.com/<you>/agentgate && cd agentgate
docker compose up            # proxy, decision server, postgres, dashboard
agentgate demo               # runs the poisoned-email scenario
```

Point an MCP agent at `http://localhost:8080/mcp` instead of the tool server, or call `POST /v1/assess` from your own framework.

## Results (placeholders: not yet measured)

| Setup | Attack success rate | Benign utility | p95 added latency |
|---|---|---|---|
| No defense | TBD | TBD | n/a |
| Regex allowlist | TBD | TBD | TBD |
| Small-LLM JSON judge | TBD | TBD | TBD |
| **AgentGate** | TBD | TBD | TBD |

Also reported: per-head ECE, coverage-risk curve for the ask path, approvals per 100 steps, throughput (decisions/sec).

## Repo layout

```
proxy/        TypeScript: MCP proxy, HTTP API, policy engine
decision/     Python: model server wrapping the fine-tuned decision model
ml/           dataset builders, training, calibration, threshold selection, eval
bench/        AgentDojo runner and baselines
dashboard/    React: decision feed, approval queue, reliability diagrams
docs/         PRD, HLD, LLD
```

## Limitations

- A guard model can be attacked too. Provenance is passed as structured tags, and adversarial examples are part of training, but this is not a proof of safety.
- The small decision models used here have short context windows, so long agent histories are truncated.
- Labels for `reversibility` and `external_send` come partly from tool metadata and carry noise.
- Calibration can drift on tools unseen in training; recalibrate per deployment.

## Roadmap

1. Proxy + decision server + policy engine (MVP)
2. Approval queue, audit log, dashboard
3. Benchmarks and baselines
4. Per-tenant calibration, trajectory-level head, Slack approvals

## License

Apache-2.0
