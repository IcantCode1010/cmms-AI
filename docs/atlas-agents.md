# Atlas AI Agents - System Review & Capability Expansion

**Document Version:** 1.0
**Date:** 2025-10-12
**Project:** Atlas CMMS AI Integration

---

## Executive Summary

This document provides a comprehensive review of the Atlas AI Agent system, analyzing its current capabilities, database structure, and identifying opportunities for expanding agent functionality to better serve CMMS operations.

**Current State:**
- OpenAI Agents runtime integration via proxy service
- 4 operational tools (work orders, assets, user context, completion drafts)
- Multi-tenant architecture with RBAC enforcement
- Conversation memory with 15-minute TTL
- Tool invocation logging and draft action system

**Key Findings:**
- Strong foundation with secure authentication and tenant isolation
- Limited tool coverage (~10% of available database entities)
- Significant expansion opportunities across 20+ domain areas
- Architecture supports easy tool addition without runtime changes

---

## Table of Contents

1. [Current Agent Architecture](#current-agent-architecture)
2. [Available Tools Analysis](#available-tools-analysis)
3. [Database Structure Overview](#database-structure-overview)
4. [Capability Expansion Opportunities](#capability-expansion-opportunities)
5. [Implementation Recommendations](#implementation-recommendations)
6. [Technical Specifications](#technical-specifications)

---

## Current Agent Architecture

### System Components

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│  Frontend UI    │─────▶│  API Gateway     │─────▶│  Agents Proxy   │
│  (React)        │      │  (Java/Spring)   │      │  (Node.js)      │
└─────────────────┘      └──────────────────┘      └─────────────────┘
                                  │                          │
                                  ▼                          ▼
                         ┌──────────────────┐      ┌─────────────────┐
                         │  Tool Services   │      │  OpenAI Agents  │
                         │  (AgentTool)     │      │  Runtime        │
                         └──────────────────┘      └─────────────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │  PostgreSQL DB   │
                         │  (Multi-tenant)  │
                         └──────────────────┘
```

### Agent Configuration

**Name:** Atlas Maintenance Copilot
**Model:** GPT-4o-mini (configurable via `OPENAI_MODEL`)
**Runtime:** OpenAI Agents SDK v0.1.9
**Proxy Port:** 4005

### Core Instructions

The agent operates with these directives (agents-proxy/src/index.js:653-663):

1. Identity: "Atlas Assistant, a maintenance copilot for Atlas CMMS"
2. Personalization: Always greet user by name
3. Tool-first approach: Use tools instead of guessing
4. Clear communication: Summarize outputs with identifiers and suggest next steps
5. Completion workflow: Identify work order → prepare draft → await confirmation
6. Guidance: Explain missing information and provide actionable steps

### Security & Authorization

**Role-Based Access Control (RBAC):**
- Allowed Roles: ADMIN, MANAGER, TECHNICIAN, SUPERVISOR
- Enforcement: Both proxy (agents-proxy/src/index.js:32) and API (AgentToolService.java:44-46)

**Tenant Isolation:**
- Company ID validation required for all tool executions
- JWT token authentication with identity verification
- User context fetched from `/auth/me` endpoint

**Session Management:**
- Conversation TTL: 15 minutes (configurable)
- Automatic cleanup of expired sessions
- Session ID tracking via metadata

---

## Available Tools Analysis

### Tool 1: view_work_orders

**Location:** agents-proxy/src/index.js:412-504
**API Endpoint:** `/api/agent/tools/work-orders/search`

**Capabilities:**
- Search work orders by status and keyword
- Filter by: OPEN, IN_PROGRESS, ON_HOLD (default)
- Result limit: 1-10 (default: 5)
- Search fields: title, description, customId

**Output Fields:**
- id, code, title, priority, status, dueDate, asset

**Current Limitations:**
- No filtering by date ranges
- No assigned user filtering
- No location or category filtering
- No sorting options beyond updatedAt DESC

### Tool 2: view_assets

**Location:** agents-proxy/src/index.js:506-586
**API Endpoint:** `/api/agent/tools/assets/search`

**Capabilities:**
- Search assets by keyword
- Result limit: 1-10 (default: 5)
- Search fields: name, customId, location.name

**Output Fields:**
- id, name, status, location, customId, category

**Current Limitations:**
- No status filtering (unlike work orders)
- No asset hierarchy navigation
- No linked parts or meters
- No maintenance history

### Tool 3: get_user_context

**Location:** agents-proxy/src/index.js:588-607

**Capabilities:**
- Return authenticated user profile
- Provide role and company context

**Output Fields:**
- id, fullName, role, companyId

**Use Case:**
- Grounding agent responses with user identity
- Role-aware suggestions

### Tool 4: prepare_work_order_completion_draft

**Location:** agents-proxy/src/index.js:609-651

**Capabilities:**
- Create completion proposal for work orders
- Match work order by ID or code
- Store draft in database for user confirmation

**Output Fields:**
- agentSessionId, operationType, payload, summary

**Workflow:**
1. Agent identifies work order to complete
2. Creates draft with "complete_work_order" operation
3. User reviews and confirms via UI
4. Backend executes actual completion

---

## Database Structure Overview

### Core Entities

The Atlas CMMS database contains 20+ interconnected entities. Here's the comprehensive structure:

#### 1. Work Order Domain

**WorkOrder** (extends WorkOrderBase)
- Fields: id, title, description, priority, status, dueDate
- Relations: asset, location, category, team, assignedTo[], customers[]
- Extensions: completedBy, completedOn, signature, feedback, audioDescription
- Parent entities: parentRequest, parentPreventiveMaintenance

**WorkOrderBase** (shared properties)
- Fields: estimatedStartDate, estimatedDuration, image
- Relationships: primaryUser, files[]

**Priority Enum:** HIGH | MEDIUM | LOW | NONE
**Status Values:** OPEN | IN_PROGRESS | ON_HOLD | COMPLETED

#### 2. Asset Domain

**Asset**
- Core: id, name, description, customId, status
- Details: model, serialNumber, barCode, power, manufacturer
- Financial: acquisitionCost, warrantyExpirationDate, inServiceDate
- Relationships: location, category, parentAsset, primaryUser, assignedTo[], teams[], vendors[], customers[], parts[], files[]
- Metrics: openWorkOrders, hasChildren

**Asset Status Enum:**
- OPERATIONAL, DOWN, STANDBY, MODERNIZATION
- INSPECTION_SCHEDULED, COMMISSIONING, EMERGENCY_SHUTDOWN

#### 3. Preventive Maintenance

**PreventiveMaintenance** (extends WorkOrderBase)
- Fields: name, schedule, tasks[], frequency, startsOn, endsOn
- Purpose: Scheduled recurring maintenance

#### 4. Request System

**Request** (extends WorkOrderBase)
- Fields: cancelled, cancellationReason, audioDescription
- Relationship: workOrder (created from request)
- Purpose: User-initiated work requests

#### 5. Parts & Inventory

**Part**
- Core: id, name, cost, quantity, minQuantity, barcode, unit
- Details: description, area, nonStock, additionalInfos
- Relationships: category, image, files[], assignedTo[], vendors[], customers[], teams[]
- Metrics: openWorkOrders

**PartQuantity** (junction entity)
- Links parts to work orders/POs with quantities

#### 6. Labor Tracking

**Labor**
- Fields: id, hourlyRate, startedAt, duration, status (RUNNING | STOPPED)
- Relationships: assignedTo (user), timeCategory
- Flags: includeToTotalTime, logged

#### 7. Additional Costs

**AdditionalCost**
- Fields: id, description, cost, date
- Relationships: assignedTo (user), category
- Flags: includeToTotalCost

#### 8. Location Management

**Location**
- Core: id, name, address, latitude, longitude, customId
- Relationships: parentLocation, image, files[], vendors[], customers[], workers[], teams[]
- Hierarchy: Supports nested locations

#### 9. Vendor Management

**Vendor**
- Fields: id, companyName, name, email, phone, address, website
- Details: vendorType, description, rate

#### 10. Customer Management

**Customer**
- Fields: id, name, email, phone, address, website
- Details: customerType, description, rate
- Billing: billingName, billingAddress, billingAddress2, billingCurrency

#### 11. Team Management

**Team**
- Fields: id, name, description
- Relationships: users[]

#### 12. Meter Readings

**Meter**
- Core: id, name, unit, updateFrequency
- Relationships: asset, location, meterCategory, users[], image
- Tracking: nextReading, lastReading

**Reading** (meter values)
- Linked to specific meters for tracking

#### 13. Purchase Orders

**PurchaseOrder**
- Core: id, name, status (APPROVED | PENDING | REJECTED)
- Details: category, vendor, additionalDetails
- Shipping: shippingDueDate, shipToName, companyName, address, city, state, zipCode, phone, fax
- Additional: requisitionedName, shippingMethod, orderCategory, term, notes
- Items: partQuantities[]

#### 14. Tasks & Checklists

**Task**
- Fields: id, value, notes, images[]
- Relationship: taskBase

**TaskBase**
- Fields: id, label, taskType
- Types: SUBTASK | NUMBER | TEXT | INSPECTION | MULTIPLE | METER
- Relationships: options[], user, asset, meter

**Checklist**
- Fields: id, name, category, description
- Relationships: taskBases[]

#### 15. Category System

**Category**
- Universal categorization for work orders, parts, labor, meters, etc.

#### 16. File Management

**File**
- Attachments for work orders, assets, locations, tasks, etc.

#### 17. Audit Trail

**Audit** (base interface)
- Fields: createdBy, updatedBy, createdAt, updatedAt
- Applied to: Most entities for change tracking

### Entity Relationship Summary

```
WorkOrder ──▶ Asset ──▶ Location
    │           │          │
    ├──▶ Team   ├──▶ Meter │
    │           │          │
    ├──▶ Parts  ├──▶ Files │
    │           │          │
    ├──▶ Labor  └──▶ Category
    │
    ├──▶ AdditionalCost
    │
    ├──▶ Tasks/Checklist
    │
    └──▶ Request/PreventiveMaintenance (parent types)

PurchaseOrder ──▶ Vendor
    │
    └──▶ PartQuantities ──▶ Part

Customer ◀─── Associated with: WorkOrder, Asset, Location, Part, Vendor
```

---

## Capability Expansion Opportunities

Based on the database structure analysis, here are 20+ high-value opportunities for agent tool expansion:

### Priority 1: Critical Operations (Immediate Impact)

#### 1. **Enhanced Work Order Management**

**New Tool: `update_work_order_status`**
- Change work order status (OPEN → IN_PROGRESS → ON_HOLD → COMPLETED)
- Add notes/comments during status transitions
- Validate status transition rules
- Impact: Enable agents to help technicians progress work

**New Tool: `assign_work_order`**
- Assign/reassign work orders to users or teams
- Check user availability and workload
- Validate role permissions
- Impact: Intelligent work distribution and load balancing

**New Tool: `view_work_order_details`**
- Full work order details (current tool only provides summary)
- Include: tasks, labor, parts used, costs, files, history
- Impact: Comprehensive work order analysis

**Expansion: `view_work_orders` filters**
- Add date range filtering (dueDate, createdAt, updatedAt)
- Filter by assignedTo, primaryUser, team
- Filter by category, location, asset
- Sort options: priority, dueDate, status, updatedAt
- Impact: More precise work order discovery

#### 2. **Preventive Maintenance Operations**

**New Tool: `view_preventive_maintenance`**
- List scheduled PM tasks
- Filter by: schedule frequency, due date, asset, location
- Show: upcoming PMs, overdue PMs, completion rate
- Impact: Proactive maintenance planning

**New Tool: `view_pm_schedule`**
- Show PM calendar/schedule
- Identify conflicts and gaps
- Suggest optimal scheduling
- Impact: Better maintenance planning

**New Tool: `create_work_order_from_pm`**
- Generate work order from PM template
- Pre-populate tasks, checklists, parts
- Assign to appropriate team
- Impact: Streamline PM execution

#### 3. **Asset Lifecycle Management**

**Expansion: `view_assets` enhancement**
- Add status filtering (OPERATIONAL, DOWN, etc.)
- Include: openWorkOrders count, parts list, meters
- Show asset hierarchy (parent/children)
- Filter by: category, primaryUser, location, status
- Impact: Better asset visibility

**New Tool: `view_asset_details`**
- Full asset profile: model, serial, warranty, acquisition cost
- Maintenance history: work orders, downtime events
- Related: parts, meters, files, assigned teams
- Impact: Comprehensive asset intelligence

**New Tool: `view_asset_downtime`**
- Track asset availability and downtime
- Calculate: MTBF, MTTR, availability percentage
- Identify patterns and trends
- Impact: Data-driven maintenance decisions

**New Tool: `update_asset_status`**
- Change asset status with reason codes
- Trigger automatic work order creation for DOWN status
- Log status transitions for audit
- Impact: Real-time asset status management

#### 4. **Parts & Inventory Intelligence**

**New Tool: `view_parts_inventory`**
- Search parts with low stock alerts (quantity < minQuantity)
- Filter by: category, location, vendor, nonStock flag
- Show: cost, openWorkOrders, usage trends
- Impact: Prevent stockouts and delays

**New Tool: `view_part_details`**
- Full part information: barcode, vendors, cost history
- Usage analytics: work orders, consumption rate
- Reorder suggestions based on usage patterns
- Impact: Intelligent inventory management

**New Tool: `check_part_availability`**
- Verify part availability for work order
- Suggest alternatives if out of stock
- Calculate total parts cost
- Impact: Work order planning accuracy

**New Tool: `request_part_order`**
- Create purchase order draft for parts
- Suggest vendor based on cost/availability
- Include shipping details
- Impact: Streamlined procurement

### Priority 2: Operational Efficiency (High Value)

#### 5. **Labor & Time Tracking**

**New Tool: `view_labor_logs`**
- Track labor hours by work order, user, date range
- Calculate total labor costs
- Identify: top performers, bottlenecks, overtime
- Impact: Labor cost visibility and optimization

**New Tool: `start_labor_timer`**
- Start labor tracking for work order
- Assign user and hourly rate
- Set time category
- Impact: Accurate time tracking automation

**New Tool: `stop_labor_timer`**
- Stop running labor timer
- Calculate duration and cost
- Flag for inclusion in total time
- Impact: Automated labor logging

#### 6. **Cost Management**

**New Tool: `view_work_order_costs`**
- Calculate total work order cost breakdown:
  - Labor costs (hourly rate × duration)
  - Parts costs (parts used × quantities)
  - Additional costs
- Compare estimated vs actual costs
- Impact: Financial visibility and budget control

**New Tool: `add_additional_cost`**
- Record miscellaneous costs (travel, materials, etc.)
- Categorize costs
- Flag for total cost inclusion
- Impact: Comprehensive cost tracking

**New Tool: `view_cost_analytics`**
- Cost trends by: asset, location, category, time period
- Identify high-cost assets/locations
- Budget vs actual analysis
- Impact: Data-driven budgeting decisions

#### 7. **Request Management**

**New Tool: `view_requests`**
- List work requests (user-submitted)
- Filter by: status, cancelled, date, location
- Show: pending approvals, conversion rate to work orders
- Impact: Request queue visibility

**New Tool: `create_work_order_from_request`**
- Convert request to work order
- Pre-populate fields from request
- Assign priority and team
- Impact: Faster request processing

**New Tool: `cancel_request`**
- Cancel work request with reason
- Notify requester
- Track cancellation reasons for analysis
- Impact: Request lifecycle management

#### 8. **Meter & Reading Management**

**New Tool: `view_meters`**
- List meters with reading status
- Filter by: asset, location, overdue readings
- Show: nextReading, lastReading, updateFrequency
- Impact: Proactive meter monitoring

**New Tool: `record_meter_reading`**
- Submit new meter reading
- Validate against expected ranges
- Trigger work orders if thresholds exceeded
- Impact: Automated condition monitoring

**New Tool: `view_meter_readings`**
- Reading history and trends
- Anomaly detection
- Forecast next maintenance based on readings
- Impact: Predictive maintenance enablement

#### 9. **Task & Checklist Execution**

**New Tool: `view_work_order_tasks`**
- List tasks for specific work order
- Show completion status and notes
- Include task types: SUBTASK, INSPECTION, METER, etc.
- Impact: Task-level progress tracking

**New Tool: `update_task_status`**
- Mark tasks complete with values/notes
- Attach images for inspections
- Record meter readings via tasks
- Impact: Digital checklist execution

**New Tool: `view_checklists`**
- List available checklist templates
- Filter by category
- Show task breakdowns
- Impact: Standardized procedure access

### Priority 3: Strategic Intelligence (Long-term Value)

#### 10. **Location & Spatial Intelligence**

**New Tool: `view_locations`**
- List locations with hierarchy
- Filter by: parent location, workers, teams
- Show: asset count, open work order count
- Impact: Location-based operations management

**New Tool: `view_location_details`**
- Full location profile with GPS coordinates
- Assets at location
- Active work orders at location
- Assigned workers and teams
- Impact: Site-level operational visibility

#### 11. **Team & User Management**

**New Tool: `view_teams`**
- List teams with member counts
- Show: assigned work orders, specializations
- Filter by: active work, location
- Impact: Resource planning and allocation

**New Tool: `view_team_workload`**
- Team capacity and current assignments
- Open vs in-progress work orders
- Overdue work orders
- Impact: Load balancing optimization

**New Tool: `view_user_workload`**
- Individual technician assignments
- Work order status distribution
- Performance metrics (completion rate, average time)
- Impact: Individual performance management

#### 12. **Vendor & Supplier Management**

**New Tool: `view_vendors`**
- List vendors with specializations
- Filter by: vendorType, active POs
- Show: contact info, rate, performance
- Impact: Vendor relationship management

**New Tool: `view_vendor_performance`**
- Vendor metrics: on-time delivery, cost, quality
- Compare vendors for parts/services
- Suggest best vendor for work order
- Impact: Data-driven procurement decisions

#### 13. **Purchase Order Management**

**New Tool: `view_purchase_orders`**
- List POs with status filtering
- Show: vendor, parts, costs, due dates
- Filter by: status (APPROVED/PENDING/REJECTED), date, vendor
- Impact: Procurement pipeline visibility

**New Tool: `view_purchase_order_details`**
- Full PO with line items (partQuantities)
- Shipping details and status
- Track delivery and receiving
- Impact: Order fulfillment tracking

**New Tool: `approve_purchase_order`**
- Create draft for PO approval
- Route for manager authorization
- Track approval workflow
- Impact: Streamlined approval process

#### 14. **Customer Management**

**New Tool: `view_customers`**
- List customers with service history
- Show: work orders, billing info, contact details
- Filter by: customerType, active work
- Impact: Customer relationship tracking

**New Tool: `view_customer_work_history`**
- Work order history for customer
- Cost analysis and billing summary
- Service level metrics
- Impact: Customer service insights

#### 15. **Analytics & Reporting**

**New Tool: `get_work_order_analytics`**
- KPIs: completion rate, average completion time, overdue %
- Trends by: status, priority, location, asset, time period
- Bottleneck identification
- Impact: Performance measurement and improvement

**New Tool: `get_asset_health_score`**
- Asset reliability metrics: uptime, MTBF, MTTR
- Work order frequency and cost trends
- Predictive maintenance score
- Impact: Proactive asset management

**New Tool: `get_maintenance_compliance`**
- PM completion rate
- Overdue PM count
- Compliance by asset/location/category
- Impact: Regulatory compliance assurance

**New Tool: `get_cost_summary`**
- Total costs by: asset, location, category, time period
- Labor vs parts vs additional cost breakdown
- Budget variance analysis
- Impact: Financial planning and control

#### 16. **File & Documentation Management**

**New Tool: `view_work_order_files`**
- List attachments for work order
- Include: images, PDFs, audio descriptions
- Download/preview capabilities
- Impact: Documentation accessibility

**New Tool: `view_asset_files`**
- Asset documentation: manuals, warranties, schematics
- Maintenance history documents
- Inspection reports
- Impact: Technical reference access

#### 17. **Audit & History Tracking**

**New Tool: `view_work_order_history`**
- Change log: status changes, assignments, updates
- Show: who, what, when for all modifications
- Track completion timeline
- Impact: Accountability and traceability

**New Tool: `view_audit_trail`**
- System-wide audit logs
- Filter by: entity type, user, date range
- Track critical changes
- Impact: Compliance and security

#### 18. **Advanced Search & Discovery**

**New Tool: `advanced_search`**
- Cross-entity search (work orders, assets, parts, etc.)
- Natural language query processing
- Fuzzy matching and suggestions
- Impact: Fast information retrieval

**New Tool: `similar_work_orders`**
- Find similar historical work orders
- Based on: asset, issue description, symptoms
- Show: resolution methods, parts used, time taken
- Impact: Knowledge reuse and faster resolution

#### 19. **Notifications & Alerts**

**New Tool: `view_notifications`**
- User notifications and alerts
- Filter by: type, read status, date
- Priority flagging
- Impact: Proactive issue awareness

**New Tool: `create_alert`**
- Generate alerts for critical events
- Notify specific users/teams
- Track acknowledgment
- Impact: Urgent issue escalation

#### 20. **Integration & Automation**

**New Tool: `trigger_workflow`**
- Execute predefined workflows
- Example: Asset down → create work order → assign team → notify manager
- Configurable automation rules
- Impact: Process automation and efficiency

---

## Implementation Recommendations

### Phase 1: Foundation Enhancement (Weeks 1-2)

**Objective:** Expand core work order and asset capabilities

**Tools to Implement:**
1. `update_work_order_status` - Status management
2. `assign_work_order` - Assignment automation
3. `view_work_order_details` - Deep work order inspection
4. Enhanced `view_work_orders` filters - Better search
5. `view_asset_details` - Comprehensive asset info
6. Enhanced `view_assets` with status filtering

**Expected Impact:**
- 50% reduction in status update manual steps
- Improved work order discovery with advanced filters
- Better asset visibility for technicians

**Implementation Effort:** 20-30 hours
- Backend API endpoints: 12 hours
- Agent tool definitions: 6 hours
- Testing and validation: 12 hours

### Phase 2: Parts & Inventory (Weeks 3-4)

**Objective:** Enable inventory management and procurement

**Tools to Implement:**
1. `view_parts_inventory` - Stock visibility
2. `view_part_details` - Part information
3. `check_part_availability` - Work order planning
4. `request_part_order` - Procurement drafts

**Expected Impact:**
- Reduce stockout incidents by 30%
- Faster work order planning with part availability checks
- Streamlined procurement process

**Implementation Effort:** 16-24 hours

### Phase 3: Labor & Costs (Weeks 5-6)

**Objective:** Financial visibility and tracking

**Tools to Implement:**
1. `view_labor_logs` - Labor tracking
2. `view_work_order_costs` - Cost breakdown
3. `add_additional_cost` - Cost recording
4. `view_cost_analytics` - Financial insights

**Expected Impact:**
- Real-time labor cost visibility
- Better budget control and forecasting
- Identification of cost optimization opportunities

**Implementation Effort:** 16-24 hours

### Phase 4: Preventive Maintenance (Weeks 7-8)

**Objective:** Proactive maintenance operations

**Tools to Implement:**
1. `view_preventive_maintenance` - PM scheduling
2. `create_work_order_from_pm` - PM execution
3. `view_meters` - Meter monitoring
4. `record_meter_reading` - Condition tracking

**Expected Impact:**
- Improved PM compliance rate
- Reduced emergency repairs
- Predictive maintenance enablement

**Implementation Effort:** 20-30 hours

### Phase 5: Analytics & Intelligence (Weeks 9-10)

**Objective:** Data-driven decision making

**Tools to Implement:**
1. `get_work_order_analytics` - KPI tracking
2. `get_asset_health_score` - Asset reliability
3. `get_maintenance_compliance` - Compliance monitoring
4. `similar_work_orders` - Knowledge reuse

**Expected Impact:**
- Performance improvement through data insights
- Proactive issue identification
- Faster problem resolution with historical knowledge

**Implementation Effort:** 24-32 hours

### Technical Implementation Pattern

For each new tool, follow this pattern:

#### 1. Backend API Endpoint (Java/Spring)

**Location:** `api/src/main/java/com/grash/controller/AgentToolController.java`

```java
@PostMapping("/[entity]/[action]")
public ResponseEntity<AgentToolResponse<[Entity]Summary>> [toolName](
        HttpServletRequest httpRequest,
        @Valid @RequestBody [Entity]SearchRequest searchRequest) {
    if (!agentProperties.isChatkitEnabled()) {
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
    OwnUser user = userService.whoami(httpRequest);
    AgentToolResponse<[Entity]Summary> response =
        agentToolService.[toolMethod](user, searchRequest);
    return ResponseEntity.ok(response);
}
```

#### 2. Service Layer (Java/Spring)

**Location:** `api/src/main/java/com/grash/service/AgentToolService.java`

```java
public AgentToolResponse<[Entity]Summary> [toolMethod](
        OwnUser user,
        [Entity]SearchRequest request) {
    ensureAuthorised(user);
    int limit = resolveLimit(request.getLimit());
    SearchCriteria criteria = baseCriteria(limit, "updatedAt");

    // Add tenant filter
    criteria.getFilterFields().add(FilterField.builder()
            .field("company.id")
            .operation("eq")
            .value(user.getCompany().getId())
            .build());

    // Add custom filters
    // ... filter logic

    Page<[Entity]> page = [entity]Repository.findAll(
        buildSpecification(criteria),
        toPageable(criteria)
    );

    List<[Entity]Summary> items = page.getContent().stream()
            .map(this::to[Entity]Summary)
            .collect(Collectors.toList());

    return AgentToolResponse.of(items);
}
```

#### 3. Proxy Tool Definition (Node.js)

**Location:** `agents-proxy/src/index.js`

```javascript
const [toolName]Tool = tool({
  name: "[tool_name]",
  description: "Clear description for LLM understanding",
  parameters: z.object({
    // Define parameters with zod schema
    limit: z.number().int().min(1).max(MAX_TOOL_RESULTS).optional().nullable(),
    searchTerm: z.string().optional().nullable(),
    // ... other parameters
  }).strict(),
  execute: async (input, runContext) => {
    const ctx = ensureRunContext(runContext);
    const {
      authorizationHeader,
      userContext,
      sessionId,
      toolLogs,
      toolResults,
      insights
    } = ctx;

    // RBAC check
    ensureRoleAccess(userContext, ALLOWED_AGENT_ROLES, "[tool_name]");
    requireTenantId(userContext);

    // Build request payload
    const criteria = {
      limit: coerceLimit(input?.limit, 5),
      search: input?.searchTerm || ""
      // ... other criteria
    };

    // Log tool invocation
    const logEntry = {
      toolName: "[tool_name]",
      arguments: criteria,
      resultCount: 0,
      status: "queued",
      sessionId
    };

    try {
      // Call backend API
      const response = await postAgentToolRequest({
        path: "/api/agent/tools/[entity]/[action]",
        authorizationHeader,
        body: criteria
      });

      // Process and normalize results
      const items = Array.isArray(response?.results)
        ? response.results
        : [];
      const normalised = items.map(normalise[Entity]).filter(Boolean);

      // Update logs and insights
      logEntry.resultCount = normalised.length;
      logEntry.status = "success";
      toolLogs.push(logEntry);
      toolResults.[tool_name] = normalised;

      if (normalised.length) {
        insights.push(summarise[Entity](normalised));
      }

      return JSON.stringify({
        type: "[entity_type]",
        total: normalised.length,
        items: normalised
      });
    } catch (error) {
      logEntry.status = "error";
      logEntry.error = error.message;
      toolLogs.push(logEntry);
      throw error;
    }
  }
});

// Register tool with agent
const atlasAgent = new Agent({
  name: "Atlas Maintenance Copilot",
  instructions: (runContext) => buildAgentInstructions(runContext),
  model: OPENAI_MODEL,
  tools: [
    viewWorkOrdersTool,
    viewAssetsTool,
    getUserContextTool,
    prepareCompletionDraftTool,
    [toolName]Tool, // Add new tool here
  ]
});
```

#### 4. DTOs and Summary Objects

**Backend DTO (Java):**
```java
@Builder
@Data
public class Agent[Entity]Summary {
    private Long id;
    private String name;
    private String status;
    // ... other summary fields
    private LocalDateTime updatedAt;
}
```

**Request DTO (Java):**
```java
@Data
public class Agent[Entity]SearchRequest {
    @Min(1) @Max(50)
    private Integer limit;

    private String search;
    private List<String> statuses;
    // ... other filter fields
}
```

### Quality Checklist for New Tools

Before deploying a new tool, verify:

**Security:**
- [ ] RBAC enforcement (role check)
- [ ] Tenant isolation (company ID filtering)
- [ ] Input validation (Zod schema + Java validation)
- [ ] SQL injection prevention (parameterized queries)

**Functionality:**
- [ ] Tool description is clear and specific
- [ ] Parameters are well-documented with types
- [ ] Error handling with meaningful messages
- [ ] Result normalization for consistency
- [ ] Logging for audit trail

**Testing:**
- [ ] Unit tests for service layer
- [ ] Integration tests for API endpoints
- [ ] Agent conversation tests (agents-proxy)
- [ ] Multi-tenant isolation verification
- [ ] Performance testing with large datasets

**Documentation:**
- [ ] API endpoint documented
- [ ] Tool added to this document
- [ ] Example conversations provided
- [ ] Update agent instructions if needed

### Deployment Considerations

**Configuration:**
- Set `OPENAI_API_KEY` for agents runtime
- Configure `AGENT_MAX_TOOL_RESULTS` (default: 10)
- Set `AGENT_PROXY_MEMORY_TTL_MS` for conversation lifetime
- Enable agent features via `agentProperties.chatkitEnabled`

**Monitoring:**
- Track tool invocation logs in `agent_tool_invocation_log` table
- Monitor draft actions in `agent_draft_action` table
- Log OpenAI API usage and costs
- Track conversation session metrics

**Scaling:**
- Agents proxy is stateless (except in-memory conversation cache)
- Can horizontally scale proxy instances
- Consider Redis for distributed conversation memory
- Database connection pooling for high concurrency

---

## Technical Specifications

### API Contracts

#### Tool Request Format

```json
{
  "prompt": "Show me open work orders for Pump-101",
  "agentId": "atlas-maintenance-copilot",
  "metadata": {
    "sessionId": "uuid-v4",
    "conversationId": "optional-conversation-id"
  }
}
```

#### Tool Response Format

```json
{
  "status": "success",
  "message": "Agent response generated",
  "agentId": "atlas-maintenance-copilot",
  "sessionId": "uuid-v4",
  "messages": [
    {
      "role": "assistant",
      "content": "Here are the open work orders for Pump-101:\n- WO-12345: Replace bearings (Priority: HIGH)\n- WO-12346: Oil change (Priority: MEDIUM)"
    }
  ],
  "toolCalls": [
    {
      "toolName": "view_work_orders",
      "arguments": {
        "limit": 5,
        "search": "Pump-101",
        "statuses": ["OPEN"]
      },
      "resultCount": 2,
      "status": "success",
      "sessionId": "uuid-v4"
    }
  ],
  "drafts": []
}
```

#### Draft Action Format

```json
{
  "id": 123,
  "agentSessionId": "uuid-v4",
  "operationType": "complete_work_order",
  "payload": "{\"workOrderId\":12345,\"status\":\"COMPLETED\",\"completedBy\":42}",
  "status": "pending",
  "createdAt": "2025-10-12T10:30:00Z",
  "updatedAt": "2025-10-12T10:30:00Z"
}
```

### Database Schema

#### agent_tool_invocation_log

Tracks all tool executions for audit and analytics.

```sql
CREATE TABLE agent_tool_invocation_log (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT,
    company_id BIGINT,
    tool_name VARCHAR(255) NOT NULL,
    arguments_json TEXT,
    result_count INTEGER,
    status VARCHAR(50),
    correlation_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user(id),
    FOREIGN KEY (company_id) REFERENCES company(id)
);

CREATE INDEX idx_agent_tool_log_correlation
    ON agent_tool_invocation_log(correlation_id);
CREATE INDEX idx_agent_tool_log_company
    ON agent_tool_invocation_log(company_id, created_at);
```

#### agent_draft_action

Stores agent-proposed actions awaiting user confirmation.

```sql
CREATE TABLE agent_draft_action (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT,
    company_id BIGINT,
    agent_session_id VARCHAR(255) NOT NULL,
    operation_type VARCHAR(100) NOT NULL,
    payload TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user(id),
    FOREIGN KEY (company_id) REFERENCES company(id)
);

CREATE INDEX idx_agent_draft_session
    ON agent_draft_action(agent_session_id);
CREATE INDEX idx_agent_draft_status
    ON agent_draft_action(company_id, status, created_at);
```

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

### Performance Considerations

**Tool Execution Limits:**
- Max results per tool call: 10 (configurable up to 50)
- Conversation memory TTL: 15 minutes
- Tool execution timeout: 30 seconds (HTTP client)

**Optimization Strategies:**
1. **Pagination:** Large result sets use database pagination
2. **Caching:** Consider caching frequently accessed reference data (categories, locations)
3. **Indexing:** Ensure database indexes on search fields (name, customId, status)
4. **Lazy Loading:** Don't fetch relationships unless needed for tool response
5. **Connection Pooling:** Use HikariCP for efficient database connections

**Scalability Targets:**
- Support 100+ concurrent agent conversations
- < 2 second response time for tool execution
- 10,000+ tool invocations per day
- 99.9% uptime

---

## Conclusion

The Atlas AI Agent system has a solid foundation with secure multi-tenant architecture, robust authentication, and clean integration patterns. The current 4 tools provide basic work order and asset visibility, but represent only ~10% of the potential capabilities given the rich database structure.

### Key Takeaways

**Strengths:**
✅ Strong security with RBAC and tenant isolation
✅ Clean architecture with separation of concerns
✅ Tool invocation logging for audit and analytics
✅ Draft action system for safe operation approval
✅ Extensible design for easy tool addition

**Opportunities:**
📈 20+ high-value tool expansion opportunities identified
📈 10x capability increase potential across 15 domain areas
📈 Significant ROI from labor/cost tracking and analytics tools
📈 Preventive maintenance and predictive capabilities unlockable

**Recommendations:**
1. Prioritize Phase 1 foundation tools for immediate impact
2. Implement parts/inventory tools to prevent stockouts
3. Add labor/cost tracking for financial visibility
4. Build analytics tools for data-driven decisions
5. Consider ML integration for predictive maintenance

**Estimated Impact:**
- 30-50% reduction in manual operations
- 20-30% improvement in maintenance efficiency
- Better cost control and budget forecasting
- Proactive issue identification and prevention
- Enhanced technician productivity and satisfaction

### Next Steps

1. **Review & Prioritize:** Stakeholder review of expansion opportunities
2. **Proof of Concept:** Implement 2-3 Phase 1 tools to validate approach
3. **Measure Impact:** Define KPIs and establish baseline metrics
4. **Iterative Development:** Roll out tools in phases with user feedback
5. **Continuous Improvement:** Monitor usage and optimize based on patterns

---

**Document Prepared By:** Claude Code AI
**Review Status:** Draft for stakeholder review
**Feedback:** Please review and provide prioritization input for implementation phases
