# Atlas CMMS API Reference

Complete REST API reference for the Atlas CMMS backend.

**Base URL**: `http://localhost:8080` (configurable via `PUBLIC_API_URL`)

**Version**: Spring Boot 2.6.7

**API Documentation**: Swagger UI available at `http://localhost:8080/swagger-ui.html`

---

## Table of Contents

1. [Authentication](#authentication)
2. [Authorization Model](#authorization-model)
3. [API Conventions](#api-conventions)
4. [Core Resources](#core-resources)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)

---

## Authentication

### Authentication Methods

Atlas CMMS supports two authentication mechanisms:

1. **JWT Authentication** (default) - Token-based authentication
2. **OAuth2/SSO** (commercial license) - Single Sign-On with Google or Microsoft

### JWT Authentication Flow

#### 1. User Signup

**Endpoint**: `POST /auth/signup`

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

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Account created successfully",
  "user": {
    "id": 123,
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1234567890",
    "role": {
      "id": 1,
      "name": "Administrator",
      "code": "ADMIN"
    },
    "company": {
      "id": 456,
      "name": "Acme Corp"
    }
  }
}
```

**Errors**:
- `400` - Validation error (invalid email, weak password, etc.)
- `403` - Access denied (email not in `ALLOWED_ORGANIZATION_ADMINS` list)
- `422` - Email already in use

---

#### 2. User Signin

**Endpoint**: `POST /auth/signin`

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123",
  "type": "WEB"
}
```

**Response** (200 OK):
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyQGV4YW1wbGUuY29tIiwidXNlcklkIjoxMjMsImNvbXBhbnlJZCI6NDU2LCJpYXQiOjE3MDQwNjcyMDAsImV4cCI6MTcwNTI3NjgwMH0.signature",
  "tokenType": "Bearer"
}
```

**Errors**:
- `400` - Something went wrong
- `422` - Invalid credentials (wrong email or password)

**Token Details**:
- **Expiration**: 14 days (1209600000 ms)
- **Algorithm**: HS256 (HMAC SHA-256)
- **Claims**: `sub` (email), `userId`, `companyId`, `iat`, `exp`

---

#### 3. Get Current User

**Endpoint**: `GET /auth/me`

**Headers**: `Authorization: Bearer <token>`

**Response** (200 OK):
```json
{
  "id": 123,
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890",
  "role": {
    "id": 1,
    "name": "Administrator",
    "code": "ADMIN",
    "createPermissions": ["WORK_ORDER", "ASSET", "LOCATION", "..."],
    "viewPermissions": ["WORK_ORDER", "ASSET", "LOCATION", "..."],
    "viewOtherPermissions": ["WORK_ORDER", "ASSET", "LOCATION", "..."],
    "editOtherPermissions": ["WORK_ORDER", "ASSET", "LOCATION", "..."],
    "deleteOtherPermissions": ["WORK_ORDER", "ASSET", "LOCATION", "..."]
  },
  "company": {
    "id": 456,
    "name": "Acme Corp"
  }
}
```

**Errors**:
- `403` - Access denied (invalid or expired token)
- `500` - Expired or invalid JWT token

---

#### 4. Reset Password

**Request Reset**:

**Endpoint**: `GET /auth/resetpwd?email=user@example.com`

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Password reset email sent"
}
```

**Confirm Reset**:

**Endpoint**: `GET /auth/reset-pwd-confirm?token=<reset-token>`

**Response**: Redirects to frontend login page

---

#### 5. Update Password

**Endpoint**: `POST /auth/updatepwd`

**Headers**: `Authorization: Bearer <token>`

**Request Body**:
```json
{
  "oldPassword": "OldPassword123",
  "newPassword": "NewSecurePassword456"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Errors**:
- `406` - Bad credentials (old password incorrect)

---

### OAuth2/SSO Authentication

**License Requirement**: Commercial license with `LICENSE_KEY` and `ENABLE_SSO=true`

**Supported Providers**:
- Google (`OAUTH2_PROVIDER=google`)
- Microsoft (`OAUTH2_PROVIDER=microsoft`)

#### Authorization Flow

**1. Initiate OAuth2 Flow**:

**Frontend Redirect**: `GET /oauth2/authorization/{provider}`

**Example**: `GET /oauth2/authorization/google`

**Process**:
- Backend generates state token (CSRF protection)
- Redirects to OAuth2 provider (Google/Microsoft)
- User authenticates with provider

**2. OAuth2 Callback**:

**Provider Redirects**: `GET /oauth2/callback/{provider}?code=xxx&state=xxx`

**Process**:
- Backend validates state token
- Exchanges authorization code for access token
- Fetches user profile from provider
- Creates or updates user in database
- Generates JWT token
- Redirects to frontend success URL

**Success Redirect**: `${PUBLIC_FRONT_URL}/oauth2/success?token=<jwt-token>`

**Failure Redirect**: `${PUBLIC_FRONT_URL}/oauth2/failure`

---

### Using JWT Tokens

#### Web/Frontend

**Store Token**:
```javascript
localStorage.setItem('token', accessToken);
```

**Include in Requests**:
```javascript
axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
```

#### Mobile

**Store Token**:
```javascript
await AsyncStorage.setItem('token', accessToken);
```

**Include in Requests**:
```javascript
const token = await AsyncStorage.getItem('token');
api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
```

---

## Authorization Model

### Role-Based Access Control (RBAC)

Atlas CMMS uses a flexible RBAC system with granular permissions.

### Role Types

1. **ROLE_SUPER_ADMIN** - Super administrator (cross-company access)
2. **ROLE_ADMIN** - Organization administrator
3. **ROLE_USER_CREATED** - Custom company-specific roles

### Default Roles (per company)

1. **Administrator** - Full permissions for all entities
2. **Technician** - Work order management permissions
3. **Requester** - Create requests only
4. **Viewer** - Read-only access

### Permission Model

**Permission Types**:
- `CREATE` - Create new records
- `VIEW` - View own records
- `VIEW_OTHER` - View records created by others in the company
- `EDIT_OTHER` - Edit records created by others in the company
- `DELETE_OTHER` - Delete records created by others in the company

**Entity Types** (Resources):
- `WORK_ORDERS`
- `ASSETS`
- `LOCATIONS`
- `PARTS`
- `PURCHASE_ORDERS`
- `REQUESTS`
- `PREVENTIVE_MAINTENANCES`
- `METERS`
- `FILES`
- `PEOPLE_TEAM` (users and teams)
- `CATEGORIES`
- `VENDORS`
- `CUSTOMERS`
- `SETTINGS` (company settings)

### Permission Checking

**Backend** uses Spring Security `@PreAuthorize`:

```java
@PreAuthorize("hasRole('ROLE_CLIENT')")
public WorkOrder create(@RequestBody WorkOrderPostDTO workOrder) {
    // Only authenticated users with ROLE_CLIENT can access
    if (!user.getRole().getCreatePermissions().contains(PermissionEntity.WORK_ORDERS)) {
        throw new CustomException("Access denied", HttpStatus.FORBIDDEN);
    }
    // Create work order
}
```

**Permission Check Example**:
```java
boolean canEdit =
    user.getRole().getEditOtherPermissions().contains(PermissionEntity.WORK_ORDERS) ||
    workOrder.getCreatedBy().equals(user.getId()) ||
    workOrder.isAssignedTo(user);
```

### Multi-Tenancy Security

**Tenant Isolation**: All data is scoped to a company (organization).

**Enforcement**:
1. JWT token contains `companyId` claim
2. All queries filtered by `company_settings_id`
3. Users cannot access data from other companies
4. Super admin can access all companies (for support)

**Example Query**:
```java
@Query("SELECT wo FROM WorkOrder wo WHERE wo.companySettings.id = :companyId")
List<WorkOrder> findByCompany(@Param("companyId") Long companyId);
```

---

## API Conventions

### HTTP Methods

- `GET` - Retrieve resource(s)
- `POST` - Create new resource
- `PATCH` - Partial update of resource
- `PUT` - Full update of resource (rarely used)
- `DELETE` - Delete resource

### Request Headers

**Required** (for authenticated endpoints):
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

### Response Format

**Success Response**:
```json
{
  "id": 123,
  "field1": "value1",
  "field2": "value2"
}
```

**Success Response (Create/Update)**:
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

**Error Response**:
```json
{
  "timestamp": "2025-01-01T12:00:00Z",
  "status": 403,
  "error": "Forbidden",
  "message": "Access denied",
  "path": "/api/work-orders/123"
}
```

### Pagination

**Search Endpoints** (POST with search criteria):

**Request**:
```json
{
  "filterFields": [
    {
      "field": "status",
      "operation": "eq",
      "value": "OPEN"
    }
  ],
  "pageNum": 0,
  "pageSize": 20,
  "direction": "desc",
  "criteria": "createdAt"
}
```

**Response**:
```json
{
  "content": [ /* array of resources */ ],
  "pageable": {
    "pageNumber": 0,
    "pageSize": 20,
    "sort": {
      "sorted": true,
      "unsorted": false,
      "empty": false
    }
  },
  "totalElements": 150,
  "totalPages": 8,
  "last": false,
  "first": true,
  "size": 20,
  "number": 0,
  "numberOfElements": 20,
  "empty": false
}
```

**Filter Operations**:
- `eq` - Equals
- `neq` - Not equals
- `gt` - Greater than
- `gte` - Greater than or equal
- `lt` - Less than
- `lte` - Less than or equal
- `like` - Contains (case-insensitive)
- `in` - In list
- `notIn` - Not in list

### Date Formats

**ISO 8601**: `2025-01-01T12:00:00Z`

**Date Only**: `2025-01-01`

---

## Core Resources

### Work Orders

**Base Path**: `/work-orders`

#### List/Search Work Orders

**Endpoint**: `POST /work-orders/search`

**Authorization**: Any authenticated user with `VIEW` permission

**Request**:
```json
{
  "filterFields": [
    { "field": "status", "operation": "eq", "value": "OPEN" },
    { "field": "priority", "operation": "in", "value": ["HIGH", "MEDIUM"] }
  ],
  "pageNum": 0,
  "pageSize": 20,
  "direction": "desc",
  "criteria": "createdAt"
}
```

**Response**: Paginated list of work orders

---

#### Get Work Order by ID

**Endpoint**: `GET /work-orders/{id}`

**Authorization**: User with `VIEW` permission who created the work order, is assigned to it, or has `VIEW_OTHER` permission

**Response**:
```json
{
  "id": 123,
  "title": "Repair HVAC Unit",
  "description": "Annual maintenance and filter replacement",
  "status": "OPEN",
  "priority": "HIGH",
  "dueDate": "2025-01-15T10:00:00Z",
  "asset": {
    "id": 456,
    "name": "HVAC Unit #1"
  },
  "location": {
    "id": 789,
    "name": "Building A - Floor 2"
  },
  "primaryUser": {
    "id": 123,
    "firstName": "John",
    "lastName": "Doe"
  },
  "assignedTo": [
    { "id": 124, "firstName": "Jane", "lastName": "Smith" }
  ],
  "category": {
    "id": 1,
    "name": "Preventive Maintenance"
  },
  "createdAt": "2025-01-01T09:00:00Z",
  "updatedAt": "2025-01-01T09:00:00Z",
  "createdBy": 123
}
```

---

#### Create Work Order

**Endpoint**: `POST /work-orders`

**Authorization**: User with `CREATE` permission for `WORK_ORDERS`

**Request**:
```json
{
  "title": "Repair HVAC Unit",
  "description": "Annual maintenance and filter replacement",
  "priority": "HIGH",
  "dueDate": "2025-01-15T10:00:00Z",
  "asset": { "id": 456 },
  "location": { "id": 789 },
  "primaryUser": { "id": 123 },
  "assignedTo": [{ "id": 124 }],
  "category": { "id": 1 }
}
```

**Response**: Created work order object (201 Created)

---

#### Update Work Order

**Endpoint**: `PATCH /work-orders/{id}`

**Authorization**: User with `EDIT_OTHER` permission, or work order creator, or assigned user

**Request** (partial update):
```json
{
  "status": "IN_PROGRESS",
  "priority": "MEDIUM",
  "description": "Updated description"
}
```

**Response**: Updated work order object

---

#### Change Work Order Status

**Endpoint**: `PATCH /work-orders/{id}/change-status`

**Authorization**: User who can edit the work order

**Request**:
```json
{
  "status": "COMPLETE",
  "signature": "data:image/png;base64,...",
  "feedback": "Work completed successfully"
}
```

**Response**: Updated work order object

**Status Values**:
- `OPEN` - Work order created, not started
- `IN_PROGRESS` - Work in progress
- `ON_HOLD` - Temporarily paused
- `COMPLETE` - Work completed

**Side Effects**:
- `COMPLETE` status:
  - Sets `completedOn` timestamp
  - Sets `completedBy` to current user
  - Stops all active labor timers
  - Stops asset downtime (if applicable)
  - Triggers notifications to admins
  - Executes workflows with `WORK_ORDER_CLOSED` trigger

---

#### Delete Work Order

**Endpoint**: `DELETE /work-orders/{id}`

**Authorization**: Work order creator or user with `DELETE_OTHER` permission

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Deleted successfully"
}
```

**Side Effects**:
- Sends email notification to admins
- Soft deletes related records (tasks, labor, costs)

---

#### Get Work Orders by Asset

**Endpoint**: `GET /work-orders/asset/{assetId}`

**Authorization**: User with `VIEW` permission

**Response**: Array of work orders associated with the asset

---

#### Get Work Orders by Location

**Endpoint**: `GET /work-orders/location/{locationId}`

**Authorization**: User with `VIEW` permission

**Response**: Array of work orders associated with the location

---

#### Get Work Order Report (PDF)

**Endpoint**: `GET /work-orders/report/{id}`

**Authorization**: User with `VIEW` permission for the work order

**Response**:
```json
{
  "success": true,
  "message": "https://storage.../work-order-report.pdf"
}
```

**Process**:
- Generates PDF from Thymeleaf template
- Includes work order details, tasks, labor, costs, parts
- Uploads to storage backend (MinIO/GCP)
- Returns presigned URL

---

### Assets

**Base Path**: `/assets`

#### List/Search Assets

**Endpoint**: `POST /assets/search`

**Authorization**: User with `VIEW` permission for `ASSETS`

**Request**: Similar to work orders search

---

#### Get Asset by ID

**Endpoint**: `GET /assets/{id}`

**Authorization**: User with `VIEW` permission

**Response**:
```json
{
  "id": 456,
  "name": "HVAC Unit #1",
  "description": "Rooftop HVAC system",
  "model": "Model XYZ-2000",
  "serialNumber": "SN123456789",
  "barcode": "BAR123456",
  "category": {
    "id": 1,
    "name": "HVAC"
  },
  "location": {
    "id": 789,
    "name": "Building A - Rooftop"
  },
  "primaryUser": {
    "id": 123,
    "firstName": "John",
    "lastName": "Doe"
  },
  "assignedTo": [
    { "id": 124, "firstName": "Jane", "lastName": "Smith" }
  ],
  "acquisitionCost": 15000.00,
  "warrantyExpiresOn": "2026-12-31",
  "createdAt": "2024-01-01T09:00:00Z"
}
```

---

#### Create Asset

**Endpoint**: `POST /assets`

**Authorization**: User with `CREATE` permission for `ASSETS`

**Request**:
```json
{
  "name": "HVAC Unit #1",
  "description": "Rooftop HVAC system",
  "model": "Model XYZ-2000",
  "serialNumber": "SN123456789",
  "barcode": "BAR123456",
  "category": { "id": 1 },
  "location": { "id": 789 },
  "primaryUser": { "id": 123 },
  "acquisitionCost": 15000.00,
  "warrantyExpiresOn": "2026-12-31"
}
```

**Response**: Created asset object

---

#### Update Asset

**Endpoint**: `PATCH /assets/{id}`

**Authorization**: User with `EDIT_OTHER` permission, asset creator, or assigned user

**Request**: Partial update (same fields as create)

**Response**: Updated asset object

---

#### Delete Asset

**Endpoint**: `DELETE /assets/{id}`

**Authorization**: Asset creator or user with `DELETE_OTHER` permission

**Response**: Success message

---

### Locations

**Base Path**: `/locations`

#### List/Search Locations

**Endpoint**: `POST /locations/search`

**Authorization**: User with `VIEW` permission for `LOCATIONS`

---

#### Get Location by ID

**Endpoint**: `GET /locations/{id}`

**Response**:
```json
{
  "id": 789,
  "name": "Building A - Floor 2",
  "address": "123 Main St, City, State 12345",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "parentLocation": {
    "id": 788,
    "name": "Building A"
  },
  "workers": [
    { "id": 123, "firstName": "John", "lastName": "Doe" }
  ],
  "teams": [
    { "id": 1, "name": "Maintenance Team" }
  ]
}
```

---

#### Create Location

**Endpoint**: `POST /locations`

**Request**:
```json
{
  "name": "Building A - Floor 2",
  "address": "123 Main St, City, State 12345",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "parentLocation": { "id": 788 },
  "workers": [{ "id": 123 }],
  "teams": [{ "id": 1 }]
}
```

---

### Parts (Inventory)

**Base Path**: `/parts`

#### List/Search Parts

**Endpoint**: `POST /parts/search`

---

#### Get Part by ID

**Endpoint**: `GET /parts/{id}`

**Response**:
```json
{
  "id": 111,
  "name": "HVAC Filter 20x25",
  "description": "High-efficiency air filter",
  "barcode": "FILTER-20x25",
  "cost": 25.00,
  "quantity": 50,
  "minQuantity": 10,
  "category": {
    "id": 2,
    "name": "Filters"
  },
  "vendor": {
    "id": 5,
    "companyName": "ABC Supplies"
  },
  "area": "Warehouse A - Shelf 3"
}
```

---

#### Create Part

**Endpoint**: `POST /parts`

**Request**:
```json
{
  "name": "HVAC Filter 20x25",
  "description": "High-efficiency air filter",
  "barcode": "FILTER-20x25",
  "cost": 25.00,
  "quantity": 50,
  "minQuantity": 10,
  "category": { "id": 2 },
  "vendor": { "id": 5 },
  "area": "Warehouse A - Shelf 3"
}
```

---

### Requests (Maintenance Requests)

**Base Path**: `/requests`

#### List Requests

**Endpoint**: `POST /requests/search`

---

#### Get Request by ID

**Endpoint**: `GET /requests/{id}`

**Response**:
```json
{
  "id": 222,
  "title": "AC not working",
  "description": "Conference room AC is not cooling",
  "priority": "HIGH",
  "status": "PENDING",
  "createdBy": {
    "id": 125,
    "firstName": "Alice",
    "lastName": "Johnson"
  },
  "asset": {
    "id": 457,
    "name": "AC Unit #2"
  },
  "location": {
    "id": 790,
    "name": "Conference Room A"
  },
  "workOrder": null,
  "createdAt": "2025-01-01T14:30:00Z"
}
```

---

#### Create Request

**Endpoint**: `POST /requests`

**Authorization**: Any authenticated user

**Request**:
```json
{
  "title": "AC not working",
  "description": "Conference room AC is not cooling",
  "priority": "HIGH",
  "asset": { "id": 457 },
  "location": { "id": 790 }
}
```

---

#### Convert Request to Work Order

**Endpoint**: `PATCH /requests/{id}/convert`

**Authorization**: User with `CREATE` permission for `WORK_ORDERS`

**Request**:
```json
{
  "assignedTo": [{ "id": 124 }],
  "primaryUser": { "id": 123 },
  "category": { "id": 1 }
}
```

**Response**: Created work order object

**Side Effects**:
- Request status changes to `APPROVED`
- Request linked to work order
- Requester receives notification

---

### Files

**Base Path**: `/files`

#### Upload File

**Endpoint**: `POST /files`

**Authorization**: Authenticated user

**Request**: `multipart/form-data`

**Form Fields**:
- `file` - File to upload (max 7MB)

**Response**:
```json
{
  "id": 333,
  "name": "hvac-photo.jpg",
  "url": "http://localhost:9000/atlas-bucket/123/files/333/hvac-photo.jpg",
  "type": "image/jpeg",
  "createdAt": "2025-01-01T15:00:00Z"
}
```

**Storage**:
- Files uploaded to MinIO or GCP based on `STORAGE_TYPE`
- URL points to object storage location

---

#### Download File

**Endpoint**: `GET /files/{id}`

**Authorization**: User with access to associated entity (work order, asset, etc.)

**Response**: File binary data or redirect to presigned URL

---

#### Delete File

**Endpoint**: `DELETE /files/{id}`

**Authorization**: File owner or user with appropriate permissions

**Response**: Success message

---

### Users

**Base Path**: `/users`

#### List Users

**Endpoint**: `GET /users`

**Authorization**: User with `VIEW` permission for `PEOPLE_TEAM`

**Response**: Array of users in the company

---

#### Get User by ID

**Endpoint**: `GET /users/{id}`

**Response**:
```json
{
  "id": 123,
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890",
  "role": {
    "id": 1,
    "name": "Administrator"
  },
  "enabled": true,
  "createdAt": "2024-01-01T09:00:00Z"
}
```

---

#### Create User (Invite)

**Endpoint**: `POST /users`

**Authorization**: User with `CREATE` permission for `PEOPLE_TEAM`

**Request**:
```json
{
  "email": "newuser@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "phone": "+1234567890",
  "role": { "id": 2 }
}
```

**Process**:
- Creates user invitation
- Sends invitation email (if `INVITATION_VIA_EMAIL=true`)
- User receives link to set password and activate account

---

#### Update User

**Endpoint**: `PATCH /users/{id}`

**Authorization**: User editing own profile, or admin with `EDIT_OTHER` permission

**Request**: Partial update

---

#### Delete User

**Endpoint**: `DELETE /users/{id}`

**Authorization**: Admin with `DELETE_OTHER` permission

---

### Analytics

**Base Path**: `/analytics`

#### Work Order Analytics

**Endpoint**: `GET /analytics/work-orders`

**Authorization**: User with `ANALYTICS` feature enabled

**Query Parameters**:
- `startDate` - Start of date range (ISO 8601)
- `endDate` - End of date range (ISO 8601)

**Response**:
```json
{
  "totalWorkOrders": 150,
  "completedWorkOrders": 120,
  "openWorkOrders": 20,
  "inProgressWorkOrders": 10,
  "completionRate": 0.80,
  "averageCompletionTime": 86400000,
  "workOrdersByPriority": {
    "HIGH": 30,
    "MEDIUM": 70,
    "LOW": 50
  },
  "workOrdersByCategory": [
    { "categoryName": "Preventive Maintenance", "count": 60 },
    { "categoryName": "Repair", "count": 50 }
  ]
}
```

---

#### Asset Analytics

**Endpoint**: `GET /analytics/assets`

**Response**:
```json
{
  "totalAssets": 200,
  "assetsByCategory": [
    { "categoryName": "HVAC", "count": 50 },
    { "categoryName": "Electrical", "count": 75 }
  ],
  "averageDowntime": 7200000,
  "totalMaintenanceCost": 125000.00
}
```

---

### Import/Export

#### Import Work Orders

**Endpoint**: `POST /import/work-orders`

**Authorization**: User with `IMPORT_CSV` feature and `CREATE` permission

**Request**: `multipart/form-data` with CSV file

**CSV Template**: Available at `/import-templates/work-orders.csv`

**Response**:
```json
{
  "success": true,
  "imported": 50,
  "errors": [
    { "row": 5, "message": "Invalid asset ID" }
  ]
}
```

---

#### Export Work Orders

**Endpoint**: `GET /export/work-orders`

**Authorization**: User with `VIEW` permission

**Query Parameters**:
- `format` - `csv` or `pdf`
- `filterFields` - JSON-encoded filter criteria

**Response**: CSV or PDF file download

---

## Error Handling

### HTTP Status Codes

- `200` OK - Request successful
- `201` Created - Resource created successfully
- `204` No Content - Request successful, no response body
- `400` Bad Request - Validation error or malformed request
- `401` Unauthorized - Missing or invalid authentication token
- `403` Forbidden - Authenticated but insufficient permissions
- `404` Not Found - Resource not found
- `406` Not Acceptable - Request cannot be fulfilled
- `422` Unprocessable Entity - Validation failed (e.g., duplicate email)
- `429` Too Many Requests - Rate limit exceeded
- `500` Internal Server Error - Server error

### Error Response Format

```json
{
  "timestamp": "2025-01-01T12:00:00Z",
  "status": 403,
  "error": "Forbidden",
  "message": "Access denied",
  "path": "/work-orders/123"
}
```

### Custom Exceptions

**CustomException** (thrown by application):
```json
{
  "message": "Access denied",
  "status": 403
}
```

### Validation Errors

**Bean Validation** (400 Bad Request):
```json
{
  "timestamp": "2025-01-01T12:00:00Z",
  "status": 400,
  "errors": [
    {
      "field": "title",
      "message": "Title is required"
    },
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

---

## Rate Limiting

**Implementation**: Bucket4j token bucket algorithm

**Default Limits**:
- **Per IP**: 100 requests per minute
- **Per User**: 1000 requests per hour

**Rate Limit Headers** (included in responses):
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704067200
```

**Rate Limit Exceeded** (429 Too Many Requests):
```json
{
  "message": "Rate limit exceeded",
  "status": 429
}
```

**Bypass**: Super admin users are exempt from rate limiting

---

## AI Agent Integration

**Base Path**: `/agent`

**Feature Flag**: Requires `AGENT_CHATKIT_ENABLED=true`

### Send Chat Prompt

**Endpoint**: `POST /api/agent/chat`

**Authorization**: Authenticated user

**Request**:
```json
{
  "prompt": "What are my open work orders?",
  "agentId": "optional-agent-id"
}
```

**Response** (200 OK):
```json
{
  "agentId": "agent-123",
  "correlationId": "corr-456",
  "message": "You have 5 open work orders: WO-001, WO-002...",
  "toolCalls": [
    {
      "toolName": "get_work_orders",
      "status": "success",
      "resultCount": 5
    }
  ],
  "draftActions": [
    {
      "id": 789,
      "operationType": "UPDATE_WORK_ORDER",
      "summary": "Close work order WO-001"
    }
  ]
}
```

**Response when disabled** (501 Not Implemented):
```json
{
  "agentId": "agent-123",
  "correlationId": "corr-456",
  "message": "AI assistant is currently disabled",
  "enabled": false
}
```

**Errors**:
- `403` - Access denied (invalid token)
- `501` - Not implemented (feature disabled)

---

### Get Pending Draft Actions

**Endpoint**: `GET /api/agent/drafts`

**Authorization**: Authenticated user

**Response** (200 OK):
```json
[
  {
    "id": 789,
    "agentSessionId": "session-123",
    "operationType": "UPDATE_WORK_ORDER",
    "payload": "{\"summary\":\"Close work order WO-001\",\"data\":{\"workOrderId\":123,\"status\":\"COMPLETE\"}}",
    "status": "pending",
    "createdAt": "2025-01-01T15:00:00Z"
  }
]
```

**Errors**:
- `403` - Access denied
- `501` - Not implemented (feature disabled)

---

### Confirm Draft Action

**Endpoint**: `POST /api/agent/drafts/{draftId}/confirm`

**Authorization**: Authenticated user (must own the draft)

**Response** (200 OK):
```json
{
  "id": 789,
  "agentSessionId": "session-123",
  "operationType": "UPDATE_WORK_ORDER",
  "payload": "{\"summary\":\"Close work order WO-001\",\"data\":{\"workOrderId\":123,\"status\":\"COMPLETE\"}}",
  "status": "confirmed",
  "updatedAt": "2025-01-01T15:05:00Z"
}
```

**Side Effects**:
- Executes the proposed action (e.g., updates work order)
- Changes draft status to "confirmed"
- May trigger notifications based on action type

**Errors**:
- `403` - Access denied (not draft owner or insufficient permissions)
- `404` - Draft not found
- `422` - Action execution failed
- `501` - Not implemented (feature disabled)

---

### Decline Draft Action

**Endpoint**: `DELETE /api/agent/drafts/{draftId}`

**Authorization**: Authenticated user (must own the draft)

**Response** (200 OK):
```json
{
  "id": 789,
  "agentSessionId": "session-123",
  "operationType": "UPDATE_WORK_ORDER",
  "payload": "{\"summary\":\"Close work order WO-001\",\"data\":{\"workOrderId\":123,\"status\":\"COMPLETE\"}}",
  "status": "declined",
  "updatedAt": "2025-01-01T15:05:00Z"
}
```

**Side Effects**:
- Changes draft status to "declined"
- Action is not executed

**Errors**:
- `403` - Access denied (not draft owner)
- `404` - Draft not found
- `501` - Not implemented (feature disabled)

---

### AI Agent Features

**Natural Language Queries**:
- "Show me open work orders"
- "What assets need maintenance?"
- "Check inventory for HVAC filters"

**Draft Actions** (require confirmation):
- Close/complete work orders
- Assign work orders
- Update work order status or priority
- Create preventive maintenance schedules

**Tool Invocations** (logged for audit):
- `get_work_orders` - Query work orders
- `update_work_order` - Modify work order
- `get_assets` - Query assets
- `get_parts` - Query inventory
- Additional CMMS-specific tools

**Configuration**:
```env
AGENT_CHATKIT_ENABLED=true                  # Enable AI assistant
AGENT_RUNTIME_URL=http://agents-proxy:4005  # Agent proxy endpoint
AGENT_RUNTIME_TOKEN=<secure-token>          # Authentication token
CHATKIT_AGENT_ID=<agent-id>                 # ChatKit agent identifier
```

**Audit Trail**:
- All tool invocations logged to `agent_tool_invocation_log` table
- Draft actions tracked in `agent_draft_action` table
- User actions (confirm/decline) audited with timestamps

---

## Additional Endpoints

### Health Check

**Endpoint**: `GET /health-check`

**Authorization**: Public (no authentication required)

**Response**:
```json
{
  "status": "UP",
  "database": "UP",
  "storage": "UP"
}
```

---

### License Validation

**Endpoint**: `GET /license/validity`

**Authorization**: Public

**Response**:
```json
{
  "valid": true,
  "features": ["SSO", "WHITE_LABELING"],
  "expiresOn": "2026-12-31T23:59:59Z"
}
```

---

### Subscription Plans

**Endpoint**: `GET /subscription-plans`

**Authorization**: Public

**Response**: Array of available subscription plans

```json
[
  {
    "id": 1,
    "code": "FREE",
    "name": "Free",
    "monthlyCostPerUser": 0,
    "yearlyCostPerUser": 0,
    "features": []
  },
  {
    "id": 2,
    "code": "PROFESSIONAL",
    "name": "Professional",
    "monthlyCostPerUser": 15,
    "yearlyCostPerUser": 150,
    "features": [
      "PREVENTIVE_MAINTENANCE",
      "CHECKLIST",
      "ANALYTICS",
      "IMPORT_CSV"
    ]
  }
]
```

---

## Best Practices

### Authentication

✅ **Do**:
- Store JWT token securely (localStorage for web, AsyncStorage for mobile)
- Include token in `Authorization` header for all authenticated requests
- Handle 401 responses by redirecting to login
- Refresh token before expiration (if refresh endpoint is implemented)

❌ **Don't**:
- Store tokens in cookies (XSS risk)
- Send tokens in URL parameters
- Hardcode tokens in source code

### Error Handling

✅ **Do**:
- Check HTTP status codes
- Parse error messages for user-friendly display
- Log errors for debugging
- Implement retry logic for transient errors (500, 503)

### Performance

✅ **Do**:
- Use pagination for large datasets
- Implement caching for frequently accessed data
- Use search/filter endpoints instead of fetching all records
- Batch operations when possible

---

## Swagger Documentation

**Interactive API Documentation**: http://localhost:8080/swagger-ui.html

**Features**:
- Browse all available endpoints
- View request/response schemas
- Try API calls directly from browser
- View authentication requirements
- Download OpenAPI specification

---

## Support

**Questions or Issues**:
- GitHub: https://github.com/grashjs/cmms/issues
- Email: contact@atlas-cmms.com
- Discord: https://discord.gg/cHqyVRYpkA
- User Docs: https://docs.atlas-cmms.com
