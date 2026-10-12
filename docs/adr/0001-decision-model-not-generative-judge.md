# 1. Decision model, not generative judge

Date: 2026-10-08

## Status
Accepted

## Context
We need to judge if an agent's tool call is safe. The industry standard is an LLM-as-judge, but that approach suffers from high latency, unparseable outputs (JSON failures), and uncalibrated confidence. 

## Decision
We will use a fine-tuned decision model instead of a generative judge. The model will output closed-set classification probabilities for specific heads (e.g., untrusted_influence, goal_alignment).

## Consequences
- Lower latency and strict JSON structure.
- We get calibrated probabilities for policy thresholds.
- Requires building and maintaining a fine-tuning pipeline.
