# Backend API Architecture

## Technology Stack

### Core Framework
- **Language**: Java 8
- **Framework**: Spring Boot 2.6.7
- **Build Tool**: Maven
- **Package**: `com.grash`

### Key Dependencies

#### Spring Framework
- `spring-boot-starter-web` - REST API framework
- `spring-boot-starter-data-jpa` - Data persistence layer
- `spring-boot-starter-validation` - Request validation
- `spring-boot-starter-mail` - Email notifications
- `spring-boot-starter-websocket` - Real-time communication
- `spring-boot-starter-actuator` - Health checks and metrics
- `spring-boot-starter-cache` - Caching (Caffeine)
- `spring-boot-starter-quartz` - Job scheduling
- `spring-boot-starter-oauth2-client` - OAuth2/SSO

#### Security
- `spring-security-web` 5.6.1 - Web security
- `spring-security-config` 5.6.1 - Security configuration
- `spring-security-oauth2-jose` - JWT/OAuth2 support
- `io.jsonwebtoken:jjwt` 0.9.1 - JWT token handling

#### Database
- `org.postgresql:postgresql` - PostgreSQL driver
- `org.liquibase:liquibase-core` 4.22.0 - Database migrations
- `org.hibernate:hibernate-envers` - Entity auditing

#### Object Mapping & Validation
- `org.mapstruct:mapstruct` 1.4.2.Final - DTO/Entity mapping
- `org.projectlombok:lombok` 1.18.24 - Boilerplate reduction

#### Storage
- `io.minio:minio` 8.5.17 - MinIO client
- `com.google.cloud:google-cloud-storage` 2.0.1 - GCP storage

#### PDF Generation
- `com.itextpdf:html2pdf` 3.0.1 - PDF export functionality

#### API Documentation
- `io.springfox:springfox-swagger2` 2.9.2 - API documentation
- `io.springfox:springfox-swagger-ui` 2.9.2 - Swagger UI

#### Other
- `org.apache.commons:commons-csv` 1.8 - CSV import/export
- `io.github.jav:expo-server-sdk` 1.1.0 - Mobile push notifications
- `com.bucket4j:bucket4j_jdk8-core` 8.2.0 - Rate limiting

## Application Structure

### Entry Point

**File**: `api/src/main/java/com/grash/ApiApplication.java`

**Main Class**: `com.grash.ApiApplication`

**Initialization Sequence**:
1. Create super admin role and company if not exists
2. Create default super admin user (`superadmin@test.com`)
3. Initialize subscription plans (FREE, STARTER, PROFESSIONAL, BUSINESS)
4. Schedule existing work orders and subscriptions
5. Update default role permissions to latest version

### Configuration Files

#### Application Configuration
**File**: `api/src/main/resources/application.yml`

**Key Configurations**:
```yaml
server:
  port: 8080

spring:
  datasource:
    url: jdbc:postgresql://${DB_URL}
    driver-class-name: org.postgresql.Driver

  liquibase:
    change-log: classpath:/db/master.xml
    enabled: true

  jpa:
    hibernate:
      ddl-auto: validate  # Schema managed by Liquibase
    properties:
      hibernate:
        dialect: org.hibernate.dialect.PostgreSQLDialect

  cache:
    type: caffeine
    caffeine:
      spec: maximumSize=1000,expireAfterWrite=20m

security:
  jwt:
    token:
      secret-key: ${JWT_SECRET_KEY}
      expire-length: 1209600000  # 14 days

storage:
  type: ${STORAGE_TYPE}  # MINIO or GCP
```

### Package Structure

```
com.grash/
├── configuration/          # Spring configuration classes
│   ├── WebSecurityConfig.java      # Security & CORS
│   ├── WebSocketConfig.java        # WebSocket setup
│   ├── OAuth2ClientRegistrationConfig.java
│   ├── EmailConfiguration.java
│   ├── QuartzConfig.java           # Job scheduling
│   ├── SwaggerConfig.java          # API documentation
│   └── AgentProperties.java        # AI agent configuration
│
├── controller/            # REST API endpoints
│   ├── AuthController.java        # Authentication
│   ├── WorkOrderController.java   # Work orders
│   ├── AssetController.java       # Asset management
│   ├── LocationController.java    # Location management
│   ├── PartController.java        # Inventory/parts
│   ├── UserController.java        # User management
│   ├── FileController.java        # File uploads
│   ├── AgentController.java       # AI agent integration
│   └── analytics/                 # Analytics endpoints
│       ├── WOAnalyticsController.java
│       ├── AssetAnalyticsController.java
│       └── ...
│
├── service/               # Business logic layer
│   ├── UserService.java
│   ├── WorkOrderService.java
│   ├── AssetService.java
│   ├── AgentService.java          # AI agent orchestration
│   ├── AgentDraftService.java     # Draft action management
│   ├── AgentRuntimeClient.java    # AI runtime HTTP client
│   ├── AgentToolRegistry.java     # Tool registration
│   └── ...
│
├── repository/            # Data access layer (JPA)
│   ├── UserRepository.java
│   ├── WorkOrderRepository.java
│   ├── AgentDraftActionRepository.java  # Draft actions
│   ├── AgentToolInvocationLogRepository.java  # Tool logs
│   └── ...
│
├── model/                 # JPA entities
│   ├── User.java
│   ├── WorkOrder.java
│   ├── Asset.java
│   ├── Location.java
│   ├── AgentDraftAction.java      # Pending agent actions
│   ├── AgentToolInvocationLog.java # Tool invocation audit
│   ├── exception/                  # Custom exceptions
│   │   └── AgentRuntimeException.java
│   └── enums/            # Enumerations
│       ├── RoleCode.java
│       ├── PlanFeatures.java
│       └── ...
│
├── dto/                   # Data Transfer Objects
│   ├── UserPatchDTO.java
│   ├── WorkOrderShowDTO.java
│   └── agent/                     # Agent DTOs
│       ├── AgentPromptRequest.java
│       ├── AgentChatResponse.java
│       ├── AgentDraftActionResponse.java
│       └── ...
│
├── mapper/                # MapStruct mappers (Entity ↔ DTO)
│   ├── UserMapper.java
│   └── ...
│
├── security/              # Security components
│   ├── OAuth2AuthenticationSuccessHandler.java
│   ├── OAuth2AuthenticationFailureHandler.java
│   └── OAuth2Properties.java
│
├── advancedsearch/        # Advanced filtering & pagination
│   ├── SearchCriteria.java
│   ├── SpecificationBuilder.java
│   └── pagination/
│
├── aspect/                # AOP aspects
│   └── TenantAspect.java # Multi-tenancy
│
└── utils/                 # Helper utilities
    └── Helper.java
```

## Core API Endpoints

### Authentication & Users
```
POST   /api/auth/signup               # User registration
POST   /api/auth/signin               # User login
GET    /api/users                     # List users
GET    /api/users/{id}                # Get user details
PATCH  /api/users/{id}                # Update user
DELETE /api/users/{id}                # Delete user
```

### Work Orders
```
GET    /api/work-orders               # List work orders
POST   /api/work-orders               # Create work order
GET    /api/work-orders/{id}          # Get work order
PATCH  /api/work-orders/{id}          # Update work order
DELETE /api/work-orders/{id}          # Delete work order
GET    /api/work-orders/{id}/history  # Work order history
```

### Assets
```
GET    /api/assets                    # List assets
POST   /api/assets                    # Create asset
GET    /api/assets/{id}               # Get asset
PATCH  /api/assets/{id}               # Update asset
DELETE /api/assets/{id}               # Delete asset
GET    /api/assets/{id}/downtime      # Asset downtime
```

### Locations
```
GET    /api/locations                 # List locations
POST   /api/locations                 # Create location
GET    /api/locations/{id}            # Get location
PATCH  /api/locations/{id}            # Update location
DELETE /api/locations/{id}            # Delete location
```

### Parts & Inventory
```
GET    /api/parts                     # List parts
POST   /api/parts                     # Create part
GET    /api/parts/{id}                # Get part
PATCH  /api/parts/{id}                # Update part
DELETE /api/parts/{id}                # Delete part
```

### Files & Uploads
```
POST   /api/files                     # Upload file
GET    /api/files/{id}                # Download file
DELETE /api/files/{id}                # Delete file
```

### Analytics
```
GET    /api/analytics/work-orders     # Work order analytics
GET    /api/analytics/assets          # Asset analytics
GET    /api/analytics/parts           # Parts analytics
GET    /api/analytics/requests        # Request analytics
GET    /api/analytics/users           # User analytics
```

### Import/Export
```
POST   /api/import/work-orders        # Import work orders CSV
POST   /api/import/assets             # Import assets CSV
POST   /api/import/locations          # Import locations CSV
GET    /api/export/work-orders        # Export work orders
GET    /api/export/assets             # Export assets
```

### AI Agent Integration
```
POST   /api/agent/chat                 # Send prompt to AI agent
GET    /api/agent/drafts               # Get pending draft actions
POST   /api/agent/drafts/{id}/confirm  # Confirm draft action
DELETE /api/agent/drafts/{id}          # Decline draft action
```

**Features**:
- Natural language queries for CMMS operations
- Draft action proposals requiring user confirmation
- Tool invocation logging and auditing
- Session-based conversation tracking

## Database Architecture

### Migration Management

**Tool**: Liquibase 4.22.0
**Master Changelog**: `api/src/main/resources/db/master.xml`
**Migration Files**: `api/src/main/resources/db/changelog/`

**Liquibase Configuration**:
```yaml
spring:
  liquibase:
    change-log: classpath:/db/master.xml
    enabled: true
  jpa:
    hibernate:
      ddl-auto: validate  # Schema managed by Liquibase only
```

### Core Entities & Relationships

#### Multi-Tenancy
All entities are scoped to a **Company** (organization):
- Each company has isolated data
- Super admin company manages all organizations
- Users belong to one company
- Tenant isolation enforced via `TenantAspect.java`

#### Entity Hierarchy
```
Company
  ├── CompanySettings (1:1)
  ├── Users (1:N)
  │   └── Roles (N:M)
  ├── Locations (1:N)
  │   └── Assets (1:N)
  ├── WorkOrders (1:N)
  │   ├── Asset (N:1)
  │   ├── Location (N:1)
  │   ├── PrimaryUser (N:1)
  │   ├── AssignedTo (N:M Users/Teams)
  │   ├── Tasks (1:N)
  │   ├── Files (N:M)
  │   └── Parts (N:M)
  ├── Parts (1:N)
  ├── Customers (1:N)
  ├── Vendors (1:N)
  ├── Teams (1:N)
  └── Subscriptions (1:N)
```

### Audit Trail

**Framework**: Hibernate Envers

All entities can be audited:
- Tracks who made changes
- Records what changed
- Timestamps for all modifications
- Accessible via `WorkOrderHistoryController`, etc.

## Security Architecture

### Authentication Methods

#### 1. JWT Authentication (Default)
- **Token Type**: Bearer JWT
- **Expiration**: 14 days (1209600000 ms)
- **Secret**: Configured via `JWT_SECRET_KEY`
- **Algorithm**: HMAC (via jjwt library)

**Flow**:
1. User submits credentials to `/api/auth/signin`
2. Backend validates against database
3. JWT token generated and returned
4. Client includes token in `Authorization: Bearer <token>` header
5. Backend validates token on each request

#### 2. OAuth2/SSO (License Required)
- **Providers**: Google, Microsoft
- **Grant Type**: Authorization Code
- **Configuration**: `OAuth2ClientRegistrationConfig.java`

**Environment Variables**:
```env
ENABLE_SSO=true
OAUTH2_PROVIDER=google|microsoft
OAUTH2_CLIENT_ID=<client-id>
OAUTH2_CLIENT_SECRET=<client-secret>
```

**OAuth2 Endpoints**:
- Authorization: `/oauth2/authorization/{provider}`
- Callback: `/oauth2/callback/{provider}`
- Success Redirect: `${PUBLIC_FRONT_URL}/oauth2/success`
- Failure Redirect: `${PUBLIC_FRONT_URL}/oauth2/failure`

### Authorization & Permissions

#### Role-Based Access Control (RBAC)

**Role Types**:
- `ROLE_SUPER_ADMIN` - Super administrator (cross-company)
- `ROLE_ADMIN` - Organization administrator
- `ROLE_USER_CREATED` - Custom company-specific roles

**Default Roles** (per company):
- Administrator (full permissions)
- Technician (limited permissions)
- Requester (request-only permissions)
- Viewer (read-only permissions)

**Permissions** (per entity type):
- `CREATE` - Create new records
- `VIEW` - View own records
- `VIEW_OTHER` - View records of others
- `EDIT_OTHER` - Edit records of others
- `DELETE_OTHER` - Delete records of others

**Entity Types**:
Work Orders, Assets, Locations, Parts, Purchase Orders, Requests, Preventive Maintenance, Meters, Files, People & Teams, Categories, Vendors, Customers, etc.

#### Permission Checking
```java
// Service layer checks user permissions before operations
@PreAuthorize("hasPermission(#id, 'WorkOrder', 'EDIT_OTHER')")
public WorkOrder update(Long id, WorkOrderPatchDTO dto) { ... }
```

### CORS Configuration

**File**: `WebSecurityConfig.java`

**Allowed Origins**: `${PUBLIC_FRONT_URL}`
**Allowed Methods**: GET, POST, PUT, PATCH, DELETE, OPTIONS
**Allowed Headers**: Authorization, Content-Type, etc.
**Credentials**: Supported

**Important**: `PUBLIC_FRONT_URL` must match exactly (including protocol and port) for CORS to work.

## Storage Architecture

### Dual Storage Support

The backend supports two storage backends:

#### 1. MinIO (Default)
**Type**: Self-hosted object storage (S3-compatible)

**Configuration**:
```env
STORAGE_TYPE=MINIO
MINIO_ENDPOINT=http://minio:9000           # Internal Docker network
MINIO_BUCKET=atlas-bucket
MINIO_ACCESS_KEY=minio
MINIO_SECRET_KEY=minio123
PUBLIC_MINIO_ENDPOINT=http://localhost:9000  # Public access URL
```

**Client**: `io.minio:minio` 8.5.17

**Operations**:
- Upload files via `FileController.java`
- Files stored in configured bucket
- Public URLs use `PUBLIC_MINIO_ENDPOINT`

#### 2. Google Cloud Storage (GCP)
**Type**: Cloud object storage

**Configuration**:
```env
STORAGE_TYPE=GCP
GCP_PROJECT_ID=your-project-id
GCP_BUCKET_NAME=your-bucket
GCP_JSON={"type":"service_account",...}  # Service account JSON
```

**Client**: `com.google.cloud:google-cloud-storage` 2.0.1

See [GCP-setup.md](../GCP-setup.md) for detailed setup.

### File Upload Limits

**Max File Size**: 7MB
**Max Request Size**: 7MB

Configured in `application.yml`:
```yaml
spring:
  servlet:
    multipart:
      max-file-size: 7MB
      max-request-size: 7MB
```

## Real-Time Features

### WebSocket Support

**Configuration**: `WebSocketConfig.java`
**Protocol**: STOMP over WebSocket
**Client Library**: `@stomp/stompjs`

**Endpoints**:
- **Connect**: `/ws`
- **Subscribe**: `/topic/notifications`, `/topic/updates`
- **Send**: `/app/message`

**Use Cases**:
- Real-time work order updates
- Live notifications
- Multi-user collaboration

## Scheduled Jobs

### Quartz Scheduler

**Configuration**: `QuartzConfig.java`

**Scheduled Tasks**:
1. **Preventive Maintenance**: Auto-create work orders based on schedules
2. **Subscription Management**: Monitor and end expired subscriptions
3. **Meter Triggers**: Create work orders when meter thresholds reached
4. **Notifications**: Send scheduled email notifications

**Job Scheduling**:
```java
// Schedules are loaded and scheduled on startup
Collection<Schedule> schedules = scheduleService.getAll();
schedules.forEach(scheduleService::scheduleWorkOrder);
```

## Caching Strategy

**Provider**: Caffeine (in-memory cache)

**Configuration**:
```yaml
spring:
  cache:
    type: caffeine
    caffeine:
      spec: maximumSize=1000,expireAfterWrite=20m
```

**Cached Operations**:
- User lookup by email
- Role permissions
- Frequently accessed entities

**Cache Annotations**:
```java
@Cacheable("users")
public User findByEmail(String email) { ... }

@CacheEvict(value = "users", key = "#user.email")
public User update(User user) { ... }
```

## Monitoring & Observability

### Spring Boot Actuator

**Enabled Endpoints**:
- `/actuator/health` - Health check
- `/actuator/metrics` - Application metrics
- `/actuator/info` - Application info

**Configuration**:
```yaml
management:
  health:
    mail:
      enabled: true  # Include mail server health
```

### Logging

**Internationalized Messages**:
- `messages.properties` - English (default)
- `messages_ar_AR.properties` - Arabic
- `messages_de_DE.properties` - German
- `messages_es_ES.properties` - Spanish
- `messages_fr_FR.properties` - French
- `messages_it_IT.properties` - Italian
- `messages_pl_PL.properties` - Polish
- `messages_pt_BR.properties` - Portuguese (Brazil)
- `messages_sv_SE.properties` - Swedish
- `messages_tr_TR.properties` - Turkish

**Email Templates** (Thymeleaf):
Located in `api/src/main/resources/templates/`

## API Documentation

### Swagger/OpenAPI

**URL**: `http://localhost:8080/swagger-ui.html`

**Configuration**: `SwaggerConfig.java`

**Features**:
- Interactive API documentation
- Try-it-out functionality
- Request/response examples
- Authentication integration

## Import/Export

### CSV Import

**Templates**: `api/src/main/resources/import-templates/`

**Supported Entities**:
- Work Orders
- Assets
- Locations
- Parts
- Users
- Customers
- Vendors

**Controller**: `ImportController.java`

### Export Formats

**Formats**: CSV, PDF
**Controller**: `ExportController.java`

**Features**:
- Filtered exports
- Custom column selection
- Scheduled exports

## Demo Data

**Location**: `api/src/main/resources/demo-data/`

Sample data for testing and demonstration purposes.

## Rate Limiting

**Library**: Bucket4j

Prevents API abuse through token bucket algorithm.

## Build & Deployment

### Maven Build
```bash
cd api
mvn clean package
```

**Output**: `target/app.jar`

### Docker Build
**Dockerfile**: `api/Dockerfile`

```dockerfile
FROM openjdk:8-jre-alpine
COPY target/app.jar /app/app.jar
CMD ["java", "-jar", "/app/app.jar"]
```

### JVM Options
**Java Version**: 1.8 (Java 8)
**Recommended**: `-Xmx2g -Xms512m` for production
