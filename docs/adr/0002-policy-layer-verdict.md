# 2. Verdict comes from a policy layer, not the model

Date: 2026-10-08

## Status
Accepted

## Context
The decision model produces probabilities. We need a way to map these probabilities to a final verdict (allow, ask, deny).

## Decision
The verdict will come from a separate policy layer, not directly from the model. 

## Consequences
- Operators can change thresholds per tool without retraining the model.
- The policy layer creates an auditable trail of why a decision was made.
- Adds complexity to the proxy component (policy evaluation engine).
