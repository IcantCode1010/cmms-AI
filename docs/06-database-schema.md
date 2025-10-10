# Database Schema & Migrations

## Database Technology

- **RDBMS**: PostgreSQL 16
- **Migration Tool**: Liquibase 4.22.0
- **ORM**: Hibernate (via Spring Data JPA)
- **Auditing**: Hibernate Envers

## Migration Management

### Liquibase Configuration

**Master Changelog**: `api/src/main/resources/db/master.xml`
**Changelog Directory**: `api/src/main/resources/db/changelog/`

**Application Configuration** (`application.yml`):
```yaml
spring:
  liquibase:
    change-log: classpath:/db/master.xml
    enabled: true
  jpa:
    hibernate:
      ddl-auto: validate  # Liquibase manages schema, Hibernate validates only
```

### Migration Workflow

1. **Schema Changes**: All schema changes are managed through Liquibase changesets
2. **Validation**: Hibernate validates schema matches entity definitions
3. **Version Control**: All migrations are version-controlled in Git
4. **Rollback**: Liquibase supports rollback for reversible changes

**Creating a Migration**:
```bash
cd api
mvn liquibase:generateChangeLog
```

**Running Migrations**:
- Automatic on application startup (if `enabled: true`)
- Manual: `mvn liquibase:update`

**Rollback**:
```bash
mvn liquibase:rollback -Dliquibase.rollbackCount=1
```

## Core Database Concepts

### Multi-Tenancy Architecture

**Tenant Isolation**: Company-based
- Each company has completely isolated data
- All tables (except global tables) have `company_id` foreign key
- Enforced at application level via `TenantAspect.java`
- No cross-company data access (except super admin)

**Global Tables** (shared across all companies):
- `subscription_plan`
- System configuration tables

**Tenant-Scoped Tables** (isolated by company):
- All entity tables (users, work_orders, assets, etc.)

### Entity Relationships

**Core Entity Hierarchy**:
```
Company (organization/tenant)
  │
  ├─── CompanySettings (1:1)
  │     └─── SubscriptionPlan (N:1)
  │
  ├─── Users (1:N)
  │     ├─── Role (N:1)
  │     ├─── Team (N:M)
  │     └─── UserSettings (1:1)
  │
  ├─── Locations (1:N)
  │     ├─── Parent Location (self-referencing)
  │     ├─── Assets (1:N)
  │     ├─── Workers (N:M Users)
  │     ├─── Teams (N:M)
  │     └─── Customers (N:M)
  │
  ├─── Assets (1:N)
  │     ├─── Location (N:1)
  │     ├─── Parent Asset (self-referencing)
  │     ├─── AssetCategory (N:1)
  │     ├─── PrimaryUser (N:1 User)
  │     ├─── AssignedTo (N:M Users)
  │     ├─── Teams (N:M)
  │     ├─── Vendor (N:1)
  │     ├─── Customers (N:M)
  │     ├─── Parts (N:M)
  │     ├─── Files (N:M)
  │     ├─── WorkOrders (1:N)
  │     └─── AssetDowntimes (1:N)
  │
  ├─── WorkOrders (1:N)
  │     ├─── Asset (N:1)
  │     ├─── Location (N:1)
  │     ├─── ParentWorkOrder (self-referencing)
  │     ├─── PrimaryUser (N:1 User)
  │     ├─── CompletedBy (N:1 User)
  │     ├─── AssignedTo (N:M Users)
  │     ├─── Teams (N:M)
  │     ├─── WorkOrderCategory (N:1)
  │     ├─── Tasks (1:N)
  │     ├─── Files (N:M)
  │     ├─── Parts (N:M)
  │     ├─── Customers (N:M)
  │     ├─── Labor (1:N)
  │     ├─── AdditionalCost (1:N)
  │     └─── Signature (1:1)
  │
  ├─── Parts (1:N)
  │     ├─── PartCategory (N:1)
  │     ├─── Vendor (N:1)
  │     ├─── Teams (N:M)
  │     ├─── Customers (N:M)
  │     └─── Files (N:M)
  │
  ├─── Requests (1:N)
  │     ├─── CreatedBy (N:1 User)
  │     ├─── Asset (N:1)
  │     ├─── Location (N:1)
  │     ├─── WorkOrder (N:1, when converted)
  │     └─── Files (N:M)
  │
  ├─── PreventiveMaintenances (1:N)
  │     ├─── Asset (N:1)
  │     ├─── Location (N:1)
  │     ├─── PrimaryUser (N:1 User)
  │     ├─── AssignedTo (N:M Users)
  │     ├─── Teams (N:M)
  │     ├─── Schedule (1:1)
  │     └─── Files (N:M)
  │
  ├─── PurchaseOrders (1:N)
  │     ├─── PurchaseOrderCategory (N:1)
  │     ├─── Vendor (N:1)
  │     ├─── ApprovedBy (N:1 User)
  │     ├─── Parts (N:M)
  │     └─── Files (N:M)
  │
  ├─── Vendors (1:N)
  ├─── Customers (1:N)
  ├─── Teams (1:N)
  │     └─── Users (N:M)
  │
  ├─── Meters (1:N)
  │     ├─── Asset (N:1)
  │     ├─── Location (N:1)
  │     ├─── MeterCategory (N:1)
  │     ├─── AssignedTo (N:M Users)
  │     └─── Readings (1:N)
  │
  └─── Categories (1:N for each type)
        ├─── WorkOrderCategory
        ├─── AssetCategory
        ├─── PartCategory
        ├─── CostCategory
        ├─── TimeCategory
        ├─── MeterCategory
        └─── PurchaseOrderCategory
```

## Core Tables

### Company & Settings

#### `company`
**Purpose**: Organization/tenant root entity

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | Primary key |
| name | VARCHAR | Company name |
| created_at | TIMESTAMP | Creation timestamp |

#### `company_settings`
**Purpose**: Company-specific configuration

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | Primary key |
| company_id | BIGINT | FK to company (1:1) |
| subscription_plan_id | BIGINT | FK to subscription_plan |
| general_preferences_id | BIGINT | FK to general_preferences |
| work_order_configuration_id | BIGINT | FK to work_order_configuration |
| work_order_request_configuration_id | BIGINT | FK to wo_request_configuration |

### Users & Authentication

#### `user`
**Purpose**: System users (multi-tenant)

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | Primary key |
| email | VARCHAR | Unique email (login) |
| password | VARCHAR | Hashed password |
| first_name | VARCHAR | First name |
| last_name | VARCHAR | Last name |
| phone | VARCHAR | Phone number |
| role_id | BIGINT | FK to role |
| company_settings_id | BIGINT | FK to company_settings (tenant) |
| enabled | BOOLEAN | Account enabled |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

**Indexes**:
- `email` (unique)
- `company_settings_id` (tenant isolation)

#### `role`
**Purpose**: User roles and permissions

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | Primary key |
| name | VARCHAR | Role name |
| code | VARCHAR | Role code (ADMIN, USER_CREATED) |
| role_type | VARCHAR | ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_USER |
| company_settings_id | BIGINT | FK to company_settings (null for super admin) |
| created_at | TIMESTAMP | Creation timestamp |

**Permissions**: Stored in separate tables
- `role_create_permissions` (N:M)
- `role_view_permissions` (N:M)
- `role_edit_other_permissions` (N:M)
- `role_delete_other_permissions` (N:M)
- `role_view_other_permissions` (N:M)

Permission types: `WORK_ORDER`, `ASSET`, `LOCATION`, `PART`, `REQUEST`, `PURCHASE_ORDER`, `METER`, `FILE`, `PEOPLE_TEAM`, `CATEGORY`, `VENDOR`, `CUSTOMER`, etc.

### Work Orders

#### `work_order`
**Purpose**: Maintenance work orders

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | Primary key |
| title | VARCHAR | Work order title |
| description | TEXT | Detailed description |
| priority | VARCHAR | LOW, MEDIUM, HIGH |
| status | VARCHAR | OPEN, IN_PROGRESS, ON_HOLD, COMPLETE |
| asset_id | BIGINT | FK to asset (nullable) |
| location_id | BIGINT | FK to location (nullable) |
| primary_user_id | BIGINT | FK to user (owner) |
| completed_by_id | BIGINT | FK to user (who completed) |
| category_id | BIGINT | FK to work_order_category |
| company_settings_id | BIGINT | FK to company_settings (tenant) |
| parent_work_order_id | BIGINT | FK to work_order (subtasks) |
| due_date | TIMESTAMP | Due date |
| completed_on | TIMESTAMP | Completion timestamp |
| estimated_duration | INT | Estimated minutes |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |
| created_by | BIGINT | FK to user (creator) |
| archived | BOOLEAN | Soft delete flag |

**Relationships**:
- `work_order_assigned_users` (N:M with user)
- `work_order_teams` (N:M with team)
- `work_order_files` (N:M with file)
- `work_order_parts` (N:M with part, includes quantity)
- `work_order_customers` (N:M with customer)

**Indexes**:
- `company_settings_id` (tenant)
- `status` (filtering)
- `priority` (filtering)
- `created_at` (sorting)
- `asset_id` (asset work orders)

#### `task`
**Purpose**: Work order checklist tasks

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | Primary key |
| label | VARCHAR | Task description |
| notes | TEXT | Task notes |
| task_order | INT | Display order |
| work_order_id | BIGINT | FK to work_order |
| task_base_id | BIGINT | FK to task_base (template) |

#### `labor`
**Purpose**: Time tracking for work orders

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | Primary key |
| work_order_id | BIGINT | FK to work_order |
| assignedTo_id | BIGINT | FK to user |
| duration | INT | Minutes worked |
| hourly_rate | DECIMAL | Cost per hour |
| started_at | TIMESTAMP | Start time |
| logged_at | TIMESTAMP | Log entry time |
| include_to_total_time | BOOLEAN | Count in total time |

#### `additional_cost`
**Purpose**: Additional costs for work orders

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | Primary key |
| work_order_id | BIGINT | FK to work_order |
| description | VARCHAR | Cost description |
| amount | DECIMAL | Cost amount |
| category_id | BIGINT | FK to cost_category |
| date | DATE | Cost date |

### Assets

#### `asset`
**Purpose**: Equipment and assets

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | Primary key |
| name | VARCHAR | Asset name |
| description | TEXT | Description |
| model | VARCHAR | Model number |
| serial_number | VARCHAR | Serial number |
| barcode | VARCHAR | Barcode/QR code |
| area | DECIMAL | Area (sq meters) |
| asset_category_id | BIGINT | FK to asset_category |
| location_id | BIGINT | FK to location |
| primary_user_id | BIGINT | FK to user (owner) |
| company_settings_id | BIGINT | FK to company_settings (tenant) |
| parent_asset_id | BIGINT | FK to asset (hierarchy) |
| vendor_id | BIGINT | FK to vendor |
| warranty_expires_on | DATE | Warranty expiration |
| acquisition_cost | DECIMAL | Purchase cost |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update |
| archived | BOOLEAN | Soft delete |

**Relationships**:
- `asset_assigned_users` (N:M with user)
- `asset_teams` (N:M with team)
- `asset_files` (N:M with file)
- `asset_parts` (N:M with part)
- `asset_customers` (N:M with customer)

**Indexes**:
- `company_settings_id` (tenant)
- `barcode` (QR code lookup)
- `location_id` (location assets)

#### `asset_downtime`
**Purpose**: Track asset downtime

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | Primary key |
| asset_id | BIGINT | FK to asset |
| starts_on | TIMESTAMP | Downtime start |
| ends_on | TIMESTAMP | Downtime end |
| duration | INT | Minutes down |

### Locations

#### `location`
**Purpose**: Physical locations/sites

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | Primary key |
| name | VARCHAR | Location name |
| address | VARCHAR | Physical address |
| latitude | DECIMAL | GPS latitude |
| longitude | DECIMAL | GPS longitude |
| company_settings_id | BIGINT | FK to company_settings (tenant) |
| parent_location_id | BIGINT | FK to location (hierarchy) |
| created_at | TIMESTAMP | Creation timestamp |

**Relationships**:
- `location_workers` (N:M with user)
- `location_teams` (N:M with team)
- `location_customers` (N:M with customer)

### Parts & Inventory

#### `part`
**Purpose**: Inventory parts and consumables

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | Primary key |
| name | VARCHAR | Part name |
| description | TEXT | Description |
| barcode | VARCHAR | Barcode/SKU |
| cost | DECIMAL | Unit cost |
| quantity | INT | Current quantity |
| min_quantity | INT | Minimum stock level |
| part_category_id | BIGINT | FK to part_category |
| vendor_id | BIGINT | FK to vendor |
| company_settings_id | BIGINT | FK to company_settings (tenant) |
| non_stock | BOOLEAN | Non-stock item flag |
| area | VARCHAR | Storage area |
| created_at | TIMESTAMP | Creation timestamp |

**Relationships**:
- `part_teams` (N:M with team)
- `part_customers` (N:M with customer)
- `part_files` (N:M with file)

**Indexes**:
- `company_settings_id` (tenant)
- `barcode` (inventory lookup)

#### `part_quantity`
**Purpose**: Part consumption tracking (work orders, assets)

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | Primary key |
| part_id | BIGINT | FK to part |
| quantity | INT | Quantity used |
| work_order_id | BIGINT | FK to work_order (nullable) |
| asset_id | BIGINT | FK to asset (nullable) |

### Requests

#### `request`
**Purpose**: Maintenance requests (user-submitted)

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | Primary key |
| title | VARCHAR | Request title |
| description | TEXT | Description |
| priority | VARCHAR | LOW, MEDIUM, HIGH |
| status | VARCHAR | PENDING, APPROVED, REJECTED, CANCELLED |
| created_by_id | BIGINT | FK to user |
| asset_id | BIGINT | FK to asset (nullable) |
| location_id | BIGINT | FK to location (nullable) |
| work_order_id | BIGINT | FK to work_order (when converted) |
| company_settings_id | BIGINT | FK to company_settings (tenant) |
| created_at | TIMESTAMP | Creation timestamp |
| cancelled_at | TIMESTAMP | Cancellation timestamp |

**Relationships**:
- `request_files` (N:M with file)

### Preventive Maintenance

#### `preventive_maintenance`
**Purpose**: Scheduled preventive maintenance tasks

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | Primary key |
| name | VARCHAR | PM name |
| description | TEXT | Description |
| asset_id | BIGINT | FK to asset (nullable) |
| location_id | BIGINT | FK to location (nullable) |
| primary_user_id | BIGINT | FK to user |
| schedule_id | BIGINT | FK to schedule (1:1) |
| category_id | BIGINT | FK to work_order_category |
| company_settings_id | BIGINT | FK to company_settings (tenant) |
| created_at | TIMESTAMP | Creation timestamp |

**Relationships**:
- `preventive_maintenance_assigned_users` (N:M with user)
- `preventive_maintenance_teams` (N:M with team)
- `preventive_maintenance_files` (N:M with file)

**Auto-generates work orders** based on schedule configuration.

#### `schedule`
**Purpose**: Scheduling configuration for PM

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | Primary key |
| frequency | INT | Frequency value |
| frequency_type | VARCHAR | DAYS, WEEKS, MONTHS, YEARS |
| starts_on | DATE | Schedule start date |
| ends_on | DATE | Schedule end date (nullable) |
| due_date | DATE | Next due date |

### Meters

#### `meter`
**Purpose**: Meter tracking (hours, miles, cycles, etc.)

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | Primary key |
| name | VARCHAR | Meter name |
| unit | VARCHAR | Unit of measurement |
| update_frequency | INT | Reading frequency |
| asset_id | BIGINT | FK to asset (nullable) |
| location_id | BIGINT | FK to location (nullable) |
| meter_category_id | BIGINT | FK to meter_category |
| company_settings_id | BIGINT | FK to company_settings (tenant) |
| created_at | TIMESTAMP | Creation timestamp |

**Relationships**:
- `meter_assigned_users` (N:M with user)

#### `reading`
**Purpose**: Meter readings

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | Primary key |
| meter_id | BIGINT | FK to meter |
| value | DECIMAL | Reading value |
| created_at | TIMESTAMP | Reading timestamp |

#### `work_order_meter_trigger`
**Purpose**: Auto-create work orders based on meter thresholds

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | Primary key |
| meter_id | BIGINT | FK to meter |
| trigger_condition | VARCHAR | Threshold condition |
| value | DECIMAL | Trigger value |
| work_order_template_id | BIGINT | FK to work order template |

### Purchase Orders

#### `purchase_order`
**Purpose**: Purchase orders for parts/services

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | Primary key |
| name | VARCHAR | PO name/number |
| description | TEXT | Description |
| status | VARCHAR | PENDING, APPROVED, REJECTED |
| category_id | BIGINT | FK to purchase_order_category |
| vendor_id | BIGINT | FK to vendor |
| approved_by_id | BIGINT | FK to user |
| company_settings_id | BIGINT | FK to company_settings (tenant) |
| shipping_due_date | DATE | Expected delivery |
| shipping_order_number | VARCHAR | Tracking number |
| shipping_company_name | VARCHAR | Shipping company |
| fee | DECIMAL | Shipping fee |
| additional_info | TEXT | Additional notes |
| created_at | TIMESTAMP | Creation timestamp |

**Relationships**:
- `purchase_order_parts` (N:M with part, includes quantity, cost)
- `purchase_order_files` (N:M with file)

### Files

#### `file`
**Purpose**: File metadata (actual files in MinIO/GCP)

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | Primary key |
| name | VARCHAR | Original filename |
| url | VARCHAR | Storage URL |
| type | VARCHAR | MIME type |
| company_settings_id | BIGINT | FK to company_settings (tenant) |
| created_at | TIMESTAMP | Upload timestamp |

**Relationships**: Many-to-many with:
- work_order
- asset
- location
- part
- request
- preventive_maintenance
- purchase_order

**Storage**: Files stored in MinIO or GCP, `url` points to storage location.

### AI Agent Tables

#### `agent_tool_invocation_log`
**Purpose**: Audit trail for AI agent tool invocations

| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL | Primary key |
| created_at | TIMESTAMP | Invocation timestamp |
| user_id | BIGINT | FK to user (who triggered) |
| company_id | BIGINT | FK to company_settings (tenant) |
| tool_name | VARCHAR(100) | Tool identifier |
| arguments_json | TEXT | Tool call arguments (JSON) |
| result_count | INTEGER | Number of results returned |
| status | VARCHAR(50) | success, pending, error |
| correlation_id | VARCHAR(100) | Session correlation ID |

**Indexes**:
- `idx_agent_tool_log_user` on `user_id`
- `idx_agent_tool_log_company` on `company_id`
- `idx_agent_tool_log_status` on `status`

**Purpose**: Track all AI agent tool invocations for auditing and analytics

#### `agent_draft_action`
**Purpose**: Pending actions requiring user confirmation

| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL | Primary key |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |
| user_id | BIGINT | FK to user (owner) |
| company_id | BIGINT | FK to company_settings (tenant) |
| agent_session_id | VARCHAR(100) | Session identifier |
| operation_type | VARCHAR(100) | Type of operation proposed |
| payload | TEXT | Action details (JSON) |
| status | VARCHAR(50) | pending, confirmed, declined |

**Indexes**:
- `idx_agent_draft_user` on `user_id`
- `idx_agent_draft_company` on `company_id`
- `idx_agent_draft_status` on `status`

**Purpose**: Store AI-proposed actions pending user confirmation

### Vendors & Customers

#### `vendor`
**Purpose**: Suppliers and service providers

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | Primary key |
| company_name | VARCHAR | Vendor company name |
| description | TEXT | Description |
| phone | VARCHAR | Phone |
| email | VARCHAR | Email |
| address | VARCHAR | Address |
| website | VARCHAR | Website URL |
| company_settings_id | BIGINT | FK to company_settings (tenant) |
| created_at | TIMESTAMP | Creation timestamp |

#### `customer`
**Purpose**: Customers (internal or external)

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | Primary key |
| name | VARCHAR | Customer name |
| description | TEXT | Description |
| phone | VARCHAR | Phone |
| email | VARCHAR | Email |
| address | VARCHAR | Address |
| website | VARCHAR | Website URL |
| company_settings_id | BIGINT | FK to company_settings (tenant) |
| created_at | TIMESTAMP | Creation timestamp |

### Teams

#### `team`
**Purpose**: User teams/departments

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | Primary key |
| name | VARCHAR | Team name |
| description | TEXT | Description |
| company_settings_id | BIGINT | FK to company_settings (tenant) |
| created_at | TIMESTAMP | Creation timestamp |

**Relationships**:
- `team_users` (N:M with user)

### Categories

Multiple category tables (all similar structure):
- `work_order_category`
- `asset_category`
- `part_category`
- `cost_category`
- `time_category`
- `meter_category`
- `purchase_order_category`

**Standard Category Table**:
| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | Primary key |
| name | VARCHAR | Category name |
| description | TEXT | Description |
| company_settings_id | BIGINT | FK to company_settings (tenant) |
| created_at | TIMESTAMP | Creation timestamp |

### Subscription & Billing

#### `subscription_plan`
**Purpose**: Subscription tier definitions (global)

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | Primary key |
| code | VARCHAR | Plan code (FREE, STARTER, PROFESSIONAL, BUSINESS) |
| name | VARCHAR | Display name |
| monthly_cost_per_user | DECIMAL | Monthly cost |
| yearly_cost_per_user | DECIMAL | Yearly cost |

**Features**: Stored in `subscription_plan_features` (N:M)
Features: PREVENTIVE_MAINTENANCE, CHECKLIST, FILE, METER, ADDITIONAL_COST, ADDITIONAL_TIME, REQUEST_CONFIGURATION, SIGNATURE, ANALYTICS, IMPORT_CSV

#### `subscription`
**Purpose**: Company subscriptions

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | Primary key |
| company_settings_id | BIGINT | FK to company_settings |
| subscription_plan_id | BIGINT | FK to subscription_plan |
| starts_on | DATE | Subscription start |
| ends_on | DATE | Subscription end |
| monthly_yearly | VARCHAR | MONTHLY or YEARLY |
| users_count | INT | Number of users |
| cancelled | BOOLEAN | Cancellation flag |
| created_at | TIMESTAMP | Creation timestamp |

## Auditing & History

### Hibernate Envers

**Audit Tables**: Automatically generated for audited entities
- Naming: `{table_name}_AUD`
- Example: `work_order_AUD`

**Audit Columns** (added to each audit table):
| Column | Type | Description |
|--------|------|-------------|
| REV | INT | Revision number |
| REVTYPE | TINYINT | 0=INSERT, 1=UPDATE, 2=DELETE |
| REVEND | INT | End revision (if modified again) |

**Revision Info Table**: `REVINFO`
| Column | Type | Description |
|--------|------|-------------|
| REV | INT | Revision ID (auto-increment) |
| REVTSTMP | BIGINT | Timestamp (milliseconds) |

**Accessing History**:
```java
AuditReader reader = AuditReaderFactory.get(entityManager);
List<Number> revisions = reader.getRevisions(WorkOrder.class, workOrderId);
WorkOrder historicalVersion = reader.find(WorkOrder.class, workOrderId, revisionNumber);
```

**Use Cases**:
- Work order change history
- Asset modification tracking
- Compliance auditing
- User action logs

## Indexes & Performance

### Recommended Indexes

**Tenant Isolation** (critical for multi-tenant queries):
```sql
CREATE INDEX idx_wo_company ON work_order(company_settings_id);
CREATE INDEX idx_asset_company ON asset(company_settings_id);
CREATE INDEX idx_location_company ON location(company_settings_id);
CREATE INDEX idx_part_company ON part(company_settings_id);
-- etc. for all tenant-scoped tables
```

**Common Queries**:
```sql
CREATE INDEX idx_wo_status ON work_order(status);
CREATE INDEX idx_wo_priority ON work_order(priority);
CREATE INDEX idx_wo_created_at ON work_order(created_at DESC);
CREATE INDEX idx_wo_asset ON work_order(asset_id);
CREATE INDEX idx_asset_location ON asset(location_id);
CREATE INDEX idx_asset_barcode ON asset(barcode);
CREATE INDEX idx_part_barcode ON part(barcode);
CREATE INDEX idx_user_email ON user(email);
```

**Composite Indexes** (for filtered queries):
```sql
CREATE INDEX idx_wo_company_status ON work_order(company_settings_id, status);
CREATE INDEX idx_wo_company_created ON work_order(company_settings_id, created_at DESC);
```

## Data Integrity

### Foreign Key Constraints

All foreign keys have `ON DELETE` constraints:
- **CASCADE**: Delete child records (e.g., work_order → tasks)
- **SET NULL**: Null the reference (e.g., work_order → asset)
- **RESTRICT**: Prevent deletion if referenced (e.g., company → users)

### Unique Constraints

- `user.email` - Unique globally
- `role.name` + `role.company_settings_id` - Unique per company
- `subscription_plan.code` - Unique globally

### Not Null Constraints

Critical fields enforced as NOT NULL:
- All entity IDs
- Tenant references (`company_settings_id`)
- Required business fields (e.g., `work_order.title`, `user.email`)

## Data Seeding

### Super Admin Account

**Created on startup** if not exists (see `ApiApplication.java`):
- Email: `superadmin@test.com`
- Password: `pls_change_me`
- Role: Super Administrator
- Company: Super Admin company

### Default Subscription Plans

Created on startup:
1. **FREE** - No additional features
2. **STARTER** - PM, Checklist, Files, Meters, Costs, Time
3. **PROFESSIONAL** - All STARTER + Requests, Signature, Analytics, Import
4. **BUSINESS** - All features

### Default Roles

Each new company gets default roles:
- Administrator (all permissions)
- Technician (work order permissions)
- Requester (request-only permissions)
- Viewer (read-only permissions)

**Permission Updates**: Automatically updated on startup if role definitions change.

### Demo Data

**Location**: `api/src/main/resources/demo-data/`

Sample data for testing and demonstration.

## Database Maintenance

### Backups

**Recommended Strategy**:
```bash
# Daily backups
pg_dump -U atlas_user atlas > backup_$(date +%Y%m%d).sql

# Restore
psql -U atlas_user atlas < backup_20250101.sql
```

**Docker Volume Backups**:
```bash
docker run --rm -v atlas_postgres_data:/data -v $(pwd):/backup ubuntu tar czf /backup/postgres_backup.tar.gz /data
```

### Vacuuming

PostgreSQL automatic vacuuming is enabled by default. For manual maintenance:
```sql
VACUUM ANALYZE;
VACUUM FULL;  -- Reclaim space (requires downtime)
```

### Monitoring

**Useful Queries**:

**Database Size**:
```sql
SELECT pg_size_pretty(pg_database_size('atlas'));
```

**Table Sizes**:
```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Active Connections**:
```sql
SELECT * FROM pg_stat_activity;
```

**Slow Queries**:
```sql
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

## Schema Evolution

### Adding New Features

1. **Create Liquibase Changeset**:
   ```xml
   <changeSet id="add-custom-field-support" author="developer">
     <createTable tableName="custom_field">
       <column name="id" type="BIGINT" autoIncrement="true">
         <constraints primaryKey="true"/>
       </column>
       <column name="name" type="VARCHAR(255)"/>
       <column name="field_type" type="VARCHAR(50)"/>
       <column name="company_settings_id" type="BIGINT">
         <constraints nullable="false" foreignKeyName="fk_customfield_company" references="company_settings(id)"/>
       </column>
     </createTable>
   </changeSet>
   ```

2. **Create JPA Entity**
3. **Run Migration**: Automatic on startup or `mvn liquibase:update`

### Modifying Existing Schema

**Best Practices**:
- Never modify existing changesets (immutable)
- Create new changeset for modifications
- Use `<rollback>` for reversible changes
- Test on staging before production

## Connection Pooling

**Configuration** (`application.yml`):
```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 10
      minimum-idle: 5
      connection-timeout: 30000
      idle-timeout: 600000
      max-lifetime: 1800000
```

**Tuning**:
- `maximum-pool-size`: Based on available connections and load
- Production: 10-20 connections typically sufficient
- Monitor connection usage via `pg_stat_activity`
