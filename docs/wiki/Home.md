# AgentGate Wiki

Welcome to the technical documentation wiki for **AgentGate**, an out-of-process authorization proxy and security gateway for autonomous AI agent tool execution.

---

## Overview

AgentGate intercepts tool calls prior to execution, evaluates prompt injection and blast-radius risks via a sub-40ms neural classification head, and enforces deterministic access control policies before actions reach production infrastructure.

This wiki provides comprehensive architecture specifications, integration guides, operational runbooks, and policy configuration references for engineering teams operating AgentGate in production.

---

## Documentation Index

### 1. System Design & Architecture
* [[Architecture]]: Technical specification of the Fastify reverse proxy, FastAPI decision server, PostgreSQL storage layer, and fail-closed runtime semantics.
* [[Neural-Risk-Heads]]: Deep dive into the 4 calibrated classification heads (`untrusted_influence`, `goal_alignment`, `reversibility`, `external_send`) and latency budgets.

### 2. Policy & Access Control
* [[Policy-Engine-Specification]]: Complete DSL reference for `policy.yaml`, rule evaluation precedence (`deny > ask > allow`), and confidence thresholds.

### 3. Integration & Deployment
* [[Client-Integration-Guide]]: Step-by-step integration guides for Model Context Protocol (MCP) clients, Python (LangChain, CrewAI, AutoGen), and REST HTTP clients.
* [[Operations-and-Deployment]]: Production deployment guidelines, Docker Compose configuration, environment variables, Prometheus metrics, and health probes.

---

## Key Architectural Principles

1. **Fail-Closed by Default**: If the decision engine is unreachable, times out, or encounters an internal error, the gateway rejects or escalates to human operator review. It never fails open silently.
2. **Stateless Gateway**: Push persistent state to PostgreSQL. The proxy remains horizontally scalable behind a layer-7 load balancer without sticky sessions.
3. **Deterministic Enforcement**: Machine learning models estimate probabilities; deterministic code enforces policies. No fuzzy generative text judges in the security boundary.
4. **Sub-50ms Latency Budget**: Risk scoring operates on a single forward pass without autoregressive token generation, preserving real-time agent responsiveness.
