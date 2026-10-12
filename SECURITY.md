# Security Policy 🛡️

AgentGate is a security-critical infrastructure component designed to guard autonomous AI agent tool executions. We take the security of AgentGate itself and the systems it protects very seriously.

---

## 🔒 Supported Versions

We provide security updates and patches for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | :white_check_mark: |
| < 0.2.0 | :x:                |

---

## 🚨 Reporting a Vulnerability

If you discover a potential security vulnerability in AgentGate, **please do not disclose it publicly or open a public GitHub issue.**

### How to Report

1. **Email:** Send details of the vulnerability to `security@agentgate.dev` (or the repository maintainers).
2. **Details to include:**
   - A clear description of the vulnerability (e.g. prompt injection bypass, policy evasion, proxy denial-of-service).
   - Step-by-step reproduction instructions or a minimal proof-of-concept.
   - Any affected components (`proxy`, `decision`, `dashboard`, `database`).
   - Your proposed remediation, if available.

### What to Expect

* **Response SLA:** We will acknowledge receipt of your report within 48 hours.
* **Assessment:** We will confirm the issue, rate its severity using CVSS, and keep you updated on progress.
* **Fix & Advisory:** We will coordinate a release date for the security patch and publicly credit your discovery (if desired).
