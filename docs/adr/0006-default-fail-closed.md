# 6. Default fail-closed

Date: 2026-10-08

## Status
Accepted

## Context
When the decision server or database is unavailable, the proxy must decide how to handle tool calls.

## Decision
We will default to fail-closed behavior when the system is unhealthy.

## Consequences
- Safe default; prevents unauthorized actions during outages.
- Can cause availability issues for agents if the gate goes down.
- Read-only tools can be explicitly configured to fail-open if needed.
