## Feature Request: ChatKit Dock & Agents Integration

**Status:** Implemented and ready for basic user testing  
**Date:** 2025-10-10

### Delivered Scope
- **Backend (Spring Boot API)**
  - Added runtime DTOs, persistence hooks, and `AgentRuntimeClient` to relay prompts, record tool calls, and manage draft actions.
  - Extended `AgentService`/`AgentController` to surface runtime responses, tool telemetry, and draft confirmations behind the feature flag.
  - Captured audit trails via `agent_tool_invocation_log` and `agent_draft_action` tables; added unit tests (`AgentServiceTest`) and re-ran `mvn test -pl api`.

- **Agents Proxy (Node)**
  - Rebuilt Express service with RBAC-protected tool adapters, stub data fallbacks, and session/draft generation.
  - Added Jest coverage (`npm test`) to validate success, RBAC denial, and neutral prompt flows.

- **Frontend (React)**
  - Introduced Redux slice (`agentChat`) plus API helper for agent endpoints.
  - Implemented persistent `ChatDock` component with prompt input, tool call summaries, draft confirm/decline flows, and runtime flag gating.
  - Embedded dock into `App.tsx`; lint suite (`npm run lint`) passes.

- **Containerisation & Config**
  - Added `.env` flags: `AGENT_CHATKIT_ENABLED`, `CHATKIT_ENABLED`, `AGENT_RUNTIME_URL`, `AGENT_API_BASE`, etc.
  - Replaced upstream frontend image with local build (Nginx + runtime env templating) and ensured `docker compose` rebuilds all services.
  - Runtime configuration now injects ChatKit settings via `runtime-env.js`.

### Validation Performed
- `mvn test -pl api` with locally provisioned Maven/JDK.
- `npm test` in `agents-proxy/`.
- `npm run lint` in `frontend/`.
- Container rebuild: `docker compose down`, `docker compose build --no-cache`, `docker compose up -d`.
- Manual UI verification: Chat dock visible after authentication, prompts return stub responses, drafts list responds to confirm/decline.

### Outstanding / Future Work
- Replace proxy stubs with real OpenAI Agents runtime once credentials are available.
- Expand integration tests (backend + frontend) to cover full draft lifecycle with live data.
- Add observability dashboards/log aggregation per Task Deployment 6 in the master plan.
