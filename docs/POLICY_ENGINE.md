# Policy Engine & Governance Reference

AgentGate decouples risk estimation (the neural model) from governance and compliance rules (the Policy Engine). This ensures security engineers can update thresholds, whitelist tools, or block attack vectors instantly in YAML without retraining the neural network.

---

## 1. Complete Policy Configuration Reference (`policy.yaml`)

Below is the full anatomy of what can be customized in `policy.yaml`:

```yaml
version: 2

# -------------------------------------------------------------
# 1. Global Defaults & Neural Safety Nets
# -------------------------------------------------------------
defaults:
  # Action to take if the model errors, times out, or circuit breaker trips
  # Options: ask | deny | allow (Default: ask for fail-closed security)
  on_model_error: ask

  # Neural Uncertainty Escalation (Abstain)
  # If the model's top confidence score is below max_prob_below,
  # the policy automatically escalates to human review ('ask').
  abstain:
    heads:
      - untrusted_influence
      - goal_alignment
    max_prob_below: 0.55   # Float between 0.0 and 1.0

# -------------------------------------------------------------
# 2. Per-Tool Security Rules
# -------------------------------------------------------------
tools:
  # Exact tool match
  bash_exec:
    rules:
      - id: deny-untrusted-exec
        when:
          head: untrusted_influence
          option: likely
          gt: 0.50
        action: deny
        reason: "Untrusted prompt influence detected on shell execution."

      - id: ask-high-blast-radius
        when:
          head: reversibility
          option: irreversible
          gt: 0.60
        action: ask
        reason: "Irreversible shell command requires manual operator confirmation."
    default: ask          # Fallback verdict if no rules match

  # Wildcard tool pattern matching (e.g., send_email, send_slack, send_http)
  "send_*":
    rules:
      - id: deny-injected-exfil
        when:
          all:
            - { head: untrusted_influence, option: likely, gt: 0.50 }
            - { head: external_send, option: "yes", gt: 0.50 }
        action: deny
        reason: "Prompt injection detected; blocking external data exfiltration."
    default: ask

  # Whitelisted benign tools
  read_file:
    default: allow        # Automatically allowed unless abstain triggers

  # Global Fallback (matches any unrecognized tool)
  "*":
    default: ask          # Fail-closed default: route to Approvals queue
```

---

## 2. All Customizable Elements Explained

### A. The 4 Calibrated Neural Heads & Valid Options
The neural model computes probabilities across 4 heads for every proposed action:

| Head Name | Options | Security Meaning |
| :--- | :--- | :--- |
| **`untrusted_influence`** | `none`, `possible`, `likely` | Detects prompt injection (untrusted text from emails, web, or docs influencing execution). |
| **`goal_alignment`** | `aligned`, `tangential`, `misaligned` | Detects autonomous agent goal drift away from the user's initial objective. |
| **`reversibility`** | `reversible`, `costly`, `irreversible` | Assesses blast radius (e.g., read-only vs hard-to-undo vs permanent destructive change). |
| **`external_send`** | `yes`, `no` | Identifies if confidential data or API keys are leaving the environment. |

### B. Condition Logic (`when`)
A rule's `when` block evaluates the probabilities output by the model:
- **`head`**: Which neural head to inspect (`untrusted_influence`, `goal_alignment`, `reversibility`, `external_send`).
- **`option`**: The choice to check (e.g. `likely`, `misaligned`, `irreversible`, `yes`).
- **`gt`** / **`lt`**: Threshold comparison (e.g. `gt: 0.50` triggers when probability $> 50\%$).
- **`all`**: Logical AND — all nested conditions must match.
- **`any`**: Logical OR — at least one nested condition must match.

### C. Actions & Conflict Resolution
Each rule outputs one of three verdicts:
- **`deny`**: Reject the execution immediately.
- **`ask`**: Pause execution and route to the human Approvals Queue.
- **`allow`**: Permit automatic execution.

**Action Precedence (Strictest Always Wins):**
$$\text{deny} > \text{ask} > \text{allow}$$
If rule A outputs `allow` and rule B outputs `deny`, the final verdict is always **`deny`**.

### D. Abstain Guardrail (`defaults.abstain`)
Protects against model hallucination or uncertainty. If the model cannot produce an answer with confidence $\ge \text{max\_prob\_below}$, AgentGate rejects autonomous execution and yields **`Ask`** with reason code `abstain_low_confidence`.

---

## 3. Workflow: Testing and Promoting Policies

1. **`Validate`**: Runs JSON Schema and YAML syntax checks in the UI editor.
2. **`Replay on sample decisions`**: Re-evaluates draft rules against up to 100 historical database decisions in $<5\text{ms}$ with zero model inference cost. Displays a before/after transition matrix showing the exact blast radius.
3. **`Activate v{N}`**: Atomically writes the new revision to PostgreSQL (`UPDATE policies SET active = false; INSERT ... active = true;`). The proxy gateway hot-reloads the rules with zero downtime.

