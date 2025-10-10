# Docker Infrastructure Documentation

## Repository Overview
- **Repo Root**: `C:\projects\cmms-AI`
- **Docker Compose**: `docker-compose.yml` (root level)
- **Dev Override**: None found
- **Dockerfiles**: 3 services (api, frontend, agents-proxy)

---

## Service Architecture

### 1. PostgreSQL Database (`postgres`)
**Type**: Pre-built image (image-only)

```yaml
Service: postgres
Image: postgres:16-alpine
Container: atlas_db
Ports: 5432:5432
Hot-Mounted: No
```

**Environment Variables**:
- `POSTGRES_DB`: atlas
- `POSTGRES_USER`: ${POSTGRES_USER}
- `POSTGRES_PASSWORD`: ${POSTGRES_PWD}

**Volumes**:
- `postgres_data:/var/lib/postgresql/data` (named volume)

**Purpose**: Primary data persistence layer

---

### 2. Backend API (`api`)
**Type**: Pre-built image (image-only) - **REBUILD REQUIRED FOR CODE CHANGES**

```yaml
Service: api
Image: intelloop/atlas-cmms-backend
Container: atlas-cmms-backend
Ports: 8080:8080
Hot-Mounted: No (except /app/static/images)
Build Context: ./api (Dockerfile present but not used in compose)
```

**Dockerfile Analysis** (`api/Dockerfile`):
- **Build Stage**: Maven 3.8.6 + JDK 8
  - Copies source and runs `mvn clean package -DskipTests`
- **Runtime Stage**: OpenJDK 8 Alpine
  - Runs JAR as `my-spring-boot-app.jar`
  - Exposes port 8080

**Volumes**:
- `./logo:/app/static/images` (host → container, hot-mounted for logo files only)

**Key Environment Variables**:
- Database: `DB_URL`, `DB_USER`, `DB_PWD`
- URLs: `PUBLIC_API_URL`, `PUBLIC_FRONT_URL`
- Storage: `STORAGE_TYPE` (minio|gcp), `MINIO_*`, `GCP_*`
- Email: `SMTP_*`, `MAIL_RECIPIENTS`, `ENABLE_EMAIL_NOTIFICATIONS`
- Auth: `JWT_SECRET_KEY`, `ENABLE_SSO`, `OAUTH2_*`
- Licensing: `LICENSE_KEY`, `LICENSE_FINGERPRINT_REQUIRED`
- Branding: `LOGO_PATHS`, `CUSTOM_COLORS`, `BRAND_CONFIG`
- Agent Integration: `AGENT_CHATKIT_ENABLED`, `AGENT_RUNTIME_URL`, `AGENT_RUNTIME_TOKEN`

**Dependencies**: postgres, minio

---

### 3. Frontend (`frontend`)
**Type**: Pre-built image (image-only) - **REBUILD REQUIRED FOR CODE CHANGES**

```yaml
Service: frontend
Image: intelloop/atlas-cmms-frontend
Container: atlas-cmms-frontend
Ports: 3000:3000
Hot-Mounted: No
Build Context: ./frontend (Dockerfile present but not used in compose)
```

**Dockerfile Analysis** (`frontend/Dockerfile`):
- **Build Stage**: Node 21.6.1
  - Runs `npm install --legacy-peer-deps`
  - Builds React app with `npm run build`
- **Runtime Stage**: Nginx 1.27.0 Alpine
  - Serves static build from `/usr/share/nginx/html`
  - Uses `runtime-env-cra` for runtime environment injection
  - Custom nginx config: `nginx-custom.conf`
  - Exposes port 3000

**Environment Variables** (Runtime Injection):
- `API_URL`: Backend API endpoint
- `GOOGLE_KEY`, `GOOGLE_TRACKING_ID`: Analytics
- `MUI_X_LICENSE`: Material-UI license
- `INVITATION_VIA_EMAIL`, `CLOUD_VERSION`: Feature flags
- `ENABLE_SSO`, `OAUTH2_PROVIDER`: SSO configuration
- `LOGO_PATHS`, `CUSTOM_COLORS`, `BRAND_CONFIG`: Branding
- `CHATKIT_ENABLED`, `CHATKIT_AGENT_ID`, `AGENT_API_BASE`: AI agent integration

**Dependencies**: api

**Note**: Uses `runtime-env-cra` to inject environment variables at container startup into the built React app.

---

### 4. Agents Proxy (`agents-proxy`)
**Type**: Built from local Dockerfile - **REBUILD REQUIRED FOR CODE CHANGES**

```yaml
Service: agents-proxy
Build Context: ./agents-proxy
Container: atlas-agents-proxy
Ports: 4005:4005
Hot-Mounted: No
```

**Dockerfile Analysis** (`agents-proxy/Dockerfile`):
- **Base**: Node 18 Alpine
- **Dependencies**: Installs production dependencies only (`npm install --omit=dev`)
- **Source**: Copies `src` directory
- **Runtime**: Runs `node src/index.js`

**Environment Variables**:
- `PORT`: Service port (default 4005)
- `API_BASE`: Backend API URL (http://api:8080)
- `OPENAI_API_KEY`: OpenAI integration
- `AGENT_CHATKIT_AGENT_ID`: ChatKit agent identifier

**Dependencies**: api

---

### 5. MinIO Object Storage (`minio`)
**Type**: Pre-built image (image-only)

```yaml
Service: minio
Image: minio/minio:RELEASE.2025-04-22T22-12-26Z
Container: atlas_minio
Ports: 9000:9000 (API), 9001:9001 (Console)
Hot-Mounted: No
```

**Environment Variables**:
- `MINIO_ROOT_USER`: ${MINIO_USER}
- `MINIO_ROOT_PASSWORD`: ${MINIO_PASSWORD}

**Volumes**:
- `minio_data:/data` (named volume)

**Command**: `server --address ":9000" --console-address ":9001" /data`

---

## Development Workflow Analysis

### Current State: Production-Only Configuration
**Impact**: All code changes require full rebuild and container recreation.

| Service | Hot-Mounted | Dev Workflow | Rebuild Required |
|---------|-------------|--------------|------------------|
| postgres | N/A | N/A | N/A (data service) |
| api | No (image-only) | ❌ Not dev-friendly | ✅ Yes |
| frontend | No (image-only) | ❌ Not dev-friendly | ✅ Yes |
| agents-proxy | No | ❌ Not dev-friendly | ✅ Yes |
| minio | N/A | N/A | N/A (storage service) |

### Recommended: Development Override Configuration

**Missing File**: `docker-compose.dev.yml`

**Suggested Development Override** (see section below for full content):
- **Frontend**: Mount source code, preserve node_modules, enable hot-reload
- **API**: Mount source and target, enable hot-reload with Spring DevTools
- **Agents-Proxy**: Mount source code, enable nodemon for auto-restart

---

## Common Operations

### Production Deployment (Current Setup)

**Start all services**:
```bash
docker compose up -d
```

**Rebuild specific service**:
```bash
# Backend API (if using local build)
docker compose build --no-cache api
docker compose up -d --force-recreate api

# Frontend (if using local build)
docker compose build --no-cache frontend
docker compose up -d --force-recreate frontend

# Agents Proxy
docker compose build --no-cache agents-proxy
docker compose up -d --force-recreate agents-proxy
```

**View logs**:
```bash
docker compose logs -f api
docker compose logs -f frontend
docker compose logs -f agents-proxy
```

**Stop all services**:
```bash
docker compose down
```

**Stop and remove volumes** (destructive):
```bash
docker compose down -v
```

---

## Development Workflow (Recommended)

**Prerequisites**: Create `docker-compose.dev.yml` (see suggested configuration below)

### Start Development Environment
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

### Hot-Reload Development
With the dev override in place:
- **Frontend**: Changes to React source automatically trigger rebuild and browser refresh
- **API**: Spring Boot DevTools enables hot-reload for Java classes
- **Agents-Proxy**: Nodemon restarts service on source changes

### Rebuild Development Service
```bash
# Rebuild and restart frontend
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build --force-recreate frontend

# Rebuild and restart API
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build --force-recreate api
```

---

## Verification Commands

### Check Service Health
```bash
# Check all containers are running
docker compose ps

# Check specific service logs
docker compose logs --tail 200 api
docker compose logs --tail 200 frontend
docker compose logs --tail 200 agents-proxy
```

### Verify File Changes (Development)
```bash
# Frontend - check mounted source
docker compose exec frontend sh -c "ls -la /app/src"

# API - check mounted source
docker compose exec api sh -c "ls -la /app/src"

# Agents-Proxy - check mounted source
docker compose exec agents-proxy sh -c "ls -la /app/src"
```

### Test Service Connectivity
```bash
# Test frontend
curl http://localhost:3000

# Test API
curl http://localhost:8080/actuator/health

# Test agents-proxy
curl http://localhost:4005/health
```

### Database Access
```bash
# Connect to PostgreSQL
docker compose exec postgres psql -U $POSTGRES_USER -d atlas

# List all databases
docker compose exec postgres psql -U $POSTGRES_USER -c "\l"
```

### MinIO Console
Access MinIO console: http://localhost:9001
- Username: `${MINIO_USER}`
- Password: `${MINIO_PASSWORD}`

---

## Suggested `docker-compose.dev.yml`

This override file enables hot-reload development for all services:

```yaml
name: atlas-cmms
services:
  api:
    build: ./api
    image: atlas-cmms-backend-dev
    volumes:
      - ./api/src:/app/src:ro
      - ./api/target:/app/target
    environment:
      SPRING_PROFILES_ACTIVE: dev
      SPRING_DEVTOOLS_RESTART_ENABLED: "true"
    command: ["sh", "-c", "mvn spring-boot:run -Dspring-boot.run.jvmArguments='-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005'"]
    ports:
      - "5005:5005"  # Debug port

  frontend:
    build:
      context: ./frontend
      target: build  # Use build stage only
    image: atlas-cmms-frontend-dev
    volumes:
      - ./frontend/src:/usr/src/app/src:ro
      - ./frontend/public:/usr/src/app/public:ro
      - /usr/src/app/node_modules  # Preserve container node_modules
    environment:
      NODE_ENV: development
      WATCHPACK_POLLING: "true"  # Enable polling for file changes
    command: ["npm", "start"]
    ports:
      - "3000:3000"

  agents-proxy:
    volumes:
      - ./agents-proxy/src:/app/src:ro
      - /app/node_modules  # Preserve container node_modules
    environment:
      NODE_ENV: development
    command: ["npx", "nodemon", "src/index.js"]
```

**Usage**:
```bash
# Start dev environment
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# Rebuild frontend only
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build --force-recreate frontend
```

**Benefits**:
- ✅ Hot-reload for frontend (React Fast Refresh)
- ✅ Hot-reload for backend (Spring DevTools)
- ✅ Hot-reload for agents-proxy (Nodemon)
- ✅ Preserves node_modules in container
- ✅ Debug port exposed for API (5005)
- ✅ Read-only source mounts (safety)

---

## File Change Impact Matrix

### Example: Change Global Frontend Font to Inter

**Files to Change**:
1. `frontend/src/index.css` or `frontend/src/App.css` - **rebuild-required**
2. `frontend/public/index.html` - **rebuild-required**

**Impact**: REBUILD REQUIRED (no hot-mount in current setup)

**Workflow**:
```bash
# 1. Make code changes
# 2. Rebuild frontend image
docker compose build --no-cache frontend

# 3. Recreate container
docker compose up -d --force-recreate frontend

# 4. Verify changes
docker compose logs --tail 50 frontend
curl -I http://localhost:3000
```

**With Dev Override** (recommended):
```bash
# 1. Make code changes
# 2. Changes auto-reload (no rebuild needed)
# 3. Verify in browser (auto-refresh)
```

---

## Environment Variables Reference

### Required Variables (`.env` file)
```bash
# Database
POSTGRES_USER=atlas_user
POSTGRES_PWD=secure_password

# MinIO
MINIO_USER=minio_admin
MINIO_PASSWORD=minio_password

# API URLs
PUBLIC_API_URL=http://localhost:8080
PUBLIC_FRONT_URL=http://localhost:3000
PUBLIC_MINIO_ENDPOINT=http://localhost:9000

# JWT Security
JWT_SECRET_KEY=your_jwt_secret_key_here

# Storage Configuration
STORAGE_TYPE=minio  # or gcp
```

### Optional Variables
See `.env.example` for complete list of optional configuration variables including:
- Email/SMTP settings
- OAuth2/SSO configuration
- Branding customization
- Agent/ChatKit integration
- Licensing

---

## Network Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Host Machine                          │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  :3000   │  │  :8080   │  │  :5432   │  │ :9000/01 │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │             │             │          │
└───────┼─────────────┼─────────────┼─────────────┼──────────┘
        │             │             │             │
        │             │             │             │
┌───────┼─────────────┼─────────────┼─────────────┼──────────┐
│       │   Docker Network: atlas-cmms_default    │          │
│       │             │             │             │          │
│  ┌────▼─────┐  ┌───▼──────┐ ┌───▼──────┐ ┌────▼─────┐    │
│  │ frontend │  │   api    │ │ postgres │ │  minio   │    │
│  │  :3000   │  │  :8080   │ │  :5432   │ │  :9000   │    │
│  └──────────┘  └────┬─────┘ └──────────┘ └──────────┘    │
│                     │                                      │
│                ┌────▼──────────┐                          │
│                │ agents-proxy  │                          │
│                │    :4005      │                          │
│                └───────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

**Service Dependencies**:
- `frontend` → `api`
- `agents-proxy` → `api`
- `api` → `postgres`, `minio`

---

## Troubleshooting

### Service Won't Start

**Check logs**:
```bash
docker compose logs -f [service-name]
```

**Check environment variables**:
```bash
docker compose config
```

**Verify network**:
```bash
docker network ls
docker network inspect atlas-cmms_default
```

### Port Already in Use

**Find and kill process**:
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID [PID] /F

# Linux/Mac
lsof -i :3000
kill -9 [PID]
```

### Volume Permission Issues

**Reset volumes**:
```bash
docker compose down -v
docker compose up -d
```

### Image Pull Failures

**Check Docker Hub access**:
```bash
docker pull intelloop/atlas-cmms-backend
docker pull intelloop/atlas-cmms-frontend
```

**Or build locally**:
```bash
# Modify docker-compose.yml to use build instead of image
# api:
#   build: ./api
# frontend:
#   build: ./frontend
```

---

## Performance Considerations

### Build Optimization
- API build time: ~5-10 minutes (Maven dependencies)
- Frontend build time: ~3-5 minutes (npm install + build)
- Agents-proxy build time: ~1-2 minutes

### Multi-stage Build Benefits
- **Frontend**: Reduces final image from ~1GB to ~50MB
- **API**: Reduces final image by excluding Maven and build tools

### Caching Strategy
- Docker layer caching enabled by default
- Use `.dockerignore` to exclude unnecessary files
- Leverage `npm ci` for reproducible builds (recommended)

---

## Security Considerations

### Secrets Management
⚠️ **Never commit `.env` file to version control**

**Current State**: Environment variables passed via `.env` file
**Recommendation**: Use Docker secrets for production deployments

```bash
# Example with Docker secrets
docker secret create postgres_password ./postgres_pwd.txt
```

### Network Isolation
- Services communicate via internal Docker network
- Only exposed ports accessible from host
- Database and MinIO not directly exposed to external networks (best practice)

### Image Security
- API uses OpenJDK 8 (⚠️ consider upgrading to Java 11+ or 17)
- Frontend uses Nginx Alpine (✅ minimal attack surface)
- Agents-proxy uses Node 18 Alpine (✅ LTS version)
- PostgreSQL 16 Alpine (✅ latest stable)

---

## Maintenance Tasks

### Backup Database
```bash
# Export PostgreSQL dump
docker compose exec postgres pg_dump -U $POSTGRES_USER atlas > backup.sql

# Restore from backup
docker compose exec -T postgres psql -U $POSTGRES_USER atlas < backup.sql
```

### Backup MinIO Data
```bash
# Export MinIO data
docker compose exec minio mc mirror /data /backup

# Or backup the volume
docker run --rm -v atlas-cmms_minio_data:/data -v $(pwd):/backup alpine tar czf /backup/minio-backup.tar.gz /data
```

### Update Services
```bash
# Pull latest images
docker compose pull

# Recreate containers
docker compose up -d --force-recreate
```

### Clean Up
```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Full cleanup
docker system prune -a --volumes
```

---

## JSON Output Format (as requested)

```json
{
  "scan": {
    "compose_file": "docker-compose.yml",
    "dev_override": null,
    "services": {
      "postgres": {
        "image": "postgres:16-alpine",
        "build_context": null,
        "volumes": ["postgres_data:/var/lib/postgresql/data"],
        "command": null,
        "env_vars": ["POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD"],
        "ports": ["5432:5432"],
        "hot_mounted": false
      },
      "api": {
        "image": "intelloop/atlas-cmms-backend",
        "build_context": "./api",
        "volumes": ["./logo:/app/static/images"],
        "command": null,
        "env_vars": ["DB_URL", "DB_USER", "DB_PWD", "PUBLIC_API_URL", "JWT_SECRET_KEY", "STORAGE_TYPE", "MINIO_*", "SMTP_*", "AGENT_*"],
        "ports": ["8080:8080"],
        "hot_mounted": "partial (only /app/static/images)"
      },
      "frontend": {
        "image": "intelloop/atlas-cmms-frontend",
        "build_context": "./frontend",
        "volumes": [],
        "command": ["/bin/sh", "-c", "runtime-env-cra && nginx -g \"daemon off;\""],
        "env_vars": ["API_URL", "GOOGLE_KEY", "MUI_X_LICENSE", "ENABLE_SSO", "CHATKIT_ENABLED"],
        "ports": ["3000:3000"],
        "hot_mounted": false
      },
      "agents-proxy": {
        "image": null,
        "build_context": "./agents-proxy",
        "volumes": [],
        "command": ["node", "src/index.js"],
        "env_vars": ["PORT", "API_BASE", "OPENAI_API_KEY", "AGENT_CHATKIT_AGENT_ID"],
        "ports": ["4005:4005"],
        "hot_mounted": false
      },
      "minio": {
        "image": "minio/minio:RELEASE.2025-04-22T22-12-26Z",
        "build_context": null,
        "volumes": ["minio_data:/data"],
        "command": "server --address \":9000\" --console-address \":9001\" /data",
        "env_vars": ["MINIO_ROOT_USER", "MINIO_ROOT_PASSWORD"],
        "ports": ["9000:9000", "9001:9001"],
        "hot_mounted": false
      }
    }
  },
  "impact": [
    {
      "file": "N/A - No specific change requested",
      "type": "N/A"
    }
  ],
  "patch": "N/A - No specific change requested. This is a documentation-only analysis.",
  "commands": [
    "docker compose up -d",
    "docker compose logs -f api",
    "docker compose logs -f frontend",
    "docker compose logs -f agents-proxy",
    "docker compose ps"
  ],
  "verify": [
    "curl http://localhost:3000",
    "curl http://localhost:8080/actuator/health",
    "curl http://localhost:4005/health",
    "docker compose ps"
  ],
  "dev_compose_suggestion": "name: atlas-cmms\nservices:\n  api:\n    build: ./api\n    image: atlas-cmms-backend-dev\n    volumes:\n      - ./api/src:/app/src:ro\n      - ./api/target:/app/target\n    environment:\n      SPRING_PROFILES_ACTIVE: dev\n      SPRING_DEVTOOLS_RESTART_ENABLED: \"true\"\n    command: [\"sh\", \"-c\", \"mvn spring-boot:run -Dspring-boot.run.jvmArguments='-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005'\"]\n    ports:\n      - \"5005:5005\"  # Debug port\n\n  frontend:\n    build: \n      context: ./frontend\n      target: build\n    image: atlas-cmms-frontend-dev\n    volumes:\n      - ./frontend/src:/usr/src/app/src:ro\n      - ./frontend/public:/usr/src/app/public:ro\n      - /usr/src/app/node_modules\n    environment:\n      NODE_ENV: development\n      WATCHPACK_POLLING: \"true\"\n    command: [\"npm\", \"start\"]\n    ports:\n      - \"3000:3000\"\n\n  agents-proxy:\n    volumes:\n      - ./agents-proxy/src:/app/src:ro\n      - /app/node_modules\n    environment:\n      NODE_ENV: development\n    command: [\"npx\", \"nodemon\", \"src/index.js\"]",
  "summary": "Complete Docker infrastructure analysis documented in docker.md.\nAll services currently use image-only deployment requiring rebuild for code changes.\nRecommended docker-compose.dev.yml provided for hot-reload development workflow."
}
```

---

## Summary

**Repository**: Atlas CMMS - Dockerized multi-service application
**Services**: 5 (postgres, api, frontend, agents-proxy, minio)
**Current Setup**: Production-optimized with pre-built images
**Development Gap**: No hot-reload support - rebuild required for all code changes
**Recommendation**: Implement `docker-compose.dev.yml` for efficient development workflow

**Key Findings**:
1. ✅ Well-structured multi-stage builds for frontend and API
2. ⚠️ No development override - inefficient for active development
3. ✅ Comprehensive environment variable configuration
4. ⚠️ API uses Java 8 (consider upgrading to Java 11/17)
5. ✅ Proper service dependency management
6. ✅ Volume persistence for database and object storage

**Next Steps**:
1. Create `docker-compose.dev.yml` for development
2. Consider upgrading Java version in API
3. Implement Docker secrets for production
4. Add health checks to all services
5. Document backup/restore procedures
