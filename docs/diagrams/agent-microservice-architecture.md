# Agent Microservice Architecture Diagrams

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
│                      Port 3000 / Container                       │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ agentApi.ts                                                 │ │
│  │ - postChat()                                                │ │
│  │ - getDrafts()                                               │ │
│  │ - confirmDraft()                                            │ │
│  └─────────────────────┬───────────────────────────────────────┘ │
└────────────────────────┼──────────────────────────────────────────┘
                         │
                         │ HTTP POST /api/agent/chat
                         │ Authorization: Bearer <JWT>
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend API (Spring Boot)                     │
│                      Port 8080 / Container                       │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ AgentController.java                                        │ │
│  │ - POST /api/agent/chat                                      │ │
│  │ - GET  /api/agent/drafts                                    │ │
│  │ - POST /api/agent/drafts/{id}/confirm                       │ │
│  └─────────┬──────────────────────────────────────────────────┘ │
│            │                                                      │
│  ┌─────────▼──────────────────────────────────────────────────┐ │
│  │ AgentRuntimeClient.java (HTTP Client)                       │ │
│  │ - Calls AGENT_RUNTIME_URL (http://agents-proxy:4005)        │ │
│  │ - Forwards JWT and request                                  │ │
│  └─────────┬──────────────────────────────────────────────────┘ │
│            │                                                      │
│  ┌─────────▼──────────────────────────────────────────────────┐ │
│  │ AgentService.java                                           │ │
│  │ - Persists AgentDraftAction entities                        │ │
│  │ - Logs tool invocations                                     │ │
│  └──────────────────────────────────────────────────────────────┘ │
└────────────────────────┼──────────────────────────────────────────┘
                         │
                         │ HTTP POST /v1/chat
                         │ Authorization: Bearer <JWT>
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Agents Proxy (Node.js/Express)                 │
│                      Port 4005 / Container                       │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ POST /v1/chat                                               │ │
│  │ 1. Decode JWT (no validation)                               │ │
│  │ 2. Call backend GET /auth/me (validate user)                │ │◄──┐
│  │ 3. Enforce RBAC (role-based access)                         │ │   │
│  │ 4. Run OpenAI Agent with tools                              │ │   │
│  │ 5. Store conversation in-memory (Map)                       │ │   │
│  │ 6. Return response with drafts                              │ │   │
│  └─────────┬──────────────────────────────────────────────────┘ │   │
│            │                                                      │   │
│  ┌─────────▼──────────────────────────────────────────────────┐ │   │
│  │ Tool Execution (viewWorkOrdersTool, viewAssetsTool)         │ │   │
│  │ - Calls backend /api/agent/tools/work-orders/search   ──────┼───┘
│  │ - Calls backend /api/agent/tools/assets/search              │ │
│  │ - Passes Authorization header                               │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ In-Memory Conversation Store (Map)                          │ │
│  │ - sessionId → { history, lastResponseId, updatedAt }        │ │
│  │ - TTL: 15 minutes                                           │ │
│  │ - Cleanup: setInterval()                                    │ │
│  │ ⚠️  Lost on restart / Not scalable                           │ │
│  └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           │ OpenAI API
                           ▼
                   ┌───────────────────┐
                   │   OpenAI Agents    │
                   │   API (gpt-4o-mini)│
                   └───────────────────┘
```

**Issues**:
- ❌ Extra hop through backend adds ~50-100ms latency
- ❌ In-memory conversation store prevents horizontal scaling
- ❌ State lost on restart
- ❌ Backend acts as unnecessary proxy

---

## Proposed Architecture (Direct Connection + Redis)

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
│                      Port 3000 / Container                       │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ agentApi.ts (Updated)                                       │ │
│  │ - baseUrl: AGENT_API_BASE (direct to agents-proxy)          │ │
│  │ - postChat() → POST /v1/chat                                │ │
│  │ - getDrafts() → GET /api/agent/drafts (still to backend)    │ │
│  │ - confirmDraft() → POST /api/agent/drafts/{id}/confirm      │ │
│  └────────┬──────────────────────────────────────────────┬─────┘ │
└───────────┼──────────────────────────────────────────────┼────────┘
            │                                               │
            │ HTTP POST /v1/chat                            │ Draft management
            │ Authorization: Bearer <JWT>                   │ (to backend)
            │                                               │
            ▼                                               ▼
┌───────────────────────────────────┐    ┌──────────────────────────────┐
│   Agents Proxy (Microservice)     │    │   Backend API (Spring Boot)   │
│      Port 4005 / Container         │    │      Port 8080 / Container    │
│         (Multiple Instances)       │    │                               │
│                                    │    │  ┌────────────────────────┐  │
│  ┌──────────────────────────────┐ │    │  │ AgentController.java    │  │
│  │ POST /v1/chat                 │ │    │  │ - GET /api/agent/drafts │  │
│  │ 1. Verify JWT (decode)        │ │    │  │ - POST /drafts/confirm  │  │
│  │ 2. Call /auth/me ──────────────┼────┼─►│ - DELETE /drafts/{id}   │  │
│  │ 3. Enforce RBAC               │ │    │  └────────────────────────┘  │
│  │ 4. Run OpenAI Agent           │ │    │                               │
│  │ 5. Store conversation in Redis│ │    │  ┌────────────────────────┐  │
│  │ 6. Return response            │ │    │  │ Tool Endpoints          │  │
│  └───────┬──────────────────────┘ │    │  │ /api/agent/tools/*      │  │
│          │                         │    │  │ - work-orders/search    │◄─┼──┐
│  ┌───────▼──────────────────────┐ │    │  │ - assets/search         │  │  │
│  │ Tool Execution                │ │    │  └────────────────────────┘  │  │
│  │ - Calls backend /api/agent/   │─┼────┼──────────────────────────────┘  │
│  │   tools/work-orders/search    │ │    │                                  │
│  │ - Passes Authorization        │ │    │  ┌────────────────────────┐     │
│  └────────────────────────────────┘ │    │  │ Database (PostgreSQL)   │     │
│                                    │    │  │ - AgentDraftAction      │     │
│  ┌──────────────────────────────┐ │    │  │ - AgentToolInvocationLog│     │
│  │ Redis Conversation Store      │ │    │  └────────────────────────┘     │
│  │ - GET conversation:{sessionId}│ │    └──────────────────────────────────┘
│  │ - SET conversation:{sessionId}│ │
│  │ - EXPIRE (TTL)                │ │
│  └───────┬──────────────────────┘ │
│          │                         │
└──────────┼─────────────────────────┘
           │
           ▼
    ┌─────────────────┐
    │  Redis Cache     │
    │  Port 6379       │
    │                  │
    │  Key Schema:     │
    │  conversation:   │
    │    {sessionId}   │
    │                  │
    │  TTL: 15 min     │
    │  Persistence:    │
    │    AOF enabled   │
    └─────────────────┘
```

**Benefits**:
- ✅ Lower latency (~50-100ms saved by skipping backend proxy)
- ✅ Horizontal scaling with Redis-backed sessions
- ✅ Conversation persistence across restarts
- ✅ Independent deployment and scaling
- ✅ Backend only handles persistence (drafts, logs)

---

## Kubernetes Deployment Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                           Kubernetes Cluster                        │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Ingress Controller                         │  │
│  │  - /api/* → api-service                                       │  │
│  │  - /v1/* → agents-proxy-service                               │  │
│  └────────┬──────────────────────────────────┬─────────────────┘  │
│           │                                   │                     │
│           ▼                                   ▼                     │
│  ┌────────────────────────┐        ┌────────────────────────────┐ │
│  │   api-service          │        │  agents-proxy-service       │ │
│  │   Type: ClusterIP      │        │  Type: ClusterIP            │ │
│  │   Port: 8080           │        │  Port: 4005                 │ │
│  └────────┬───────────────┘        └─────────┬──────────────────┘ │
│           │                                   │                     │
│           ▼                                   ▼                     │
│  ┌────────────────────────┐        ┌────────────────────────────┐ │
│  │ api Deployment         │        │ agents-proxy Deployment     │ │
│  │ Replicas: 3            │        │ Replicas: 2-10 (HPA)        │ │
│  │                        │        │                             │ │
│  │ ┌────────────────────┐│        │ ┌────────────────────────┐ │ │
│  │ │ Pod 1 (api:8080)   ││        │ │ Pod 1 (proxy:4005)      │ │ │
│  │ └────────────────────┘│        │ └────────────────────────┘ │ │
│  │ ┌────────────────────┐│        │ ┌────────────────────────┐ │ │
│  │ │ Pod 2 (api:8080)   ││        │ │ Pod 2 (proxy:4005)      │ │ │
│  │ └────────────────────┘│        │ └────────────────────────┘ │ │
│  │ ┌────────────────────┐│        │ ┌────────────────────────┐ │ │
│  │ │ Pod 3 (api:8080)   ││        │ │ Pod N (proxy:4005)      │ │ │
│  │ └────────────────────┘│        │ └────────────────────────┘ │ │
│  └────────────────────────┘        └─────────┬──────────────────┘ │
│           │                                   │                     │
│           ▼                                   ▼                     │
│  ┌────────────────────────┐        ┌────────────────────────────┐ │
│  │  postgres-service      │        │  redis-service              │ │
│  │  Port: 5432            │        │  Port: 6379                 │ │
│  └────────┬───────────────┘        └─────────┬──────────────────┘ │
│           │                                   │                     │
│           ▼                                   ▼                     │
│  ┌────────────────────────┐        ┌────────────────────────────┐ │
│  │ PostgreSQL StatefulSet │        │ Redis StatefulSet           │ │
│  │ Replicas: 1 (primary)  │        │ Replicas: 1 (standalone)    │ │
│  │                        │        │ or Redis Cluster (3 masters)│ │
│  │ PersistentVolumeClaim  │        │ PersistentVolumeClaim       │ │
│  │ - postgres_data (10Gi) │        │ - redis_data (5Gi)          │ │
│  └────────────────────────┘        └────────────────────────────┘ │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │           HorizontalPodAutoscaler (agents-proxy)              │  │
│  │  - Min Replicas: 2                                            │  │
│  │  - Max Replicas: 10                                           │  │
│  │  - Metrics:                                                   │  │
│  │    * CPU: 70% target                                          │  │
│  │    * Memory: 80% target                                       │  │
│  │    * Custom: agents_chat_requests_total (rate)                │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                  Monitoring Stack (Optional)                  │  │
│  │  - Prometheus (scrapes /metrics)                              │  │
│  │  - Grafana (visualizes metrics)                               │  │
│  │  - Jaeger (distributed tracing)                               │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

**Autoscaling Behavior**:
```
Load Scenario          │ Active Pods │ Response Time │ Notes
─────────────────────────────────────────────────────────────────
Low (< 10 req/min)     │      2      │   ~500ms      │ Baseline
Normal (10-50 req/min) │     2-4     │   ~500ms      │ Steady state
High (50-100 req/min)  │     4-7     │   ~600ms      │ Scale up
Spike (> 100 req/min)  │    7-10     │   ~800ms      │ Max capacity
Cooldown (< 10)        │      2      │   ~500ms      │ Scale down (5min)
```

---

## Data Flow: Chat Request Lifecycle

### Current Flow (3 Hops)
```
┌─────────┐      ┌─────────┐      ┌──────────────┐      ┌─────────┐
│ Frontend│─(1)─►│ Backend │─(2)─►│ Agents Proxy │─(3)─►│ OpenAI  │
└─────────┘      └────┬────┘      └───────┬──────┘      └─────────┘
                      │                   │
                      │                   │
                 (4) Validate JWT    (5) Execute Tools
                      │                   │
                      ▼                   ▼
                 ┌─────────┐         ┌─────────┐
                 │   DB    │         │ Backend │ (Tool API)
                 │ (Drafts)│         └─────────┘
                 └─────────┘

Total Latency: ~1500-2000ms
  - Frontend → Backend: 50ms
  - Backend → Proxy: 50ms
  - Proxy → OpenAI: 1000-1500ms
  - Tool Execution: 200ms
  - Proxy → Backend: 50ms
  - Backend → Frontend: 50ms
```

### Proposed Flow (2 Hops)
```
┌─────────┐      ┌──────────────┐      ┌─────────┐
│ Frontend│─(1)─►│ Agents Proxy │─(2)─►│ OpenAI  │
└─────────┘      └───────┬──────┘      └─────────┘
                         │
                    (3) Validate
                         │
                         ▼
                    ┌─────────┐
                    │ Backend │ (/auth/me + Tools)
                    └────┬────┘
                         │
                    (4) Store
                         ▼
                    ┌─────────┐
                    │  Redis  │ (Conversations)
                    └─────────┘

Total Latency: ~1400-1800ms
  - Frontend → Proxy: 50ms
  - Proxy → OpenAI: 1000-1500ms
  - Tool Execution: 200ms
  - Proxy → Redis: 10ms
  - Proxy → Frontend: 50ms

Latency Reduction: ~100-200ms (5-10% improvement)
```

---

## Security Model

```
┌─────────────────────────────────────────────────────────────┐
│                    Trust Boundaries                          │
└─────────────────────────────────────────────────────────────┘

Internet           DMZ                Internal           External
   │               │                     │                  │
   │               │                     │                  │
   ▼               ▼                     ▼                  ▼
┌────────┐    ┌────────┐    ┌────────┐  ┌────────┐  ┌─────────┐
│Frontend│───►│Ingress │───►│Backend │  │  Redis │  │ OpenAI  │
│ (User) │    │ (HTTPS)│    │  API   │  │ (Cache)│  │   API   │
└────────┘    └────────┘    └────┬───┘  └────────┘  └─────────┘
                                  │           ▲           ▲
                                  │           │           │
                                  ▼           │           │
                            ┌─────────────────┴───────────┴──┐
                            │    Agents Proxy                 │
                            │                                 │
                            │  1. JWT decode (NO validation)  │
                            │  2. Call /auth/me (validation)  │
                            │  3. RBAC enforcement            │
                            │  4. Tool authorization          │
                            └─────────────────────────────────┘

JWT Flow:
1. User logs in → Backend generates JWT (secret key)
2. Frontend stores JWT in memory/localStorage
3. Frontend sends JWT to Agents Proxy
4. Agents Proxy DECODES (not validates) JWT
5. Agents Proxy calls Backend /auth/me with JWT
6. Backend VALIDATES JWT signature (source of truth)
7. Backend returns user context
8. Agents Proxy uses context for RBAC

Security Properties:
✅ Backend is single source of truth for authentication
✅ Agents Proxy never needs JWT secret key
✅ JWT cannot be forged (validated by backend)
✅ RBAC enforced before tool execution
✅ All tool calls include Authorization header
✅ Redis doesn't store sensitive data (only conversation history)
```

---

## Observability Stack

```
┌────────────────────────────────────────────────────────────────┐
│                      Metrics & Monitoring                       │
└────────────────────────────────────────────────────────────────┘

┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│ Agents Proxy │       │   Backend    │       │   Frontend   │
│              │       │     API      │       │              │
└──────┬───────┘       └──────┬───────┘       └──────┬───────┘
       │                      │                       │
       │ /metrics             │ /actuator/metrics     │ (RUM)
       │                      │                       │
       ▼                      ▼                       ▼
┌────────────────────────────────────────────────────────────────┐
│                      Prometheus Server                          │
│  - Scrape interval: 15s                                        │
│  - Retention: 15 days                                          │
│  - Metrics:                                                    │
│    * agents_chat_requests_total{status,agent_id}               │
│    * agents_chat_request_duration_seconds{agent_id,status}     │
│    * agents_active_conversations                               │
│    * agents_tool_executions_total{tool_name,status}            │
│    * process_cpu_seconds_total                                 │
│    * process_resident_memory_bytes                             │
└─────────────────────────┬──────────────────────────────────────┘
                          │
                          ▼
                  ┌───────────────┐
                  │    Grafana    │
                  │               │
                  │  Dashboards:  │
                  │  - Agents     │
                  │  - Backend    │
                  │  - System     │
                  └───────────────┘

┌────────────────────────────────────────────────────────────────┐
│                     Distributed Tracing                         │
└────────────────────────────────────────────────────────────────┘

Request with Trace ID: abc-123-def-456

Frontend               Agents Proxy            Backend
   │                        │                     │
   ├─ Span: user_request    │                     │
   │  trace_id: abc-123     │                     │
   │                        │                     │
   ├───────────────────────►│                     │
   │                        ├─ Span: chat_request │
   │                        │  trace_id: abc-123  │
   │                        │  parent: user_request
   │                        │                     │
   │                        ├────────────────────►│
   │                        │                     ├─ Span: auth_validation
   │                        │                     │  trace_id: abc-123
   │                        │                     │  parent: chat_request
   │                        │◄────────────────────┤
   │                        │                     │
   │                        ├────────────────────►│
   │                        │                     ├─ Span: tool_execution
   │                        │                     │  trace_id: abc-123
   │                        │                     │  parent: chat_request
   │                        │◄────────────────────┤
   │◄───────────────────────┤                     │
   │                        │                     │
   ▼                        ▼                     ▼
        ┌──────────────────────────────────┐
        │        Jaeger Collector           │
        │  - Collects spans                │
        │  - Stores in backend             │
        │  - UI: localhost:16686           │
        └──────────────────────────────────┘

Trace Timeline:
0ms     user_request [Frontend]
50ms      ├─ chat_request [Agents Proxy]
100ms     │   ├─ auth_validation [Backend] (50ms)
150ms     │   ├─ agent_execution [Agents Proxy] (1000ms)
200ms     │   │   ├─ openai_api_call (800ms)
250ms     │   │   ├─ tool_execution [Backend] (150ms)
1150ms    │   │   └─ redis_save (10ms)
1200ms    │   └─ complete
1250ms    └─ complete
```

---

## Failure Scenarios & Resilience

```
┌────────────────────────────────────────────────────────────────┐
│               Scenario 1: Backend API Down                      │
└────────────────────────────────────────────────────────────────┘

┌─────────┐      ┌──────────────┐      ┌─────────┐
│Frontend │─────►│ Agents Proxy │─ ✗ ─►│ Backend │ (Down)
└─────────┘      └──────────────┘      └─────────┘

Agents Proxy Behavior:
1. GET /auth/me → Connection refused
2. Catch axios error
3. Return 503 Service Unavailable:
   {
     "status": "error",
     "message": "Backend API unavailable",
     "retryAfter": 30
   }

Frontend Action:
- Show user-friendly error
- Retry with exponential backoff
- Fallback: Disable chat feature temporarily

┌────────────────────────────────────────────────────────────────┐
│              Scenario 2: Redis Down                             │
└────────────────────────────────────────────────────────────────┘

┌─────────┐      ┌──────────────┐      ┌─────────┐
│Frontend │─────►│ Agents Proxy │─ ✗ ─►│  Redis  │ (Down)
└─────────┘      └──────────────┘      └─────────┘

Agents Proxy Behavior:
1. Detect Redis connection failure
2. Fallback to in-memory Map (degraded mode)
3. Log warning: "Redis unavailable, using in-memory store"
4. Continue serving requests
5. Health check: status "degraded"

Implications:
- ⚠️  No conversation persistence across restarts
- ⚠️  No session sharing across instances
- ✅ Service remains available

┌────────────────────────────────────────────────────────────────┐
│             Scenario 3: OpenAI API Down                         │
└────────────────────────────────────────────────────────────────┘

┌─────────┐      ┌──────────────┐      ┌─────────┐
│Frontend │─────►│ Agents Proxy │─ ✗ ─►│ OpenAI  │ (Down)
└─────────┘      └──────────────┘      └─────────┘

Agents Proxy Behavior:
1. OpenAI SDK throws error
2. Catch AgentsError
3. Return 503 with retry info:
   {
     "status": "error",
     "message": "AI service temporarily unavailable",
     "retryAfter": 60
   }

Frontend Action:
- Display: "AI assistant is temporarily offline"
- Allow retry after cooldown
- Queue messages for later?

┌────────────────────────────────────────────────────────────────┐
│          Scenario 4: Agents Proxy Pod Restart                   │
└────────────────────────────────────────────────────────────────┘

With Redis:
✅ Conversations persist
✅ Users can continue from where they left off
✅ No data loss

Without Redis (in-memory):
❌ All active conversations lost
❌ Users must start new sessions
❌ Poor user experience

Mitigation:
- Use Redis in production
- Graceful shutdown (drain connections)
- PreStop hook: wait for active requests to complete
```

This architecture enables a **robust, scalable, and observable** agent microservice!
