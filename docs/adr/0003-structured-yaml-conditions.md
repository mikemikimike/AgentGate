# 3. Structured YAML conditions, no expression eval

Date: 2026-10-08

## Status
Accepted

## Context
The policy layer needs rules. Allowing arbitrary expressions (like JS or CEL) adds a security risk (code injection).

## Decision
We will use structured YAML conditions (all, any, gt, lt) instead of arbitrary expression evaluation.

## Consequences
- No code injection surface.
- Easy to parse, validate against a schema, and replay against historical data.
- Limits the expressiveness of the rules (can't do complex math or loops).
