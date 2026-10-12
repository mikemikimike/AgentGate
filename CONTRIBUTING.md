# Contributing to AgentGate

Thank you for contributing to AgentGate. This document outlines the engineering standards, local environment setup, verification requirements, and pull request workflow for the repository.

---

## Codebase Organization

The repository is structured as a monorepo consisting of three primary services and supporting tooling:

| Directory | Language / Runtime | Description |
| :--- | :--- | :--- |
| `proxy/` | TypeScript / Node.js 22 | Fastify authorization proxy, policy engine, PostgreSQL audit logger, and SSE stream. |
| `decision/` | Python 3.11 / FastAPI | Sub-40ms neural classification server (Unsloth Qwen-0.8B) and CPU stub engine. |
| `dashboard/` | TypeScript / React 18 | Vite management interface, real-time audit flight recorder, and approvals desk. |
| `test_scripts/` | JavaScript / Node.js | Traffic simulation and latency load testing scripts. |
| `docs/` | Markdown | Technical specifications, architecture decision records (ADRs), and PRDs. |

---

## Local Development Setup

### Prerequisites

* **Node.js**: v22.x or later
* **pnpm**: v12.x or later (`npm i -g pnpm`)
* **Python**: v3.11.x or later
* **uv**: Astral `uv` package and project manager (`curl -LsSf https://astral.sh/uv/install.sh | sh`)
* **Docker & Docker Compose**: v2.20 or later

### Initial Setup

Clone the repository and run the top-level setup target:

```bash
git clone https://github.com/mohitdebian/AgentGate.git
cd AgentGate
make setup
```

`make setup` installs dependencies for the proxy, dashboard, and sets up a virtual environment with development dependencies for the decision engine via `uv sync --extra dev`.

### Running the Stack

#### Option A: Docker Compose (Recommended)

Run all services in isolated containers:

```bash
docker compose up -d
```

Service endpoints:
* **Dashboard Console**: `http://localhost:5173`
* **Proxy Gateway**: `http://localhost:8080` (`/metrics` for Prometheus)
* **Decision Server**: `http://localhost:9000` (`/health` for probe)
* **PostgreSQL**: `localhost:5432`

To tear down:
```bash
docker compose down
```

#### Option B: Native Host Processes

Start services individually during active development:

```bash
# Terminal 1: PostgreSQL
docker compose up postgres -d

# Terminal 2: Decision Server
cd decision
uv run uvicorn src.app:app --host 0.0.0.0 --port 9000 --reload

# Terminal 3: Proxy Gateway
cd proxy
pnpm dev

# Terminal 4: Dashboard
cd dashboard
pnpm dev
```

---

## Verification & Testing Standards

All code submitted to `main` must pass static analysis and unit test suites. Run tests locally before opening a pull request:

```bash
# Run linting across all services (ESLint + Ruff)
make lint

# Run all test suites (Vitest + Pytest)
make test
```

### Component-Specific Test Commands

* **Proxy (`proxy/`)**:
  ```bash
  cd proxy
  pnpm lint
  pnpm test
  ```

* **Dashboard (`dashboard/`)**:
  ```bash
  cd dashboard
  pnpm lint
  pnpm test
  ```

* **Decision Service (`decision/`)**:
  ```bash
  cd decision
  uv run --extra dev ruff check .
  uv run --extra dev pytest
  ```

---

## Engineering Non-Negotiables

When authoring code for AgentGate, adhere to the following architectural requirements:

1. **Fail-Closed Semantics**: Security controls must fail closed under all circumstances. If the decision engine is unavailable, times out (`AG_DECISION_DEADLINE_MS`), or encounters an unhandled exception, the proxy must default to `deny` or escalate to `ask`. Never fail open.
2. **Stateless Gateway**: Push persistent state to PostgreSQL. The proxy must remain horizontally scalable behind a layer-7 load balancer without sticky sessions or in-process session caches.
3. **Latency Budgets**: The decision path budget is strictly sub-50ms p99. Avoid blocking the Node.js event loop or performing heavy serial operations inside the request pipeline.
4. **Deterministic Policy Precedence**: Rule evaluation precedence must strictly maintain `deny > ask > allow`.
5. **Clean Dependency Boundaries**: Keep Python ML dependencies isolated. Core API serving code must never hard-depend on GPU libraries (e.g. PyTorch, CUDA, Unsloth) so that CI and lightweight CPU nodes can boot without overhead.

---

## Pull Request Workflow

1. **Branching**: Branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```

2. **Commit Conventions**: Use Conventional Commits formatting:
   * `feat:` New features or policy rule extensions
   * `fix:` Bug fixes and error handling corrections
   * `docs:` Documentation improvements
   * `refactor:` Code refactoring without behavior changes
   * `perf:` Performance and latency optimizations
   * `test:` New or updated automated tests

3. **Pre-Submission Checklist**:
   * [ ] `make lint` exits with code 0.
   * [ ] `make test` exits with code 0.
   * [ ] `docker compose --profile stub config` validates successfully.
   * [ ] New features include automated unit or integration tests.
   * [ ] Public configuration changes are documented in `README.md` and `.env.example`.

4. **Pull Request Submission**:
   Open a pull request targeting `main`. Provide a concise summary of the change, the technical rationale, and the local test results.
