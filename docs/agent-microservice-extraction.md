# Agent Proxy Microservice Extraction Analysis

## Executive Summary

**Yes, the agent proxy can and should be extracted into a standalone microservice.** The current implementation in [agents-proxy/src/index.js](../agents-proxy/src/index.js) already follows microservice patterns and is well-positioned for independent deployment.

## Current Architecture Analysis

### Existing Implementation

The agent proxy currently exists as a semi-independent service with:

**Location**: `agents-proxy/src/index.js`
**Port**: `4005` (configurable)
**Dependencies**:
- `@openai/agents` - OpenAI Agents runtime
- `express` - HTTP server
- `axios` - HTTP client for backend API calls
- `jsonwebtoken` - JWT token decoding
- `winston` - Logging
- `zod` - Schema validation

### Current Responsibilities

✅ **Already Single-Responsibility**:
1. **Agent Proxying/Routing**: Mediates ChatKit requests to OpenAI Agents runtime
2. **Authentication**: Verifies JWT tokens and fetches user context from main API
3. **Authorization (RBAC)**: Enforces role-based access control for agent tools
4. **Tool Execution**: Proxies tool calls back to main API with authorization headers
5. **Conversation Management**: In-memory conversation store with TTL-based cleanup
6. **Request Queuing**: Handles concurrent agent requests

### Current Integration Points

**Inbound** (Frontend → Agents Proxy):
```
Frontend (port 3000)
  ↓ HTTP POST /api/agent/chat
  ↓ Authorization: Bearer <JWT>
API Backend (port 8080) /api/agent/chat
  ↓ Proxies to
Agents Proxy (port 4005) /v1/chat
```

**Outbound** (Agents Proxy → Backend API):
```
Agents Proxy (port 4005)
  ↓ GET /auth/me (fetch user context)
  ↓ POST /api/agent/tools/work-orders/search (tool execution)
  ↓ POST /api/agent/tools/assets/search (tool execution)
API Backend (port 8080)
```

### Current Network Topology

```yaml
# docker-compose.yml (lines 93-104)
agents-proxy:
  build: ./agents-proxy
  container_name: atlas-agents-proxy
  environment:
    PORT: 4005
    API_BASE: http://api:8080
    OPENAI_API_KEY: ${OPENAI_API_KEY}
  ports:
    - "4005:4005"
  depends_on:
    - api
```

**Observation**: Already containerized and independently deployable!

## Proposed Microservice Architecture

### Service Definition

**Service Name**: `agents-runtime-service`
**Single Responsibility**: AI agent proxying, routing, authentication, and tool orchestration
**Network API**: HTTP/REST (with gRPC migration path)
**Port**: `4005` (or configurable)

### Enhanced Network API

#### 1. Chat Endpoint (Already Exists)
```http
POST /v1/chat
Content-Type: application/json
Authorization: Bearer <JWT>

{
  "prompt": "Show me open work orders",
  "agentId": "atlas-copilot",
  "metadata": {
    "sessionId": "uuid",
    "correlationId": "uuid"
  }
}

Response:
{
  "status": "success",
  "sessionId": "uuid",
  "agentId": "atlas-copilot",
  "messages": [
    {
      "role": "assistant",
      "content": "Here are your open work orders..."
    }
  ],
  "toolCalls": [...],
  "drafts": [...]
}
```

#### 2. Health Check (Already Exists)
```http
GET /health

Response:
{
  "status": "ok",
  "openaiConfigured": true
}
```

#### 3. Additional Endpoints to Add

**Session Management**:
```http
GET /v1/sessions/{sessionId}
DELETE /v1/sessions/{sessionId}
```

**Conversation History**:
```http
GET /v1/sessions/{sessionId}/history
```

**Agent Configuration**:
```http
GET /v1/agents
GET /v1/agents/{agentId}
```

**Metrics & Observability**:
```http
GET /metrics
GET /health/ready
GET /health/live
```

### Service Boundaries

#### What Stays in the Microservice

✅ **Core Responsibilities**:
- OpenAI Agents runtime integration
- Conversation state management (in-memory store)
- JWT token verification and user context resolution
- RBAC enforcement for tool access
- Tool execution proxying to backend API
- Agent prompt construction and instructions
- Error handling and unwrapping
- Request/response logging

#### What Remains in Backend API

✅ **Backend Responsibilities** (`api/` Spring Boot):
- User authentication (JWT generation)
- User/company data persistence
- Work order/asset/location CRUD operations
- Tool endpoint implementation (`/api/agent/tools/*`)
- Draft action persistence (`AgentDraftAction` entity)
- Tool invocation logging (`AgentToolInvocationLog` entity)
- Database transactions
- Business logic validation

### Communication Patterns

#### 1. Frontend → Backend → Agents Proxy (Current)

```
Frontend
  ↓ POST /api/agent/chat + JWT
API Backend (AgentController.java)
  ↓ Validate feature flag (AGENT_CHATKIT_ENABLED)
  ↓ HTTP client call to AGENT_RUNTIME_URL
Agents Proxy
  ↓ Process with OpenAI
  ↓ Return response
API Backend
  ↓ Persist drafts to AgentDraftAction table
  ↓ Return to frontend
Frontend
```

**Pros**:
- Centralized feature flag control
- Backend can persist drafts immediately
- Single authentication point

**Cons**:
- Extra hop adds latency
- Backend becomes a pass-through proxy

#### 2. Frontend → Agents Proxy Direct (Proposed)

```
Frontend
  ↓ POST /v1/chat + JWT
Agents Proxy
  ↓ Verify JWT (decode only, no validation)
  ↓ GET /auth/me to backend
  ↓ Execute agent with tools
  ↓ POST tool requests back to backend
  ↓ Return response with drafts
Frontend
  ↓ POST /api/agent/drafts/{id}/confirm (to backend)
Backend
  ↓ Persist draft and execute action
```

**Pros**:
- Lower latency (one less hop)
- True microservice independence
- Agents proxy scales independently

**Cons**:
- Frontend needs two base URLs (`API_BASE`, `AGENT_API_BASE`)
- Requires CORS configuration for agents proxy
- Feature flag checking moves to frontend or agents proxy

**Recommendation**: Use **Direct Pattern** for true microservice architecture

### Authentication & Authorization Flow

#### Current Flow (Secure ✅)
1. Frontend obtains JWT from backend (`/api/auth/signin`)
2. Frontend sends JWT to agents proxy in `Authorization` header
3. Agents proxy **decodes** JWT (no secret validation)
4. Agents proxy calls backend `GET /auth/me` with same JWT
5. Backend validates JWT signature and returns user context
6. Agents proxy enforces RBAC based on user context
7. Tool calls include JWT in `Authorization` header back to backend

**Security Model**: Backend is the **source of truth** for authentication. Agents proxy trusts backend's validation.

#### Proposed Enhancement
Add health checks and token refresh mechanisms:

```javascript
// Add to agents-proxy
const verifyBackendConnectivity = async () => {
  try {
    await axios.get(`${API_BASE}/health`);
    return true;
  } catch (error) {
    logger.error('Backend unreachable', { error: error.message });
    return false;
  }
};

// Middleware to check backend health before processing
app.use('/v1/chat', async (req, res, next) => {
  if (!(await verifyBackendConnectivity())) {
    return res.status(503).json({
      status: 'error',
      message: 'Backend API unavailable'
    });
  }
  next();
});
```

### Data Management

#### Stateful Components (In-Memory)

**Conversation Store** ([index.js:73-81](../agents-proxy/src/index.js#L73-L81)):
```javascript
const conversationStore = new Map();
// Structure: Map<sessionId, { history, lastResponseId, updatedAt }>
// TTL: 15 minutes (configurable via CONVERSATION_TTL_MS)
```

**Implications**:
- ❌ Not horizontally scalable (sticky sessions required)
- ❌ State lost on restart
- ❌ No cross-instance conversation continuity

**Solutions**:

##### Option 1: Redis-backed Conversation Store
```javascript
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');

const saveConversationEntry = async (sessionId, runResult) => {
  if (!sessionId || !runResult) return;

  const entry = {
    history: runResult.history,
    lastResponseId: runResult.lastResponseId,
    updatedAt: Date.now()
  };

  await redis.setex(
    `conversation:${sessionId}`,
    CONVERSATION_TTL_MS / 1000, // Redis expects seconds
    JSON.stringify(entry)
  );
};

const getConversationEntry = async (sessionId) => {
  if (!sessionId) return null;

  const data = await redis.get(`conversation:${sessionId}`);
  if (!data) return null;

  return JSON.parse(data);
};
```

**Benefits**:
- ✅ Horizontally scalable
- ✅ Persistent across restarts
- ✅ Shared state across instances
- ✅ TTL handled by Redis

##### Option 2: Backend Database Persistence
Move conversation history to backend database:

```java
// api/src/main/java/com/grash/model/AgentSession.java
@Entity
@Table(name = "agent_sessions")
public class AgentSession {
    @Id
    private String sessionId;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String conversationHistory; // JSON

    private String lastResponseId;

    private LocalDateTime expiresAt;

    @ManyToOne
    private User user;

    @ManyToOne
    private Company company;
}
```

Agents proxy calls:
```http
GET  /api/agent/sessions/{sessionId}
POST /api/agent/sessions/{sessionId}
```

**Benefits**:
- ✅ Consistent with other persistence
- ✅ Queryable conversation history
- ✅ Audit trail integration
- ❌ Adds latency (database round-trip)

**Recommendation**: **Redis** for low latency + optional database archival

### Deployment Strategies

#### Current State
```yaml
# docker-compose.yml
agents-proxy:
  build: ./agents-proxy
  container_name: atlas-agents-proxy
  ports:
    - "4005:4005"
  depends_on:
    - api
```

#### Enhanced Docker Compose (Redis)
```yaml
services:
  redis:
    image: redis:7-alpine
    container_name: atlas_redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

  agents-proxy:
    build: ./agents-proxy
    container_name: atlas-agents-proxy
    environment:
      PORT: 4005
      API_BASE: http://api:8080
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      REDIS_URL: redis://redis:6379
      CONVERSATION_TTL_MS: ${CONVERSATION_TTL_MS:-900000}
      LOG_LEVEL: ${LOG_LEVEL:-info}
    ports:
      - "4005:4005"
    depends_on:
      - api
      - redis
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:4005/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  redis_data:
```

#### Kubernetes Deployment
```yaml
# k8s/agents-proxy-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agents-proxy
  labels:
    app: agents-proxy
spec:
  replicas: 3  # Horizontal scaling
  selector:
    matchLabels:
      app: agents-proxy
  template:
    metadata:
      labels:
        app: agents-proxy
    spec:
      containers:
      - name: agents-proxy
        image: atlas/agents-proxy:latest
        ports:
        - containerPort: 4005
        env:
        - name: PORT
          value: "4005"
        - name: API_BASE
          value: "http://api-service:8080"
        - name: REDIS_URL
          value: "redis://redis-service:6379"
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: openai-secret
              key: api-key
        livenessProbe:
          httpGet:
            path: /health/live
            port: 4005
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 4005
          initialDelaySeconds: 10
          periodSeconds: 5
        resources:
          requests:
            cpu: 100m
            memory: 256Mi
          limits:
            cpu: 500m
            memory: 512Mi
---
apiVersion: v1
kind: Service
metadata:
  name: agents-proxy-service
spec:
  selector:
    app: agents-proxy
  ports:
  - protocol: TCP
    port: 4005
    targetPort: 4005
  type: ClusterIP
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agents-proxy-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: agents-proxy
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### Observability & Monitoring

#### Logging Enhancements
```javascript
// Enhanced structured logging
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'agents-proxy',
    version: process.env.npm_package_version
  },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: 'logs/combined.log'
    })
  ]
});

// Request ID middleware
const requestIdMiddleware = (req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
};

// Correlation ID for tool calls
const logToolCall = (toolName, sessionId, requestId, args) => {
  logger.info('Tool execution started', {
    toolName,
    sessionId,
    requestId,
    correlationId: sessionId,
    arguments: args
  });
};
```

#### Metrics Endpoint
```javascript
const promClient = require('prom-client');

// Create a Registry
const register = new promClient.Registry();

// Default metrics
promClient.collectDefaultMetrics({ register });

// Custom metrics
const chatRequestsTotal = new promClient.Counter({
  name: 'agents_chat_requests_total',
  help: 'Total number of chat requests',
  labelNames: ['status', 'agent_id']
});

const chatRequestDuration = new promClient.Histogram({
  name: 'agents_chat_request_duration_seconds',
  help: 'Chat request duration in seconds',
  labelNames: ['agent_id', 'status'],
  buckets: [0.5, 1, 2, 5, 10, 30]
});

const activeConversations = new promClient.Gauge({
  name: 'agents_active_conversations',
  help: 'Number of active conversations'
});

const toolExecutionsTotal = new promClient.Counter({
  name: 'agents_tool_executions_total',
  help: 'Total number of tool executions',
  labelNames: ['tool_name', 'status']
});

register.registerMetric(chatRequestsTotal);
register.registerMetric(chatRequestDuration);
register.registerMetric(activeConversations);
register.registerMetric(toolExecutionsTotal);

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Update metrics in chat handler
app.post('/v1/chat', async (req, res) => {
  const start = Date.now();
  const agentId = req.body.agentId || 'default-agent';

  try {
    // ... existing logic

    chatRequestsTotal.inc({ status: 'success', agent_id: agentId });
    chatRequestDuration.observe(
      { agent_id: agentId, status: 'success' },
      (Date.now() - start) / 1000
    );
    activeConversations.set(conversationStore.size);

  } catch (error) {
    chatRequestsTotal.inc({ status: 'error', agent_id: agentId });
    chatRequestDuration.observe(
      { agent_id: agentId, status: 'error' },
      (Date.now() - start) / 1000
    );
    throw error;
  }
});
```

#### Distributed Tracing
```javascript
const opentelemetry = require('@opentelemetry/api');
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');

// Configure tracer
const provider = new NodeTracerProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'agents-proxy',
  }),
});

const exporter = new JaegerExporter({
  endpoint: process.env.JAEGER_ENDPOINT || 'http://jaeger:14268/api/traces',
});

provider.addSpanProcessor(new opentelemetry.tracing.SimpleSpanProcessor(exporter));
provider.register();

const tracer = opentelemetry.trace.getTracer('agents-proxy');

// Instrumentation
app.post('/v1/chat', async (req, res) => {
  const span = tracer.startSpan('chat_request');

  try {
    span.setAttributes({
      'agent.id': req.body.agentId,
      'session.id': sessionId,
      'user.id': userContext?.id
    });

    // ... existing logic

    span.setStatus({ code: opentelemetry.SpanStatusCode.OK });
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: opentelemetry.SpanStatusCode.ERROR });
    throw error;
  } finally {
    span.end();
  }
});
```

### Testing Strategy

#### Unit Tests (Existing)
```javascript
// agents-proxy/src/__tests__/chat.test.js (already exists)
describe('POST /v1/chat', () => {
  it('should return 400 when prompt is missing', async () => {
    // Test exists
  });

  it('should return 401 when authorization header is missing', async () => {
    // Test exists
  });
});
```

#### Integration Tests (To Add)
```javascript
// agents-proxy/src/__tests__/integration.test.js
const request = require('supertest');
const nock = require('nock');
const app = require('../index');

describe('Integration: Chat with Backend', () => {
  beforeEach(() => {
    nock('http://api:8080')
      .get('/auth/me')
      .reply(200, {
        id: 1,
        role: 'ADMIN',
        companyId: 1
      });
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('should fetch user context and process chat', async () => {
    nock('http://api:8080')
      .post('/api/agent/tools/work-orders/search')
      .reply(200, { results: [] });

    const response = await request(app)
      .post('/v1/chat')
      .set('Authorization', 'Bearer valid-jwt')
      .send({
        prompt: 'Show me work orders',
        agentId: 'atlas-copilot'
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('success');
  });

  it('should handle backend unavailability', async () => {
    nock('http://api:8080')
      .get('/auth/me')
      .replyWithError('Connection refused');

    const response = await request(app)
      .post('/v1/chat')
      .set('Authorization', 'Bearer valid-jwt')
      .send({
        prompt: 'Test',
        agentId: 'atlas-copilot'
      });

    expect(response.status).toBe(401);
  });
});
```

#### Load Testing
```javascript
// k6 load test script
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 10 },  // Ramp up
    { duration: '5m', target: 10 },  // Stay at 10 users
    { duration: '2m', target: 50 },  // Spike
    { duration: '5m', target: 50 },  // Stay at 50
    { duration: '2m', target: 0 },   // Ramp down
  ],
};

export default function () {
  const url = 'http://localhost:4005/v1/chat';
  const payload = JSON.stringify({
    prompt: 'Show me open work orders',
    agentId: 'atlas-copilot',
    metadata: { sessionId: `session-${__VU}-${__ITER}` }
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-jwt-token',
    },
  };

  const res = http.post(url, payload, params);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 5s': (r) => r.timings.duration < 5000,
  });

  sleep(1);
}
```

### Migration Path

#### Phase 1: Redis Integration (Week 1-2)
- [ ] Add Redis dependency to `package.json`
- [ ] Implement Redis-backed conversation store
- [ ] Add Redis to `docker-compose.yml`
- [ ] Update environment variables and `.env.example`
- [ ] Test conversation persistence across restarts
- [ ] **Deliverable**: Redis-backed stateful microservice

#### Phase 2: Enhanced Observability (Week 3)
- [ ] Add Prometheus metrics endpoint
- [ ] Implement structured logging with correlation IDs
- [ ] Add health check endpoints (`/health/live`, `/health/ready`)
- [ ] Set up Grafana dashboards
- [ ] **Deliverable**: Observable microservice with metrics

#### Phase 3: Frontend Direct Connection (Week 4)
- [ ] Update frontend to call agents-proxy directly
- [ ] Configure CORS on agents-proxy
- [ ] Add feature flag to toggle direct vs proxied mode
- [ ] Test end-to-end with direct connection
- [ ] **Deliverable**: Direct frontend-to-microservice communication

#### Phase 4: Horizontal Scaling (Week 5-6)
- [ ] Create Kubernetes manifests
- [ ] Set up HorizontalPodAutoscaler
- [ ] Load test with multiple instances
- [ ] Validate session affinity not required (thanks to Redis)
- [ ] **Deliverable**: Production-ready Kubernetes deployment

#### Phase 5: gRPC Migration (Optional, Week 7-8)
- [ ] Define Protocol Buffers schema
- [ ] Implement gRPC server alongside HTTP
- [ ] Add gRPC client to backend
- [ ] Performance comparison (gRPC vs HTTP/REST)
- [ ] **Deliverable**: High-performance gRPC interface

### Security Considerations

#### 1. API Key Protection
```javascript
// Validate OPENAI_API_KEY is set
if (!OPENAI_API_KEY) {
  logger.error('OPENAI_API_KEY not configured');
  process.exit(1); // Fail fast in production
}

// Never log the actual key
logger.info('OpenAI configuration', {
  configured: Boolean(OPENAI_API_KEY),
  model: OPENAI_MODEL
});
```

#### 2. Rate Limiting (Add)
```javascript
const rateLimit = require('express-rate-limit');

const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per IP
  message: 'Too many chat requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

app.post('/v1/chat', chatLimiter, async (req, res) => {
  // ... existing logic
});
```

#### 3. Input Validation (Enhance)
```javascript
const { z } = require('zod');

const ChatRequestSchema = z.object({
  prompt: z.string().min(1).max(10000),
  agentId: z.string().optional(),
  metadata: z.object({
    sessionId: z.string().uuid().optional(),
    correlationId: z.string().optional()
  }).optional()
});

app.post('/v1/chat', async (req, res) => {
  try {
    const validated = ChatRequestSchema.parse(req.body);
    // Use validated instead of req.body
  } catch (error) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid request format',
      errors: error.errors
    });
  }
});
```

#### 4. CORS Configuration
```javascript
const cors = require('cors');

const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:8080'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
};

app.use(cors(corsOptions));
```

### Performance Optimization

#### 1. Connection Pooling
```javascript
const axios = require('axios');
const { Agent } = require('http');

const httpAgent = new Agent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 30000
});

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  httpAgent
});

// Use apiClient instead of axios
const response = await apiClient.get('/auth/me', {
  headers: { Authorization: authorizationHeader }
});
```

#### 2. Conversation Store Optimization
```javascript
// Add background cleanup
setInterval(() => {
  const before = conversationStore.size;
  cleanupExpiredConversations();
  const after = conversationStore.size;

  if (before !== after) {
    logger.info('Conversation cleanup', {
      removed: before - after,
      remaining: after
    });
  }
}, CONVERSATION_TTL_MS / 2); // Run twice per TTL period
```

#### 3. Response Streaming (Future Enhancement)
```javascript
// For long-running agent responses
app.post('/v1/chat/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Stream agent responses as they arrive
  const stream = await runAgentConversationStream({...});

  for await (const chunk of stream) {
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  }

  res.end();
});
```

## Recommended Implementation Plan

### Immediate Actions (This Week)

1. **Add Redis Integration**
   - Update `package.json` with `ioredis`
   - Implement Redis-backed conversation store
   - Test with Docker Compose

2. **Enhance Observability**
   - Add Prometheus metrics
   - Implement structured logging
   - Create health check endpoints

3. **Documentation**
   - Update `agents-proxy/README.md`
   - Document environment variables
   - Add architecture diagram

### Short Term (Next Month)

1. **Frontend Direct Connection**
   - Update frontend configuration
   - Test direct API calls
   - Monitor performance improvements

2. **Kubernetes Deployment**
   - Create deployment manifests
   - Set up autoscaling
   - Load testing

3. **CI/CD Pipeline**
   - Automated testing
   - Container image builds
   - Deployment automation

### Long Term (Next Quarter)

1. **gRPC Migration** (optional)
2. **Advanced Features**
   - Multi-agent support
   - Agent versioning
   - A/B testing framework
3. **Cost Optimization**
   - Token usage tracking
   - Response caching
   - Model selection strategies

## Conclusion

**The agent proxy is already well-architected as a microservice.** Key improvements needed:

1. ✅ **Already Good**: Single responsibility, containerized, independent deployment
2. 🔧 **Needs Work**: Stateless design (add Redis), observability, direct frontend access
3. 🚀 **Future**: Horizontal scaling, gRPC, advanced monitoring

**Estimated Effort**: 4-6 weeks for full production-ready microservice extraction

**Risk Level**: Low (already semi-independent)

**Business Value**: High (scalability, reliability, maintainability)
