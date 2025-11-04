# Atlas AI Agent - Capabilities Definition

**Version:** 1.5
**Last Updated:** 2025-10-28
**Agent Name:** Atlas Maintenance Copilot
**Model:** GPT-4o-mini (configurable)

---

## Changelog

### Version 1.5 (2025-10-28) - Phase 1.5 Enhanced Filtering & Details

**New Features:**
- ✅ **Tool 7: view_work_order_details** - Comprehensive work order details with tasks, labor, files, and history
- ✅ **Enhanced view_work_orders filtering** - Added 14 new filter parameters:
  - Date range filters (dueDateBefore/After, createdAtBefore/After, updatedAtBefore/After)
  - Priority filters (support for multiple priorities: NONE, LOW, MEDIUM, HIGH)
  - Assignment filters (assignedToUserId, primaryUserId, teamId)
  - Classification filters (assetId, locationId, categoryId)
  - Sorting options (sortBy field, sortDirection ASC/DESC)

**Backend Improvements:**
- Created `AgentWorkOrderDetails` DTO with 9 nested summary classes
- Implemented 5 filter helper methods in `AgentToolService`
- Added `getWorkOrderDetails()` service method with full relationship mapping
- New controller endpoint: `POST /api/agent/tools/work-orders/{id}/details`

**Agent Proxy Enhancements:**
- Extended `viewWorkOrdersTool` with comprehensive Zod schema validation for all filters
- Added `viewWorkOrderDetailsTool` with RBAC enforcement and tenant isolation
- Updated agent instructions to guide proper tool usage
- Maintains full backward compatibility (all new parameters optional)

### Version 1.1 (2025-10-17)

**Bug Fixes:**
- ✅ Fixed draft payload extraction to handle nested `data` object structure
- ✅ Fixed work order completion to properly handle status transitions (OPEN → IN_PROGRESS → COMPLETE)
- ✅ Enhanced `extractWorkOrderIdentifier` method to support both root-level and nested payload formats

**Improvements:**
- Automatic status transition handling for work order completion
- Added fallback identifier checks for multiple payload structures
- Improved error handling for status transition validation

---

## Table of Contents

1. [Overview](#overview)
2. [Current Capabilities](#current-capabilities)
3. [Tool Definitions](#tool-definitions)
4. [Security & Access Control](#security--access-control)
5. [Conversation Management](#conversation-management)
6. [Expansion Roadmap](#expansion-roadmap)

---

## Overview

The Atlas Maintenance Copilot is an AI-powered assistant that helps CMMS users interact with their maintenance data through natural language conversations. It provides intelligent access to work orders, assets, and can propose actions for user approval.

### Core Characteristics

**Identity & Personality:**
- Name: Atlas Assistant
- Role: Maintenance copilot for Atlas CMMS
- Approach: Tool-first (always uses real data, never guesses)
- Communication: Clear, actionable, references specific identifiers

**Behavioral Guidelines:**
1. Always greet users by name in first response
2. Use available tools to fetch real data instead of guessing
3. Summarize tool outputs clearly with work order/asset identifiers
4. Suggest helpful next steps when appropriate
5. For completion requests, verify correct record before creating draft
6. Explain missing information and provide actionable guidance

### Technical Foundation

**Runtime Environment:**
- OpenAI Agents SDK v0.1.9
- Node.js proxy service (port 4005)
- Multi-tenant PostgreSQL database
- JWT-based authentication

**Performance Parameters:**
- Max results per tool call: 10 (configurable up to 50)
- Conversation memory TTL: 15 minutes
- Tool execution timeout: 30 seconds
- Concurrent conversations supported: 100+

---

## Current Capabilities

### 1. Work Order Management

**What the agent can do:**
- Search and retrieve work orders by keyword or status
- Filter by multiple status values (OPEN, IN_PROGRESS, ON_HOLD)
- **NEW (v1.5):** Filter by date ranges (due date, created date, updated date)
- **NEW (v1.5):** Filter by priority levels (NONE, LOW, MEDIUM, HIGH)
- **NEW (v1.5):** Filter by assignments (assigned users, primary user, team)
- **NEW (v1.5):** Filter by classifications (asset, location, category)
- **NEW (v1.5):** Sort results by any field with ASC/DESC direction
- **NEW (v1.5):** View comprehensive work order details with tasks, labor, files, and history
- View work order summaries with key details
- Identify work orders for completion
- Create completion drafts for user approval

**Example interactions:**
```
User: "Show me open work orders"
Agent: "Found 3 work orders:
- WO-12345: Replace pump bearings (Priority HIGH; Status OPEN; Asset Pump-101)
- WO-12346: Oil change (Priority MEDIUM; Status OPEN; Asset Compressor-5)
- WO-12347: Inspect valve (Priority LOW; Status OPEN; Asset Valve-22)"

User: "Show HIGH priority work orders due this week for asset Pump-101"
Agent: [Uses enhanced filters: priorities=["HIGH"], assetId=101, dueDateAfter=<today>, dueDateBefore=<week_end>]
"Found 2 HIGH priority work orders for Pump-101 due this week..."

User: "Show me details for work order 12345"
Agent: [Uses view_work_order_details tool]
"WO-12345: Replace pump bearings
- Status: OPEN | Priority: HIGH | Due: Oct 25
- Asset: Pump-101 (Location: Building A - Floor 2)
- Assigned: John Doe (Team: Maintenance)
- Tasks: 3 tasks (2 pending, 1 complete)
- Labor: 4.5 hours logged
- Files: 2 attachments (photo.jpg, manual.pdf)
- Recent Activity: Created Oct 15, Updated Oct 20..."

User: "Complete work order 12345"
Agent: "I've prepared a completion draft for WO-12345 (Replace pump bearings).
Please review and confirm this action in the pending drafts section."
```

**Limitations:**
- Cannot modify work order details directly (except completion via draft)
- Cannot create new work orders

**Recent Enhancements (v1.5):**
- ✅ Comprehensive filtering with 14 new parameters
- ✅ Detailed work order view with all relationships
- ✅ Full backward compatibility maintained

**Previous Fixes (v1.1):**
- ✅ Work order completion now properly handles status transitions
- ✅ Automatic OPEN → IN_PROGRESS → COMPLETE workflow
- ✅ Fixed payload extraction for nested draft structures

### 2. Asset Information

**What the agent can do:**
- Search assets by name or custom ID
- View asset summaries with status and location
- Retrieve asset details for maintenance planning

**Example interactions:**
```
User: "Show me details about Pump-101"
Agent: "- Pump-101 (Status OPERATIONAL; Location Building A - Floor 2; ID P-101)"

User: "Find all compressors"
Agent: "Found 5 assets:
- Compressor-5 (Status OPERATIONAL; Location Building B)
- Compressor-12 (Status DOWN; Location Building A)
..."
```

**Limitations:**
- No status-based filtering (e.g., "show me all DOWN assets")
- Cannot view asset hierarchy or relationships
- No access to linked parts or meters
- No maintenance history or downtime analytics

### 3. User Context Awareness

**What the agent can do:**
- Access authenticated user's profile
- Understand user's role and permissions
- Filter results by user's company (tenant isolation)
- Personalize responses with user's name

**Example:**
```
Agent has access to:
- User ID: 123
- Full Name: "John Doe"
- Role: "TECHNICIAN"
- Company ID: 456
```

### 4. Draft Action System

**What the agent can do:**
- Create action proposals that require user approval
- Store drafts for review in the UI
- Track draft status (pending, confirmed, declined)
- Handle complex workflows automatically (e.g., multi-step status transitions)

**Current draft types:**
- `complete_work_order`: Propose work order completion with automatic status transition handling

**Example workflow:**
```
1. User: "Complete work order 12345"
2. Agent identifies correct work order
3. Agent creates draft with operation details
4. Draft appears in UI for user confirmation
5. User reviews and confirms/declines
6. Backend executes confirmed action:
   - If work order is OPEN: Automatically transitions to IN_PROGRESS first
   - Then completes the work order (sets status to COMPLETE)
   - Records completion timestamp and user
   - Notifies assigned users
```

**Status Transition Rules:**
The system enforces workflow validation to ensure proper work order lifecycle:
- ✅ **OPEN → IN_PROGRESS → COMPLETE** (Supported - automatic)
- ✅ **IN_PROGRESS → COMPLETE** (Direct completion)
- ✅ **ON_HOLD → IN_PROGRESS → COMPLETE** (Resume then complete)
- ❌ **OPEN → COMPLETE** (Blocked - work must be started first)

**Smart Transition Handling:**
When confirming a completion draft, the backend automatically:
1. Checks current work order status
2. If OPEN: Transitions to IN_PROGRESS with note "Started via agent"
3. Transitions to COMPLETE with note "Completed via agent"
4. Records completion metadata (timestamp, user)
5. Creates history entries for each transition

---

## Tool Definitions

**Tool Invocation Logging:**
All tool executions are logged to the `agent_tool_invocation_log` table with:
- Tool name
- Input arguments (serialized)
- Result count
- Execution status (queued → success/error)
- Session ID
- Timestamp

**Error Handling:**
- `ToolCallError`: Invalid parameters or validation failures
- `TenantContextError`: Missing or invalid company context
- `AuthenticationError`: Missing or invalid JWT token
- `RbacError`: Insufficient permissions for tool access
- `CustomException`: Business logic violations (work order not found, invalid status transition, etc.)

**Performance Characteristics:**
- Tool execution timeout: 30 seconds (configurable)
- Result limit: 1-50 items (default 5)
- Search performance: Optimized with database indexes on company_id, status, updatedAt
- Caching: None (real-time data required)

---

### Tool 1: view_work_orders

**Purpose:** Retrieve work orders for the current tenant with comprehensive filtering and sorting

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| limit | integer | No | 5 | Number of results (1-50) |
| statuses | string[] or string | No | ["OPEN", "IN_PROGRESS", "ON_HOLD"] | Status filters (accepts array or single string) |
| search | string | No | "" | Keyword search (title, description, customId) |
| **NEW (v1.5):** dueDateBefore | string (ISO 8601) | No | null | Filter work orders due before this date |
| **NEW (v1.5):** dueDateAfter | string (ISO 8601) | No | null | Filter work orders due after this date |
| **NEW (v1.5):** createdAtBefore | string (ISO 8601) | No | null | Filter work orders created before this date |
| **NEW (v1.5):** createdAtAfter | string (ISO 8601) | No | null | Filter work orders created after this date |
| **NEW (v1.5):** updatedAtBefore | string (ISO 8601) | No | null | Filter work orders updated before this date |
| **NEW (v1.5):** updatedAtAfter | string (ISO 8601) | No | null | Filter work orders updated after this date |
| **NEW (v1.5):** priorities | string[] or enum | No | null | Priority filters: NONE, LOW, MEDIUM, HIGH |
| **NEW (v1.5):** assignedToUserId | integer | No | null | Filter by assigned user ID |
| **NEW (v1.5):** primaryUserId | integer | No | null | Filter by primary user ID |
| **NEW (v1.5):** teamId | integer | No | null | Filter by team ID |
| **NEW (v1.5):** assetId | integer | No | null | Filter by asset ID |
| **NEW (v1.5):** locationId | integer | No | null | Filter by location ID |
| **NEW (v1.5):** categoryId | integer | No | null | Filter by category ID |
| **NEW (v1.5):** sortBy | string | No | "updatedAt" | Field to sort by |
| **NEW (v1.5):** sortDirection | enum | No | "DESC" | Sort direction: ASC or DESC |

**Output Fields:**
- `id`: Work order database ID
- `code`: Work order code/custom ID (fallback to id if customId not set)
- `title`: Work order title
- `priority`: Priority level (HIGH, MEDIUM, LOW, NONE)
- `status`: Current status (OPEN, IN_PROGRESS, ON_HOLD, COMPLETE)
- `dueDate`: Due date (ISO 8601 format if set)
- `asset`: Associated asset name (if assigned)
- `location`: Location name (if assigned)
- `updatedAt`: Last update timestamp

**Authorization:**
- Allowed roles: ADMIN, MANAGER, TECHNICIAN, SUPERVISOR
- Tenant filtering: Automatic by company ID (strict isolation)
- Archived filter: Excludes archived work orders

**API Endpoint:** `POST /api/agent/tools/work-orders/search`

**Implementation Details:**
- Backend service: `AgentToolService.searchWorkOrders()` (AgentToolService.java:91-114)
- Search fields: title, description, customId (case-insensitive partial match)
- Sorting: Descending by `updatedAt` timestamp
- Pagination: Page 0, configurable size (1-50)

**Example requests:**
```javascript
// Basic search - returns 5 most recently updated work orders
{ "limit": 5 }

// Status filtering - multiple statuses
{ "limit": 10, "statuses": ["OPEN", "IN_PROGRESS"] }

// Single status filter (string format)
{ "limit": 5, "statuses": "OPEN" }

// Keyword search - searches title, description, and customId
{ "limit": 5, "search": "pump", "statuses": ["OPEN"] }

// NEW (v1.5): Date range filtering - work orders due this week
{
  "limit": 10,
  "dueDateAfter": "2025-10-28T00:00:00Z",
  "dueDateBefore": "2025-11-04T23:59:59Z"
}

// NEW (v1.5): Priority filtering - HIGH and MEDIUM priority only
{
  "limit": 10,
  "priorities": ["HIGH", "MEDIUM"],
  "statuses": ["OPEN", "IN_PROGRESS"]
}

// NEW (v1.5): Assignment filtering - work orders for specific user
{
  "limit": 20,
  "assignedToUserId": 123,
  "statuses": ["IN_PROGRESS"]
}

// NEW (v1.5): Asset filtering - work orders for specific asset
{
  "limit": 10,
  "assetId": 456,
  "statuses": ["OPEN"]
}

// NEW (v1.5): Combined filters - HIGH priority, asset, due soon
{
  "limit": 5,
  "priorities": ["HIGH"],
  "assetId": 456,
  "dueDateAfter": "2025-10-28T00:00:00Z",
  "dueDateBefore": "2025-10-31T23:59:59Z"
}

// NEW (v1.5): Sorting - oldest work orders first
{
  "limit": 10,
  "sortBy": "createdAt",
  "sortDirection": "ASC"
}

// Maximum results (50 limit enforced)
{ "limit": 50, "search": "bearing" }
```

**Example response:**
```json
{
  "type": "work_orders",
  "total": 3,
  "items": [
    {
      "id": 12345,
      "code": "WO-12345",
      "title": "Replace pump bearings",
      "priority": "HIGH",
      "status": "OPEN",
      "dueDate": "2025-10-20T00:00:00Z",
      "asset": "Pump-101",
      "location": "Building A - Floor 2",
      "updatedAt": "2025-10-15T14:30:00Z"
    }
  ]
}
```

---

### Tool 2: view_assets

**Purpose:** Retrieve assets for the current tenant with advanced filtering

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| limit | integer | No | 5 | Number of results (1-50) |
| search | string | No | "" | Keyword search (name, customId) |
| statuses | string[] | No | [] | Asset status filters (OPTIONAL) |

**Output Fields:**
- `id`: Asset database ID
- `name`: Asset name
- `status`: Asset status (OPERATIONAL, DOWN, STANDBY, MODERNIZATION, INSPECTION_SCHEDULED, COMMISSIONING, EMERGENCY_SHUTDOWN)
- `location`: Location name (if assigned)
- `customId`: Custom identifier (if set)
- `category`: Asset category name (if assigned)

**Authorization:**
- Allowed roles: ADMIN, MANAGER, TECHNICIAN, SUPERVISOR
- Tenant filtering: Automatic by company ID (strict isolation)
- Archived filter: Excludes archived assets

**API Endpoint:** `POST /api/agent/tools/assets/search`

**Implementation Details:**
- Backend service: `AgentToolService.searchAssets()` (AgentToolService.java:116-139)
- Search fields: name, customId (case-insensitive partial match)
- Sorting: Descending by `updatedAt` timestamp
- Pagination: Page 0, configurable size (1-50)
- Status filtering: Optional, supports multiple status values

**Example requests:**
```javascript
// Basic search - returns 5 most recently updated assets
{ "limit": 5 }

// Keyword search - searches name and customId
{ "limit": 10, "search": "pump" }

// Status filtering (optional feature)
{ "limit": 10, "statuses": ["OPERATIONAL", "DOWN"] }

// Combined search and status filter
{ "limit": 20, "search": "compressor", "statuses": ["OPERATIONAL"] }
```

**Example response:**
```json
{
  "type": "assets",
  "total": 2,
  "items": [
    {
      "id": 789,
      "name": "Pump-101",
      "status": "OPERATIONAL",
      "location": "Building A - Floor 2",
      "customId": "P-101",
      "category": "Hydraulic Equipment"
    }
  ]
}
```

**Asset Status Values:**
- `OPERATIONAL`: Asset is functioning normally
- `DOWN`: Asset is not operational (requires maintenance)
- `STANDBY`: Asset is ready but not in active use
- `MODERNIZATION`: Asset is being upgraded
- `INSPECTION_SCHEDULED`: Asset has pending inspection
- `COMMISSIONING`: Asset is being commissioned
- `EMERGENCY_SHUTDOWN`: Asset is in emergency shutdown state

---

### Tool 3: get_user_context

**Purpose:** Return authenticated user's profile for grounding responses

**Parameters:** None

**Output Fields:**
- `id`: User ID
- `fullName`: User's full name
- `role`: User role (ADMIN, MANAGER, TECHNICIAN, SUPERVISOR)
- `companyId`: Company/tenant ID

**Authorization:**
- Any authenticated user with valid JWT token

**Example response:**
```json
{
  "id": 123,
  "fullName": "John Doe",
  "role": "TECHNICIAN",
  "companyId": 456
}
```

---

### Tool 4: prepare_work_order_completion_draft

**Purpose:** Create completion proposal for work order requiring user confirmation

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| workOrderId | string/number | Yes | Work order ID or code to complete |
| summary | string | No | Optional custom summary (auto-generated if omitted) |

**Draft Structure:**
```json
{
  "agentSessionId": "uuid-v4",
  "operationType": "complete_work_order",
  "payload": {
    "workOrderId": 12345,
    "status": "COMPLETED",
    "completedBy": 123,
    "completedByName": "John Doe"
  },
  "summary": "Complete work order WO-12345"
}
```

**Payload Structure Notes:**
- `workOrderId` accepts both numeric IDs (e.g., 12345) and string custom codes (e.g., "WO-12345")
- Agent automatically matches work order from previous `view_work_orders` results
- Fallback behavior: Creates draft with provided ID if no previous results found
- Backend service extracts work order identifier during draft confirmation (AgentDraftService.java)

**Authorization:**
- Allowed roles: ADMIN, MANAGER, TECHNICIAN, SUPERVISOR
- Tenant filtering: Automatic by company ID (strict isolation)
- Permission check: User must have edit rights on work order

**Workflow:**
1. **Agent Tool Execution** (agents-proxy/src/index.js:867-909):
   - Agent identifies work order from `toolResults.view_work_orders` cache
   - Matches by id, code, or customId
   - Creates draft object with completion metadata
   - Adds draft to run context for transmission to backend

2. **Draft Creation** (Backend):
   - Draft stored in `agent_draft_action` table with status "pending"
   - Payload includes work order identifier, completion metadata, and user context

3. **User Review** (Frontend UI):
   - User sees pending draft in notifications or dedicated review section
   - Displays work order details and proposed action

4. **Draft Confirmation Execution** (AgentDraftService.java):
   - Extracts work order identifier using `extractWorkOrderIdentifier()`
   - Resolves work order by numeric ID or custom code
   - Checks current status and applies automatic transition logic

5. **Automatic Status Transition** (AgentToolService.java:273-309):
   - If status is OPEN: First transitions to IN_PROGRESS (note: "Started via agent")
   - Then transitions to COMPLETE (note: "Completed via agent")
   - Records completion timestamp, completedBy user, and completedOn date
   - Creates work order history entries for each transition
   - Sends notifications to all assigned users (excluding actor)

**Status Transition Handling:**
The backend automatically handles the required workflow transitions based on current status:

```
OPEN work order:
  Step 1: OPEN → IN_PROGRESS (automatic, with note "Started via agent")
  Step 2: IN_PROGRESS → COMPLETE (completion with note "Completed via agent")

IN_PROGRESS work order:
  Step 1: IN_PROGRESS → COMPLETE (direct completion)

ON_HOLD work order:
  Invalid: Work order must be resumed first (transition rejected)
```

**Validation Rules:**
- Work order must exist and belong to user's company (tenant isolation)
- Work order cannot be archived
- User must have edit permissions on work order
- All required tasks must be completed before closing
- Signature required if `requireSignature` flag is set
- Labor timers automatically stopped when completing

**Completion Side Effects:**
- Labor timers: All running labor timers for the work order are stopped
- History tracking: Two history entries created (start + complete for OPEN status)
- Notifications: Sent to all assigned users except the completing user
- Completion metadata: `completedBy` and `completedOn` fields populated
- First time to react: Set if not already recorded

This ensures compliance with business rules that require work orders to be started before completion.

---

### Tool 5: create_work_order_immediately

**Purpose:** Create a work order immediately without user confirmation (bypass draft system)

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| title | string | Yes | - | Work order title (required) |
| description | string | No | null | Work order description |
| priority | enum | No | LOW | Priority: NONE, LOW, MEDIUM, HIGH |
| dueDate | string | No | null | Due date (ISO 8601 format) |
| estimatedStartDate | string | No | null | Estimated start date (ISO 8601) |
| estimatedDurationHours | number | No | null | Estimated duration in hours |
| requireSignature | boolean | No | false | Require signature for completion |
| locationId | integer | No | null | Location ID (must belong to company) |
| assetId | integer | No | null | Asset ID (must belong to company) |
| teamId | integer | No | null | Team ID (must belong to company) |
| primaryUserId | integer | No | null | Primary user ID (must belong to company) |
| assignedUserIds | integer[] | No | [] | Assigned user IDs (must belong to company) |
| categoryId | integer | No | null | Category ID (must belong to company) |

**Authorization:**
- Allowed roles: ADMIN, MANAGER, TECHNICIAN, SUPERVISOR
- Tenant filtering: Automatic by company ID (strict isolation)
- Foreign key validation: All referenced entities validated against company ID

**API Endpoint:** `POST /api/agent/tools/work-orders/create`

**Implementation Details:**
- Backend service: `AgentToolService.createWorkOrder()` (AgentToolService.java:141-249)
- Tool definition: agents-proxy/src/index.js:911-983
- Date parsing: Supports ISO 8601 instant, offset datetime, and local date formats
- Default values: status=OPEN, priority=LOW, createdBy=current user

**When to Use:**
- User explicitly requests immediate creation: "create now", "create immediately"
- Urgent workflows requiring no approval delay
- Automated workflows or integrations

**When NOT to Use:**
- Normal creation workflows → use `prepare_work_order_creation_draft` instead
- This allows user review and editing before final creation

**Example requests:**
```javascript
// Minimal creation (title only)
{ "title": "Replace HVAC filter" }

// Full creation with all fields
{
  "title": "Emergency pump repair",
  "description": "Pump P-101 is leaking hydraulic fluid",
  "priority": "HIGH",
  "dueDate": "2025-10-30T00:00:00Z",
  "estimatedStartDate": "2025-10-28T08:00:00Z",
  "estimatedDurationHours": 4.0,
  "requireSignature": true,
  "locationId": 5,
  "assetId": 789,
  "teamId": 3,
  "primaryUserId": 42,
  "assignedUserIds": [42, 55, 67],
  "categoryId": 12
}
```

**Example response:**
```json
{
  "success": true,
  "workOrder": {
    "id": 12350,
    "code": "WO-12350",
    "title": "Emergency pump repair",
    "status": "OPEN",
    "priority": "HIGH",
    "createdAt": "2025-10-27T10:30:00Z"
  },
  "message": "Work order created successfully"
}
```

**Validation Rules:**
- Title is required and cannot be empty
- Priority defaults to LOW if not specified
- All foreign keys validated against company ID (tenant isolation)
- Date parsing supports multiple ISO 8601 formats with fallback
- Status always set to OPEN on creation

---

### Tool 6: update_work_order

**Purpose:** Update an existing work order's details or assignments

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| workOrderId | string/number | Yes | Work order ID or custom code to update |
| title | string | No | Updated work order title |
| description | string | No | Updated description (null to clear) |
| priority | enum | No | Updated priority: NONE, LOW, MEDIUM, HIGH |
| dueDate | Date | No | Updated due date (null to clear) |
| estimatedStartDate | Date | No | Updated estimated start date (null to clear) |
| estimatedDurationHours | number | No | Updated estimated duration in hours |
| requireSignature | boolean | No | Updated signature requirement flag |
| locationId | integer | No | Updated location ID (null to unassign) |
| assetId | integer | No | Updated asset ID (null to unassign) |
| teamId | integer | No | Updated team ID (null to unassign) |
| primaryUserId | integer | No | Updated primary user ID (null to unassign) |
| assignedUserIds | integer[] | No | Updated assigned user IDs (empty array to clear) |
| categoryId | integer | No | Updated category ID (null to unassign) |

**Authorization:**
- Allowed roles: ADMIN, MANAGER, TECHNICIAN, SUPERVISOR
- Tenant filtering: Automatic by company ID (strict isolation)
- Permission check: User must have edit rights on work order
- Foreign key validation: All referenced entities validated against company ID

**API Endpoint:** `POST /api/agent/tools/work-orders/{workOrderId}/update`

**Implementation Details:**
- Backend service: `AgentToolService.updateWorkOrder()` (AgentToolService.java:785-991)
- Tool definition: agents-proxy/src/index.js:985-1056
- Field preservation: Only specified fields are modified
- Optional wrapper pattern: Distinguishes between null (clear value) and undefined (don't touch)
- History tracking: Automatic history entry with list of updated fields

**When to Use:**
- Modify work order details: "change the title", "update priority"
- Assign/reassign users: "assign to John", "add Mary to the team"
- Update scheduling: "change due date to Friday", "extend duration"
- Modify associations: "link to asset Pump-101", "move to Building B"

**Field Update Behavior:**
- **Explicit null**: Clears the field value (sets to null in database)
- **Omitted field**: Leaves field unchanged (preserves current value)
- **New value**: Replaces current value with new value

**Example requests:**
```javascript
// Update title only
{
  "workOrderId": "WO-12345",
  "title": "Replace pump bearings and seals"
}

// Update priority and due date
{
  "workOrderId": 12345,
  "priority": "HIGH",
  "dueDate": "2025-10-30T00:00:00Z"
}

// Assign to team and users
{
  "workOrderId": "WO-12345",
  "teamId": 5,
  "primaryUserId": 42,
  "assignedUserIds": [42, 55, 67]
}

// Clear asset assignment (set to null)
{
  "workOrderId": 12345,
  "assetId": null
}

// Comprehensive update
{
  "workOrderId": "WO-12345",
  "title": "Emergency pump repair - URGENT",
  "description": "Pump P-101 leaking hydraulic fluid. Requires immediate attention.",
  "priority": "HIGH",
  "dueDate": "2025-10-28T17:00:00Z",
  "requireSignature": true,
  "assetId": 789,
  "locationId": 5,
  "primaryUserId": 42
}
```

**Example response:**
```json
{
  "success": true,
  "workOrder": {
    "id": 12345,
    "code": "WO-12345",
    "title": "Emergency pump repair - URGENT",
    "description": "Pump P-101 leaking hydraulic fluid. Requires immediate attention.",
    "status": "OPEN",
    "priority": "HIGH",
    "dueDate": "2025-10-28T17:00:00Z",
    "primaryUserName": "John Smith",
    "assignedUserNames": ["John Smith"],
    "updatedAt": "2025-10-27T10:45:00Z"
  },
  "message": "Work order updated successfully",
  "updatedFields": ["title", "description", "priority", "dueDate", "requireSignature", "asset", "location", "primaryUser"]
}
```

**Validation Rules:**
- Work order must exist and belong to user's company (tenant isolation)
- Work order cannot be archived (archived work orders are read-only)
- User must have edit permissions on work order
- Title cannot be empty if updating title field
- All foreign keys validated against company ID (prevents cross-tenant references)
- Foreign entities must exist (Location, Asset, Team, User, Category)

**Side Effects:**
- History entry created: "Agent updated: {list of updated fields}"
- Updated fields tracked and returned in response
- `updatedAt` timestamp automatically updated
- No notifications sent (silent update)

**Use Cases:**
1. **Field corrections**: Fix typos, update descriptions, clarify requirements
2. **Priority escalation**: Increase priority when issues become urgent
3. **Resource assignment**: Assign technicians, teams, or reassign work
4. **Scheduling adjustments**: Update due dates, estimated start dates, duration
5. **Association changes**: Link to different assets, locations, or categories

---

### Tool 7: view_work_order_details (NEW in v1.5)

**Purpose:** Retrieve comprehensive details for a specific work order including tasks, labor, files, history, and all related entities

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| workOrderId | string/number | Yes | Work order ID or custom code to retrieve details for |

**Output Structure:**
```typescript
{
  id: number;
  code: string;
  title: string;
  description?: string;
  priority: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  status: "OPEN" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETE";
  dueDate?: string;       // ISO 8601
  createdAt: string;      // ISO 8601
  updatedAt: string;      // ISO 8601
  estimatedStartDate?: string;
  estimatedDurationHours?: number;
  requireSignature: boolean;

  // Related entities (summary objects)
  asset?: {
    id: number;
    name: string;
    customId?: string;
    status?: string;
    location?: { id: number; name: string };
  };

  location?: { id: number; name: string };

  primaryUser?: {
    id: number;
    fullName: string;
    email: string;
  };

  assignedUsers: Array<{
    id: number;
    fullName: string;
    email: string;
  }>;

  team?: { id: number; name: string };

  category?: { id: number; name: string };

  // Detailed work breakdown
  tasks: Array<{
    id: number;
    label: string;
    notes?: string;
    completed: boolean;
    order: number;
  }>;

  labor: Array<{
    id: number;
    hours: number;
    hourlyRate?: number;
    totalCost?: number;
    startedAt?: string;
    stoppedAt?: string;
    userFullName?: string;
  }>;

  // Activity history
  history: Array<{
    id: number;
    name: string;        // Action description
    timestamp: string;   // ISO 8601
    userFullName?: string;
  }>;

  // Attachments
  files: Array<{
    id: number;
    name: string;
    url: string;
  }>;
}
```

**Authorization:**
- Allowed roles: ADMIN, MANAGER, TECHNICIAN, SUPERVISOR
- Tenant filtering: Automatic by company ID (strict isolation)
- Permission check: User must have view rights on work order

**API Endpoint:** `POST /api/agent/tools/work-orders/{workOrderId}/details`

**Implementation Details:**
- Backend service: `AgentToolService.getWorkOrderDetails()` (AgentToolService.java:142-155)
- Backend mapper: `AgentToolService.toWorkOrderDetails()` (AgentToolService.java:678-708)
- Tool definition: agents-proxy/src/index.js:1058-1119
- Eager loading: All relationships loaded with JOIN FETCH to prevent N+1 queries
- DTO mapping: Comprehensive `AgentWorkOrderDetails` DTO with 9 nested summary classes

**When to Use:**
- User asks for "details", "full information", or "everything" about a work order
- User wants to see tasks, labor entries, or work breakdown
- User needs to review files or attachments
- User wants to see activity history or timeline
- Before taking action on a work order (completion, assignment, etc.)

**Example requests:**
```javascript
// By work order ID
{ "workOrderId": 12345 }

// By custom code
{ "workOrderId": "WO-12345" }
```

**Example response:**
```json
{
  "type": "work_order_details",
  "details": {
    "id": 12345,
    "code": "WO-12345",
    "title": "Replace pump bearings",
    "description": "Pump P-101 bearings showing signs of wear. Replace with manufacturer-specified bearings.",
    "priority": "HIGH",
    "status": "IN_PROGRESS",
    "dueDate": "2025-10-30T00:00:00Z",
    "createdAt": "2025-10-15T08:30:00Z",
    "updatedAt": "2025-10-27T14:20:00Z",
    "estimatedDurationHours": 4.0,
    "requireSignature": true,
    "asset": {
      "id": 789,
      "name": "Pump-101",
      "customId": "P-101",
      "status": "DOWN",
      "location": {
        "id": 5,
        "name": "Building A - Floor 2"
      }
    },
    "location": {
      "id": 5,
      "name": "Building A - Floor 2"
    },
    "primaryUser": {
      "id": 42,
      "fullName": "John Smith",
      "email": "john.smith@company.com"
    },
    "assignedUsers": [
      {
        "id": 42,
        "fullName": "John Smith",
        "email": "john.smith@company.com"
      },
      {
        "id": 55,
        "fullName": "Mary Johnson",
        "email": "mary.johnson@company.com"
      }
    ],
    "team": {
      "id": 3,
      "name": "Maintenance Team Alpha"
    },
    "category": {
      "id": 12,
      "name": "Mechanical Repair"
    },
    "tasks": [
      {
        "id": 1001,
        "label": "Drain pump system",
        "notes": "Follow lockout/tagout procedure",
        "completed": true,
        "order": 1
      },
      {
        "id": 1002,
        "label": "Remove old bearings",
        "notes": null,
        "completed": true,
        "order": 2
      },
      {
        "id": 1003,
        "label": "Install new bearings",
        "notes": "Part #: BRG-P101-2025",
        "completed": false,
        "order": 3
      },
      {
        "id": 1004,
        "label": "Test pump operation",
        "notes": null,
        "completed": false,
        "order": 4
      }
    ],
    "labor": [
      {
        "id": 501,
        "hours": 2.5,
        "hourlyRate": 45.00,
        "totalCost": 112.50,
        "startedAt": "2025-10-27T08:00:00Z",
        "stoppedAt": "2025-10-27T10:30:00Z",
        "userFullName": "John Smith"
      },
      {
        "id": 502,
        "hours": 1.5,
        "hourlyRate": 45.00,
        "totalCost": 67.50,
        "startedAt": "2025-10-27T13:00:00Z",
        "stoppedAt": "2025-10-27T14:30:00Z",
        "userFullName": "John Smith"
      }
    ],
    "history": [
      {
        "id": 2001,
        "name": "Work order created",
        "timestamp": "2025-10-15T08:30:00Z",
        "userFullName": "System"
      },
      {
        "id": 2002,
        "name": "Assigned to John Smith",
        "timestamp": "2025-10-15T09:15:00Z",
        "userFullName": "Manager User"
      },
      {
        "id": 2003,
        "name": "Status changed to IN_PROGRESS",
        "timestamp": "2025-10-27T08:00:00Z",
        "userFullName": "John Smith"
      }
    ],
    "files": [
      {
        "id": 301,
        "name": "pump-photo-before.jpg",
        "url": "https://storage.example.com/files/301/pump-photo-before.jpg"
      },
      {
        "id": 302,
        "name": "bearing-manual.pdf",
        "url": "https://storage.example.com/files/302/bearing-manual.pdf"
      }
    ]
  }
}
```

**Validation Rules:**
- Work order must exist and belong to user's company (tenant isolation)
- User must have view permissions on work order
- All related entities filtered by company ID
- Archived work orders can be viewed (read-only)

**Performance Characteristics:**
- Single database query with JOIN FETCH for all relationships
- No N+1 query problems
- Response time typically < 500ms
- Caching: None (real-time data required)

**Use Cases:**
1. **Pre-completion review**: View all details before marking work order complete
2. **Task progress check**: See which tasks are done and which remain
3. **Labor hour verification**: Review time logged by technicians
4. **File access**: View attached photos, manuals, or documentation
5. **Activity timeline**: Understand work order history and changes
6. **Assignment review**: See who is assigned and their contact information

---

## Security & Access Control

### Role-Based Access Control (RBAC)

**Allowed Roles:**
- `ADMIN`: Full access to all tools
- `MANAGER`: Full access to all tools
- `TECHNICIAN`: Full access to all tools
- `SUPERVISOR`: Full access to all tools

**Blocked Roles:**
- `LIMITED_ADMIN`: No agent access
- `LIMITED_TECHNICIAN`: No agent access
- `VIEW_ONLY`: No agent access
- `REQUESTER`: No agent access

**Enforcement Points:**
1. **Proxy Layer** (`agents-proxy/src/index.js:32`): Initial role check
2. **API Layer** (`AgentToolService.java:44-46`): Secondary verification
3. **Tool Execution**: Per-tool role validation

### Multi-Tenancy Isolation

**Company ID Validation:**
- Required for all tool executions
- Automatically extracted from JWT token
- Filters all database queries
- Prevents cross-tenant data access

**Implementation:**
```java
// Backend service layer
criteria.getFilterFields().add(FilterField.builder()
    .field("company.id")
    .operation("eq")
    .value(user.getCompany().getId())
    .build());
```

**Validation Failures:**
- Missing company ID → 403 Forbidden
- Invalid tenant context → TenantContextError
- Cross-tenant access attempts → Blocked at query level

### Authentication Flow

```
1. User submits prompt with JWT token
   ↓
2. Proxy verifies Authorization header
   ↓
3. Proxy calls /auth/me to fetch user context
   ↓
4. Validate role in ALLOWED_AGENT_ROLES
   ↓
5. Extract and validate company ID
   ↓
6. Execute tools with user context
   ↓
7. Filter all results by company ID
   ↓
8. Return filtered results
```

### Audit Trail

**Tool Invocation Logging:**
- Table: `agent_tool_invocation_log`
- Captured: tool name, arguments, result count, status, user, company
- Retention: Indefinite (configurable)

**Draft Action Tracking:**
- Table: `agent_draft_action`
- Captured: operation type, payload, status, timestamps, user, company
- Status transitions: pending → confirmed/declined

---

## Conversation Management

### Session Lifecycle

**Session Creation:**
- Session ID: Generated from metadata or UUID
- Sources: `sessionId`, `conversationId`, `correlationId`, `threadId`
- Storage: In-memory Map (not distributed)

**Conversation Memory:**
- TTL: 15 minutes (configurable via `AGENT_PROXY_MEMORY_TTL_MS`)
- Storage format: Complete conversation history
- Cleanup: Automatic every 15 minutes

**Memory Structure:**
```javascript
{
  history: [...messages],        // Full conversation
  lastResponseId: "response-id", // OpenAI response tracking
  updatedAt: 1697558400000      // Timestamp for TTL
}
```

### Context Preservation

**Maintained Across Messages:**
- User authentication and permissions
- Previous tool results (within session)
- Conversation history
- Draft actions

**Reset Conditions:**
- 15 minute inactivity
- Server restart (in-memory storage)
- Explicit session cleanup
- Error conditions (automatic cleanup)

**Scalability Considerations:**
- ✅ Current: In-memory storage (single instance)
- ⚠️ Future: Consider Redis for distributed sessions
- ⚠️ Future: Implement session persistence for reliability

---

## Expansion Roadmap

### Phase 1: Enhanced Work Order Operations (Priority: Critical)

**Status:** ✅ **COMPLETED** (2025-10-27)

**Implemented Capabilities:**

1. **create_work_order_immediately** ✅ *IMPLEMENTED*
   - Direct work order creation without draft approval
   - Full field support: title, description, priority, dates, assignments
   - Backend endpoint: `POST /api/agent/tools/work-orders/create`
   - Implementation: AgentToolService.java:141-249
   - Tool definition: agents-proxy/src/index.js:911-983

2. **update_work_order** ✅ *IMPLEMENTED*
   - Update existing work order fields (title, description, priority, assignments, etc.)
   - Field preservation: Only specified fields are modified
   - History tracking: Automatic history entry with updated field list
   - Backend endpoint: `POST /api/agent/tools/work-orders/{id}/update`
   - Implementation: AgentToolService.java:785-991
   - Tool definition: agents-proxy/src/index.js:985-1056

3. **update_work_order_status** ✅ *IMPLEMENTED* (via completion draft + direct status updates)
   - ✅ Completion workflow: OPEN → IN_PROGRESS → COMPLETE (via draft system)
   - ✅ Automatic status transition handling with business rule validation
   - ✅ Transition notes and history tracking
   - ✅ Labor timer management (automatic start/stop)
   - ✅ ON_HOLD status management with required reason codes
   - ✅ Status transition validation rules (see AgentToolService.java:358-415)
   - Backend implementation: AgentToolService.java:273-614
   - Impact: Full status lifecycle management with safety validations

**Business Rule Enforcement:**
- Status transition validation (OPEN cannot directly transition to COMPLETE)
- Task completion requirements before work order closure
- Signature validation if required
- Labor timer automatic management
- Notification dispatch to assigned users
- Permission checks (only managers can reopen completed work orders)

**Technical Improvements:**
- **Field-level update control**: Optional wrapper pattern for null vs. undefined distinction
- **Automatic history tracking**: All updates generate audit trail entries
- **Validation layers**: Input validation (Zod) + business logic validation (Java)
- **Tenant isolation**: All operations filtered by company ID
- **Error handling**: Comprehensive validation with meaningful error messages

**Implementation Effort:** 30-40 hours (actual)
**Expected ROI:** 60% reduction in manual status updates and assignments

---

### Phase 1.5: Work Order Details and Advanced Filtering (Priority: High)

**New Capabilities:**

1. **view_work_order_details**
   - Full details: tasks, labor, parts, costs, files
   - History tracking timeline
   - Related entities (location, asset, category)
   - Impact: Comprehensive analysis for completion decisions

2. **Enhanced view_work_orders filters**
   - Date range: dueDate, createdAt, updatedAt
   - Assignment: assignedTo, primaryUser, team
   - Classification: category, location, asset
   - Sorting: priority, dueDate, status, createdAt
   - Impact: Precise discovery and filtering

**Implementation Effort:** 12-16 hours
**Expected ROI:** 40% improvement in work order discovery accuracy

---

### Phase 2: Parts & Inventory Intelligence (Priority: High)

**New Capabilities:**

1. **view_parts_inventory**
   - Low stock alerts (quantity < minQuantity)
   - Filter: category, location, vendor
   - Show: cost, usage trends
   - Impact: Prevent stockouts

2. **view_part_details**
   - Full information: barcode, vendors, cost
   - Usage analytics
   - Reorder suggestions
   - Impact: Intelligent inventory management

3. **check_part_availability**
   - Verify availability for work order
   - Suggest alternatives
   - Calculate total cost
   - Impact: Planning accuracy

4. **request_part_order**
   - Create purchase order draft
   - Suggest vendor
   - Include shipping details
   - Impact: Streamlined procurement

**Implementation Effort:** 16-24 hours
**Expected ROI:** 30% reduction in stockout incidents

---

### Phase 3: Preventive Maintenance (Priority: High)

**New Capabilities:**

1. **view_preventive_maintenance**
   - List scheduled PM tasks
   - Filter: frequency, due date, asset
   - Show: upcoming, overdue, completion rate
   - Impact: Proactive planning

2. **create_work_order_from_pm**
   - Generate from PM template
   - Pre-populate tasks and parts
   - Assign to team
   - Impact: Streamline execution

3. **view_meters**
   - List with reading status
   - Filter: overdue readings
   - Show: next/last reading
   - Impact: Proactive monitoring

4. **record_meter_reading**
   - Submit readings
   - Validate ranges
   - Trigger alerts
   - Impact: Condition monitoring

**Implementation Effort:** 20-30 hours
**Expected ROI:** Improved PM compliance, reduced emergencies

---

### Phase 4: Labor & Cost Tracking (Priority: Medium)

**New Capabilities:**

1. **view_labor_logs**
   - Track hours by work order/user/date
   - Calculate costs
   - Identify bottlenecks
   - Impact: Cost visibility

2. **view_work_order_costs**
   - Breakdown: labor, parts, additional
   - Estimated vs actual
   - Budget tracking
   - Impact: Financial control

3. **start_labor_timer** / **stop_labor_timer**
   - Automated time tracking
   - Hourly rate calculation
   - Cost accumulation
   - Impact: Accurate labor logging

**Implementation Effort:** 16-24 hours
**Expected ROI:** Real-time cost visibility, better budgeting

---

### Phase 5: Analytics & Intelligence (Priority: Medium)

**New Capabilities:**

1. **get_work_order_analytics**
   - KPIs: completion rate, average time, overdue %
   - Trends by multiple dimensions
   - Bottleneck identification
   - Impact: Performance measurement

2. **get_asset_health_score**
   - Reliability metrics: uptime, MTBF, MTTR
   - Cost trends
   - Predictive maintenance score
   - Impact: Proactive asset management

3. **similar_work_orders**
   - Find historical similar issues
   - Show resolution methods
   - Track parts used and time
   - Impact: Faster resolution

**Implementation Effort:** 24-32 hours
**Expected ROI:** Data-driven decisions, proactive issue identification

---

## Adding New Capabilities

### Tool Development Pattern

**1. Define the Tool Specification**
```javascript
// agents-proxy/src/index.js
const newTool = tool({
  name: "tool_name",
  description: "Clear description for LLM understanding",
  parameters: z.object({
    param1: z.string(),
    param2: z.number().int().min(1).max(10).optional()
  }).strict(),
  execute: async (input, runContext) => {
    // Implementation
  }
});
```

**2. Create Backend API Endpoint**
```java
// AgentToolController.java
@PostMapping("/entity/action")
public ResponseEntity<AgentToolResponse<EntitySummary>> toolMethod(
    HttpServletRequest request,
    @Valid @RequestBody EntitySearchRequest searchRequest) {
    // Implementation with RBAC and tenant filtering
}
```

**3. Implement Service Layer**
```java
// AgentToolService.java
public AgentToolResponse<EntitySummary> toolMethod(
    OwnUser user,
    EntitySearchRequest request) {
    ensureAuthorised(user);
    // Add tenant filter
    // Query database
    // Return normalized results
}
```

**4. Register Tool with Agent**
```javascript
// Add to tools array
const atlasAgent = new Agent({
  tools: [
    viewWorkOrdersTool,
    viewAssetsTool,
    getUserContextTool,
    prepareCompletionDraftTool,
    newTool // ← Add here
  ]
});
```

**5. Quality Checklist**
- [ ] RBAC enforcement (role check)
- [ ] Tenant isolation (company ID filtering)
- [ ] Input validation (Zod schema + Java validation)
- [ ] Error handling with meaningful messages
- [ ] Logging for audit trail
- [ ] Unit and integration tests
- [ ] Documentation update

---

## Configuration Reference

### Environment Variables

**Agents Proxy (Node.js):**
```bash
# Required
OPENAI_API_KEY=sk-...
API_BASE=http://api:8080

# Optional
PORT=4005
OPENAI_MODEL=gpt-4o-mini
AGENT_CHATKIT_AGENT_ID=atlas-maintenance-copilot
AGENT_MAX_TOOL_RESULTS=10
AGENT_PROXY_MEMORY_TTL_MS=900000  # 15 minutes
LOG_LEVEL=info
```

**API Backend (Java/Spring):**
```yaml
agent:
  chatkit-enabled: true
  chatkit-agent-id: atlas-maintenance-copilot
  runtime-url: http://agents-proxy:4005
```

---

## Monitoring & Observability

### Key Metrics

**Performance:**
- Tool execution time (p50, p95, p99)
- Conversation response time
- Concurrent conversations
- Session memory usage

**Usage:**
- Tool invocation frequency
- Most used tools
- User adoption rate
- Draft confirmation rate

**Quality:**
- Tool success rate
- Error rate by type
- Session abandonment rate
- User satisfaction (future)

### Logging

**Tool Invocations:**
```sql
SELECT tool_name, COUNT(*) as invocations,
       AVG(result_count) as avg_results,
       SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate
FROM agent_tool_invocation_log
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY tool_name;
```

**Draft Actions:**
```sql
SELECT operation_type, status, COUNT(*) as count
FROM agent_draft_action
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY operation_type, status;
```

**Known Issues & Resolutions:**

| Issue | Status | Resolution |
|-------|--------|------------|
| Draft payload not extracting workOrderId from nested structure | ✅ Fixed (v1.1) | Enhanced `extractWorkOrderIdentifier` with nested object support |
| "Invalid status transition from OPEN to COMPLETE" error | ✅ Fixed (v1.1) | Implemented automatic two-step transition workflow |
| "Work order does not exist" after confirmation | ✅ Fixed (v1.1) | Fixed payload extraction to check both root and nested locations |

---

## Support & Feedback

**Documentation:**
- Technical Architecture: `docs/agent-features.md`
- Expansion Analysis: `docs/atlas-agents.md`
- API Reference: `docs/API-REFERENCE.md`

**Development Team:**
- Email: development-team@atlas-cmms.com
- Issue Tracker: GitHub Issues
- Discord: [Atlas CMMS Community](https://discord.gg/cHqyVRYpkA)

---

## Technical Implementation Notes

### Draft Payload Handling (v1.1)

**File:** `api/src/main/java/com/grash/service/AgentDraftService.java`

**Improved extractWorkOrderIdentifier method:**
```java
private Object extractWorkOrderIdentifier(Map<String, Object> payload) {
    if (payload == null || payload.isEmpty()) {
        return null;
    }
    // Check root level first
    if (payload.containsKey("workOrderId")) {
        return payload.get("workOrderId");
    }
    // Check nested data object (handles wrapped payload structure)
    Object dataNode = payload.get("data");
    if (dataNode instanceof Map<?, ?>) {
        Map<?, ?> dataMap = (Map<?, ?>) dataNode;
        if (dataMap.containsKey("workOrderId")) {
            return dataMap.get("workOrderId");
        }
    }
    // Fallback: check for id field variations
    if (payload.containsKey("id")) {
        return payload.get("id");
    }
    if (dataNode instanceof Map<?, ?>) {
        Map<?, ?> dataMap = (Map<?, ?>) dataNode;
        if (dataMap.containsKey("id")) {
            return dataMap.get("id");
        }
    }
    return null;
}
```

**Automatic Status Transition Logic:**
```java
private void applyCompleteWorkOrderDraft(AgentDraftAction draftAction, OwnUser user) {
    // ... validation ...

    // Handle status transition: OPEN → IN_PROGRESS → COMPLETE
    Status currentStatus = workOrder.getStatus();
    if (Status.OPEN.equals(currentStatus)) {
        // First transition to IN_PROGRESS
        AgentWorkOrderStatusUpdateRequest progressRequest = new AgentWorkOrderStatusUpdateRequest();
        progressRequest.setWorkOrderId(workOrderIdentifier);
        progressRequest.setNewStatus(Status.IN_PROGRESS.name());
        progressRequest.setNotes("Started via agent");
        agentToolService.updateWorkOrderStatus(user, progressRequest);
    }

    // Then transition to COMPLETE
    AgentWorkOrderStatusUpdateRequest completeRequest = new AgentWorkOrderStatusUpdateRequest();
    completeRequest.setWorkOrderId(workOrderIdentifier);
    completeRequest.setNewStatus(Status.COMPLETE.name());
    completeRequest.setNotes("Completed via agent");
    agentToolService.updateWorkOrderStatus(user, completeRequest);
}
```

---

**Document Version:** 1.2
**Status:** Comprehensive capabilities documented, Phase 1 completed, implementation details added
**Next Review:** After Phase 1.5 implementation
**Last Updated:** 2025-10-27

---

## Summary of Current Capabilities

### Implemented Tools (7 Total)

**Data Retrieval Tools:**
1. ✅ **view_work_orders**: Search and filter work orders (5-50 results)
2. ✅ **view_assets**: Search and filter assets (5-50 results)
3. ✅ **get_user_context**: Retrieve authenticated user profile

**Work Order Creation Tools:**
4. ✅ **prepare_work_order_creation_draft**: Stage work order for user review (draft system)
5. ✅ **create_work_order_immediately**: Create work order without approval (urgent workflows)

**Work Order Modification Tools:**
6. ✅ **update_work_order**: Update work order fields and assignments
7. ✅ **prepare_work_order_completion_draft**: Propose work order completion (automatic status transitions)

### Key Features

**Security & Isolation:**
- Multi-tenant isolation (automatic company ID filtering on all operations)
- Role-based access control (ADMIN, MANAGER, TECHNICIAN, SUPERVISOR)
- Permission validation (edit rights checked before modifications)
- Audit trail (tool invocation logging + work order history)

**Smart Behavior:**
- Automatic status transitions (OPEN → IN_PROGRESS → COMPLETE)
- Labor timer management (automatic start/stop on status changes)
- Notification dispatch (alerts assigned users of changes)
- Field preservation (optional updates only modify specified fields)
- Flexible identifier support (accepts numeric IDs or custom codes)

**Data Quality:**
- Search capabilities (keyword search across multiple fields)
- Status filtering (work orders and assets)
- Sorting by update timestamp
- Validation rules (business logic enforcement)
- Error handling (comprehensive validation with clear messages)

### Capabilities Matrix

| Capability | Status | Tool | Authorization Required |
|------------|--------|------|------------------------|
| Search work orders | ✅ Implemented | view_work_orders | ADMIN, MANAGER, TECHNICIAN, SUPERVISOR |
| Search assets | ✅ Implemented | view_assets | ADMIN, MANAGER, TECHNICIAN, SUPERVISOR |
| Create work order (draft) | ✅ Implemented | prepare_work_order_creation_draft | ADMIN, MANAGER, TECHNICIAN, SUPERVISOR |
| Create work order (immediate) | ✅ Implemented | create_work_order_immediately | ADMIN, MANAGER, TECHNICIAN, SUPERVISOR |
| Update work order fields | ✅ Implemented | update_work_order | ADMIN, MANAGER, TECHNICIAN, SUPERVISOR + edit permissions |
| Complete work order | ✅ Implemented | prepare_work_order_completion_draft | ADMIN, MANAGER, TECHNICIAN, SUPERVISOR + edit permissions |
| Status transitions | ✅ Implemented | Via completion draft | Automatic business rule validation |
| View work order details | 🔲 Planned | - | Phase 1.5 |
| View parts inventory | 🔲 Planned | - | Phase 2 |
| Preventive maintenance | 🔲 Planned | - | Phase 3 |
| Labor tracking | 🔲 Planned | - | Phase 4 |
| Analytics | 🔲 Planned | - | Phase 5 |

### Performance Metrics

**Tool Execution:**
- Timeout: 30 seconds per tool call
- Result limit: 1-50 items (default 5)
- Session TTL: 15 minutes (in-memory)
- Concurrent conversations: 100+ supported

**Search Performance:**
- Indexed fields: company_id, status, updatedAt, customId
- Search mode: Case-insensitive partial match (LIKE %term%)
- Sorting: Descending by updatedAt timestamp
- Pagination: Single page (no cursor-based pagination yet)

**Data Validation:**
- Input validation: Zod schemas (Node.js) + Bean Validation (Java)
- Business rules: Multi-layered validation (proxy → service → repository)
- Tenant isolation: Automatic filtering on all queries
- Foreign key validation: All references validated against company ID

### Integration Points

**Frontend (React):**
- ChatDock component: Chat interface for agent conversations
- Draft review UI: Pending actions requiring user confirmation
- Notification system: Real-time updates for status changes

**Backend (Spring Boot):**
- AgentToolController: REST endpoints for tool execution
- AgentToolService: Business logic and validation
- AgentDraftService: Draft action management and confirmation
- WorkOrderService: Core work order CRUD operations

**Agents Proxy (Node.js):**
- OpenAI Agents runtime: Tool execution and conversation management
- Conversation cache: In-memory session storage with TTL
- Tool logging: Audit trail for all tool invocations
- Error handling: Comprehensive error recovery and messaging

### Known Limitations

**Search & Filtering:**
- No date range filtering (createdAt, updatedAt, dueDate)
- No assignment filtering (assignedTo, primaryUser, team)
- No category/location filtering
- No custom field support
- Result limit: 50 items maximum (no pagination)

**Work Order Operations:**
- Cannot view full work order details (tasks, labor, parts, costs)
- Cannot create/update tasks within work orders
- Cannot manage labor entries directly
- Cannot attach files or signatures via agent
- Cannot delete or archive work orders

**Asset Operations:**
- Read-only access (no asset creation or updates)
- Limited filtering (no status-based search UI)
- No meter reading access
- No maintenance history access

**Session Management:**
- In-memory storage (not persistent across server restarts)
- Single-instance only (no distributed sessions)
- 15-minute TTL (hard-coded, not configurable per session)

### Roadmap Summary

**Phase 1**: ✅ **COMPLETED** - Enhanced work order operations (30-40 hours)
- Create, update, and complete work orders with full validation
- Status lifecycle management with automatic transitions
- Labor timer integration and notification dispatch

**Phase 1.5**: 🔲 **PLANNED** - Work order details and advanced filtering (12-16 hours)
- Full work order detail view with related entities
- Advanced filtering by date, assignment, classification
- Improved search and discovery accuracy

**Phase 2**: 🔲 **PLANNED** - Parts & inventory intelligence (16-24 hours)
- Low stock alerts and inventory management
- Part availability checking and order requests

**Phase 3**: 🔲 **PLANNED** - Preventive maintenance (20-30 hours)
- PM task management and work order generation
- Meter reading tracking and condition monitoring

**Phase 4**: 🔲 **PLANNED** - Labor & cost tracking (16-24 hours)
- Labor logging and timer management
- Cost breakdowns and budget tracking

**Phase 5**: 🔲 **PLANNED** - Analytics & intelligence (24-32 hours)
- KPI dashboards and trend analysis
- Asset health scoring and predictive maintenance
