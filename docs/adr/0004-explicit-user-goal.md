# 4. User goal supplied explicitly

Date: 2026-10-08

## Status
Accepted

## Context
The gate needs to know the user's goal to evaluate `goal_alignment`. MCP does not natively carry the user's goal. Inferring it from traffic is error-prone.

## Decision
The user goal must be supplied explicitly (via session init API, header, or a reserved tool call).

## Consequences
- Removes a failure source (incorrect goal inference).
- Requires agent developers to integrate with AgentGate explicitly to pass the goal.
