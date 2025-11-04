# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Atlas CMMS is a self-hosted maintenance management system (think "Jira for technicians") built as a microservices architecture with four coordinated services:

- **API** (Spring Boot 2.6.7 / Java 8) - Backend REST API with JPA entities, business logic, and database migrations
- **Frontend** (React 17 / TypeScript 4.7) - Web SPA with Material-UI, Redux Toolkit, and real-time features
- **Mobile** (React Native / Expo) - Mobile companion app sharing state patterns with frontend
- **Agents Proxy** (Node.js / Express) - AI agent runtime bridge mediating ChatKit and OpenAI Agents

## Architecture Principles

### Multi-Tenancy
- All entities are scoped to a `Company` (organization) with strict tenant isolation
- `TenantAspect.java` enforces company-level data separation via AOP
- Every API endpoint filters by `user.getCompany().getId()`

### Role-Based Access Control (RBAC)
- Roles: `ROLE_SUPER_ADMIN`, `ROLE_ADMIN`, `ROLE_USER_CREATED`
- Permissions checked per entity type: CREATE, VIEW, VIEW_OTHER, EDIT_OTHER, DELETE_OTHER
- Agent tools restricted to: ADMIN, MANAGER, TECHNICIAN, SUPERVISOR roles

### Database Migrations
- **CRITICAL**: Schema managed exclusively via Liquibase (never manual DDL)
- Master changelog: `api/src/main/resources/db/master.xml`
- Changesets: `api/src/main/resources/db/changelog/`
- JPA DDL mode: `validate` (not `update` or `create`)

### AI Agent Architecture
- OpenAI Agents runtime accessed via `agents-proxy` service (port 4005)
- Tools defined in `agents-proxy/src/index.js` with Zod schemas
- Backend endpoints in `AgentToolController.java` with tenant-aware service layer
- Draft actions stored in `agent_draft_action` table requiring user confirmation
- Tool invocations logged to `agent_tool_invocation_log` for audit

## Development Commands

### API (Backend)
```bash
cd api

# Local development
./mvnw spring-boot:run

# Run tests
./mvnw test

# Run specific test class
./mvnw test -Dtest=AgentDraftServiceTest

# Build production JAR
./mvnw clean package

# Liquibase: Generate changelog from schema changes
./mvnw liquibase:diff

# Liquibase: Apply migrations
./mvnw liquibase:update
```

### Frontend (Web)
```bash
cd frontend

# Install dependencies
npm install

# Development server (port 3000)
npm start

# Production build
npm run build

# Linting
npm run lint
npm run lint:fix

# Code formatting
npm run format
```

### Mobile
```bash
cd mobile

# Install dependencies
npm install

# Start Expo dev server
npm run start

# Run on Android/iOS
npm run android
npm run ios

# Run tests
npm run test -- --watchAll=false
```

### Agents Proxy
```bash
cd agents-proxy

# Install dependencies
npm install

# Development with hot reload
npm run dev

# Production mode
npm run start

# Run tests
npm run test
```

### Docker Stack
```bash
# Start entire stack (Postgres, MinIO, API, Frontend, Agents Proxy)
docker-compose up -d

# View logs
docker-compose logs -f api
docker-compose logs -f frontend
docker-compose logs -f agents-proxy

# Rebuild after code changes
docker-compose up -d --build

# Stop stack
docker-compose down
```

## Code Structure & Patterns

### Backend (Java/Spring)

**Package Structure:**
```
com.grash/
├── controller/          # REST endpoints (@RestController)
│   ├── AgentController.java           # AI agent chat endpoints
│   ├── AgentToolController.java       # Tool execution endpoints
│   ├── WorkOrderController.java
│   └── analytics/                     # Analytics endpoints
├── service/             # Business logic (@Service)
│   ├── AgentService.java              # Agent orchestration
│   ├── AgentDraftService.java         # Draft action management
│   ├── AgentToolService.java          # Tool execution logic
│   └── WorkOrderService.java
├── repository/          # Data access (JpaRepository)
│   ├── AgentDraftActionRepository.java
│   ├── WorkOrderRepository.java
│   └── advancedsearch/                # Advanced filtering
├── model/               # JPA entities (@Entity)
│   ├── WorkOrder.java
│   ├── AgentDraftAction.java
│   └── enums/
├── dto/                 # Data transfer objects
│   └── agent/
│       ├── AgentPromptRequest.java
│       └── AgentChatResponse.java
├── mapper/              # MapStruct mappers (@Mapper)
├── configuration/       # Spring config (@Configuration)
│   ├── WebSecurityConfig.java         # JWT + OAuth2 security
│   ├── AgentProperties.java           # Agent feature flags
│   └── QuartzConfig.java              # Job scheduling
└── security/            # OAuth2 handlers
```

**Key Patterns:**
- Controllers delegate to services (no business logic in controllers)
- Services use repositories for data access (no direct EntityManager)
- MapStruct for DTO ↔ Entity conversion
- `@PreAuthorize` for permission checking
- Hibernate Envers for audit trail

### Frontend (React/TypeScript)

**Source Structure:**
```
frontend/src/
├── App.tsx                    # Root component with provider hierarchy
├── components/                # Reusable UI components
│   ├── ChatDock/              # AI assistant chat interface
│   │   ├── ChatDock.tsx
│   │   └── MarkdownMessage.tsx
│   ├── buttons/
│   ├── forms/
│   └── tables/
├── content/                   # Page/screen components
│   ├── work-orders/
│   ├── assets/
│   ├── analytics/
│   └── settings/
├── slices/                    # Redux Toolkit slices
│   ├── agentChat.ts           # AI agent state management
│   ├── workOrderSlice.ts
│   └── authSlice.ts
├── contexts/                  # React Context providers
│   ├── AuthContext.tsx
│   └── ThemeContext.tsx
├── hooks/                     # Custom React hooks
│   ├── useAuth.ts
│   └── usePermissions.ts
├── models/                    # TypeScript interfaces
├── router/                    # React Router v6 config
├── theme/                     # Material-UI theming
└── i18n/                      # Internationalization
    └── locales/               # Translation JSON files
```

**Key Patterns:**
- Redux Toolkit for global state (work orders, assets, users)
- React Context for auth and theme
- Formik + Yup for form validation
- Material-UI components with custom theming
- Axios interceptors for auth tokens and error handling
- WebSocket (STOMP) for real-time updates

### Agents Proxy (Node.js)

**Structure:**
```
agents-proxy/src/
├── index.js              # Main server + agent runtime
│   ├── Tool definitions (view_work_orders, view_assets, etc.)
│   ├── Zod parameter schemas
│   ├── OpenAI Agent initialization
│   └── Express endpoints (/chat, /health)
└── __tests__/            # Jest test suites
```

**Key Patterns:**
- Tools defined with `tool()` from OpenAI Agents SDK
- Zod for runtime parameter validation
- RBAC enforcement via `ensureRoleAccess()`
- Tenant isolation via `requireTenantId()`
- In-memory conversation cache with TTL
- Tool invocation logging with status tracking

## AI Agent Development

### Adding a New Agent Tool

Follow this pattern for consistency:

#### 1. Backend API Endpoint (`api/src/main/java/com/grash/controller/AgentToolController.java`)
```java
@PostMapping("/agent/tools/[entity]/[action]")
public ResponseEntity<AgentToolResponse<EntitySummary>> toolName(
        HttpServletRequest httpRequest,
        @Valid @RequestBody EntitySearchRequest request) {
    if (!agentProperties.isChatkitEnabled()) {
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
    OwnUser user = userService.whoami(httpRequest);
    return ResponseEntity.ok(agentToolService.toolMethod(user, request));
}
```

#### 2. Service Layer (`api/src/main/java/com/grash/service/AgentToolService.java`)
```java
public AgentToolResponse<EntitySummary> toolMethod(
        OwnUser user, EntitySearchRequest request) {
    ensureAuthorised(user);  // RBAC check

    SearchCriteria criteria = baseCriteria(
        resolveLimit(request.getLimit()),
        "updatedAt"
    );

    // CRITICAL: Tenant isolation
    criteria.getFilterFields().add(FilterField.builder()
        .field("company.id")
        .operation("eq")
        .value(user.getCompany().getId())
        .build());

    // Add custom filters...

    Page<Entity> page = entityRepository.findAll(
        buildSpecification(criteria),
        toPageable(criteria)
    );

    return AgentToolResponse.of(
        page.getContent().stream()
            .map(this::toEntitySummary)
            .collect(Collectors.toList())
    );
}
```

#### 3. Proxy Tool Definition (`agents-proxy/src/index.js`)
```javascript
const toolNameTool = tool({
  name: "tool_name",
  description: "Clear description for LLM understanding",
  parameters: z.object({
    limit: z.number().int().min(1).max(MAX_TOOL_RESULTS).optional().nullable(),
    searchTerm: z.string().optional().nullable(),
  }).strict(),
  execute: async (input, runContext) => {
    const ctx = ensureRunContext(runContext);

    // RBAC enforcement
    ensureRoleAccess(ctx.userContext, ALLOWED_AGENT_ROLES, "tool_name");
    requireTenantId(ctx.userContext);

    // Build request
    const criteria = {
      limit: coerceLimit(input?.limit, 5),
      search: input?.searchTerm || ""
    };

    // Log invocation
    const logEntry = {
      toolName: "tool_name",
      arguments: criteria,
      status: "queued"
    };

    try {
      const response = await postAgentToolRequest({
        path: "/api/agent/tools/[entity]/[action]",
        authorizationHeader: ctx.authorizationHeader,
        body: criteria
      });

      const items = Array.isArray(response?.results) ? response.results : [];
      logEntry.resultCount = items.length;
      logEntry.status = "success";
      ctx.toolLogs.push(logEntry);

      return JSON.stringify({ type: "[entity_type]", total: items.length, items });
    } catch (error) {
      logEntry.status = "error";
      logEntry.error = error.message;
      ctx.toolLogs.push(logEntry);
      throw error;
    }
  }
});

// Register tool
const atlasAgent = new Agent({
  tools: [
    viewWorkOrdersTool,
    viewAssetsTool,
    toolNameTool  // Add here
  ]
});
```

#### 4. Quality Checklist
Before deploying:
- [ ] RBAC enforcement (role check in proxy and service)
- [ ] Tenant isolation (company ID filter in service)
- [ ] Input validation (Zod schema + `@Valid` annotation)
- [ ] Tool invocation logging
- [ ] Unit tests for service layer
- [ ] Integration test for API endpoint
- [ ] Agent conversation test

## Common Development Tasks

### Database Migrations

**Creating a new migration:**
```bash
cd api

# 1. Modify JPA entity
# 2. Generate diff changelog
./mvnw liquibase:diff

# 3. Review generated changelog in src/main/resources/db/changelog/
# 4. Rename with sequence number: db.changelog-XXX-description.yaml
# 5. Add to master.xml
# 6. Test migration
./mvnw liquibase:update
```

**Migration file structure:**
```yaml
databaseChangeLog:
  - changeSet:
      id: XXX-add-agent-session-id
      author: developer-name
      changes:
        - addColumn:
            tableName: agent_draft_action
            columns:
              - column:
                  name: agent_session_id
                  type: varchar(255)
        - createIndex:
            indexName: idx_agent_draft_session
            tableName: agent_draft_action
            columns:
              - column:
                  name: agent_session_id
```

### Adding a New API Endpoint

1. Create/update controller method with proper annotations
2. Implement service layer logic with permission checks
3. Create DTOs for request/response
4. Add repository methods if needed
5. Write unit tests for service
6. Write integration tests for controller
7. Update Swagger documentation

### Adding Frontend Components

1. Create component in `frontend/src/components/` or `frontend/src/content/`
2. Use TypeScript interfaces from `models/`
3. Connect to Redux if needed (or use local state)
4. Follow Material-UI theming patterns
5. Use Formik for forms with Yup validation
6. Add i18n translation keys
7. Ensure responsive design (mobile breakpoints)

### Environment Configuration

**Required environment variables (.env):**
```bash
# Database
POSTGRES_USER=rootUser
POSTGRES_PWD=mypassword
DB_URL=postgres:5432/atlas

# Storage
STORAGE_TYPE=minio  # or 'gcp'
MINIO_USER=minio
MINIO_PASSWORD=minio123
PUBLIC_MINIO_ENDPOINT=http://localhost:9000

# Backend
PUBLIC_API_URL=http://localhost:8080
JWT_SECRET_KEY=your_jwt_secret

# Frontend
PUBLIC_FRONT_URL=http://localhost:3000

# AI Agents (optional)
AGENT_CHATKIT_ENABLED=false
OPENAI_API_KEY=sk-...
AGENT_CHATKIT_AGENT_ID=atlas-maintenance-copilot
AGENT_RUNTIME_URL=http://agents-proxy:4005
```

## Testing Approach

### Backend Tests
- **Location:** `api/src/test/java/com/grash/`
- **Framework:** JUnit 5 + Mockito
- **Patterns:**
  - Mock repositories and services
  - Use `@WebMvcTest` for controller tests
  - Use `@DataJpaTest` for repository tests
  - Test multi-tenancy isolation
  - Verify RBAC enforcement

### Frontend Tests
- **Current state:** Lint + manual QA
- **When making changes:**
  - Run `npm run lint` before committing
  - Capture screenshots for visual changes
  - Document manual test scenarios in PR

### Agents Proxy Tests
- **Location:** `agents-proxy/src/__tests__/`
- **Framework:** Jest + Supertest
- **Run:** `npm run test`
- **Coverage:** Tool execution, RBAC, tenant isolation

## Security Considerations

### Authentication
- JWT tokens with 14-day expiration
- OAuth2/SSO support (Google, Microsoft) - requires license
- Token in `Authorization: Bearer <token>` header

### Authorization
- Check user roles before operations
- Filter all queries by `company.id`
- Use `@PreAuthorize` for method-level security
- Validate agent tool access against `ALLOWED_AGENT_ROLES`

### Input Validation
- Backend: `@Valid` + Bean Validation annotations
- Agents: Zod schemas with strict mode
- Frontend: Formik + Yup validation
- SQL injection prevention: parameterized queries only

### File Uploads
- Max file size: 7MB
- Storage: MinIO (default) or GCP
- Tenant isolation in bucket structure

## Commit Conventions

This project uses **Conventional Commits** enforced by `commitlint.config.js`:

```
feat(frontend): add work order completion draft UI
fix(api): correct tenant isolation in asset search
docs(agents): update tool development guide
refactor(service): extract work order validation logic
test(agents): add draft action confirmation tests
chore(deps): update Spring Boot to 2.6.8
```

**Scopes:** api, frontend, mobile, agents-proxy, docs

## Key Files & Directories

### Configuration
- `docker-compose.yml` - Stack orchestration
- `.env` - Environment variables (never commit)
- `api/src/main/resources/application.yml` - Spring Boot config
- `frontend/src/config.ts` - Frontend runtime config

### Documentation
- `docs/` - Architecture, features, and guides
  - `03-backend-architecture.md` - API structure
  - `04-frontend-architecture.md` - Frontend patterns
  - `atlas-agents.md` - AI agent system review
  - `AGENT_CAPABILITIES.md` - Tool expansion opportunities

### Database
- `api/src/main/resources/db/master.xml` - Liquibase master changelog
- `api/src/main/resources/db/changelog/` - Migration files

### AI Agents
- `agents-proxy/src/index.js` - Tool definitions + agent runtime
- `api/src/main/java/com/grash/service/AgentToolService.java` - Tool execution
- `api/src/main/java/com/grash/controller/AgentToolController.java` - Tool endpoints

## Performance & Scalability

### Database
- Use pagination for large result sets
- Add indexes on frequently queried fields (status, company_id, customId)
- Connection pooling via HikariCP
- Liquibase migrations run sequentially (avoid conflicts)

### API
- Caching via Caffeine (20-minute TTL, 1000 max entries)
- Rate limiting via Bucket4j
- CORS restricted to `PUBLIC_FRONT_URL`

### Frontend
- Code splitting with React.lazy()
- Memoization with React.memo and useMemo
- Bundle analysis: `npm run build && source-map-explorer build/static/js/*.js`

### Agents
- Tool result limit: 1-50 (default 10)
- Conversation TTL: 15 minutes
- Tool execution timeout: 30 seconds
- Stateless proxy (can horizontally scale)

## Troubleshooting

### Common Issues

**Backend won't start:**
- Check Postgres connection: `DB_URL`, `POSTGRES_USER`, `POSTGRES_PWD`
- Verify Liquibase migrations applied: `./mvnw liquibase:status`
- Check port 8080 not in use

**Frontend can't reach API:**
- Verify `API_URL` matches `PUBLIC_API_URL`
- Check CORS configuration in `WebSecurityConfig.java`
- Ensure JWT token present in requests

**Agent tools not working:**
- Verify `AGENT_CHATKIT_ENABLED=true` in backend
- Check `OPENAI_API_KEY` set in agents-proxy
- Verify user role in `ALLOWED_AGENT_ROLES`
- Check tool invocation logs in database

**Database migration conflicts:**
- Never modify existing changesets
- Always create new changeset with incremented ID
- Test migrations on clean database first
- Use rollback if needed: `./mvnw liquibase:rollback -Dliquibase.rollbackCount=1`

## Additional Resources

- [Usage Guide](https://docs.atlas-cmms.com)
- [Contributing Guidelines](./CONTRIBUTING.md) (in each subproject)
- [Discord Server](https://discord.gg/cHqyVRYpkA)
- [GitHub Issues](https://github.com/grashjs/cmms/issues)
