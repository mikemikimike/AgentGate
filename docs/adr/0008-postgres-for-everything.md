# 8. Postgres for everything in v1

Date: 2026-10-08

## Status
Accepted

## Context
We need to store sessions, decisions, policies, models, and approvals. A distributed system might use Kafka or Redis, but that increases operational complexity.

## Decision
We will use Postgres for everything in v1. 

## Consequences
- Simple deployment (only one stateful dependency).
- Approval waits handled via in-process promises (can use LISTEN/NOTIFY if scaled out later).
- May become a bottleneck at extremely high throughput, but sufficient for v1.
