# Feature Request: Enhanced Work Order Management for Atlas AI Agent

**Feature ID:** FR-AGENT-WO-001
**Priority:** P0 (Critical - Foundation Enhancement)
**Status:** Planning
**Target Release:** Phase 1 - Weeks 1-2
**Created:** 2025-10-12
**Author:** Development Team

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Business Context](#business-context)
3. [Feature Components](#feature-components)
4. [Technical Requirements](#technical-requirements)
5. [Progress Stages](#progress-stages)
6. [Testing Strategy](#testing-strategy)
7. [Acceptance Criteria](#acceptance-criteria)
8. [Success Metrics](#success-metrics)
9. [Dependencies & Risks](#dependencies--risks)
10. [Implementation Timeline](#implementation-timeline)

---

## Executive Summary

### Overview

This feature request encompasses the expansion of Atlas AI Agent's work order management capabilities through four critical enhancements:

1. **Status Management** - Enable agents to update work order status with validation
2. **Assignment Automation** - Intelligent work order assignment to users and teams
3. **Detailed Work Order Views** - Comprehensive work order information retrieval
4. **Advanced Filtering** - Enhanced search and discovery capabilities

### Business Value

**Current Pain Points:**
- Manual status updates require technician context switching to UI
- Work order assignment lacks intelligence and load balancing
- Limited visibility into work order details (tasks, costs, parts, history)
- Basic search functionality limits operational efficiency

**Expected Benefits:**
- **50% reduction** in manual status update operations
- **30% improvement** in work order discovery time
- **Better workload distribution** through intelligent assignment
- **Comprehensive visibility** enabling data-driven decisions

**ROI Estimate:**
- Implementation Effort: 20-30 hours
- Time Savings: ~10 hours/week per active team
- Payback Period: 2-3 weeks for teams of 5+

---

## Business Context

### Problem Statement

Current Atlas AI Agent provides basic work order search (`view_work_orders`), but lacks critical operations that technicians, managers, and supervisors need for day-to-day maintenance workflow execution.

**Current Capabilities:**
- ✅ Search work orders by keyword and status
- ✅ View basic work order information (id, title, priority, status, dueDate, asset)
- ✅ Prepare completion drafts

**Critical Gaps:**
- ❌ Cannot update work order status through agent
- ❌ Cannot assign/reassign work orders
- ❌ Cannot view detailed work order information (tasks, labor, parts, costs)
- ❌ Limited filtering options (no date ranges, users, teams, categories, locations)
- ❌ No sorting flexibility beyond updatedAt

### User Stories

#### Story 1: Technician Status Updates (US-001)
**As a** maintenance technician
**I want** to update work order status via AI agent conversation
**So that** I can progress work without switching to the UI

**Acceptance Criteria:**
- Given a work order in OPEN status
- When I ask the agent to start work on it
- Then the agent updates status to IN_PROGRESS
- And records who made the change and when
- And validates status transition rules

**Example Conversation:**
```
User: "Start work on WO-12345"
Agent: "I've updated WO-12345: Replace pump bearings to IN_PROGRESS status.
       The work order is now assigned to you and marked as started."
```

#### Story 2: Manager Work Assignment (US-002)
**As a** maintenance manager
**I want** to assign work orders to technicians or teams via agent
**So that** I can balance workload and assign based on skills

**Acceptance Criteria:**
- Given multiple available technicians
- When I request work order assignment
- Then the agent checks availability and workload
- And suggests appropriate assignee
- And creates draft assignment for confirmation

**Example Conversation:**
```
User: "Assign WO-12345 to best available technician"
Agent: "Based on current workload and skillset, I recommend assigning
       WO-12345 to John Smith (Plumbing specialist, 2 active work orders).
       Would you like me to create this assignment?"
```

#### Story 3: Supervisor Detailed Analysis (US-003)
**As a** maintenance supervisor
**I want** to view complete work order details via agent
**So that** I can review progress, costs, and issues without UI navigation

**Acceptance Criteria:**
- Given a work order ID
- When I request details
- Then the agent returns comprehensive information
- Including tasks completion, labor hours, parts used, costs, files, history
- And provides actionable insights

**Example Conversation:**
```
User: "Show me full details for WO-12345"
Agent: "WO-12345: Replace pump bearings (HIGH priority, IN_PROGRESS)
       - Assigned to: John Smith
       - Tasks: 3/5 completed
       - Labor: 2.5 hours ($75 cost)
       - Parts: 2 bearings ($120), 1 seal ($15)
       - Total Cost: $210 (estimate: $200)
       - Due: Tomorrow 3PM
       - Files: 2 images attached
       Work is on track but slightly over budget."
```

#### Story 4: Manager Advanced Search (US-004)
**As a** maintenance manager
**I want** advanced filtering options for work order search
**So that** I can quickly find relevant work orders for analysis

**Acceptance Criteria:**
- Given multiple filter options
- When I search with specific criteria
- Then results match all filters
- And support date ranges, users, teams, categories, locations
- And provide sorting options

**Example Conversation:**
```
User: "Show me high priority work orders assigned to Team A that are overdue"
Agent: "Found 3 overdue HIGH priority work orders for Team A:
       1. WO-12340: HVAC repair (2 days overdue, IN_PROGRESS)
       2. WO-12355: Electrical inspection (1 day overdue, ON_HOLD)
       3. WO-12360: Plumbing leak (3 days overdue, OPEN)
       Would you like details on any of these?"
```

---

## Feature Components

### Component 1: Status Update Tool (`update_work_order_status`)

#### Description
Enable agents to update work order status with proper validation, audit logging, and status transition rules enforcement.

#### Functional Requirements

**FR-1.1: Status Transitions**
- Support status updates: OPEN → IN_PROGRESS → COMPLETED
- Support hold operations: Any → ON_HOLD → (previous status)
- Support reopen: COMPLETED → OPEN (with manager approval)
- Validate transition rules per company configuration

**FR-1.2: Status Change Metadata**
- Record user who initiated status change
- Timestamp of status change
- Optional notes/comments during transition
- Reason codes for ON_HOLD or status reversions

**FR-1.3: Automatic Actions**
- Start labor timer when transitioning to IN_PROGRESS
- Stop labor timer when transitioning from IN_PROGRESS
- Trigger notifications to assigned users/teams
- Update completion timestamps for COMPLETED status

**FR-1.4: Validation Rules**
- Verify user has permission to update status (RBAC)
- Ensure work order is not archived
- Validate completion requirements (tasks, signature if required)
- Prevent duplicate status (already in requested status)

#### Technical Requirements

**API Endpoint:**
```
POST /api/agent/tools/work-orders/update-status
```

**Request Schema:**
```json
{
  "workOrderId": "number (required)",
  "newStatus": "string enum [OPEN, IN_PROGRESS, ON_HOLD, COMPLETED] (required)",
  "notes": "string (optional)",
  "reasonCode": "string (optional, required for ON_HOLD)",
  "completionData": {
    "signature": "file reference (conditional)",
    "feedback": "string (optional)"
  }
}
```

**Response Schema:**
```json
{
  "success": true,
  "workOrder": {
    "id": 12345,
    "code": "WO-12345",
    "previousStatus": "OPEN",
    "newStatus": "IN_PROGRESS",
    "updatedBy": "John Smith",
    "updatedAt": "2025-10-12T10:30:00Z",
    "notes": "Starting bearing replacement work"
  },
  "actions": [
    "Labor timer started",
    "Notification sent to supervisor"
  ]
}
```

#### Agent Tool Definition

**Tool Name:** `update_work_order_status`

**Description:**
```
Update the status of a work order. Use this when the user wants to start work,
put work on hold, complete work, or reopen a completed work order. Always confirm
the status change with the user before executing.
```

**Parameters (Zod Schema):**
```javascript
z.object({
  workOrderId: z.union([z.number(), z.string()]).describe("Work order ID or code"),
  newStatus: z.enum(["OPEN", "IN_PROGRESS", "ON_HOLD", "COMPLETED"])
    .describe("Target status for the work order"),
  notes: z.string().optional()
    .describe("Optional notes explaining the status change"),
  reasonCode: z.string().optional()
    .describe("Reason code, required when setting status to ON_HOLD")
})
```

---

### Component 2: Assignment Tool (`assign_work_order`)

#### Description
Intelligent work order assignment to users or teams with workload checking and skill matching.

#### Functional Requirements

**FR-2.1: Assignment Operations**
- Assign work order to specific user
- Assign work order to team (auto-selects team member)
- Reassign from one user/team to another
- Unassign (remove current assignment)
- Set primary user vs additional assignees

**FR-2.2: Intelligent Suggestions**
- Check current workload (open + in-progress work orders)
- Consider user skills and categories
- Factor in user location and work order location
- Suggest "best fit" when user requests "assign to best available"

**FR-2.3: Workload Balancing**
- Show current assignment counts per user
- Prevent overallocation (configurable thresholds)
- Warn if user already has HIGH priority work
- Consider user availability status

**FR-2.4: Validation & Authorization**
- Verify assignee exists and is active
- Check user role permits assignment (MANAGER, ADMIN, SUPERVISOR)
- Ensure work order not archived
- Validate tenant isolation (same company)

#### Technical Requirements

**API Endpoint:**
```
POST /api/agent/tools/work-orders/assign
```

**Request Schema:**
```json
{
  "workOrderId": "number (required)",
  "assignmentType": "string enum [USER, TEAM, UNASSIGN, SUGGEST] (required)",
  "assignToUserId": "number (conditional - required if type=USER)",
  "assignToTeamId": "number (conditional - required if type=TEAM)",
  "isPrimary": "boolean (default: true)",
  "notes": "string (optional)"
}
```

**Response Schema:**
```json
{
  "success": true,
  "workOrder": {
    "id": 12345,
    "code": "WO-12345",
    "title": "Replace pump bearings",
    "assignedTo": [
      {
        "id": 42,
        "name": "John Smith",
        "isPrimary": true,
        "currentWorkload": 3
      }
    ],
    "team": {
      "id": 5,
      "name": "Plumbing Team"
    }
  },
  "suggestion": {
    "recommended": true,
    "reason": "Lowest workload in plumbing team, located at same site"
  }
}
```

#### Agent Tool Definition

**Tool Name:** `assign_work_order`

**Description:**
```
Assign or reassign a work order to a user or team. Can suggest best available
technician based on workload and skills. Use when the user wants to delegate
work or rebalance assignments.
```

**Parameters (Zod Schema):**
```javascript
z.object({
  workOrderId: z.union([z.number(), z.string()])
    .describe("Work order ID or code"),
  assignmentType: z.enum(["USER", "TEAM", "SUGGEST"])
    .describe("Type of assignment: specific user, team, or request suggestion"),
  assignToUserId: z.number().optional()
    .describe("User ID to assign to (required if assignmentType=USER)"),
  assignToTeamId: z.number().optional()
    .describe("Team ID to assign to (required if assignmentType=TEAM)"),
  notes: z.string().optional()
    .describe("Optional notes about the assignment")
})
```

---

### Component 3: Detailed View Tool (`view_work_order_details`)

#### Description
Retrieve comprehensive work order information including tasks, labor, parts, costs, files, and history.

#### Functional Requirements

**FR-3.1: Core Information**
- All fields from WorkOrder entity
- Relationships: asset, location, category, team
- Assigned users (primary and additional)
- Parent request or preventive maintenance reference

**FR-3.2: Tasks & Checklists**
- List all tasks with completion status
- Show task types (SUBTASK, INSPECTION, METER, etc.)
- Include task notes and values
- Display images attached to tasks

**FR-3.3: Labor Tracking**
- All labor entries for work order
- Running vs stopped timers
- Total labor hours and costs
- Labor by user and time category

**FR-3.4: Parts & Inventory**
- Parts used/planned for work order
- Part quantities and costs
- Availability status
- Total parts cost

**FR-3.5: Additional Costs**
- All additional cost entries
- Cost categories and descriptions
- Dates and assignees
- Total additional costs

**FR-3.6: Cost Summary**
- Total labor cost
- Total parts cost
- Total additional costs
- Grand total actual cost
- Estimated vs actual variance

**FR-3.7: Files & Attachments**
- Images, documents, audio descriptions
- File metadata (name, size, uploaded by, date)
- Count of attachments

**FR-3.8: Audit History**
- Status change history
- Assignment history
- Who created, who last updated, timestamps
- Completion information (completedBy, completedOn)

**FR-3.9: Related Work**
- Parent request details (if created from request)
- Parent PM details (if created from PM)
- Child work orders (if applicable)

#### Technical Requirements

**API Endpoint:**
```
POST /api/agent/tools/work-orders/details
```

**Request Schema:**
```json
{
  "workOrderId": "number (required)",
  "includeTasks": "boolean (default: true)",
  "includeLabor": "boolean (default: true)",
  "includeParts": "boolean (default: true)",
  "includeCosts": "boolean (default: true)",
  "includeFiles": "boolean (default: true)",
  "includeHistory": "boolean (default: false)"
}
```

**Response Schema:**
```json
{
  "workOrder": {
    "id": 12345,
    "code": "WO-12345",
    "title": "Replace pump bearings",
    "description": "Main circulation pump showing wear...",
    "status": "IN_PROGRESS",
    "priority": "HIGH",
    "dueDate": "2025-10-13T15:00:00Z",
    "estimatedDuration": 240,
    "asset": {
      "id": 100,
      "name": "Pump-101",
      "location": "Building A - Mechanical Room"
    },
    "category": {
      "id": 5,
      "name": "Mechanical"
    },
    "primaryUser": {
      "id": 42,
      "name": "John Smith",
      "role": "TECHNICIAN"
    },
    "assignedTo": [
      {"id": 42, "name": "John Smith"},
      {"id": 43, "name": "Jane Doe"}
    ],
    "team": {
      "id": 5,
      "name": "Plumbing Team"
    },
    "tasks": [
      {
        "id": 1,
        "label": "Remove old bearings",
        "taskType": "SUBTASK",
        "status": "COMPLETED",
        "completedBy": "John Smith"
      },
      {
        "id": 2,
        "label": "Install new bearings",
        "taskType": "SUBTASK",
        "status": "IN_PROGRESS"
      },
      {
        "id": 3,
        "label": "Final inspection",
        "taskType": "INSPECTION",
        "status": "PENDING"
      }
    ],
    "labor": [
      {
        "id": 1,
        "assignedTo": "John Smith",
        "startedAt": "2025-10-12T08:00:00Z",
        "duration": 150,
        "hourlyRate": 30,
        "cost": 75,
        "status": "RUNNING"
      }
    ],
    "parts": [
      {
        "id": 200,
        "name": "Bearing 6205-2RS",
        "quantity": 2,
        "unitCost": 60,
        "totalCost": 120
      },
      {
        "id": 201,
        "name": "Oil Seal",
        "quantity": 1,
        "unitCost": 15,
        "totalCost": 15
      }
    ],
    "additionalCosts": [
      {
        "id": 1,
        "description": "Specialized tools rental",
        "cost": 25,
        "category": "Equipment"
      }
    ],
    "costSummary": {
      "laborCost": 75,
      "partsCost": 135,
      "additionalCost": 25,
      "totalCost": 235,
      "estimatedCost": 200,
      "variance": 35,
      "variancePercent": 17.5
    },
    "files": [
      {
        "id": 1,
        "name": "pump_damage.jpg",
        "type": "image",
        "uploadedBy": "John Smith",
        "uploadedAt": "2025-10-12T08:15:00Z"
      }
    ],
    "createdAt": "2025-10-10T09:00:00Z",
    "createdBy": "Manager User",
    "updatedAt": "2025-10-12T10:30:00Z",
    "updatedBy": "John Smith"
  }
}
```

#### Agent Tool Definition

**Tool Name:** `view_work_order_details`

**Description:**
```
Retrieve comprehensive details for a specific work order including tasks, labor,
parts, costs, files, and history. Use when the user needs complete information
about a work order beyond basic summary.
```

**Parameters (Zod Schema):**
```javascript
z.object({
  workOrderId: z.union([z.number(), z.string()])
    .describe("Work order ID or code"),
  includeHistory: z.boolean().optional()
    .describe("Include full audit history (default: false)")
})
```

---

### Component 4: Enhanced Filters (`view_work_orders` expansion)

#### Description
Expand existing `view_work_orders` tool with advanced filtering and sorting capabilities.

#### Functional Requirements

**FR-4.1: Date Range Filtering**
- Filter by dueDate range (e.g., due this week, overdue)
- Filter by createdAt range (e.g., created last month)
- Filter by updatedAt range (e.g., recently updated)
- Support relative dates (today, this week, this month) and absolute dates

**FR-4.2: User & Team Filtering**
- Filter by assignedTo user(s)
- Filter by primaryUser
- Filter by team assignment
- Filter by createdBy user
- Support multiple user/team selections (OR logic)

**FR-4.3: Entity Relationship Filtering**
- Filter by asset (specific asset or asset category)
- Filter by location (specific location or location hierarchy)
- Filter by category (work order category)
- Filter by customer (if applicable)

**FR-4.4: Additional Filters**
- Filter by priority (HIGH, MEDIUM, LOW, NONE)
- Filter by archived status (default: exclude archived)
- Filter by parent type (created from request, PM, or standalone)
- Filter by completion status (completed vs not completed)

**FR-4.5: Sorting Options**
- Sort by: priority, dueDate, createdAt, updatedAt, status
- Sort direction: ascending or descending
- Multi-level sorting (e.g., priority DESC, dueDate ASC)

**FR-4.6: Combination Logic**
- All filters use AND logic (must match all criteria)
- Within multi-select filters, use OR logic (e.g., status IN [OPEN, IN_PROGRESS])
- Support filter combinations for complex queries

#### Technical Requirements

**API Endpoint:**
```
POST /api/agent/tools/work-orders/search
```

**Expanded Request Schema:**
```json
{
  "limit": "number (1-50, default: 5)",
  "search": "string (optional - searches title, description, customId)",

  "statuses": "array of strings (optional - OPEN, IN_PROGRESS, ON_HOLD, COMPLETED)",
  "priorities": "array of strings (optional - HIGH, MEDIUM, LOW, NONE)",

  "dueDateRange": {
    "start": "ISO date (optional)",
    "end": "ISO date (optional)",
    "preset": "string enum (optional - TODAY, THIS_WEEK, THIS_MONTH, OVERDUE)"
  },
  "createdAtRange": {
    "start": "ISO date (optional)",
    "end": "ISO date (optional)"
  },
  "updatedAtRange": {
    "start": "ISO date (optional)",
    "end": "ISO date (optional)"
  },

  "assignedToUserIds": "array of numbers (optional)",
  "primaryUserId": "number (optional)",
  "teamIds": "array of numbers (optional)",
  "createdByUserId": "number (optional)",

  "assetIds": "array of numbers (optional)",
  "locationIds": "array of numbers (optional)",
  "categoryIds": "array of numbers (optional)",

  "archived": "boolean (default: false)",
  "hasParentRequest": "boolean (optional)",
  "hasParentPM": "boolean (optional)",

  "sortBy": "string (priority, dueDate, createdAt, updatedAt, status)",
  "sortDirection": "string enum (ASC, DESC, default: DESC)"
}
```

**Response Schema:**
```json
{
  "results": [
    {
      "id": 12345,
      "code": "WO-12345",
      "title": "Replace pump bearings",
      "status": "IN_PROGRESS",
      "priority": "HIGH",
      "dueDate": "2025-10-13T15:00:00Z",
      "asset": "Pump-101",
      "location": "Building A",
      "assignedTo": ["John Smith"],
      "team": "Plumbing Team",
      "category": "Mechanical",
      "createdAt": "2025-10-10T09:00:00Z",
      "updatedAt": "2025-10-12T10:30:00Z"
    }
  ],
  "total": 15,
  "page": 0,
  "pageSize": 5,
  "appliedFilters": {
    "statuses": ["IN_PROGRESS"],
    "priorities": ["HIGH"],
    "dueDatePreset": "THIS_WEEK"
  }
}
```

#### Agent Tool Definition

**Tool Name:** `view_work_orders` (Enhanced)

**Description:**
```
Search and filter work orders with advanced criteria. Supports filtering by status,
priority, date ranges, assigned users/teams, asset, location, category, and more.
Returns paginated results with sorting options.
```

**Parameters (Zod Schema):**
```javascript
z.object({
  limit: z.number().int().min(1).max(50).optional(),
  search: z.string().optional()
    .describe("Search in title, description, and code"),

  statuses: z.array(z.enum(["OPEN", "IN_PROGRESS", "ON_HOLD", "COMPLETED"])).optional(),
  priorities: z.array(z.enum(["HIGH", "MEDIUM", "LOW", "NONE"])).optional(),

  dueDatePreset: z.enum(["TODAY", "THIS_WEEK", "THIS_MONTH", "OVERDUE"]).optional()
    .describe("Quick date range presets"),
  dueDateStart: z.string().optional().describe("Due date range start (ISO format)"),
  dueDateEnd: z.string().optional().describe("Due date range end (ISO format)"),

  assignedToUserIds: z.array(z.number()).optional()
    .describe("Filter by assigned users"),
  teamIds: z.array(z.number()).optional()
    .describe("Filter by teams"),

  assetIds: z.array(z.number()).optional(),
  locationIds: z.array(z.number()).optional(),
  categoryIds: z.array(z.number()).optional(),

  sortBy: z.enum(["priority", "dueDate", "createdAt", "updatedAt"]).optional(),
  sortDirection: z.enum(["ASC", "DESC"]).optional()
})
```

---

## Progress Stages

### Stage 1: Planning & Design (2 days)

**Milestone:** Requirements finalized and technical design approved

**Tasks:**
- [x] Review atlas-agents.md for context
- [x] Create detailed feature request document
- [ ] Review with stakeholders (product, engineering)
- [ ] Finalize API contracts and schemas
- [ ] Create database migration scripts (if needed)
- [ ] Design agent conversation flows
- [ ] Identify edge cases and validation rules

**Deliverables:**
- This feature request document
- API specification (OpenAPI/Swagger)
- Database schema changes (Liquibase)
- Agent conversation flow diagrams

**Exit Criteria:**
- ✅ All stakeholders approve requirements
- ✅ API contracts reviewed and signed off
- ✅ Database changes reviewed by DBA
- ✅ Security review completed

---

### Stage 2: Backend Implementation (5 days)

**Milestone:** Backend API endpoints functional and tested

#### Stage 2.1: Status Update Tool (1.5 days)

**Tasks:**
- [ ] Create `AgentWorkOrderStatusUpdateRequest` DTO
- [ ] Create `AgentWorkOrderStatusUpdateResponse` DTO
- [ ] Implement `updateWorkOrderStatus()` in `AgentToolService`
- [ ] Add endpoint to `AgentToolController`
- [ ] Implement status validation logic
- [ ] Add audit logging for status changes
- [ ] Create unit tests for service layer
- [ ] Create integration tests for API endpoint

**Files Modified/Created:**
- `api/src/main/java/com/grash/dto/agent/AgentWorkOrderStatusUpdateRequest.java` (NEW)
- `api/src/main/java/com/grash/dto/agent/AgentWorkOrderStatusUpdateResponse.java` (NEW)
- `api/src/main/java/com/grash/service/AgentToolService.java` (MODIFY)
- `api/src/main/java/com/grash/controller/AgentToolController.java` (MODIFY)
- `api/src/test/java/com/grash/service/AgentToolServiceTest.java` (MODIFY)
- `api/src/test/java/com/grash/controller/AgentToolControllerTest.java` (MODIFY)

**Validation Requirements:**
```java
// Status transition validation
public void validateStatusTransition(Status currentStatus, Status newStatus, OwnUser user) {
    // Rule: Cannot go directly from OPEN to COMPLETED (must be IN_PROGRESS first)
    if (currentStatus == Status.OPEN && newStatus == Status.COMPLETED) {
        throw new CustomException("Cannot complete work order without starting it", HttpStatus.BAD_REQUEST);
    }

    // Rule: Only MANAGER/ADMIN can reopen COMPLETED work orders
    if (currentStatus == Status.COMPLETED && !hasRole(user, RoleCode.ADMIN, RoleCode.LIMITED_ADMIN)) {
        throw new CustomException("Only managers can reopen completed work orders", HttpStatus.FORBIDDEN);
    }

    // Rule: ON_HOLD requires reason code
    if (newStatus == Status.ON_HOLD && !StringUtils.hasText(request.getReasonCode())) {
        throw new CustomException("Reason code required when placing work order on hold", HttpStatus.BAD_REQUEST);
    }
}
```

**Exit Criteria:**
- ✅ All unit tests pass (>90% coverage)
- ✅ Integration tests pass
- ✅ Manual API testing successful
- ✅ Code review approved

#### Stage 2.2: Assignment Tool (1.5 days)

**Tasks:**
- [ ] Create `AgentWorkOrderAssignRequest` DTO
- [ ] Create `AgentWorkOrderAssignResponse` DTO with workload info
- [ ] Implement `assignWorkOrder()` in `AgentToolService`
- [ ] Implement workload checking logic
- [ ] Implement assignment suggestion algorithm
- [ ] Add endpoint to `AgentToolController`
- [ ] Create unit tests
- [ ] Create integration tests

**Files Modified/Created:**
- `api/src/main/java/com/grash/dto/agent/AgentWorkOrderAssignRequest.java` (NEW)
- `api/src/main/java/com/grash/dto/agent/AgentWorkOrderAssignResponse.java` (NEW)
- `api/src/main/java/com/grash/dto/agent/AgentUserWorkloadSummary.java` (NEW)
- `api/src/main/java/com/grash/service/AgentToolService.java` (MODIFY)
- `api/src/main/java/com/grash/controller/AgentToolController.java` (MODIFY)

**Assignment Algorithm:**
```java
public AgentUserWorkloadSummary suggestBestAssignee(WorkOrder workOrder, Long teamId) {
    // Get team members or all eligible users
    List<OwnUser> candidates = teamId != null
        ? teamRepository.findById(teamId).getUsers()
        : userRepository.findByCompanyAndRole(workOrder.getCompany(), ALLOWED_ROLES);

    // Calculate workload for each candidate
    List<UserWorkload> workloads = candidates.stream()
        .map(user -> {
            int openCount = workOrderRepository.countByAssignedToAndStatusIn(
                user, Arrays.asList(Status.OPEN, Status.IN_PROGRESS)
            );
            int highPriorityCount = workOrderRepository.countByAssignedToAndPriority(
                user, Priority.HIGH
            );
            boolean sameLocation = user.getLocation().equals(workOrder.getLocation());

            return UserWorkload.builder()
                .user(user)
                .openWorkOrders(openCount)
                .highPriorityCount(highPriorityCount)
                .sameLocation(sameLocation)
                .score(calculateScore(openCount, highPriorityCount, sameLocation))
                .build();
        })
        .sorted(Comparator.comparingInt(UserWorkload::getScore))
        .collect(Collectors.toList());

    // Return top candidate
    return workloads.get(0);
}

private int calculateScore(int openCount, int highPriorityCount, boolean sameLocation) {
    int score = openCount * 10;  // Penalize high workload
    score += highPriorityCount * 5;  // Extra penalty for existing high priority work
    score -= sameLocation ? 20 : 0;  // Bonus for same location
    return score;  // Lower score = better candidate
}
```

**Exit Criteria:**
- ✅ Assignment algorithm tested with various scenarios
- ✅ Workload calculation accurate
- ✅ All tests pass
- ✅ Code review approved

#### Stage 2.3: Detailed View Tool (1.5 days)

**Tasks:**
- [ ] Create `AgentWorkOrderDetailsRequest` DTO
- [ ] Create `AgentWorkOrderDetailsResponse` DTO (comprehensive)
- [ ] Create nested DTOs for tasks, labor, parts, costs
- [ ] Implement `getWorkOrderDetails()` in `AgentToolService`
- [ ] Optimize database queries (use JOIN FETCH)
- [ ] Add cost calculation logic
- [ ] Add endpoint to `AgentToolController`
- [ ] Create unit tests
- [ ] Create integration tests

**Files Modified/Created:**
- `api/src/main/java/com/grash/dto/agent/AgentWorkOrderDetailsRequest.java` (NEW)
- `api/src/main/java/com/grash/dto/agent/AgentWorkOrderDetailsResponse.java` (NEW)
- `api/src/main/java/com/grash/dto/agent/AgentTaskSummary.java` (NEW)
- `api/src/main/java/com/grash/dto/agent/AgentLaborSummary.java` (NEW)
- `api/src/main/java/com/grash/dto/agent/AgentPartUsageSummary.java` (NEW)
- `api/src/main/java/com/grash/dto/agent/AgentCostSummary.java` (NEW)
- `api/src/main/java/com/grash/service/AgentToolService.java` (MODIFY)
- `api/src/main/java/com/grash/controller/AgentToolController.java` (MODIFY)

**Performance Optimization:**
```java
// Use single query with JOIN FETCH to avoid N+1 problem
@Query("SELECT wo FROM WorkOrder wo " +
       "LEFT JOIN FETCH wo.asset " +
       "LEFT JOIN FETCH wo.location " +
       "LEFT JOIN FETCH wo.assignedTo " +
       "LEFT JOIN FETCH wo.team " +
       "LEFT JOIN FETCH wo.tasks " +
       "LEFT JOIN FETCH wo.labors " +
       "LEFT JOIN FETCH wo.partQuantities " +
       "WHERE wo.id = :id AND wo.company.id = :companyId")
WorkOrder findByIdWithDetails(@Param("id") Long id, @Param("companyId") Long companyId);
```

**Exit Criteria:**
- ✅ Query performance acceptable (< 500ms for full details)
- ✅ All relationships loaded correctly
- ✅ Cost calculations accurate
- ✅ All tests pass
- ✅ Code review approved

#### Stage 2.4: Enhanced Filters (0.5 days)

**Tasks:**
- [ ] Expand `AgentWorkOrderSearchRequest` DTO
- [ ] Update `searchWorkOrders()` method in `AgentToolService`
- [ ] Implement date range filter builders
- [ ] Implement user/team filter builders
- [ ] Implement entity relationship filter builders
- [ ] Add sorting logic
- [ ] Update existing tests
- [ ] Add tests for new filters

**Files Modified:**
- `api/src/main/java/com/grash/dto/agent/AgentWorkOrderSearchRequest.java` (MODIFY)
- `api/src/main/java/com/grash/service/AgentToolService.java` (MODIFY)

**Filter Implementation:**
```java
private void appendDateRangeFilter(SearchCriteria criteria,
                                   String field,
                                   LocalDateTime start,
                                   LocalDateTime end) {
    if (start != null || end != null) {
        if (start != null && end != null) {
            criteria.getFilterFields().add(FilterField.builder()
                .field(field)
                .operation("between")
                .values(Arrays.asList(start, end))
                .build());
        } else if (start != null) {
            criteria.getFilterFields().add(FilterField.builder()
                .field(field)
                .operation("gte")
                .value(start)
                .build());
        } else {
            criteria.getFilterFields().add(FilterField.builder()
                .field(field)
                .operation("lte")
                .value(end)
                .build());
        }
    }
}

private void appendUserFilter(SearchCriteria criteria, List<Long> userIds) {
    if (!CollectionUtils.isEmpty(userIds)) {
        criteria.getFilterFields().add(FilterField.builder()
            .field("assignedTo.id")
            .operation("in")
            .values(new ArrayList<>(userIds))
            .build());
    }
}
```

**Exit Criteria:**
- ✅ All filter combinations work correctly
- ✅ Sorting works for all supported fields
- ✅ Tests cover edge cases
- ✅ Code review approved

---

### Stage 3: Agent Proxy Integration (2 days)

**Milestone:** Agent tools registered and functional in conversation

#### Stage 3.1: Tool Definitions (0.5 days)

**Tasks:**
- [ ] Define `updateWorkOrderStatusTool` in agents-proxy
- [ ] Define `assignWorkOrderTool` in agents-proxy
- [ ] Define `viewWorkOrderDetailsTool` in agents-proxy
- [ ] Update `viewWorkOrdersTool` with new parameters
- [ ] Register all tools with Atlas agent

**Files Modified/Created:**
- `agents-proxy/src/index.js` (MODIFY - add 3 new tools, update 1)

**Tool Registration:**
```javascript
const atlasAgent = new Agent({
  name: "Atlas Maintenance Copilot",
  instructions: (runContext) => buildAgentInstructions(runContext),
  model: OPENAI_MODEL,
  tools: [
    viewWorkOrdersTool,  // Enhanced with new filters
    viewAssetsTool,
    getUserContextTool,
    prepareCompletionDraftTool,
    updateWorkOrderStatusTool,  // NEW
    assignWorkOrderTool,  // NEW
    viewWorkOrderDetailsTool,  // NEW
  ]
});
```

**Exit Criteria:**
- ✅ All tools defined with proper Zod schemas
- ✅ Tool descriptions clear and LLM-friendly
- ✅ Tools registered with agent
- ✅ No syntax errors

#### Stage 3.2: Tool Implementation (1 day)

**Tasks:**
- [ ] Implement `updateWorkOrderStatusTool.execute()`
- [ ] Implement `assignWorkOrderTool.execute()`
- [ ] Implement `viewWorkOrderDetailsTool.execute()`
- [ ] Update `viewWorkOrdersTool.execute()` for new filters
- [ ] Add normalization functions for new response formats
- [ ] Add summary functions for insights generation
- [ ] Add error handling and logging

**Normalization Example:**
```javascript
const normaliseWorkOrderDetails = (workOrder) => {
  if (!workOrder || typeof workOrder !== "object") {
    return null;
  }

  return {
    id: workOrder.id,
    code: workOrder.code || workOrder.customId || workOrder.id,
    title: workOrder.title || "Work order",
    status: workOrder.status || null,
    priority: workOrder.priority || null,
    dueDate: workOrder.dueDate || null,
    asset: workOrder.asset?.name || null,
    location: workOrder.location?.name || null,
    assignedTo: workOrder.assignedTo?.map(u => u.name) || [],
    team: workOrder.team?.name || null,
    tasks: {
      total: workOrder.tasks?.length || 0,
      completed: workOrder.tasks?.filter(t => t.status === "COMPLETED").length || 0
    },
    costs: {
      labor: workOrder.costSummary?.laborCost || 0,
      parts: workOrder.costSummary?.partsCost || 0,
      additional: workOrder.costSummary?.additionalCost || 0,
      total: workOrder.costSummary?.totalCost || 0,
      estimated: workOrder.costSummary?.estimatedCost || 0,
      variance: workOrder.costSummary?.variance || 0
    },
    files: workOrder.files?.length || 0
  };
};

const summariseWorkOrderDetails = (details) => {
  if (!details) return "No work order details available.";

  const parts = [];
  parts.push(`${details.code}: ${details.title}`);
  parts.push(`Status: ${details.status}, Priority: ${details.priority}`);

  if (details.assignedTo.length) {
    parts.push(`Assigned to: ${details.assignedTo.join(", ")}`);
  }

  if (details.tasks.total > 0) {
    parts.push(`Tasks: ${details.tasks.completed}/${details.tasks.total} completed`);
  }

  if (details.costs.total > 0) {
    parts.push(`Total cost: $${details.costs.total} (est: $${details.costs.estimated})`);
    if (details.costs.variance !== 0) {
      const sign = details.costs.variance > 0 ? "over" : "under";
      parts.push(`${sign} budget by $${Math.abs(details.costs.variance)}`);
    }
  }

  return parts.join("\n");
};
```

**Exit Criteria:**
- ✅ All tool execute functions call backend APIs correctly
- ✅ Response normalization works
- ✅ Insights generation provides value
- ✅ Error handling graceful

#### Stage 3.3: Agent Instructions Update (0.5 days)

**Tasks:**
- [ ] Update `buildAgentInstructions()` to include new capabilities
- [ ] Add examples for status updates in instructions
- [ ] Add examples for assignments in instructions
- [ ] Add guidance on when to use detailed view

**Updated Instructions:**
```javascript
const buildAgentInstructions = (runContext) => {
  const displayName = resolveDisplayName(runContext?.context?.userContext) || "there";
  return [
    "You are Atlas Assistant, a maintenance copilot for Atlas CMMS.",
    `Always greet ${displayName} by name in your first sentence.`,
    "Use the available tools to fetch real data instead of guessing.",

    // NEW: Status update guidance
    "When users want to start work, use update_work_order_status to change status to IN_PROGRESS.",
    "When users want to complete work, verify all required tasks are done before updating to COMPLETED.",
    "If placing work on hold, always ask for a reason and include it in the status update.",

    // NEW: Assignment guidance
    "When users want to assign work, use assign_work_order. Suggest best available if they don't specify.",
    "Check workload before recommending assignments - avoid overloading technicians.",

    // NEW: Detailed view guidance
    "Use view_work_order_details when users ask about progress, costs, or need comprehensive information.",
    "For simple queries, use view_work_orders. For detailed analysis, use view_work_order_details.",

    "Summarise tool outputs clearly, reference work order or asset identifiers, and suggest next steps when helpful.",
    "If information is missing, explain what else you need and provide actionable guidance."
  ].join(" ");
};
```

**Exit Criteria:**
- ✅ Instructions updated and comprehensive
- ✅ Examples clear and relevant
- ✅ Agent behavior aligns with user expectations

---

### Stage 4: Testing & Quality Assurance (3 days)

**Milestone:** All tests pass and quality gates met

#### Stage 4.1: Unit Testing (1 day)

**Tasks:**
- [ ] Backend service layer tests (AgentToolService)
- [ ] Backend controller tests (AgentToolController)
- [ ] Proxy tool execution tests
- [ ] Validation logic tests
- [ ] Error handling tests

**Coverage Targets:**
- Service layer: >90%
- Controller layer: >80%
- Proxy tools: >85%

**Test Categories:**

**Happy Path Tests:**
```java
@Test
public void testUpdateWorkOrderStatus_OpenToInProgress_Success() {
    // Arrange
    WorkOrder workOrder = createTestWorkOrder(Status.OPEN);
    AgentWorkOrderStatusUpdateRequest request = new AgentWorkOrderStatusUpdateRequest();
    request.setWorkOrderId(workOrder.getId());
    request.setNewStatus("IN_PROGRESS");

    // Act
    AgentToolResponse<AgentWorkOrderStatusUpdateResponse> response =
        agentToolService.updateWorkOrderStatus(testUser, request);

    // Assert
    assertNotNull(response);
    assertEquals("IN_PROGRESS", response.getResults().get(0).getNewStatus());
    assertEquals("OPEN", response.getResults().get(0).getPreviousStatus());
}
```

**Validation Tests:**
```java
@Test
public void testUpdateWorkOrderStatus_OnHoldWithoutReason_Fails() {
    // Arrange
    WorkOrder workOrder = createTestWorkOrder(Status.IN_PROGRESS);
    AgentWorkOrderStatusUpdateRequest request = new AgentWorkOrderStatusUpdateRequest();
    request.setWorkOrderId(workOrder.getId());
    request.setNewStatus("ON_HOLD");
    // No reason code provided

    // Act & Assert
    assertThrows(CustomException.class, () -> {
        agentToolService.updateWorkOrderStatus(testUser, request);
    });
}
```

**RBAC Tests:**
```java
@Test
public void testUpdateWorkOrderStatus_UnauthorizedRole_Fails() {
    // Arrange
    OwnUser limitedUser = createUserWithRole(RoleCode.LIMITED_TECHNICIAN);
    WorkOrder workOrder = createTestWorkOrder(Status.OPEN);
    AgentWorkOrderStatusUpdateRequest request = new AgentWorkOrderStatusUpdateRequest();
    request.setWorkOrderId(workOrder.getId());
    request.setNewStatus("IN_PROGRESS");

    // Act & Assert
    assertThrows(CustomException.class, () -> {
        agentToolService.updateWorkOrderStatus(limitedUser, request);
    });
}
```

**Multi-tenant Isolation Tests:**
```java
@Test
public void testUpdateWorkOrderStatus_DifferentTenant_Fails() {
    // Arrange
    OwnUser userCompanyA = createUserForCompany(1L);
    WorkOrder workOrderCompanyB = createTestWorkOrderForCompany(2L);
    AgentWorkOrderStatusUpdateRequest request = new AgentWorkOrderStatusUpdateRequest();
    request.setWorkOrderId(workOrderCompanyB.getId());
    request.setNewStatus("IN_PROGRESS");

    // Act & Assert
    assertThrows(CustomException.class, () -> {
        agentToolService.updateWorkOrderStatus(userCompanyA, request);
    });
}
```

**Exit Criteria:**
- ✅ All unit tests pass
- ✅ Coverage targets met
- ✅ Edge cases covered
- ✅ No flaky tests

#### Stage 4.2: Integration Testing (1 day)

**Tasks:**
- [ ] API endpoint integration tests
- [ ] Database transaction tests
- [ ] Agent conversation tests (end-to-end)
- [ ] Multi-tenant isolation verification
- [ ] Performance tests

**Integration Test Examples:**

**API Integration Test:**
```java
@Test
@WithMockUser(roles = "ADMIN")
public void testUpdateWorkOrderStatusEndpoint_Success() throws Exception {
    // Arrange
    WorkOrder workOrder = createTestWorkOrder(Status.OPEN);
    String requestBody = """
        {
            "workOrderId": %d,
            "newStatus": "IN_PROGRESS",
            "notes": "Starting work now"
        }
        """.formatted(workOrder.getId());

    // Act & Assert
    mockMvc.perform(post("/api/agent/tools/work-orders/update-status")
            .contentType(MediaType.APPLICATION_JSON)
            .content(requestBody))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.results[0].newStatus").value("IN_PROGRESS"))
        .andExpect(jsonPath("$.results[0].previousStatus").value("OPEN"));

    // Verify database updated
    WorkOrder updated = workOrderRepository.findById(workOrder.getId()).orElseThrow();
    assertEquals(Status.IN_PROGRESS, updated.getStatus());
}
```

**Agent Conversation Test:**
```javascript
// In agents-proxy/__tests__/conversation.test.js
describe("Work Order Status Update Conversations", () => {
  test("should update status when user says 'start work'", async () => {
    const prompt = "Start work on WO-12345";
    const response = await sendAgentPrompt(prompt, mockAuthHeader);

    expect(response.status).toBe("success");
    expect(response.toolCalls).toHaveLength(2);
    expect(response.toolCalls[0].toolName).toBe("view_work_orders");
    expect(response.toolCalls[1].toolName).toBe("update_work_order_status");
    expect(response.toolCalls[1].arguments.newStatus).toBe("IN_PROGRESS");
    expect(response.messages[0].content).toContain("started");
  });

  test("should request reason when putting work on hold", async () => {
    const prompt = "Put WO-12345 on hold";
    const response = await sendAgentPrompt(prompt, mockAuthHeader);

    // Agent should ask for reason
    expect(response.messages[0].content.toLowerCase()).toContain("reason");
  });
});
```

**Performance Test:**
```java
@Test
public void testViewWorkOrderDetails_PerformanceAcceptable() {
    // Arrange
    WorkOrder workOrder = createComplexWorkOrder(); // With tasks, labor, parts, etc.

    // Act
    long startTime = System.currentTimeMillis();
    AgentToolResponse<AgentWorkOrderDetailsResponse> response =
        agentToolService.getWorkOrderDetails(testUser, workOrder.getId());
    long duration = System.currentTimeMillis() - startTime;

    // Assert
    assertNotNull(response);
    assertTrue(duration < 500, "Query took " + duration + "ms, expected < 500ms");
}
```

**Exit Criteria:**
- ✅ All integration tests pass
- ✅ Multi-tenant isolation verified
- ✅ Performance benchmarks met
- ✅ Agent conversations natural and accurate

#### Stage 4.3: Manual Testing & UAT (1 day)

**Tasks:**
- [ ] Manual API testing via Postman/Swagger
- [ ] Agent conversation testing via UI
- [ ] Cross-browser testing (if UI changes)
- [ ] Mobile testing (if applicable)
- [ ] Accessibility testing
- [ ] User acceptance testing with stakeholders

**Test Scenarios:**

**Scenario 1: Technician Updates Status**
```
Role: TECHNICIAN
Preconditions: Work order WO-12345 in OPEN status, assigned to current user

Steps:
1. Open agent chat
2. Type: "I'm starting work on WO-12345"
3. Verify agent responds with confirmation
4. Verify status changed to IN_PROGRESS in UI
5. Verify audit log shows status change
6. Type: "Put WO-12345 on hold because waiting for parts"
7. Verify agent asks for reason (if not provided)
8. Confirm hold placement
9. Verify status changed to ON_HOLD
10. Verify reason stored correctly

Expected Result: All status updates successful, audit trail complete
```

**Scenario 2: Manager Assigns Work**
```
Role: MANAGER
Preconditions: Unassigned work order, multiple available technicians

Steps:
1. Open agent chat
2. Type: "Assign WO-12345 to best available plumber"
3. Verify agent shows workload for available plumbers
4. Verify agent recommends technician with lowest workload
5. Confirm assignment
6. Verify work order assigned correctly
7. Verify notification sent to assignee

Expected Result: Intelligent assignment based on workload, notifications sent
```

**Scenario 3: Supervisor Reviews Details**
```
Role: SUPERVISOR
Preconditions: Work order in progress with tasks, labor, parts

Steps:
1. Open agent chat
2. Type: "Show me full details for WO-12345"
3. Verify agent returns comprehensive information:
   - Basic info (status, priority, due date)
   - Task completion (X/Y completed)
   - Labor hours and costs
   - Parts used and costs
   - Total cost with variance
   - File attachments count
4. Ask follow-up: "Is this work order on budget?"
5. Verify agent analyzes cost variance correctly

Expected Result: Complete information presented, cost analysis accurate
```

**Scenario 4: Advanced Search**
```
Role: MANAGER
Preconditions: Multiple work orders with various statuses, dates, assignments

Steps:
1. Open agent chat
2. Type: "Show me overdue high priority work orders for Team A"
3. Verify agent applies correct filters:
   - Priority: HIGH
   - Due date: < today
   - Team: Team A
4. Verify results accurate
5. Type: "Sort by most overdue first"
6. Verify sorting applied correctly

Expected Result: Filters and sorting work correctly, results accurate
```

**Exit Criteria:**
- ✅ All manual test scenarios pass
- ✅ No critical bugs found
- ✅ User acceptance obtained
- ✅ Accessibility requirements met

---

### Stage 5: Documentation & Deployment (2 days)

**Milestone:** Feature documented and deployed to production

#### Stage 5.1: Documentation (1 day)

**Tasks:**
- [ ] Update API documentation (Swagger/OpenAPI)
- [ ] Update atlas-agents.md with new tools
- [ ] Create user guide for new features
- [ ] Create example conversations
- [ ] Update README files
- [ ] Create runbook for operations

**Documentation Deliverables:**

**API Documentation:**
- OpenAPI spec for all 4 endpoints
- Example requests and responses
- Error codes and messages
- Authentication requirements

**User Guide:**
```markdown
# Work Order Management with Atlas AI Agent

## Updating Work Order Status

You can ask the agent to update work order status using natural language:

**Examples:**
- "Start work on WO-12345"
- "Put WO-12345 on hold because waiting for parts"
- "Mark WO-12345 as completed"

**Status Transitions:**
- OPEN → IN_PROGRESS: Anyone assigned can start
- IN_PROGRESS → ON_HOLD: Requires reason
- IN_PROGRESS → COMPLETED: Validates all tasks completed
- COMPLETED → OPEN: Requires manager approval

## Assigning Work Orders

Ask the agent to assign work intelligently:

**Examples:**
- "Assign WO-12345 to John Smith"
- "Assign WO-12345 to the Plumbing Team"
- "Assign WO-12345 to best available technician"

The agent will:
- Check technician workload
- Consider skills and location
- Suggest optimal assignment
- Request confirmation before assigning

## Viewing Work Order Details

Get comprehensive work order information:

**Examples:**
- "Show me details for WO-12345"
- "What's the status of WO-12345?"
- "Is WO-12345 on budget?"

The agent provides:
- Task completion status
- Labor hours and costs
- Parts used and costs
- Total cost vs estimate
- File attachments
- Assignment history

## Advanced Search

Find work orders with complex filters:

**Examples:**
- "Show me overdue high priority work orders"
- "List work orders assigned to Team A due this week"
- "Find all open work orders for Building A"

**Supported Filters:**
- Status, Priority
- Date ranges (due, created, updated)
- Assigned users and teams
- Assets, Locations, Categories
- Sorting options
```

**Runbook:**
```markdown
# Work Order Management Tools - Operations Runbook

## Monitoring

**Metrics to Track:**
- Tool invocation success rate (target: >99%)
- Average response time (target: <2s)
- Error rate by tool (target: <1%)
- User adoption rate (conversations using new tools)

**Dashboards:**
- Grafana: "Agent Tools Performance"
- SQL Query: `SELECT tool_name, COUNT(*), AVG(response_time)
              FROM agent_tool_invocation_log
              WHERE created_at > NOW() - INTERVAL '1 day'
              GROUP BY tool_name`

## Common Issues

**Issue: Status update fails with "Invalid transition"**
- Check current work order status
- Verify transition is allowed (see status transition matrix)
- Check user has required permissions

**Issue: Assignment fails with "User not found"**
- Verify user is active and not archived
- Check user belongs to same company as work order
- Verify user role permits work order assignment

**Issue: Details query slow (>2s)**
- Check database query plan
- Verify JOIN FETCH is being used
- Consider adding database indexes
- Check for large number of related entities (tasks, labor)

## Rollback Procedure

If critical issues found:
1. Disable new tools via feature flag: `agent.tools.work-order-management.enabled=false`
2. Restart agents-proxy service
3. Verify old functionality still works
4. Investigate and fix issue
5. Re-enable feature flag
```

**Exit Criteria:**
- ✅ All documentation complete and reviewed
- ✅ Examples tested and working
- ✅ Runbook validated by operations team

#### Stage 5.2: Deployment (1 day)

**Tasks:**
- [ ] Deploy database migrations (if any)
- [ ] Deploy backend API changes
- [ ] Deploy agents-proxy changes
- [ ] Update environment variables
- [ ] Enable feature flags
- [ ] Smoke test in production
- [ ] Monitor for errors
- [ ] Communicate release to users

**Deployment Steps:**

**1. Pre-Deployment Checklist:**
- [ ] All tests pass in staging
- [ ] Database backup completed
- [ ] Rollback plan documented
- [ ] Stakeholders notified
- [ ] Maintenance window scheduled (if needed)

**2. Database Migration:**
```bash
# Run Liquibase migrations
./gradlew update -Pcontexts=production

# Verify migrations applied
psql -h prod-db -U admin -d atlas_cmms -c "SELECT * FROM databasechangelog ORDER BY dateexecuted DESC LIMIT 5;"
```

**3. Backend Deployment:**
```bash
# Build and deploy API
./gradlew clean build
docker build -t atlas-api:v2.5.0 .
docker push atlas-api:v2.5.0

# Update Kubernetes deployment
kubectl set image deployment/atlas-api api=atlas-api:v2.5.0
kubectl rollout status deployment/atlas-api

# Verify health
curl https://api.atlas-cmms.com/health
```

**4. Agents Proxy Deployment:**
```bash
# Deploy agents-proxy
cd agents-proxy
npm run build
docker build -t atlas-agents-proxy:v2.5.0 .
docker push atlas-agents-proxy:v2.5.0

kubectl set image deployment/agents-proxy proxy=atlas-agents-proxy:v2.5.0
kubectl rollout status deployment/agents-proxy

# Verify health
curl https://agents.atlas-cmms.com/health
```

**5. Smoke Testing:**
```bash
# Test status update
curl -X POST https://api.atlas-cmms.com/api/agent/tools/work-orders/update-status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"workOrderId": 12345, "newStatus": "IN_PROGRESS"}'

# Test agent conversation
curl -X POST https://agents.atlas-cmms.com/v1/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Show me open work orders", "agentId": "atlas-maintenance-copilot"}'
```

**6. Post-Deployment Monitoring:**
- Monitor error logs for 1 hour
- Check tool invocation success rate
- Verify no performance degradation
- Monitor user feedback channels

**Rollback Triggers:**
- Error rate >5%
- Tool failure rate >10%
- Performance degradation >50%
- Critical security issue discovered

**Exit Criteria:**
- ✅ All services deployed successfully
- ✅ Smoke tests pass
- ✅ No critical errors in logs
- ✅ Metrics within acceptable ranges
- ✅ User communication sent

---

## Testing Strategy

### Unit Testing

**Backend (Java/JUnit):**
- Service layer: Test business logic, validation, calculations
- Controller layer: Test request/response mapping, authorization
- Repository layer: Test custom queries (if any)

**Frontend (Node.js/Jest):**
- Tool execution logic
- Response normalization
- Error handling
- Insights generation

**Coverage Goals:**
- Service layer: >90%
- Controller layer: >80%
- Tool execution: >85%

### Integration Testing

**API Integration:**
- Request/response contract validation
- Database transaction verification
- Multi-tenant isolation
- RBAC enforcement

**Agent Conversation:**
- Tool invocation from natural language
- Multi-turn conversations
- Context retention across turns
- Error recovery

### Performance Testing

**Load Testing:**
- 100 concurrent tool invocations
- Response time <2s at 95th percentile
- Database query optimization

**Stress Testing:**
- 1000 tool invocations per minute
- Identify breaking points
- Memory leak detection

### Security Testing

**RBAC Verification:**
- Unauthorized role access blocked
- Cross-tenant access prevented
- Privilege escalation prevented

**Input Validation:**
- SQL injection prevention
- XSS prevention (if applicable)
- Parameter tampering detection

### User Acceptance Testing

**UAT Scenarios:**
- Technician daily workflow
- Manager work assignment
- Supervisor oversight and reporting
- Edge cases and error handling

**UAT Participants:**
- 2-3 technicians
- 1-2 managers
- 1 supervisor
- 1 power user

**UAT Duration:** 3-5 days

---

## Acceptance Criteria

### Functional Acceptance

**Status Update Tool:**
- [ ] ✅ Can update status: OPEN → IN_PROGRESS → COMPLETED
- [ ] ✅ Can put work on hold with reason
- [ ] ✅ Validates status transition rules
- [ ] ✅ Records audit trail (who, when, why)
- [ ] ✅ Triggers automatic actions (labor timer, notifications)
- [ ] ✅ Blocks invalid transitions with clear errors

**Assignment Tool:**
- [ ] ✅ Can assign to specific user
- [ ] ✅ Can assign to team
- [ ] ✅ Suggests best available based on workload
- [ ] ✅ Shows current workload for candidates
- [ ] ✅ Validates user exists and is active
- [ ] ✅ Prevents cross-tenant assignments

**Detailed View Tool:**
- [ ] ✅ Returns all work order fields
- [ ] ✅ Includes task completion status
- [ ] ✅ Includes labor hours and costs
- [ ] ✅ Includes parts used and costs
- [ ] ✅ Calculates total costs correctly
- [ ] ✅ Shows cost variance (actual vs estimate)
- [ ] ✅ Lists file attachments
- [ ] ✅ Query performance <500ms

**Enhanced Filters:**
- [ ] ✅ Date range filtering works (due, created, updated)
- [ ] ✅ User/team filtering works
- [ ] ✅ Asset/location/category filtering works
- [ ] ✅ Priority filtering works
- [ ] ✅ Sorting works for all supported fields
- [ ] ✅ Filter combinations work correctly
- [ ] ✅ Results accurate for all filter combinations

### Non-Functional Acceptance

**Performance:**
- [ ] ✅ Tool execution <2s at 95th percentile
- [ ] ✅ Detailed view query <500ms
- [ ] ✅ Supports 100+ concurrent tool invocations
- [ ] ✅ No memory leaks under sustained load

**Security:**
- [ ] ✅ RBAC enforced for all tools
- [ ] ✅ Multi-tenant isolation verified
- [ ] ✅ Input validation prevents injection attacks
- [ ] ✅ Audit logging captures all actions

**Reliability:**
- [ ] ✅ Tool success rate >99%
- [ ] ✅ Graceful error handling
- [ ] ✅ Meaningful error messages to users
- [ ] ✅ No data corruption on failure

**Usability:**
- [ ] ✅ Natural language understanding accurate
- [ ] ✅ Agent responses clear and actionable
- [ ] ✅ Confirmation prompts for critical actions
- [ ] ✅ Help text available for all features

**Documentation:**
- [ ] ✅ API documentation complete
- [ ] ✅ User guide published
- [ ] ✅ Example conversations provided
- [ ] ✅ Runbook available for operations

---

## Success Metrics

### Adoption Metrics

**Target: 60% of active users try new features within 2 weeks**

Measurement:
```sql
SELECT
    COUNT(DISTINCT user_id) * 100.0 / (SELECT COUNT(*) FROM user WHERE active = true) AS adoption_rate
FROM agent_tool_invocation_log
WHERE tool_name IN ('update_work_order_status', 'assign_work_order', 'view_work_order_details')
    AND created_at > NOW() - INTERVAL '14 days';
```

### Usage Metrics

**Target: 500+ tool invocations per week**

Measurement:
```sql
SELECT
    tool_name,
    COUNT(*) AS invocations,
    COUNT(*) * 100.0 / SUM(COUNT(*)) OVER() AS percentage
FROM agent_tool_invocation_log
WHERE tool_name IN ('update_work_order_status', 'assign_work_order', 'view_work_order_details')
    AND created_at > NOW() - INTERVAL '7 days'
GROUP BY tool_name;
```

### Efficiency Metrics

**Target: 50% reduction in manual status updates**

Measurement:
- Baseline: Count UI status updates per week (before feature)
- Post-launch: Count (UI + agent) status updates per week
- Calculate: (Agent updates / Total updates) × 100

**Target: 30% improvement in work order discovery time**

Measurement:
- User study: Time to find specific work order (before vs after)
- Calculate average time reduction

### Quality Metrics

**Target: Tool success rate >99%**

Measurement:
```sql
SELECT
    tool_name,
    COUNT(*) AS total_invocations,
    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS successful,
    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS success_rate
FROM agent_tool_invocation_log
WHERE tool_name IN ('update_work_order_status', 'assign_work_order', 'view_work_order_details')
GROUP BY tool_name;
```

**Target: Average response time <2s**

Measurement:
```sql
SELECT
    tool_name,
    AVG(response_time_ms) AS avg_response_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) AS p95_response_ms
FROM agent_tool_invocation_log
WHERE tool_name IN ('update_work_order_status', 'assign_work_order', 'view_work_order_details')
GROUP BY tool_name;
```

### User Satisfaction

**Target: 4.0+ star rating (out of 5)**

Measurement:
- In-app feedback prompt after tool usage
- NPS survey for agent features
- User interviews

**Target: <5% error/complaint rate**

Measurement:
- Support ticket tracking
- Error report submissions
- User feedback analysis

---

## Dependencies & Risks

### Dependencies

**Technical:**
- ✅ Backend API infrastructure (existing)
- ✅ Agents proxy service (existing)
- ✅ Database schema for work orders (existing)
- ✅ RBAC system (existing)
- ✅ OpenAI Agents SDK (existing)
- ⚠️ Database indexes on search fields (may need optimization)

**Teams:**
- Backend engineering team (5 days effort)
- Agents proxy team (2 days effort)
- QA team (3 days effort)
- DevOps team (1 day deployment support)
- Product team (UAT coordination)

**External:**
- OpenAI API availability (99.9% SLA)
- Database performance (requires tuning)

### Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Database performance degradation with detailed view queries | HIGH | MEDIUM | Optimize queries with JOIN FETCH, add indexes, implement caching |
| OpenAI API latency impacts user experience | MEDIUM | LOW | Set reasonable timeout (5s), provide loading indicators, cache common queries |
| Status transition validation complexity causes bugs | MEDIUM | MEDIUM | Comprehensive unit tests, clear validation rules matrix, extensive UAT |
| Multi-tenant data leakage | CRITICAL | LOW | Rigorous testing of tenant isolation, code review focus on company_id filtering |
| User confusion with new features | MEDIUM | MEDIUM | Clear documentation, in-app help, gradual rollout, user training |
| Assignment algorithm doesn't match real workload | LOW | MEDIUM | Make algorithm configurable, collect feedback, iterate on logic |
| Backward compatibility with existing view_work_orders usage | LOW | LOW | Extend existing API (additive changes only), maintain default behavior |

### Risk Mitigation Plan

**High-Impact Risks:**

1. **Database Performance (HIGH/MEDIUM)**
   - Action: Performance testing before deployment
   - Action: Query optimization review by DBA
   - Action: Implement query result caching (Redis)
   - Fallback: Rate limiting on detailed view queries

2. **Multi-tenant Data Leakage (CRITICAL/LOW)**
   - Action: Dedicated security code review
   - Action: Automated tests for all tenant isolation scenarios
   - Action: Penetration testing before production
   - Fallback: Feature flag to disable immediately if issue found

**Medium-Impact Risks:**

3. **OpenAI API Latency (MEDIUM/LOW)**
   - Action: Implement request timeout (5s)
   - Action: Monitor API latency in production
   - Fallback: Degrade gracefully with error message

4. **Status Validation Bugs (MEDIUM/MEDIUM)**
   - Action: Create validation rules matrix document
   - Action: 100% test coverage for validation logic
   - Action: Extended UAT period with diverse scenarios

5. **User Confusion (MEDIUM/MEDIUM)**
   - Action: User guide with examples
   - Action: In-app tooltips and help
   - Action: Phased rollout (beta users first)
   - Action: Support team training

---

## Implementation Timeline

### Week 1: Planning & Backend (Days 1-5)

**Day 1-2: Planning & Design**
- [x] Feature request finalized
- [ ] API contracts reviewed
- [ ] Database schema reviewed
- [ ] Security review completed

**Day 3-4: Status Update & Assignment Tools**
- [ ] Backend implementation (status update)
- [ ] Backend implementation (assignment)
- [ ] Unit tests
- [ ] Code review

**Day 5: Detailed View & Enhanced Filters**
- [ ] Backend implementation (detailed view)
- [ ] Backend implementation (enhanced filters)
- [ ] Unit tests
- [ ] Code review

### Week 2: Integration & Testing (Days 6-10)

**Day 6-7: Agent Proxy Integration**
- [ ] Tool definitions in agents-proxy
- [ ] Tool execution implementation
- [ ] Agent instructions update
- [ ] Agent conversation tests

**Day 8-9: Testing**
- [ ] Integration testing
- [ ] Performance testing
- [ ] Security testing
- [ ] Manual testing

**Day 10: Documentation & Deployment**
- [ ] Documentation complete
- [ ] Deployment to staging
- [ ] UAT coordination
- [ ] Production deployment

### Post-Launch (Week 3+)

**Monitoring Period (2 weeks):**
- Monitor adoption metrics
- Track error rates
- Collect user feedback
- Fix critical issues

**Iteration (ongoing):**
- Optimize based on usage patterns
- Enhance based on feedback
- Plan next phase enhancements

---

## Conclusion

This feature request defines a comprehensive enhancement to Atlas AI Agent's work order management capabilities. The four components (status updates, assignment, detailed views, enhanced filters) address critical gaps in current functionality and provide significant value to technicians, managers, and supervisors.

**Key Success Factors:**
- Clear requirements and acceptance criteria
- Comprehensive testing strategy
- Phased implementation approach
- Strong focus on security and multi-tenancy
- User-centered design with real conversation examples

**Expected Outcomes:**
- 50% reduction in manual status updates
- 30% improvement in work order discovery efficiency
- Better workload distribution through intelligent assignment
- Enhanced visibility for data-driven decisions

**Next Steps:**
1. Stakeholder review and approval
2. Sprint planning and resource allocation
3. Implementation kickoff
4. Regular progress updates and demos

---

**Document Status:** Draft for Review
**Last Updated:** 2025-10-12
**Review Required By:** Product, Engineering, QA, Security
**Target Start Date:** TBD
**Target Completion Date:** TBD (2 weeks from start)
