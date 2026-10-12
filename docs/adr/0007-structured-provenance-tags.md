# 7. Provenance as structured tags in the prompt

Date: 2026-10-08

## Status
Accepted

## Context
The model needs to distinguish between trusted instructions and untrusted content (like email bodies).

## Decision
We will use structured tags (e.g., `<untrusted>...</untrusted>`) to indicate provenance in the prompt, and escape sentinel strings within the untrusted text.

## Consequences
- Easier for the model to learn than free-text hints.
- Harder for attackers to spoof, provided escaping is done correctly.
