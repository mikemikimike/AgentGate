# 5. Small base model first

Date: 2026-10-08

## Status
Accepted

## Context
We need to select a base model for fine-tuning. Larger models are more capable but more expensive to serve and train.

## Decision
We will start with a small base model (Laya fine-tune) and only escalate to larger models (like Qwen-class) if context limits hurt performance.

## Consequences
- Cheapest to train and serve.
- May suffer from context truncation if agent histories are very long.
