# Security Policy

AgentGate is a security-critical infrastructure gateway designed to enforce access control over autonomous AI agent tool executions. We treat the security and resilience of AgentGate and the systems it protects with the highest priority.

---

## Supported Versions

Security patches and bug fixes are actively provided for the following releases:

| Version | Status |
| :--- | :--- |
| `0.1.x` | Supported |
| `< 0.1.0` | End of Life |

---

## Reporting a Vulnerability

If you identify a security vulnerability in AgentGate, do not disclose it publicly via GitHub issues, discussions, or social media.

### Coordinated Disclosure Process

1. **Submission**: Submit vulnerability details via GitHub Private Vulnerability Reporting or email the maintainers directly at `devbyte.mohit@gmail.com`.
2. **Information to Include**:
   * A technical description of the vulnerability (e.g., prompt injection bypass, policy evasion, authentication flaw, or denial-of-service vector).
   * Reproduction steps, curl commands, or a minimal proof-of-concept.
   * Affected components (`proxy`, `decision`, `dashboard`, `postgres`).
   * Potential blast radius and suggested remediation, if identified.

### Response Timelines

* **Initial Acknowledgment**: Within 48 hours of report receipt.
* **Triage & Severity Assessment**: Within 5 business days, including a CVSS rating.
* **Remediation & Advisory**: We coordinate release timing with the reporter and provide attribution in release notes unless anonymity is requested.
