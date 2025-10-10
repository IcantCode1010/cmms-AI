# Authentication & Security

## Authentication Methods

Atlas CMMS supports two authentication mechanisms:

1. **JWT-Based Authentication** (default)
2. **OAuth2/SSO** (commercial license required)

## JWT Authentication

### Overview

**Standard**: JSON Web Tokens (JWT) with HMAC signing
**Library**: `io.jsonwebtoken:jjwt` 0.9.1
**Token Expiration**: 14 days (configurable)
**Storage**: Client-side (localStorage for web, AsyncStorage for mobile)

### JWT Configuration

**Application Configuration** (`application.yml`):
```yaml
security:
  jwt:
    token:
      secret-key: ${JWT_SECRET_KEY}
      expire-length: 1209600000  # 14 days in milliseconds (1000*60*60*24*14)
```

**Environment Variables** (`.env`):
```env
JWT_SECRET_KEY=your_jwt_secret  # MUST change in production!
```

**Security**: Use a strong, random secret key (minimum 64 characters recommended):
```bash
# Generate secure secret
openssl rand -base64 64
```

### Authentication Flow

#### User Registration

**Endpoint**: `POST /api/auth/signup`

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890",
  "companyName": "Acme Corp",
  "employeesCount": 50,
  "language": "EN"
}
```

**Process**:
1. Validate input (email format, password strength)
2. Check if email already exists
3. Check `ALLOWED_ORGANIZATION_ADMINS` (if set)
4. Hash password using BCrypt
5. Create company and default roles
6. Create user with role assignment
7. Create user invitation record
8. Send invitation email (if `INVITATION_VIA_EMAIL=true`)
9. Generate JWT token
10. Return token and user data

**Response**:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "user": {
    "id": 123,
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": {
      "id": 1,
      "name": "Administrator",
      "code": "ADMIN"
    }
  }
}
```

#### User Login

**Endpoint**: `POST /api/auth/signin`

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

**Process**:
1. Validate credentials against database
2. Verify password using BCrypt
3. Check if user account is enabled
4. Generate JWT token with user claims
5. Return token and user data

**Response**: Same as signup

#### JWT Token Structure

**Header**:
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

**Payload (Claims)**:
```json
{
  "sub": "user@example.com",  // Subject (user email)
  "userId": 123,               // User ID
  "companyId": 456,            // Company ID (for multi-tenancy)
  "iat": 1704067200,           // Issued at (timestamp)
  "exp": 1705276800            // Expiration (timestamp)
}
```

**Signature**: HMAC SHA-256 using `JWT_SECRET_KEY`

### Token Usage

#### Web Frontend

**Store Token**:
```typescript
localStorage.setItem('token', accessToken);
```

**Include in Requests** (Axios interceptor):
```typescript
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

**Handle Expiration**:
```typescript
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

#### Mobile App

**Store Token**:
```typescript
await AsyncStorage.setItem('token', accessToken);
```

**Include in Requests**:
```typescript
const token = await AsyncStorage.getItem('token');
api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
```

### Token Validation (Backend)

**Security Filter**: Spring Security filter chain validates JWT on every request

**Validation Process**:
1. Extract token from `Authorization: Bearer <token>` header
2. Verify signature using `JWT_SECRET_KEY`
3. Check token expiration
4. Extract user claims (email, userId, companyId)
5. Load user from database
6. Set authentication context (SecurityContext)
7. Enforce tenant isolation (companyId)

**Filter Implementation** (`WebSecurityConfig.java`):
```java
@Override
protected void configure(HttpSecurity http) throws Exception {
    http
        .csrf().disable()
        .sessionManagement().sessionCreationPolicy(SessionCreationPolicy.STATELESS)
        .and()
        .authorizeRequests()
            .antMatchers("/api/auth/**").permitAll()
            .anyRequest().authenticated()
        .and()
        .addFilterBefore(jwtAuthenticationFilter(), UsernamePasswordAuthenticationFilter.class);
}
```

### Password Security

#### Hashing

**Algorithm**: BCrypt (adaptive hashing)
**Cost Factor**: 10 (default, 2^10 iterations)

**Hashing on Registration**:
```java
String hashedPassword = passwordEncoder.encode(plainPassword);
user.setPassword(hashedPassword);
```

**Verification on Login**:
```java
boolean matches = passwordEncoder.matches(plainPassword, user.getPassword());
```

#### Password Requirements

**Recommended Policy** (implement in frontend validation):
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

## OAuth2/SSO Authentication

**License Requirement**: Commercial license with valid `LICENSE_KEY`

### Supported Providers

1. **Google** - Google Workspace accounts
2. **Microsoft** - Azure AD / Microsoft 365 accounts

### OAuth2 Configuration

**Environment Variables** (`.env`):
```env
LICENSE_KEY=<your-commercial-license-key>
ENABLE_SSO=true
OAUTH2_PROVIDER=google  # or microsoft
OAUTH2_CLIENT_ID=<oauth2-client-id>
OAUTH2_CLIENT_SECRET=<oauth2-client-secret>
```

**Application Configuration** (`application.yml`):
```yaml
enable-sso: ${ENABLE_SSO:false}
oauth2:
  success-redirect-url: ${PUBLIC_FRONT_URL}/oauth2/success
  failure-redirect-url: ${PUBLIC_FRONT_URL}/oauth2/failure
  provider: ${OAUTH2_PROVIDER}
```

### Google OAuth2 Setup

**1. Create OAuth2 Credentials**:
- Go to [Google Cloud Console](https://console.cloud.google.com)
- Navigate to APIs & Services → Credentials
- Create OAuth 2.0 Client ID
- Application type: Web application
- Authorized JavaScript origins: `${PUBLIC_FRONT_URL}`
- Authorized redirect URIs: `${PUBLIC_API_URL}/oauth2/callback/google`

**2. Configure Application**:
```env
OAUTH2_PROVIDER=google
OAUTH2_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
OAUTH2_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxx
```

### Microsoft OAuth2 Setup

**1. Register Application in Azure AD**:
- Go to [Azure Portal](https://portal.azure.com)
- Navigate to Azure Active Directory → App registrations
- New registration
- Name: Atlas CMMS
- Supported account types: Accounts in this organizational directory only
- Redirect URI: `${PUBLIC_API_URL}/oauth2/callback/microsoft`

**2. Configure Application**:
```env
OAUTH2_PROVIDER=microsoft
OAUTH2_CLIENT_ID=12345678-1234-1234-1234-123456789012
OAUTH2_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**3. API Permissions**:
- Microsoft Graph → User.Read (delegated)

### OAuth2 Flow

#### Authorization Request

**Web Frontend**:
```typescript
// Redirect user to backend OAuth2 endpoint
window.location.href = `${API_URL}/oauth2/authorization/${provider}`;
```

**Backend** (`/oauth2/authorization/{provider}`):
1. Generate state token (CSRF protection)
2. Store state in session
3. Redirect to OAuth2 provider authorization URL

**Provider Authorization URL** (Google example):
```
https://accounts.google.com/o/oauth2/v2/auth?
  response_type=code&
  client_id=${CLIENT_ID}&
  scope=openid%20email%20profile&
  redirect_uri=${REDIRECT_URI}&
  state=${STATE_TOKEN}
```

#### Callback Handling

**Provider Redirects** to `${PUBLIC_API_URL}/oauth2/callback/${provider}?code=xxx&state=xxx`

**Backend Process**:
1. Validate state token (CSRF check)
2. Exchange authorization code for access token
3. Fetch user profile from OAuth2 provider
4. Create or update user in database
5. Assign default role
6. Generate JWT token
7. Redirect to frontend success URL with JWT

**Success Redirect**:
```
${PUBLIC_FRONT_URL}/oauth2/success?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Frontend** (`/oauth2/success`):
```typescript
const params = new URLSearchParams(window.location.search);
const token = params.get('token');

if (token) {
  localStorage.setItem('token', token);
  // Redirect to dashboard
  navigate('/dashboard');
} else {
  // Redirect to login on error
  navigate('/login');
}
```

### OAuth2 User Mapping

**User Creation**:
- Email: From OAuth2 provider
- First Name: From profile
- Last Name: From profile
- Password: Not set (OAuth2-only user)
- Company: Auto-assigned or created based on email domain

**Account Linking**:
- Existing users can link OAuth2 account
- Match by email address
- Multiple OAuth2 providers per user (future enhancement)

## Authorization & Permissions

### Role-Based Access Control (RBAC)

**Architecture**: Role → Permissions → Resources

**Roles**:
- Super Administrator (cross-company)
- Organization Administrator (company-level)
- Custom Roles (company-specific)

**Default Roles** (per company):
1. Administrator - Full permissions
2. Technician - Work order management
3. Requester - Create requests only
4. Viewer - Read-only access

### Permission Model

**Permission Types**:
- `CREATE` - Create new records
- `VIEW` - View own records
- `VIEW_OTHER` - View records of others in company
- `EDIT_OTHER` - Edit records of others in company
- `DELETE_OTHER` - Delete records of others in company

**Resource Types**:
- WORK_ORDER
- ASSET
- LOCATION
- PART
- PURCHASE_ORDER
- REQUEST
- PREVENTIVE_MAINTENANCE
- METER
- FILE
- PEOPLE_TEAM (users and teams)
- CATEGORY
- VENDOR
- CUSTOMER

### Permission Checking

#### Backend (Java)

**Method-Level Security** (`@PreAuthorize`):
```java
@PreAuthorize("hasPermission(#id, 'WorkOrder', 'EDIT_OTHER')")
public WorkOrder updateWorkOrder(Long id, WorkOrderPatchDTO dto) {
    // Only users with EDIT_OTHER permission can execute
}
```

**Programmatic Check**:
```java
boolean canEdit = permissionService.hasPermission(
    user,
    PermissionEntity.WORK_ORDER,
    RoleType.EDIT_OTHER
);

if (canEdit) {
    // Allow operation
} else {
    throw new ForbiddenException("Insufficient permissions");
}
```

**Data Filtering** (Repository):
```java
@Query("SELECT wo FROM WorkOrder wo WHERE wo.companySettings.id = :companyId")
List<WorkOrder> findByCompany(@Param("companyId") Long companyId);
```

#### Frontend (React)

**Permission Hook**:
```typescript
const { hasPermission } = usePermissions();

const canEditWorkOrder = hasPermission('WORK_ORDER', 'EDIT_OTHER');
const canCreateAsset = hasPermission('ASSET', 'CREATE');
```

**Conditional Rendering**:
```typescript
{hasPermission('WORK_ORDER', 'EDIT_OTHER') && (
  <Button onClick={editWorkOrder}>Edit</Button>
)}
```

**Route Protection**:
```typescript
<Route
  path="/work-orders/new"
  element={
    <RequirePermission entity="WORK_ORDER" permission="CREATE">
      <CreateWorkOrder />
    </RequirePermission>
  }
/>
```

#### Mobile (React Native)

**Permission Check**:
```typescript
const canCreate = hasPermission('WORK_ORDER', 'CREATE');

{canCreate && (
  <Button title="New Work Order" onPress={createWorkOrder} />
)}
```

### Multi-Tenancy Security

**Tenant Isolation**: All data scoped to company

**Enforcement Mechanisms**:

**1. Database Level**:
- All entity tables have `company_settings_id` foreign key
- Queries filtered by company ID

**2. Application Level** (`TenantAspect.java`):
```java
@Aspect
public class TenantAspect {
    @Before("execution(* com.grash.repository.*.*(..))")
    public void enforceTenant() {
        Long currentCompanyId = SecurityContextHolder.getContext()
            .getAuthentication()
            .getCompanyId();

        // Inject company filter into query
    }
}
```

**3. Request Level**:
- Extract `companyId` from JWT token
- Set in SecurityContext
- All queries filtered by companyId

**Cross-Tenant Protection**:
- Users cannot access data from other companies
- Super admin can access all companies (for support)
- Company ID mismatch returns 403 Forbidden

## Security Features

### CORS Configuration

**Configuration** (`WebSecurityConfig.java`):
```java
@Bean
public CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOrigins(Arrays.asList(frontendUrl));  // ${PUBLIC_FRONT_URL}
    config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
    config.setAllowedHeaders(Arrays.asList("*"));
    config.setAllowCredentials(true);
    return source;
}
```

**Important**: `PUBLIC_FRONT_URL` must match exactly (including protocol and port)

**Multiple Origins**:
```java
config.setAllowedOrigins(Arrays.asList(
    "http://localhost:3000",
    "https://app.example.com"
));
```

### CSRF Protection

**Disabled for Stateless API**:
```java
http.csrf().disable()
```

**Justification**: JWT-based authentication is stateless and not vulnerable to CSRF

**Alternative Protection**: Validate JWT signature on every request

### Rate Limiting

**Library**: Bucket4j (`com.bucket4j:bucket4j_jdk8-core`)

**Implementation**:
```java
@Component
public class RateLimitingFilter extends OncePerRequestFilter {

    private final Map<String, Bucket> cache = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                     HttpServletResponse response,
                                     FilterChain filterChain) throws ServletException, IOException {
        String clientId = getClientId(request);  // IP or user ID
        Bucket bucket = cache.computeIfAbsent(clientId, this::createBucket);

        if (bucket.tryConsume(1)) {
            filterChain.doFilter(request, response);
        } else {
            response.setStatus(429);  // Too Many Requests
            response.getWriter().write("Rate limit exceeded");
        }
    }

    private Bucket createBucket(String key) {
        return Bucket.builder()
            .addLimit(Bandwidth.simple(100, Duration.ofMinutes(1)))  // 100 requests per minute
            .build();
    }
}
```

**Limits** (configurable):
- 100 requests per minute per IP
- 1000 requests per hour per user

### Input Validation

**Bean Validation** (`javax.validation`):
```java
public class CreateWorkOrderRequest {
    @NotBlank(message = "Title is required")
    @Size(max = 255, message = "Title too long")
    private String title;

    @Email(message = "Invalid email format")
    private String contactEmail;

    @Min(value = 1, message = "Priority must be at least 1")
    @Max(value = 5, message = "Priority must be at most 5")
    private Integer priority;
}
```

**Controller Validation**:
```java
@PostMapping("/work-orders")
public ResponseEntity<WorkOrder> create(@Valid @RequestBody CreateWorkOrderRequest request) {
    // Validation errors automatically returned as 400 Bad Request
}
```

### SQL Injection Prevention

**JPA/Hibernate**: Automatically uses parameterized queries

**Safe**:
```java
@Query("SELECT u FROM User u WHERE u.email = :email")
User findByEmail(@Param("email") String email);
```

**Dangerous** (never use):
```java
// DO NOT DO THIS
String query = "SELECT * FROM user WHERE email = '" + email + "'";
entityManager.createNativeQuery(query).getSingleResult();
```

### XSS Protection

**Frontend**: React automatically escapes output

**Backend**: API returns JSON (not HTML), no XSS risk

**Additional Protection**:
- Sanitize rich text input (from rich text editors)
- Content Security Policy (CSP) headers (optional)

### API Security Headers

**Recommended Headers**:
```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) {
    http.headers()
        .contentSecurityPolicy("default-src 'self'")
        .and()
        .xssProtection()
        .and()
        .contentTypeOptions()
        .and()
        .frameOptions().deny()
        .and()
        .httpStrictTransportSecurity()
            .maxAgeInSeconds(31536000)
            .includeSubDomains(true);
}
```

**Headers**:
- `Content-Security-Policy` - Prevent XSS
- `X-Content-Type-Options: nosniff` - Prevent MIME sniffing
- `X-Frame-Options: DENY` - Prevent clickjacking
- `X-XSS-Protection: 1; mode=block` - Browser XSS filter
- `Strict-Transport-Security` - Force HTTPS

## Secrets Management

### Environment Variables

**Never Commit Secrets** to version control:
- Add `.env` to `.gitignore`
- Use `.env.example` as template

**Production Secrets**:
- Use secrets manager (AWS Secrets Manager, HashiCorp Vault)
- Inject secrets via environment variables
- Rotate secrets regularly

### Database Credentials

**Production Setup**:
```env
POSTGRES_USER=atlas_prod_user
POSTGRES_PWD=<generated-strong-password>
```

**Best Practices**:
- Use unique passwords per environment
- Restrict database user privileges (least privilege)
- Enable SSL for database connections

### JWT Secret Key

**Generation**:
```bash
openssl rand -base64 64
```

**Storage**:
- Environment variable (Docker secrets, Kubernetes secrets)
- Never hardcode in source code

### OAuth2 Credentials

**Storage**: Environment variables only

**Security**:
- Rotate client secrets periodically
- Restrict callback URLs to production domains
- Monitor OAuth2 usage logs

## Audit Logging

### Hibernate Envers

**Automatic Auditing**: Track all entity changes

**What's Logged**:
- Who made the change (user ID)
- When the change occurred (timestamp)
- What changed (before/after values)
- Type of change (INSERT, UPDATE, DELETE)

**Accessing Audit Logs**:
```java
AuditReader reader = AuditReaderFactory.get(entityManager);
List<Number> revisions = reader.getRevisions(WorkOrder.class, workOrderId);

for (Number revision : revisions) {
    WorkOrder historical = reader.find(WorkOrder.class, workOrderId, revision);
    Date timestamp = reader.getRevisionDate(revision);
    // Display audit trail
}
```

**Use Cases**:
- Compliance audits
- Troubleshooting changes
- Rollback to previous state
- User activity tracking

### Application Logging

**Framework**: SLF4J with Logback

**Log Levels**:
- ERROR - Errors and exceptions
- WARN - Warnings
- INFO - Important events (login, logout, major operations)
- DEBUG - Detailed debugging information
- TRACE - Very detailed trace information

**Security Events to Log**:
- ✅ Login attempts (success and failure)
- ✅ Logout events
- ✅ Permission denied (403)
- ✅ Password changes
- ✅ Role/permission changes
- ✅ Account creation/deletion
- ✅ OAuth2 authentication events

**Example**:
```java
logger.info("User {} logged in successfully", user.getEmail());
logger.warn("Failed login attempt for email: {}", email);
logger.error("Unauthorized access attempt to work order {} by user {}", workOrderId, userId);
```

## Security Best Practices

### Password Management

✅ **Do**:
- Use BCrypt for hashing
- Implement password complexity requirements
- Provide password reset functionality
- Rate-limit login attempts
- Lock accounts after repeated failures

❌ **Don't**:
- Store plain-text passwords
- Use weak hashing (MD5, SHA-1)
- Allow weak passwords
- Display specific failure reasons ("Email not found" vs "Password incorrect")

### Token Security

✅ **Do**:
- Use strong secret keys (64+ characters)
- Set reasonable expiration (14 days max)
- Validate signature on every request
- Rotate secret keys periodically

❌ **Don't**:
- Use short secret keys
- Set very long expiration (>30 days)
- Store tokens in cookies (XSS risk)
- Share secret keys across environments

### API Security

✅ **Do**:
- Use HTTPS in production
- Implement rate limiting
- Validate all input
- Return generic error messages to clients
- Log security events

❌ **Don't**:
- Use HTTP for sensitive data
- Trust client input
- Expose stack traces to clients
- Include sensitive data in logs

### Multi-Tenancy Security

✅ **Do**:
- Filter all queries by company ID
- Validate tenant access on every request
- Use separate schemas or databases for high security
- Test cross-tenant access prevention

❌ **Don't**:
- Trust client-provided company ID
- Skip tenant validation
- Allow super admin access without audit logging

## Compliance Considerations

### GDPR

**Right to Access**: Export user data via API
**Right to Deletion**: Soft delete with configurable hard delete
**Data Minimization**: Collect only necessary data
**Consent**: Track user consent for data processing

**Implementation**:
```java
// Export user data
@GetMapping("/users/{id}/export")
public ResponseEntity<UserDataExport> exportUserData(@PathVariable Long id) {
    // Gather all user data
    // Return as JSON or PDF
}

// Delete user (GDPR right to deletion)
@DeleteMapping("/users/{id}/gdpr-delete")
public ResponseEntity<?> deleteUser(@PathVariable Long id) {
    userService.gdprDelete(id);  // Hard delete after soft delete period
}
```

### HIPAA (if applicable)

**Requirements**:
- Audit logging (Hibernate Envers)
- Encryption at rest and in transit
- Access controls (RBAC)
- Business Associate Agreements with vendors

### SOC 2 (if applicable)

**Controls**:
- Authentication and authorization
- Audit logging
- Data encryption
- Backup and recovery
- Change management

## Security Monitoring

### Metrics to Track

- Failed login attempts per minute/hour
- 403 Forbidden responses (permission denied)
- 401 Unauthorized responses (invalid/expired tokens)
- Rate limit violations
- Suspicious API usage patterns

### Alerting

**Configure Alerts** for:
- Spike in failed logins (possible brute force attack)
- Multiple 403 errors from same user (possible privilege escalation attempt)
- Unusual API usage patterns
- Database connection failures

### Security Testing

**Recommended Tests**:
- Penetration testing (annual)
- Vulnerability scanning (continuous)
- Dependency scanning (automated)
- OWASP Top 10 assessment
- SQL injection testing
- XSS testing
- Authentication bypass attempts
- Authorization bypass attempts

**Tools**:
- OWASP ZAP
- Burp Suite
- Snyk (dependency scanning)
- Trivy (container scanning - see `.trivyignore`)
