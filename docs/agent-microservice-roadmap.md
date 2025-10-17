# Agent Microservice Implementation Roadmap

## Phase 1: Redis Integration (Week 1-2)
**Goal**: Replace in-memory conversation store with Redis for persistence and scalability

### Tasks

#### 1.1 Add Redis Dependencies
```bash
cd agents-proxy
npm install ioredis
npm install --save-dev @types/ioredis
```

**Files to Update**:
- [agents-proxy/package.json](../agents-proxy/package.json)

#### 1.2 Create Redis Client Module
**New File**: `agents-proxy/src/redis-client.js`

```javascript
const Redis = require('ioredis');
const logger = require('./logger'); // Extract logger to separate module

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_KEY_PREFIX = process.env.REDIS_KEY_PREFIX || 'agents:';

let redisClient;

const getRedisClient = () => {
  if (redisClient) {
    return redisClient;
  }

  redisClient = new Redis(REDIS_URL, {
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      logger.warn(`Redis connection retry attempt ${times}`, { delay });
      return delay;
    },
    reconnectOnError: (err) => {
      logger.error('Redis connection error', { error: err.message });
      return true;
    }
  });

  redisClient.on('connect', () => {
    logger.info('Redis connected', { url: REDIS_URL });
  });

  redisClient.on('error', (err) => {
    logger.error('Redis error', { error: err.message });
  });

  return redisClient;
};

module.exports = { getRedisClient, REDIS_KEY_PREFIX };
```

#### 1.3 Update Conversation Store Functions
**File**: [agents-proxy/src/index.js](../agents-proxy/src/index.js)

Replace lines 73-81 and 686-713 with:

```javascript
const { getRedisClient, REDIS_KEY_PREFIX } = require('./redis-client');

// Remove: const conversationStore = new Map();

const saveConversationEntry = async (sessionId, runResult) => {
  if (!sessionId || !runResult) {
    return;
  }
  if (!Array.isArray(runResult.history)) {
    return;
  }

  const redis = getRedisClient();
  const key = `${REDIS_KEY_PREFIX}conversation:${sessionId}`;
  const entry = {
    history: runResult.history,
    lastResponseId: runResult.lastResponseId,
    updatedAt: Date.now()
  };

  try {
    await redis.setex(
      key,
      Math.floor(CONVERSATION_TTL_MS / 1000), // Redis expects seconds
      JSON.stringify(entry)
    );
    logger.debug('Conversation saved to Redis', { sessionId, key });
  } catch (error) {
    logger.error('Failed to save conversation to Redis', {
      sessionId,
      error: error.message
    });
    // Continue processing; conversation loss is not critical
  }
};

const getConversationEntry = async (sessionId) => {
  if (!sessionId) {
    return null;
  }

  const redis = getRedisClient();
  const key = `${REDIS_KEY_PREFIX}conversation:${sessionId}`;

  try {
    const data = await redis.get(key);
    if (!data) {
      return null;
    }

    const entry = JSON.parse(data);

    // Check if expired (defensive check; Redis TTL should handle this)
    if (Date.now() - entry.updatedAt > CONVERSATION_TTL_MS) {
      await redis.del(key);
      return null;
    }

    return entry;
  } catch (error) {
    logger.error('Failed to retrieve conversation from Redis', {
      sessionId,
      error: error.message
    });
    return null;
  }
};

// Remove: const cleanupExpiredConversations function
// Remove: setInterval for cleanup (Redis TTL handles this)
```

Update `runAgentConversation` function (line 775-829):

```javascript
const runAgentConversation = async ({
  prompt,
  agentId,
  authorizationHeader,
  userContext,
  metadata,
  sessionOverride
}) => {
  const agent = getAtlasAgent();
  const sessionId = sessionOverride || getSessionId(metadata);
  const previousConversation = await getConversationEntry(sessionId); // Add await

  // ... rest of function remains same

  const result = await run(agent, conversationInput, runOptions);
  await saveConversationEntry(sessionId, result); // Add await

  // ... rest of function
};
```

#### 1.4 Update Docker Compose
**File**: [docker-compose.yml](../docker-compose.yml)

Add Redis service (after line 104):

```yaml
  redis:
    image: redis:7-alpine
    container_name: atlas_redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3
```

Update `agents-proxy` service (lines 93-104):

```yaml
  agents-proxy:
    build: ./agents-proxy
    container_name: atlas-agents-proxy
    environment:
      PORT: ${AGENTS_PROXY_PORT:-4005}
      API_BASE: http://api:8080
      OPENAI_API_KEY: ${OPENAI_API_KEY:-}
      AGENT_CHATKIT_AGENT_ID: ${AGENT_CHATKIT_AGENT_ID:-}
      REDIS_URL: redis://redis:6379              # NEW
      REDIS_KEY_PREFIX: ${REDIS_KEY_PREFIX:-agents:}  # NEW
      CONVERSATION_TTL_MS: ${CONVERSATION_TTL_MS:-900000}  # NEW
      LOG_LEVEL: ${LOG_LEVEL:-info}              # NEW
    ports:
      - "${AGENTS_PROXY_PORT:-4005}:4005"
    depends_on:
      redis:                                      # NEW
        condition: service_healthy               # NEW
      api:
        condition: service_started
    healthcheck:                                  # NEW
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:4005/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

Add volume (after line 119):

```yaml
volumes:
  postgres_data:
  minio_data:
  redis_data:  # NEW
```

#### 1.5 Update Environment Variables
**File**: [agents-proxy/.env.example](../agents-proxy/.env.example)

```env
# Server
PORT=4005

# Backend API
API_BASE=http://api:8080

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
AGENT_CHATKIT_AGENT_ID=atlas-copilot

# Redis (NEW)
REDIS_URL=redis://redis:6379
REDIS_KEY_PREFIX=agents:

# Conversation Management (NEW)
CONVERSATION_TTL_MS=900000  # 15 minutes

# Logging (NEW)
LOG_LEVEL=info
```

#### 1.6 Testing
```bash
# Start services
docker-compose up -d redis agents-proxy

# Test Redis connection
docker exec -it atlas_redis redis-cli ping
# Expected: PONG

# Test conversation persistence
curl -X POST http://localhost:4005/v1/chat \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Show me open work orders",
    "agentId": "atlas-copilot",
    "metadata": { "sessionId": "test-session-123" }
  }'

# Check Redis for stored conversation
docker exec -it atlas_redis redis-cli KEYS "agents:*"
# Expected: 1) "agents:conversation:test-session-123"

# Restart agents-proxy
docker-compose restart agents-proxy

# Verify conversation persists
curl -X POST http://localhost:4005/v1/chat \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "What did I just ask?",
    "metadata": { "sessionId": "test-session-123" }
  }'
# Expected: Agent remembers previous context
```

**Acceptance Criteria**:
- ✅ Redis container starts and accepts connections
- ✅ Conversations saved to Redis with correct TTL
- ✅ Conversations retrieved from Redis correctly
- ✅ Conversations persist across agent-proxy restarts
- ✅ Multiple agent-proxy instances share conversation state
- ✅ Expired conversations removed automatically by Redis

---

## Phase 2: Enhanced Observability (Week 3)
**Goal**: Add Prometheus metrics, structured logging, and health checks

### Tasks

#### 2.1 Add Monitoring Dependencies
```bash
npm install prom-client
npm install express-winston
```

#### 2.2 Implement Metrics Endpoint
**New File**: `agents-proxy/src/metrics.js`

```javascript
const promClient = require('prom-client');

const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

// Custom metrics
const chatRequestsTotal = new promClient.Counter({
  name: 'agents_chat_requests_total',
  help: 'Total number of chat requests',
  labelNames: ['status', 'agent_id'],
  registers: [register]
});

const chatRequestDuration = new promClient.Histogram({
  name: 'agents_chat_request_duration_seconds',
  help: 'Chat request duration in seconds',
  labelNames: ['agent_id', 'status'],
  buckets: [0.5, 1, 2, 5, 10, 30],
  registers: [register]
});

const activeConversations = new promClient.Gauge({
  name: 'agents_active_conversations',
  help: 'Number of active conversations in Redis',
  registers: [register]
});

const toolExecutionsTotal = new promClient.Counter({
  name: 'agents_tool_executions_total',
  help: 'Total number of tool executions',
  labelNames: ['tool_name', 'status'],
  registers: [register]
});

const openaiApiCalls = new promClient.Counter({
  name: 'agents_openai_api_calls_total',
  help: 'Total OpenAI API calls',
  labelNames: ['model', 'status'],
  registers: [register]
});

module.exports = {
  register,
  chatRequestsTotal,
  chatRequestDuration,
  activeConversations,
  toolExecutionsTotal,
  openaiApiCalls
};
```

**Update**: [agents-proxy/src/index.js](../agents-proxy/src/index.js)

Add metrics endpoint:

```javascript
const {
  register,
  chatRequestsTotal,
  chatRequestDuration,
  activeConversations,
  toolExecutionsTotal
} = require('./metrics');

// Metrics endpoint (add before /v1/chat)
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Update active conversations gauge periodically
const updateActiveConversations = async () => {
  try {
    const redis = getRedisClient();
    const keys = await redis.keys(`${REDIS_KEY_PREFIX}conversation:*`);
    activeConversations.set(keys.length);
  } catch (error) {
    logger.error('Failed to update active conversations metric', {
      error: error.message
    });
  }
};

setInterval(updateActiveConversations, 30000); // Every 30 seconds
```

#### 2.3 Instrument Chat Endpoint
**Update**: [agents-proxy/src/index.js](../agents-proxy/src/index.js) lines 876-1015

```javascript
app.post('/v1/chat', async (req, res) => {
  const startTime = Date.now();
  const { prompt, agentId: requestedAgentId, metadata } = req.body || {};
  const agentId = requestedAgentId || DEFAULT_AGENT_ID || 'default-agent';

  if (!prompt) {
    chatRequestsTotal.inc({ status: 'error_validation', agent_id: agentId });
    return res.status(400).json({ error: 'prompt is required' });
  }

  // ... existing auth logic

  try {
    const agentResponse = await runAgentConversation({
      prompt,
      agentId,
      authorizationHeader,
      userContext,
      metadata,
      sessionOverride: sessionId
    });

    // Record success metrics
    chatRequestsTotal.inc({ status: 'success', agent_id: agentId });
    chatRequestDuration.observe(
      { agent_id: agentId, status: 'success' },
      (Date.now() - startTime) / 1000
    );

    return res.json({
      status: 'success',
      message: 'Agent response generated',
      agentId,
      sessionId: agentResponse.sessionId,
      messages: [
        {
          role: 'assistant',
          content: agentResponse.finalOutput
        }
      ],
      toolCalls: agentResponse.toolCalls,
      drafts: agentResponse.drafts
    });
  } catch (error) {
    const rootError = unwrapAgentError(error);

    // Record error metrics
    const errorType = rootError instanceof AuthenticationError
      ? 'error_auth'
      : rootError instanceof RbacError
      ? 'error_rbac'
      : rootError instanceof TenantContextError
      ? 'error_tenant'
      : 'error_internal';

    chatRequestsTotal.inc({ status: errorType, agent_id: agentId });
    chatRequestDuration.observe(
      { agent_id: agentId, status: errorType },
      (Date.now() - startTime) / 1000
    );

    // ... existing error handling
  }
});
```

#### 2.4 Add Health Check Endpoints
**Update**: [agents-proxy/src/index.js](../agents-proxy/src/index.js)

```javascript
// Liveness probe (basic)
app.get('/health/live', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Readiness probe (checks dependencies)
app.get('/health/ready', async (req, res) => {
  const checks = {
    redis: 'unknown',
    backend: 'unknown',
    openai: Boolean(OPENAI_API_KEY)
  };

  try {
    // Check Redis
    const redis = getRedisClient();
    await redis.ping();
    checks.redis = 'ok';
  } catch (error) {
    checks.redis = 'error';
  }

  try {
    // Check Backend
    await axios.get(`${API_BASE}/actuator/health`, { timeout: 5000 });
    checks.backend = 'ok';
  } catch (error) {
    checks.backend = 'error';
  }

  const allHealthy = checks.redis === 'ok' && checks.backend === 'ok';
  const status = allHealthy ? 200 : 503;

  res.status(status).json({
    status: allHealthy ? 'ready' : 'not_ready',
    checks,
    timestamp: new Date().toISOString()
  });
});
```

#### 2.5 Enhanced Structured Logging
**New File**: `agents-proxy/src/logger.js`

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'agents-proxy',
    version: require('../package.json').version,
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
          return `${timestamp} [${service}] ${level}: ${message} ${
            Object.keys(meta).length ? JSON.stringify(meta) : ''
          }`;
        })
      )
    })
  ]
});

module.exports = logger;
```

**Update**: Replace all `logger` references in [agents-proxy/src/index.js](../agents-proxy/src/index.js) with:

```javascript
const logger = require('./logger');
```

---

## Phase 3: Frontend Direct Connection (Week 4)
**Goal**: Enable frontend to call agents-proxy directly instead of through backend

### Tasks

#### 3.1 Update Frontend Agent API Client
**File**: [frontend/src/utils/agentApi.ts](../frontend/src/utils/agentApi.ts)

```typescript
import { agentApiBase } from 'src/config';
import { authHeader } from './api';

// Change baseUrl to use AGENT_API_BASE directly
const trimmedBase = agentApiBase.endsWith('/')
  ? agentApiBase.slice(0, -1)
  : agentApiBase;

// Point directly to agents-proxy instead of backend
const baseUrl = trimmedBase; // Was: `${trimmedBase}/api/agent`

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: HeadersInit = {
    ...authHeader(false),
    ...(init.headers || {})
  };

  // Direct call to agents-proxy
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers
  });

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    const payload =
      contentType.includes('application/json')
        ? await response.json()
        : await response.text();
    const errorMessage =
      typeof payload === 'string'
        ? payload
        : payload?.message || 'Agent API request failed';
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return response.json() as Promise<T>;
}

// Chat endpoint now calls agents-proxy directly
export function postChat<T>(body: unknown): Promise<T> {
  return request<T>('/v1/chat', {  // Changed from '/chat' to '/v1/chat'
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
}

// Drafts endpoints still go to backend API
const backendApiBase = process.env.REACT_APP_API_URL || 'http://localhost:8080';

export function getDrafts<T>(): Promise<T> {
  return fetch(`${backendApiBase}/api/agent/drafts`, {
    headers: {
      ...authHeader(false),
    }
  }).then(res => res.json());
}

export function confirmDraft<T>(draftId: number): Promise<T> {
  return fetch(`${backendApiBase}/api/agent/drafts/${draftId}/confirm`, {
    method: 'POST',
    headers: {
      ...authHeader(false),
    }
  }).then(res => res.json());
}

export function declineDraft<T>(draftId: number): Promise<T> {
  return fetch(`${backendApiBase}/api/agent/drafts/${draftId}`, {
    method: 'DELETE',
    headers: {
      ...authHeader(false),
    }
  }).then(res => res.json());
}
```

#### 3.2 Add CORS to Agents Proxy
**File**: [agents-proxy/src/index.js](../agents-proxy/src/index.js)

```javascript
const cors = require('cors');

// Add CORS configuration
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:8080'];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked request from origin', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
};

app.use(cors(corsOptions));
```

#### 3.3 Update Docker Compose Environment
**File**: [docker-compose.yml](../docker-compose.yml)

```yaml
  agents-proxy:
    build: ./agents-proxy
    container_name: atlas-agents-proxy
    environment:
      # ... existing vars
      ALLOWED_ORIGINS: ${ALLOWED_ORIGINS:-http://localhost:3000,http://localhost:8080}  # NEW
```

#### 3.4 Testing
```bash
# Test direct frontend connection
# 1. Start all services
docker-compose up -d

# 2. Open browser DevTools Network tab
# 3. Navigate to chat interface
# 4. Send a message
# 5. Verify request goes to http://localhost:4005/v1/chat (not http://localhost:8080)

# 6. Check response time improvement
# Before: ~1500-2000ms
# After: ~1400-1800ms
# Improvement: ~100-200ms (5-10%)
```

**Acceptance Criteria**:
- ✅ Frontend calls agents-proxy directly
- ✅ CORS headers allow frontend origin
- ✅ JWT authorization works correctly
- ✅ Latency reduced by 5-10%
- ✅ Draft management still works via backend

---

## Phase 4: Horizontal Scaling (Week 5-6)
**Goal**: Deploy to Kubernetes with autoscaling

### Tasks

#### 4.1 Create Kubernetes Manifests
**New Directory**: `k8s/agents-proxy/`

**File**: `k8s/agents-proxy/deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agents-proxy
  namespace: default
  labels:
    app: agents-proxy
    version: v1
spec:
  replicas: 2
  selector:
    matchLabels:
      app: agents-proxy
  template:
    metadata:
      labels:
        app: agents-proxy
        version: v1
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "4005"
        prometheus.io/path: "/metrics"
    spec:
      containers:
      - name: agents-proxy
        image: atlas/agents-proxy:latest
        imagePullPolicy: Always
        ports:
        - name: http
          containerPort: 4005
          protocol: TCP
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
        - name: LOG_LEVEL
          value: "info"
        - name: ALLOWED_ORIGINS
          value: "https://app.example.com"
        livenessProbe:
          httpGet:
            path: /health/live
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health/ready
            port: http
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 5
          failureThreshold: 3
        resources:
          requests:
            cpu: 100m
            memory: 256Mi
          limits:
            cpu: 500m
            memory: 512Mi
```

**File**: `k8s/agents-proxy/service.yaml`

```yaml
apiVersion: v1
kind: Service
metadata:
  name: agents-proxy-service
  namespace: default
spec:
  type: ClusterIP
  selector:
    app: agents-proxy
  ports:
  - name: http
    protocol: TCP
    port: 4005
    targetPort: http
```

**File**: `k8s/agents-proxy/hpa.yaml`

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agents-proxy-hpa
  namespace: default
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
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 30
      - type: Pods
        value: 2
        periodSeconds: 30
      selectPolicy: Max
```

#### 4.2 Load Testing
**New File**: `agents-proxy/load-test.js` (using k6)

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const chatRequests = new Counter('chat_requests');
const chatDuration = new Trend('chat_duration');

export let options = {
  stages: [
    { duration: '2m', target: 10 },   // Warm up
    { duration: '5m', target: 10 },   // Baseline
    { duration: '2m', target: 50 },   // Scale up
    { duration: '5m', target: 50 },   // Sustained load
    { duration: '2m', target: 100 },  // Spike
    { duration: '3m', target: 100 },  // Peak
    { duration: '2m', target: 0 },    // Scale down
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'], // 95% of requests under 5s
    http_req_failed: ['rate<0.05'],    // Less than 5% failures
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4005';
const JWT_TOKEN = __ENV.JWT_TOKEN || 'test-jwt-token';

export default function () {
  const sessionId = `session-${__VU}-${__ITER}`;

  const payload = JSON.stringify({
    prompt: 'Show me open work orders',
    agentId: 'atlas-copilot',
    metadata: { sessionId }
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${JWT_TOKEN}`,
    },
  };

  const start = new Date();
  const res = http.post(`${BASE_URL}/v1/chat`, payload, params);
  const duration = new Date() - start;

  chatRequests.add(1);
  chatDuration.add(duration);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response has sessionId': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.sessionId !== undefined;
      } catch {
        return false;
      }
    },
    'response time < 5s': () => duration < 5000,
  });

  sleep(1);
}
```

Run load test:

```bash
# Install k6
# macOS: brew install k6
# Linux: sudo apt install k6

# Run test
k6 run --vus 10 --duration 30s agents-proxy/load-test.js

# With custom settings
BASE_URL=http://localhost:4005 \
JWT_TOKEN=<your-jwt> \
k6 run agents-proxy/load-test.js
```

**Acceptance Criteria**:
- ✅ Kubernetes deployment successful
- ✅ HPA scales from 2 to 10 pods under load
- ✅ Load test shows <5% error rate at 100 VUs
- ✅ p95 latency < 5 seconds
- ✅ Graceful scale-down after load reduction

---

## Phase 5: Production Hardening (Week 7)
**Goal**: Add security, monitoring, and operational readiness

### Tasks

#### 5.1 Rate Limiting
```bash
npm install express-rate-limit
```

**Update**: [agents-proxy/src/index.js](../agents-proxy/src/index.js)

```javascript
const rateLimit = require('express-rate-limit');

const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.RATE_LIMIT_MAX || 30,
  message: {
    status: 'error',
    message: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path.startsWith('/health');
  }
});

app.use('/v1/chat', chatLimiter);
```

#### 5.2 Input Validation
**Update Tool Schemas**: [agents-proxy/src/index.js](../agents-proxy/src/index.js)

Add request validation:

```javascript
const ChatRequestSchema = z.object({
  prompt: z.string().min(1).max(10000),
  agentId: z.string().optional(),
  metadata: z.object({
    sessionId: z.string().uuid().optional(),
    correlationId: z.string().optional()
  }).optional()
});

app.post('/v1/chat', chatLimiter, async (req, res) => {
  try {
    const validated = ChatRequestSchema.parse(req.body);
    // Use validated.prompt instead of req.body.prompt
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid request format',
        errors: error.errors
      });
    }
    throw error;
  }

  // ... rest of handler
});
```

#### 5.3 Secrets Management
**Create Kubernetes Secret**:

```bash
kubectl create secret generic openai-secret \
  --from-literal=api-key=$OPENAI_API_KEY \
  --namespace=default
```

**Never commit** `.env` files with real credentials!

#### 5.4 Monitoring Dashboards
**New File**: `k8s/grafana/agents-proxy-dashboard.json`

(Grafana dashboard JSON - see full example in separate document)

Key metrics to monitor:
- Request rate (req/min)
- Error rate (%)
- p50, p95, p99 latency
- Active conversations
- Pod count (HPA)
- CPU/Memory usage
- Redis connection pool

---

## Success Metrics

### Performance
- [ ] Latency reduced by 5-10% (direct connection)
- [ ] p95 < 5 seconds under normal load
- [ ] p99 < 10 seconds under spike load
- [ ] Error rate < 1% in production

### Scalability
- [ ] Horizontal scaling from 2-10 pods
- [ ] Handles 100+ concurrent users
- [ ] Redis stores 1000+ active conversations
- [ ] No degradation with multiple instances

### Reliability
- [ ] 99.9% uptime
- [ ] Zero data loss (conversations persist)
- [ ] Graceful degradation when dependencies fail
- [ ] Successful recovery from pod restarts

### Observability
- [ ] All critical metrics exposed
- [ ] Structured logging with correlation IDs
- [ ] Distributed tracing enabled
- [ ] Grafana dashboards operational

---

## Rollback Plan

If issues occur, rollback steps:

1. **Phase 3 Rollback** (Frontend Direct):
   - Revert frontend to proxy through backend
   - Update `agentApi.ts` to use `/api/agent/chat`

2. **Phase 1 Rollback** (Redis):
   - Remove Redis dependency
   - Revert to in-memory `Map`
   - Accept session loss on restart

3. **Kubernetes Rollback**:
   ```bash
   kubectl rollout undo deployment/agents-proxy
   ```

4. **Full Rollback**:
   - Use backend as proxy again
   - Disable direct frontend connection
   - Scale down agents-proxy to 1 replica

---

## Next Steps

After completing all phases:

1. **Documentation**:
   - API reference
   - Deployment guide
   - Troubleshooting guide

2. **CI/CD**:
   - Automated testing
   - Container builds
   - Deployment pipelines

3. **Advanced Features**:
   - Multi-agent support
   - A/B testing
   - Cost tracking
   - Response caching
   - gRPC migration (optional)

---

**Estimated Total Effort**: 6-7 weeks
**Team Size**: 1-2 developers
**Risk Level**: Low (incremental, reversible changes)
**Business Value**: High (scalability, performance, maintainability)
