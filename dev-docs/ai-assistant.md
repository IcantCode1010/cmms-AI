# AI Assistant Configuration Notes

The ChatKit + OpenAI Agents feature is disabled by default and guarded by environment-driven feature flags. Use the following checklist when enabling the integration locally or in non-production environments.

## Backend (`api/`)

| Property | Environment Variable | Notes |
| --- | --- | --- |
| `agent.chatkit-enabled` | `AGENT_CHATKIT_ENABLED` | Master switch for all ChatKit/Agents endpoints. |
| `agent.chatkit-agent-id` | `AGENT_CHATKIT_AGENT_ID` | Optional default agent identifier. |
| `agent.runtime-url` | `AGENT_RUNTIME_URL` | Base URL for the OpenAI Agents runtime or proxy. |
| `agent.runtime-token` | `AGENT_RUNTIME_TOKEN` | Bearer token or API key injected into outbound requests. |
| `agent.timeout-ms` | `AGENT_TIMEOUT_MS` | Client timeout for agent calls (defaults to `30000`). |
| `agent.max-tool-results` | `AGENT_MAX_TOOL_RESULTS` | Upper bound for tool adapter result sets (defaults to `50`). |

- Update `.env` with the variables above before starting the Spring Boot service.
- Store production credentials (runtime URL and token) in the organization secrets manager; never commit real values.

## Frontend (`frontend/`)

| Runtime Key | Environment Variable | Description |
| --- | --- | --- |
| `CHATKIT_ENABLED` | `CHATKIT_ENABLED` or `REACT_APP_CHATKIT_ENABLED` | Enables the persistent ChatKit dock. |
| `CHATKIT_AGENT_ID` | `CHATKIT_AGENT_ID` or `REACT_APP_CHATKIT_AGENT_ID` | ID of the ChatKit agent to address by default. |
| `AGENT_API_BASE` | `AGENT_API_BASE` or `REACT_APP_AGENT_API_BASE` | Base URL for API calls that proxy ChatKit requests. |

Populate `frontend/.env` (or export the variables in your shell) before running `npm start`. For containerised deployments, supply the same keys through the runtime-env generator (`frontend/public/runtime-env.js`).

### Chat Dock Usage

- Enabling the runtime flag surfaces a floating “Atlas Assistant” dock within the main React shell (see `ChatDock/ChatDock.tsx`).
- The dock persists conversation context locally, relays prompts via `/api/agent/chat`, and renders assistant responses, tool telemetry, and any pending drafts that require operator sign-off.
- Draft payloads include a `summary` and `data` envelope so additional UI cards can be built without schema migrations.
- Manual reviewers can confirm/decline draft actions directly in the dock; these calls hit `/api/agent/drafts/:id/confirm|DELETE`.

## Agents Proxy (`agents-proxy/`)

| Environment Variable | Description |
| --- | --- |
| `PORT` | Port the sidecar listens on (defaults to `4005`). |
| `API_BASE` | Internal URL for the Spring API (defaults to `http://api:8080`). |
| `OPENAI_API_KEY` | API key used when calling the OpenAI Agents runtime. |
| `AGENT_CHATKIT_AGENT_ID` | Default agent identifier passed to OpenAI. |

The proxy is optional while the integration is feature-flagged. Without `OPENAI_API_KEY`, it returns a stub response but still logs requests for observability.

### Docker Compose Notes

- `docker-compose.yml` passes the backend variables (`AGENT_CHATKIT_ENABLED`, `AGENT_RUNTIME_URL`, and so on) directly into the `api` container. Edit your `.env` file or compose overrides to change values per environment.
- The frontend container reads `CHATKIT_ENABLED`, `CHATKIT_AGENT_ID`, and `AGENT_API_BASE`; make sure `AGENT_API_BASE` matches the publicly reachable API origin when running in Docker (for example `http://api:8080` for internal service-to-service calls or the external ingress URL).
- When introducing the `agents-proxy` sidecar, declare matching environment keys in the compose file and ensure secrets are loaded via Docker secrets or your orchestrator's equivalent.

### Local Testing Checklist

| Component | Command |
| --- | --- |
| Java API | `./mvnw test -pl api` *(requires Maven wrapper or local Maven)* |
| Agents proxy | `npm install && npm test` inside `agents-proxy/` |
| Frontend lint | `npm install && npm run lint` inside `frontend/` |

> **Note:** All services should be rebuilt after configuration or code updates. Run `docker compose down`, `docker compose build --no-cache`, followed by `docker compose up -d` to guarantee the new images are in use.

## Secrets Handling

- Rotate the OpenAI runtime token regularly and scope it to read and write capabilities required by the Agents SDK.
- Treat the ChatKit agent ID as non-secret but avoid hard-coding tenant-specific IDs in source.
- Ensure staging and production secrets are injected through infrastructure tooling (Docker or Kubernetes secrets, HashiCorp Vault, and similar).

## Feature Enablement Checklist

1. Set `AGENT_CHATKIT_ENABLED=true` on the API.
2. Set `CHATKIT_ENABLED=true` and `AGENT_API_BASE` to point at the API route (`https://<host>/api/agent`).
3. Provide `AGENT_RUNTIME_URL` and `AGENT_RUNTIME_TOKEN` so the API can reach the OpenAI runtime or sidecar.
4. Confirm the runtime env script (`frontend/public/runtime-env.js`) resolves the new keys by hitting the deployed `/runtime-env.js` asset.
5. Keep the defaults (`false` or empty) in repository examples to prevent accidental activation in developer environments.
