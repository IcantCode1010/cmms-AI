# ChatKit + Agents SDK Task Deployments

## Repository and Deployment Context
- Backend (`api/`): Spring Boot 2.6 with RBAC, service layers, Liquibase, OkHttp, Jackson. API runs in Docker via the `api` service in `docker-compose.yml`.
- Frontend (`frontend/`): React 17 + TypeScript, MUI, Redux Toolkit, JWT auth context. Delivered as Docker image `atlas-cmms-frontend`.
- Node sidecar: Will be added as a Docker service hosting `openai-agents-js`.
- Configuration flow: `.env`, Spring `application.yml`, `frontend/public/runtime-env.js`, and container environment variables defined in `docker-compose.yml`.

## Task Deployment 1 - Configuration Foundations
- **Status:** Completed (2025-10-10)
- **Scope**
  - Add `AgentProperties` binding with support for `AGENT_RUNTIME_URL`, `AGENT_RUNTIME_TOKEN`, `AGENT_CHATKIT_ENABLED`, `AGENT_TIMEOUT_MS`, `AGENT_MAX_TOOL_RESULTS`, `AGENT_CHATKIT_AGENT_ID`.
  - Update `.env.example`, `frontend/.env.example`, and `frontend/public/runtime-env.js` with the new keys.
  - Amend `docker-compose.yml` so the `api` and `frontend` services accept the new environment variables (defaulting to disabled).
  - Document secrets management, feature toggles, and container overrides in `dev-docs/ai-assistant.md`.
- **Dependencies**
  - None.
- **Go/No-Go Validation**
  - Spring configuration test verifying `AgentProperties` binding.
  - `docker compose config` confirms environment interpolation.
  - Documentation review by platform or DevOps stakeholder.

## Task Deployment 2 - Java Agent Proxy Scaffold
- **Status:** Completed (2025-10-10)
- **Scope**
  - Create `AgentController` and `AgentService` stubs returning feature-flagged placeholder responses.
  - Define DTOs for session init, message payloads, tool call summaries, draft actions.
  - Add Liquibase migrations for `agent_tool_invocation_log` and `agent_draft_action`.
  - Ensure the API Docker image exposes the new endpoints while the flag remains off.
- **Dependencies**
  - Task Deployment 1 complete.
- **Go/No-Go Validation**
  - Spring Boot integration test (`AgentControllerIT`) covering RBAC and stub responses.
  - Liquibase migration dry run in staging database.
  - `docker compose up api` smoke test with the updated image.

## Task Deployment 3 - Node Sidecar with openai-agents-js
- **Status:** Completed (2025-10-10)
- **Scope**
  - Stand up a Node.js service (for example `agents-proxy`) using `express`, `openai-agents-js`, `axios`, `jsonwebtoken`.
  - Implement tool adapters that call back to the Java API read-only endpoints and enforce JWT-based RBAC.
  - Add logging (for example winston) and configuration for OpenAI credentials.
  - Provide a Dockerfile and integrate the service into `docker-compose.yml`.
- **Dependencies**
  - Task Deployment 2.
- **Go/No-Go Validation**
  - Jest test suite covering adapter RBAC and agent session flows.
  - Manual integration test hitting sidecar endpoints from the Java service.
  - `docker compose up agents-proxy` verifies container health checks.

## Task Deployment 4 - Java Tool Adapter and Draft Workflow
- **Status:** Completed (2025-10-10)
- **Scope**
  - Implement `AgentToolRegistry` and adapter classes wrapping `WorkOrderService`, `PartService`, `UserService`.
  - Persist invocation logs via `AgentToolInvocationLogRepository`.
  - Complete draft lifecycle endpoints (`GET`, `POST`, `DELETE /api/agent/drafts`) and transactional confirm execution.
  - Wire in container environment defaults for throttling (max results) and ensure feature flag gating.
- **Dependencies**
  - Task Deployments 2 and 3.
- **Go/No-Go Validation**
  - Integration tests for draft creation, confirmation, decline, and RBAC enforcement.
  - Database migration verification (records written and audited in staging).
  - Log inspection ensuring structured entries for tool calls.

## Task Deployment 5 - Frontend ChatKit Dock Integration
- **Status:** Completed (2025-10-10)
- **Scope**
  - Install `@openai/chatkit`.
  - Replace the header popover with a persistent dock component (`components/ChatDock/`) wired to a Redux slice `agentChatSlice`.
  - Implement API client wrappers for proxy endpoints, render draft cards with confirm and decline actions, and add translations.
  - Update the frontend Docker image build to bundle `runtime-env.js` placeholders and document new environment variables.
- **Dependencies**
  - Task Deployment 1 and Task Deployment 4, with the node sidecar available.
- **Go/No-Go Validation**
  - React Testing Library suite covering dock render, prompt send, and draft actions (mocked API).
  - Manual UI acceptance walkthrough for accessibility and responsiveness.
  - `docker compose up frontend` confirms runtime environment values inside the container.

## Task Deployment 6 - Observability, Hardening, and Launch Operations
- **Status:** Pending
- **Scope**
  - Add structured logs and metrics across the Java proxy, node sidecar, and frontend analytics hooks.
  - Update runbooks in `dev-docs/ai-assistant.md`, including monitoring dashboards, container readiness, and incident procedures.
  - Finalize feature flag strategy and rollout sequencing (internal QA -> pilot tenants -> GA).
- **Dependencies**
  - Task Deployments 2 through 5.
- **Go/No-Go Validation**
  - Observability checks confirm logs and metrics reach ELK, Grafana, or equivalent from all containers.
  - Feature flag toggle test in staging ensures safe rollback.
  - Stakeholder sign-off on documentation and launch checklist.

## Dependency Overview
- Backend (Java): Reuse OkHttp, Jackson, and existing Spring starters; add Liquibase changelog files; expose new environment variables via Docker.
- Node sidecar: `openai-agents-js`, `express`, `axios`, `jsonwebtoken`, `winston` (or preferred logger); dockerised service with health checks.
- Frontend: `@openai/chatkit` plus existing axios, Redux, and MUI stack; runtime env injection via container build pipeline.
- Infrastructure: Secrets manager entries for OpenAI keys, Docker image builds for API, frontend, and sidecar, database migration scheduling, observability pipelines.

## Incremental Deployment Flow
1. Ship Task Deployments 1 and 2 to staging (feature flag off), validate configuration, migrations, and rebuilt Docker images.
2. Introduce Task Deployment 3 sidecar; run integration smoke tests via the docker-compose stack before enabling agent calls.
3. Complete Task Deployment 4 backend functionality; verify the draft workflow end-to-end within the containerised environment.
4. Deliver Task Deployment 5 frontend dock disabled via runtime flag; enable for internal QA once backend and sidecar are stable.
5. Execute Task Deployment 6 activities, then perform staged tenant rollout with a go/no-go gate after each Docker-based deployment.
