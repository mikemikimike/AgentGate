# Contributing to AgentGate 🛡️

Thank you for your interest in contributing to AgentGate! We welcome bug fixes, documentation improvements, new safety rules, and model integrations.

---

## 🛠️ Development Setup

AgentGate is designed around clean microservices. The entire stack can be run locally using Docker or natively on your workstation.

### Prerequisites
* Docker & Docker Compose (v2.20+)
* Node.js 20+ (for Proxy and Dashboard)
* Python 3.10+ (for Decision Model Engine)
* NVIDIA GPU with CUDA support (optional, CPU mode is supported)

### Quick Local Dev Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-org/agentgate.git
   cd agentgate
   ```

2. **Launch with Docker Compose:**
   ```bash
   docker compose up -d
   ```

3. **Verify running services:**
   * Dashboard: `http://localhost:5173`
   * Fastify Proxy: `http://localhost:8080/metrics`
   * ML Decision Engine: `http://localhost:9000/health`
   * PostgreSQL: `localhost:5432`

---

## 🧪 Testing

We enforce strict test coverage across frontend, backend, and machine learning components:

### Frontend Tests (Dashboard)
```bash
cd dashboard
npm test              # Run unit tests (Vitest)
npm run test:e2e      # Run Playwright E2E tests
npm run lint          # ESLint with 0 warnings
```

### Backend & Load Tests (Proxy)
```bash
# Run 100 concurrent mock agent calls
node test_scripts/load_test.js

# Run live streaming agent simulation
node test_scripts/stream_simulation.js
```

### ML Engine Tests
```bash
cd decision
pytest tests/
```

---

## 📐 Engineering Principles

When writing code for AgentGate, adhere to our Senior Engineering guidelines:

1. **Fail-Closed by Default:** Never fail open. If the model is down or timeouts occur, escalate to `Ask` or `Deny`.
2. **Stateless Gateway:** Push all persistence to PostgreSQL. The proxy must be horizontally scalable behind a load balancer without local session state.
3. **No Uncalibrated Text Judges:** Use single-forward-pass classification heads (`Clef`) instead of slow autoregressive generative LLMs for authorization.
4. **Deterministic Policy Precedence:** Always maintain `deny > ask > allow`.

---

## 🔄 Pull Request Process

1. Fork the repository and create your branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. Commit your changes with concise, descriptive commit messages adhering to Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`).
3. Ensure all tests and linters pass.
4. Open a Pull Request against `main` describing your changes and verification steps.
