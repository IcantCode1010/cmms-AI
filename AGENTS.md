# Repository Guidelines

## Project Structure & Module Organization
Atlas CMMS ships as four coordinated services: `api/` (Spring Boot backend, domain logic in `src/main/java`, Liquibase change sets in `src/main/resources/liquibase`), `frontend/` (React + TypeScript SPA under `src/` with static assets in `public/`), `mobile/` (Expo React Native app with screens in `screens/` and shared state in `store/`), and `agents-proxy/` (Node.js bridge in `src/` that mediates ChatKit and OpenAI Agents runtime traffic). Shared imagery lives in `images/` and `logo/`, while stack-wide configuration sits alongside `docker-compose.yml` and `.env.example` at the repo root.

## Build, Test, and Development Commands
- `docker-compose up -d` (root) boots Postgres, MinIO, the API, and the frontend for an end-to-end sandbox.
- Backend: `cd api && ./mvnw spring-boot:run` for local dev, `./mvnw clean package` to emit deployable artifacts.
- Frontend: `cd frontend && npm install && npm run start` (port 3000); `npm run build` to produce a production bundle.
- Mobile: `cd mobile && npm install && npm run start` for the Expo dev server; `npm run android|ios` before device QA.
- Agents proxy: `cd agents-proxy && npm install && npm run dev` for hot reload; `npm run start` hardens the service.

## Coding Style & Naming Conventions
- JS/TS repos share Prettier (`tabWidth: 2`, `singleQuote`) and Airbnb ESLint rules; run `npm run lint` or `npm run format` before committing.
- Use PascalCase for React components and screens, camelCase for hooks, services, and utilities; keep shared UI primitives colocated under module-specific `components/`.
- Java code follows Spring defaults (four-space indent, PascalCase classes, camelCase methods); route every schema change through Liquibase YAML in `api/src/main/resources/liquibase` instead of manual DDL.

## Testing Guidelines
- Backend: add JUnit or MockMvc coverage in `api/src/test/java` and run `./mvnw test` before pushing.
- Agents proxy: keep Jest + Supertest specs under `agents-proxy/src/__tests__/`; execute `npm run test`.
- Mobile: use Jest (`npm run test -- --watchAll=false`) for screens, utilities, and reducers.
- Frontend currently relies on lint plus manual QA; run `npm run lint`, capture screenshots for visual shifts, and describe manual smoke steps in the PR.

## Commit & Pull Request Guidelines
- History follows Conventional Commits (`feat:`, `fix:`, `chore:`) as enforced by `commitlint.config.js`; scope modules when helpful (e.g., `feat(frontend): add calendar filters`).
- Run the relevant verification commands (tests, lint, docker) locally and list them in the PR template before requesting review.
- Attach context: link issues, call out new env vars or Liquibase changes, and provide screenshots or short Looms for UI/mobile updates.
- Keep PRs focused; split cross-cutting features into parallel API/frontend/mobile slices when possible.

## Security & Configuration Tips
- Keep secrets in `.env`; mirror any new keys in `.env.example` and document changes in `dev-docs/`.
- Align JWT and license secrets across services; rotate values together to avoid auth or feature flag mismatches.
- When exposing agent features, secure OpenAI credentials in deployment tooling and avoid logging raw tokens.
