# Infrastructure & Deployment

## Overview

Atlas CMMS is deployed using Docker Compose with a microservices architecture consisting of:
- PostgreSQL database
- Spring Boot API backend
- React frontend
- MinIO object storage
- AI Agent Proxy (Node.js service for AI runtime communication)

## Docker Compose Architecture

### Services

#### 1. PostgreSQL Database (`postgres`)
- **Image**: `postgres:16-alpine`
- **Container Name**: `atlas_db`
- **Port**: `5432:5432`
- **Database**: `atlas`
- **Volume**: `postgres_data:/var/lib/postgresql/data`

**Environment Variables**:
```yaml
POSTGRES_DB: atlas
POSTGRES_USER: ${POSTGRES_USER}
POSTGRES_PASSWORD: ${POSTGRES_PWD}
```

#### 2. Backend API (`api`)
- **Image**: `intelloop/atlas-cmms-backend`
- **Container Name**: `atlas-cmms-backend`
- **Port**: `8080:8080`
- **Tech Stack**: Java 8, Spring Boot 2.6.7
- **Depends On**: postgres, minio

**Volume Mounts**:
- `./logo:/app/static/images` - Custom logo directory for white-labeling

**Key Environment Variables**:
```yaml
DB_URL: postgres/atlas
DB_USER: ${POSTGRES_USER}
DB_PWD: ${POSTGRES_PWD}
PUBLIC_API_URL: ${PUBLIC_API_URL:-http://localhost:8080}
PUBLIC_FRONT_URL: ${PUBLIC_FRONT_URL}
STORAGE_TYPE: ${STORAGE_TYPE:-minio}  # minio or gcp
LICENSE_KEY: ${LICENSE_KEY}
```

#### 3. Frontend (`frontend`)
- **Image**: `intelloop/atlas-cmms-frontend`
- **Container Name**: `atlas-cmms-frontend`
- **Port**: `3000:3000`
- **Tech Stack**: React 17, TypeScript, Material-UI
- **Depends On**: api

**Environment Variables**:
```yaml
API_URL: ${PUBLIC_API_URL}
GOOGLE_KEY: ${GOOGLE_KEY}
MUI_X_LICENSE: ${MUI_X_LICENSE}
NODE_ENV: production
ENABLE_SSO: ${ENABLE_SSO:-false}
```

#### 4. MinIO Object Storage (`minio`)
- **Image**: `minio/minio:RELEASE.2025-04-22T22-12-26Z`
- **Container Name**: `atlas_minio`
- **Ports**:
  - `9000:9000` (API)
  - `9001:9001` (Console)
- **Volume**: `minio_data:/data`
- **Command**: `server --address ":9000" --console-address ":9001" /data`

**Environment Variables**:
```yaml
MINIO_ROOT_USER: ${MINIO_USER}
MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD}
```

#### 5. AI Agent Proxy (`agents-proxy`)
- **Image**: Custom build from `./agents-proxy`
- **Container Name**: `atlas-cmms-agents-proxy`
- **Port**: `4005:4005`
- **Tech Stack**: Node.js 18, Express
- **Depends On**: api

**Purpose**: Acts as intermediary between the CMMS application and AI runtime services, providing:
- ChatKit agent integration
- OpenAI API communication
- Request routing and response formatting
- AI runtime authentication

**Environment Variables**:
```yaml
OPENAI_API_KEY: ${OPENAI_API_KEY}
AGENT_CHATKIT_AGENT_ID: ${CHATKIT_AGENT_ID}
API_URL: http://api:8080
PORT: 4005
```

**Features**:
- Natural language query processing
- Tool invocation coordination
- Draft action proposal generation
- Session-based conversation tracking

### Persistent Volumes

```yaml
volumes:
  postgres_data:  # PostgreSQL data persistence
  minio_data:     # MinIO object storage persistence
```

## Environment Configuration

### Required Environment Variables

Create a `.env` file from `.env.example` with the following configuration:

#### Database Configuration
```env
POSTGRES_USER=rootUser           # PostgreSQL username
POSTGRES_PWD=mypassword          # PostgreSQL password (change in production!)
```

#### MinIO Storage Configuration
```env
MINIO_USER=minio                 # MinIO access key
MINIO_PASSWORD=minio123          # MinIO secret key (change in production!)
STORAGE_TYPE=MINIO               # Storage type: MINIO or GCP
PUBLIC_MINIO_ENDPOINT=http://localhost:9000
```

#### Security & Authentication
```env
JWT_SECRET_KEY=your_jwt_secret   # JWT signing key (MUST change in production!)
ENABLE_SSO=false                 # Enable OAuth2 SSO
OAUTH2_PROVIDER=                 # google or microsoft
OAUTH2_CLIENT_ID=
OAUTH2_CLIENT_SECRET=
```

#### Email Notifications (Optional)
```env
ENABLE_EMAIL_NOTIFICATIONS=false
INVITATION_VIA_EMAIL=false
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PWD=
```

#### Public URLs
```env
PUBLIC_FRONT_URL=http://localhost:3000
PUBLIC_API_URL=http://localhost:8080
```

#### Google Services (Optional)
```env
GOOGLE_KEY=                      # Google Maps API key
GOOGLE_TRACKING_ID=              # Google Analytics tracking ID
```

#### Commercial Features (License Required)
```env
LICENSE_KEY=                     # Atlas CMMS commercial license
MUI_X_LICENSE=                   # MUI X Pro license (1 dev perpetual)
LOGO_PATHS=                      # Custom logo paths JSON
CUSTOM_COLORS=                   # Custom color scheme JSON
BRAND_CONFIG=                    # White-labeling config JSON
```

#### Access Control
```env
ALLOWED_ORGANIZATION_ADMINS=     # Comma-separated emails allowed to create orgs
```

#### AI Agent Integration (Optional)
```env
AGENT_CHATKIT_ENABLED=false      # Enable/disable AI assistant feature
AGENT_RUNTIME_URL=http://agents-proxy:4005  # AI runtime service endpoint
AGENT_RUNTIME_TOKEN=              # Authentication token for AI runtime
CHATKIT_AGENT_ID=                 # ChatKit agent identifier
OPENAI_API_KEY=                   # OpenAI API key for agent proxy
```

**Note**: The AI agent feature requires the `agents-proxy` service to be running and properly configured with OpenAI API access.

### GCP Storage Configuration (Alternative to MinIO)

If using Google Cloud Storage instead of MinIO:

```env
STORAGE_TYPE=GCP
GCP_PROJECT_ID=your-project-id
GCP_BUCKET_NAME=your-bucket-name
GCP_JSON={"type":"service_account",...}  # Service account JSON key
```

See [GCP-setup.md](../GCP-setup.md) for detailed instructions.

## Deployment Instructions

### Local Development

1. **Create Environment File**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

2. **Start Services**:
   ```bash
   docker-compose up -d
   ```

3. **Access Applications**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8080
   - MinIO Console: http://localhost:9001

4. **Default Super Admin Credentials**:
   - Email: `superadmin@test.com`
   - Password: `pls_change_me`

### Remote/Production Deployment

#### Port Configuration
Ensure the following ports are open in your firewall:
- `3000` - Frontend
- `8080` - Backend API
- `4005` - AI Agent Proxy (if using AI agent feature)
- `9000` - MinIO API (if using MinIO)
- `9001` - MinIO Console (optional)

#### Environment Variables for Remote Deployment
Update all `PUBLIC_*` variables with your server's public address:

```env
PUBLIC_FRONT_URL=http://your.public.ip:3000
PUBLIC_API_URL=http://your.public.ip:8080
PUBLIC_MINIO_ENDPOINT=http://your.public.ip:9000
```

#### HTTPS Configuration
- Backend and frontend must use the same protocol (http or https)
- Configure reverse proxy (nginx/Apache) for SSL termination
- Update CORS configuration in `WebSecurityConfig.java`

#### Security Hardening for Production

**CRITICAL**: Change these default values:
```env
POSTGRES_PWD=<strong-password>
MINIO_PASSWORD=<strong-password>
JWT_SECRET_KEY=<random-64-char-string>
```

**Recommended**:
- Use environment-specific Docker Compose overrides
- Implement SSL/TLS certificates
- Configure firewall rules
- Enable database backups
- Monitor logs and metrics
- Restrict `ALLOWED_ORGANIZATION_ADMINS` to trusted emails

## Scaling Considerations

### Horizontal Scaling
- Frontend: Can scale horizontally behind load balancer
- Backend: Stateless API, can scale with load balancer
- Database: Consider PostgreSQL replication for read scaling
- MinIO: Supports distributed mode for high availability

### Resource Requirements

**Minimum (Development)**:
- CPU: 2 cores
- RAM: 4GB
- Storage: 20GB

**Recommended (Production)**:
- CPU: 4+ cores
- RAM: 8GB+
- Storage: 100GB+ (depends on file uploads)

### Monitoring & Observability

The backend includes Spring Boot Actuator:
- Health Check: `http://localhost:8080/actuator/health`
- Metrics: `http://localhost:8080/actuator/metrics`

## Troubleshooting

### Container Issues
```bash
# View logs
docker-compose logs -f [service-name]

# Restart service
docker-compose restart [service-name]

# Rebuild and restart
docker-compose up -d --build [service-name]
```

### Database Connection Issues
- Verify PostgreSQL is running: `docker-compose ps`
- Check database logs: `docker-compose logs postgres`
- Ensure `DB_URL` matches PostgreSQL service name: `postgres/atlas`

### Storage Issues
- MinIO Console: http://localhost:9001
- Verify MinIO bucket creation
- Check MinIO logs: `docker-compose logs minio`

### CORS Issues
- Ensure `PUBLIC_FRONT_URL` exactly matches frontend URL
- Check browser console for CORS errors
- Verify backend CORS configuration
