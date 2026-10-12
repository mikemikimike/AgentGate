# Policy Engine Specification

AgentGate evaluates all actions against a declarative YAML configuration file (`policy.yaml`).

---

## Evaluation Semantics

1. **Precedence Hierarchy**:
   When multiple rules match for an action, the most restrictive action wins:
   $$\text{deny} > \text{ask} > \text{allow}$$
   If any matching rule dictates `deny`, the action is rejected immediately. If no rule dictates `deny` but at least one dictates `ask`, the action is enqueued for operator approval.

2. **Abstention Safeguards (`abstain`)**:
   If the neural classification head's highest confidence for a critical head fails to exceed a configured probability threshold (`max_prob_below`), the engine abstains and automatically promotes the decision to `ask`.

3. **Fallback Matching**:
   Tool matching supports exact names (`bash_exec`), glob wildcards (`send_*`), and a global catch-all (`*`).

---

## Schema Reference

### Root Attributes

| Field | Type | Description |
| :--- | :--- | :--- |
| `version` | Integer | Configuration schema version (currently `2`). |
| `defaults` | Object | Global fallbacks and model error handling. |
| `tools` | Object | Dictionary mapping tool patterns to rule definitions. |

### `defaults` Object

```yaml
defaults:
  on_model_error: ask    # Action taken if decision engine fails or times out ('ask' or 'deny')
  abstain:
    heads:
      - untrusted_influence
      - goal_alignment
    max_prob_below: 0.55 # Promotes to 'ask' if model confidence is below 55%
```

### `tools` Rules Definition

```yaml
tools:
  bash_exec:
    rules:
      - id: block-injected-shell
        when:
          head: untrusted_influence
          option: likely
          gt: 0.50
        action: deny
        reason: "Untrusted prompt influence exceeds safety threshold."

      - id: confirm-irreversible-shell
        when:
          head: reversibility
          option: irreversible
          gt: 0.60
        action: ask
        reason: "Irreversible shell operations require operator sign-off."
    default: ask

  "send_*":
    rules:
      - id: block-exfil
        when:
          all:
            - { head: untrusted_influence, option: likely, gt: 0.50 }
            - { head: external_send, option: "yes", gt: 0.50 }
        action: deny
        reason: "Outbound transmission blocked under untrusted influence."
    default: ask

  read_file:
    default: allow

  "*":
    default: ask
```

---

## Condition DSL Operators

* **Single condition**:
  ```yaml
  when:
    head: untrusted_influence
    option: likely
    gt: 0.50
  ```
* **Conjunction (`all`)**: Evaluates true only if all listed conditions match:
  ```yaml
  when:
    all:
      - { head: untrusted_influence, option: likely, gt: 0.50 }
      - { head: external_send, option: "yes", gt: 0.50 }
  ```
* **Disjunction (`any`)**: Evaluates true if any listed condition matches:
  ```yaml
  when:
    any:
      - { head: goal_alignment, option: misaligned, gt: 0.70 }
      - { head: reversibility, option: irreversible, gt: 0.60 }
  ```
