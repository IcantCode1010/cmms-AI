const express = require("express");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const winston = require("winston");
const crypto = require("crypto");
const { Agent, run, tool, user, ToolCallError, AgentsError } = require("@openai/agents");
const { z } = require("zod");
require("dotenv").config();
const intentRouter = require("./routes/intent");

const app = express();
app.use(express.json());
app.use("/intent", intentRouter);

const PORT = process.env.PORT || 4005;
const API_BASE = process.env.API_BASE || "http://api:8080";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4";
const DEFAULT_AGENT_ID = process.env.AGENT_CHATKIT_AGENT_ID || "";
const MAX_TOOL_RESULTS = (() => {
  const parsed = Number.parseInt(
    process.env.AGENT_MAX_TOOL_RESULTS || process.env.AGENT_PROXY_MAX_RESULTS || "10",
    10
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
})();
const CONVERSATION_TTL_MS = (() => {
  const parsed = Number.parseInt(
    process.env.AGENT_PROXY_MEMORY_TTL_MS || process.env.AGENT_MEMORY_TTL_MS || String(15 * 60 * 1000),
    10
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15 * 60 * 1000;
})();
const ALLOWED_AGENT_ROLES = ["ADMIN", "MANAGER", "TECHNICIAN", "SUPERVISOR"];

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.simple()
      )
    })
  ]
});

class RbacError extends Error {
  constructor(message) {
    super(message);
    this.name = "RbacError";
  }
}

class TenantContextError extends Error {
  constructor(message) {
    super(message);
    this.name = "TenantContextError";
  }
}

class AuthenticationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthenticationError";
  }
}

if (!OPENAI_API_KEY) {
  logger.warn(
    "OPENAI_API_KEY not provided; proxy will return stubbed responses."
  );
}

const conversationStore = new Map();
const cleanupExpiredConversations = (referenceTs = Date.now()) => {
  for (const [sessionId, entry] of conversationStore.entries()) {
    if (referenceTs - entry.updatedAt > CONVERSATION_TTL_MS) {
      conversationStore.delete(sessionId);
    }
  }
};
setInterval(() => cleanupExpiredConversations(), CONVERSATION_TTL_MS).unref?.();

const verifyToken = (authorizationHeader) => {
  if (!authorizationHeader) {
    return null;
  }
  const token = authorizationHeader.replace("Bearer ", "");
  try {
    const decoded = jwt.decode(token, { complete: true });
    return decoded && decoded.payload ? decoded.payload : null;
  } catch (error) {
    logger.warn("Unable to decode JWT for context", { error: error.message });
    return null;
  }
};

const fetchUserContext = async (authorizationHeader) => {
  if (!authorizationHeader) {
    throw new AuthenticationError(
      "Authorization header is required for agent access."
    );
  }
  try {
    const response = await axios.get(`${API_BASE}/auth/me`, {
      headers: {
        Authorization: authorizationHeader
      }
    });
    const userContext = response.data;
    if (!userContext || typeof userContext !== "object") {
      logger.warn("Identity service returned an empty user context");
      throw new AuthenticationError(
        "Identity verification failed; no user context available."
      );
    }
    return userContext;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    const status = error?.response?.status;
    logger.warn("Unable to fetch user context from API", {
      error: error.message,
      status
    });
    const message =
      status === 401 || status === 403
        ? "User authentication failed when calling /auth/me."
        : "Unable to verify user identity.";
    throw new AuthenticationError(message);
  }
};

const deriveRoleName = (userContext) => {
  if (!userContext) {
    return null;
  }
  if (typeof userContext.role === "string" && userContext.role.trim()) {
    return String(userContext.role).toUpperCase();
  }
  if (
    userContext.role &&
    typeof userContext.role === "object" &&
    userContext.role.code
  ) {
    return String(userContext.role.code).toUpperCase();
  }
  if (userContext.role && userContext.role.name) {
    return String(userContext.role.name).toUpperCase();
  }
  if (userContext.roleName) {
    return String(userContext.roleName).toUpperCase();
  }
  if (userContext.role_key) {
    return String(userContext.role_key).toUpperCase();
  }
  return null;
};

const resolveDisplayName = (userContext) => {
  if (!userContext) {
    return null;
  }
  if (userContext.fullName) {
    return userContext.fullName;
  }
  if (userContext.firstName || userContext.lastName) {
    return [userContext.firstName, userContext.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
  }
  if (userContext.name) {
    return userContext.name;
  }
  return userContext.email || userContext.username || null;
};

const resolveCompanyId = (userContext) => {
  if (!userContext || typeof userContext !== "object") {
    return null;
  }
  if (userContext.companyId !== undefined && userContext.companyId !== null) {
    const numeric = Number(userContext.companyId);
    return Number.isFinite(numeric) ? numeric : null;
  }
  if (userContext.company && userContext.company.id !== undefined) {
    const numeric = Number(userContext.company.id);
    return Number.isFinite(numeric) ? numeric : null;
  }
  if (userContext.company_id !== undefined && userContext.company_id !== null) {
    const numeric = Number(userContext.company_id);
    return Number.isFinite(numeric) ? numeric : null;
  }
  if (Array.isArray(userContext.companies) && userContext.companies.length) {
    const first = userContext.companies[0];
    if (typeof first === "object" && first !== null && first.id !== undefined) {
      const numeric = Number(first.id);
      return Number.isFinite(numeric) ? numeric : null;
    }
    if (typeof first === "number") {
      return Number.isFinite(first) ? first : null;
    }
  }
  return null;
};

const requireTenantId = (userContext) => {
  const tenantId = resolveCompanyId(userContext);
  if (!tenantId) {
    throw new TenantContextError(
      "Tenant context missing or invalid; unable to execute tool safely."
    );
  }
  return tenantId;
};

const ensureAuthorisedUser = (userContext) => {
  if (!userContext) {
    throw new AuthenticationError(
      "Authenticated user context is required for agent access."
    );
  }
  const roleName = deriveRoleName(userContext);
  if (!roleName) {
    throw new AuthenticationError(
      "Authenticated user has no role assigned; contact an administrator."
    );
  }
  if (!ALLOWED_AGENT_ROLES.includes(roleName)) {
    throw new RbacError(
      `User role ${roleName} is not authorised for agent access.`
    );
  }
  requireTenantId(userContext);
  return roleName;
};

const coerceLimit = (value, fallback = 5) => {
  const numeric = Number.parseInt(value, 10);
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.min(numeric, MAX_TOOL_RESULTS);
  }
  return Math.min(fallback, MAX_TOOL_RESULTS);
};

const buildWorkOrderSearchPayload = ({
  limit,
  statuses,
  searchTerm,
  dueDateBefore,
  dueDateAfter,
  createdAtBefore,
  createdAtAfter,
  updatedAtBefore,
  updatedAtAfter,
  priorities,
  assignedToUserId,
  primaryUserId,
  teamId,
  assetId,
  locationId,
  categoryId,
  sortBy,
  sortDirection
}) => {
  const payload = {
    limit
  };

  // Status filter
  if (Array.isArray(statuses) && statuses.length) {
    payload.statuses = statuses;
  }

  // Search term
  if (typeof searchTerm === "string" && searchTerm.trim()) {
    payload.search = searchTerm.trim();
  }

  // Date filters
  if (dueDateBefore) payload.dueDateBefore = dueDateBefore;
  if (dueDateAfter) payload.dueDateAfter = dueDateAfter;
  if (createdAtBefore) payload.createdAtBefore = createdAtBefore;
  if (createdAtAfter) payload.createdAtAfter = createdAtAfter;
  if (updatedAtBefore) payload.updatedAtBefore = updatedAtBefore;
  if (updatedAtAfter) payload.updatedAtAfter = updatedAtAfter;

  // Priority filter
  if (priorities) {
    payload.priorities = Array.isArray(priorities) ? priorities : [priorities];
  }

  // Assignment filters
  if (assignedToUserId !== undefined && assignedToUserId !== null) {
    payload.assignedToUserId = assignedToUserId;
  }
  if (primaryUserId !== undefined && primaryUserId !== null) {
    payload.primaryUserId = primaryUserId;
  }
  if (teamId !== undefined && teamId !== null) {
    payload.teamId = teamId;
  }

  // Classification filters
  if (assetId !== undefined && assetId !== null) {
    payload.assetId = assetId;
  }
  if (locationId !== undefined && locationId !== null) {
    payload.locationId = locationId;
  }
  if (categoryId !== undefined && categoryId !== null) {
    payload.categoryId = categoryId;
  }

  // Sorting
  if (sortBy) payload.sortBy = sortBy;
  if (sortDirection) payload.sortDirection = sortDirection;

  return payload;
};

const buildAssetSearchPayload = ({
  limit,
  searchTerm
}) => {
  const payload = {
    limit
  };
  if (typeof searchTerm === "string" && searchTerm.trim()) {
    payload.search = searchTerm.trim();
  }
  return payload;
};

const normaliseWorkOrder = (workOrder) => {
  if (!workOrder || typeof workOrder !== "object") {
    return null;
  }
  const assetName =
    workOrder.asset && typeof workOrder.asset === "object"
      ? workOrder.asset.name || workOrder.asset.customId || null
      : workOrder.asset || null;
  return {
    id: workOrder.id,
    code: workOrder.code || workOrder.customId || workOrder.id,
    title: workOrder.title || workOrder.description || "Work order",
    priority: workOrder.priority || null,
    status: workOrder.status || null,
    dueDate: workOrder.dueDate || null,
    asset: assetName
  };
};

const normaliseAsset = (asset) => {
  if (!asset || typeof asset !== "object") {
    return null;
  }
  const locationName =
    asset.location && typeof asset.location === "object"
      ? asset.location.name || asset.location.customId || null
      : asset.location || null;
  return {
    id: asset.id,
    name: asset.name || asset.customId || "Asset",
    status: asset.status || null,
    location: locationName,
    customId: asset.customId || null
  };
};

const summariseWorkOrders = (workOrders) => {
  if (!Array.isArray(workOrders) || !workOrders.length) {
    return "No matching work orders were returned.";
  }

  const priorityEmoji = {
    HIGH: "🔴",
    MEDIUM: "🟡",
    LOW: "🟢",
    NONE: "⚪"
  };

  const headline = `### 📋 Work Orders (${workOrders.length})\n`;
  const details = workOrders
    .map((order) => {
      const emoji = priorityEmoji[order.priority] || "📝";
      const code = order.code || order.id;
      const title = order.title || "Work order";
      const meta = [];

      if (order.status) meta.push(`Status: **${order.status}**`);
      if (order.priority) meta.push(`Priority: ${emoji} ${order.priority}`);
      if (order.asset) meta.push(`Asset: **${order.asset}**`);
      if (order.dueDate) {
        try {
          const date = new Date(order.dueDate);
          const formatted = date.toLocaleDateString();
          meta.push(`Due: ${formatted}`);
        } catch (e) {
          // Skip invalid dates
        }
      }

      const metaLine = meta.length ? `\n  - ${meta.join(" • ")}` : "";
      return `- **${code}**: ${title}${metaLine}`;
    })
    .join("\n\n");

  return `${headline}\n${details}`;
};

const summariseAssets = (assets) => {
  if (!Array.isArray(assets) || !assets.length) {
    return "No assets matched that request.";
  }

  const statusEmoji = {
    OPERATIONAL: "✅",
    DOWN: "⚠️",
    STANDBY: "⏸️",
    MODERNIZATION: "🔧",
    INSPECTION_SCHEDULED: "🔍",
    COMMISSIONING: "🚀",
    EMERGENCY_SHUTDOWN: "🔴"
  };

  const headline = `### 🏭 Assets (${assets.length})\n`;
  const details = assets
    .map((asset) => {
      const emoji = statusEmoji[asset.status] || "📦";
      const name = asset.name || asset.id;
      const meta = [];

      if (asset.status) meta.push(`Status: ${emoji} **${asset.status}**`);
      if (asset.location) meta.push(`Location: **${asset.location}**`);
      if (asset.customId) meta.push(`ID: \`${asset.customId}\``);

      const metaLine = meta.length ? `\n  - ${meta.join(" • ")}` : "";
      return `- **${name}**${metaLine}`;
    })
    .join("\n\n");

  return `${headline}\n${details}`;
};

const postAgentToolRequest = async ({
  path,
  authorizationHeader,
  body
}) => {
  if (!authorizationHeader) {
    throw new AuthenticationError(
      "Authorization header is required for agent tool execution."
    );
  }
  const headers = {
    Authorization: authorizationHeader,
    "Content-Type": "application/json"
  };
  try {
    const response = await axios.post(`${API_BASE}${path}`, body, {
      headers
    });
    return response.data;
  } catch (error) {
    const status = error.response ? error.response.status : undefined;
    logger.error("Agent tool request failed", {
      path: `${API_BASE}${path}`,
      status,
      error: error.message
    });
    throw error;
  }
};

const ensureRoleAccess = (userContext, allowedRoles, toolName) => {
  const roleName = ensureAuthorisedUser(userContext);
  if (allowedRoles && allowedRoles.length && !allowedRoles.includes(roleName)) {
    logger.warn("RBAC mismatch", {
      toolName,
      roleName,
      allowedRoles,
      userContextKeys: Object.keys(userContext || {})
    });
    throw new RbacError(`User is not authorised to use tool ${toolName}`);
  }
};

const buildCreationDraft = (sessionId, data, summary) => ({
  agentSessionId: sessionId,
  operationType: "create_work_order",
  payload: {
    summary,
    data
  },
  summary
});

const buildCompletionDraft = (sessionId, workOrder, userContext) => {
  const workOrderId = workOrder?.id || workOrder?.workOrderId || workOrder?.code;
  const summary = `Complete work order ${workOrder?.code || workOrderId}`;
  return {
    agentSessionId: sessionId,
    operationType: "complete_work_order",
    payload: {
      workOrderId,
      status: "COMPLETED",
      completedBy: userContext ? userContext.id || userContext.userId : null,
      completedByName: userContext
        ? userContext.fullName || userContext.name || null
        : null
    },
    summary
  };
};

const ensureRunContext = (runContext) => runContext?.context || {};

const coerceOptionalNumber = (value, fieldName) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new ToolCallError(fieldName + " must be numeric.");
    }
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      throw new ToolCallError(`${fieldName} must be numeric (received "${value}").`);
    }
    return parsed;
  }
  throw new ToolCallError(fieldName + " must be numeric.");
};

const pickFirstString = (...values) => {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    } else if (typeof value === "number") {
      const asString = String(value).trim();
      if (asString) {
        return asString;
      }
    }
  }
  return undefined;
};

const normalizeWhitespace = (value) => {
  if (typeof value !== "string") {
    return value;
  }
  return value.trim().replace(/\s+/g, " ");
};

const capitalizeFirstLetter = (value) => {
  if (typeof value !== "string" || !value) {
    return value;
  }
  return value.replace(/^[a-z]/, (match) => match.toUpperCase());
};

const enhanceTitle = (value) => {
  if (typeof value !== "string") {
    return value;
  }
  const cleaned = normalizeWhitespace(value);
  if (!cleaned) {
    return cleaned;
  }
  return capitalizeFirstLetter(cleaned);
};

const enhanceDescription = (value, fallbackTitle) => {
  if (typeof value !== "string" || !value.trim()) {
    if (!fallbackTitle) {
      return undefined;
    }
    return `${fallbackTitle} (details pending update).`;
  }
  const cleaned = normalizeWhitespace(value);
  if (!cleaned) {
    if (!fallbackTitle) {
      return undefined;
    }
    return `${fallbackTitle} (details pending update).`;
  }
  const capitalized = capitalizeFirstLetter(cleaned);
  if (/[.!?]$/.test(capitalized)) {
    return capitalized;
  }
  return `${capitalized}.`;
};

const parseBooleanLike = (value, fieldName) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return undefined;
    }
    if (["true", "yes", "y", "1"].includes(normalized)) {
      return true;
    }
    if (["false", "no", "n", "0"].includes(normalized)) {
      return false;
    }
    throw new ToolCallError(`${fieldName} must be true or false (received "${value}").`);
  }
  throw new ToolCallError(`${fieldName} must be a boolean-like value.`);
};

const extractNumericId = (candidate, fieldName) => {
  if (candidate === undefined || candidate === null || candidate === "") {
    return undefined;
  }
  try {
    return coerceOptionalNumber(candidate, fieldName);
  } catch (error) {
    logger.warn("Skipping non-numeric identifier", { fieldName, candidate });
    return undefined;
  }
};

const normaliseCreationInput = (input) => {
  const normalizedInput =
    input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const summaryOverride = pickFirstString(
    normalizedInput.summary,
    normalizedInput.summaryText,
    normalizedInput.summaryOverride,
    normalizedInput.brief
  );

  const title = pickFirstString(
    normalizedInput.title,
    normalizedInput.name,
    normalizedInput.workOrderTitle,
    normalizedInput.requestTitle,
    normalizedInput.subject,
    normalizedInput.ticketTitle,
    normalizedInput.task,
    summaryOverride
  );
  if (!title) {
    throw new ToolCallError("title is required to prepare a work order creation draft.");
  }

  const enhancedTitle = enhanceTitle(title);
  const data = {
    title: enhancedTitle,
    priority: "LOW"
  };

  const description = pickFirstString(
    normalizedInput.description,
    normalizedInput.details,
    normalizedInput.notes,
    normalizedInput.problemStatement,
    normalizedInput.reason,
    normalizedInput.message,
    normalizedInput.body
  );
  const enhancedDescription = enhanceDescription(description, enhancedTitle);
  if (enhancedDescription) {
    data.description = enhancedDescription;
  }

  const sanitizedSummaryOverride = summaryOverride
    ? capitalizeFirstLetter(normalizeWhitespace(summaryOverride))
    : undefined;

  return { data, summaryOverride: sanitizedSummaryOverride };
};


const viewWorkOrdersTool = tool({
  name: "view_work_orders",
  description:
    "Retrieve work orders for the current tenant. Supports filtering by status, priority, dates, assignments, and assets. Use this for listing and filtering work orders.",
  parameters: z
    .object({
      limit: z.number().int().min(1).max(MAX_TOOL_RESULTS).optional().nullable(),
      statuses: z
        .union([z.array(z.string()), z.string()])
        .optional()
        .nullable(),
      search: z.string().optional().nullable(),
      // Date filters
      dueDateBefore: z.string().optional().nullable(),
      dueDateAfter: z.string().optional().nullable(),
      createdAtBefore: z.string().optional().nullable(),
      createdAtAfter: z.string().optional().nullable(),
      updatedAtBefore: z.string().optional().nullable(),
      updatedAtAfter: z.string().optional().nullable(),
      // Priority filters
      priorities: z
        .union([z.array(z.enum(["NONE", "LOW", "MEDIUM", "HIGH"])), z.enum(["NONE", "LOW", "MEDIUM", "HIGH"])])
        .optional()
        .nullable(),
      // Assignment filters
      assignedToUserId: z.number().int().optional().nullable(),
      primaryUserId: z.number().int().optional().nullable(),
      teamId: z.number().int().optional().nullable(),
      // Classification filters
      assetId: z.number().int().optional().nullable(),
      locationId: z.number().int().optional().nullable(),
      categoryId: z.number().int().optional().nullable(),
      // Sorting
      sortBy: z.string().optional().nullable(),
      sortDirection: z.enum(["ASC", "DESC"]).optional().nullable()
    })
    .strict(),
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
    ensureRoleAccess(userContext, ALLOWED_AGENT_ROLES, "view_work_orders");
    requireTenantId(userContext);

    const limit = coerceLimit(
      input?.limit == null ? 5 : input.limit,
      5
    );
    let statuses = input?.statuses == null ? undefined : input.statuses;
    if (typeof statuses === "string") {
      statuses = statuses.trim() ? [statuses.trim()] : [];
    }
    const statusList = Array.isArray(statuses) && statuses.length
      ? statuses
      : ["OPEN", "IN_PROGRESS", "ON_HOLD"];
    const searchTerm =
      typeof input?.search === "string" ? input.search : "";

    // Extract new filter parameters
    const criteria = buildWorkOrderSearchPayload({
      limit,
      statuses: statusList,
      searchTerm,
      dueDateBefore: input?.dueDateBefore,
      dueDateAfter: input?.dueDateAfter,
      createdAtBefore: input?.createdAtBefore,
      createdAtAfter: input?.createdAtAfter,
      updatedAtBefore: input?.updatedAtBefore,
      updatedAtAfter: input?.updatedAtAfter,
      priorities: input?.priorities,
      assignedToUserId: input?.assignedToUserId,
      primaryUserId: input?.primaryUserId,
      teamId: input?.teamId,
      assetId: input?.assetId,
      locationId: input?.locationId,
      categoryId: input?.categoryId,
      sortBy: input?.sortBy,
      sortDirection: input?.sortDirection
    });

    const logEntry = {
      toolName: "view_work_orders",
      arguments: criteria,
      resultCount: 0,
      status: "queued",
      sessionId
    };

    try {
      const response = await postAgentToolRequest({
        path: "/api/agent/tools/work-orders/search",
        authorizationHeader,
        body: criteria
      });

      const items = Array.isArray(response?.results)
        ? response.results
        : Array.isArray(response)
        ? response
        : [];
      const normalised = items
        .map(normaliseWorkOrder)
        .filter(Boolean)
        .slice(0, limit);

      logEntry.resultCount = normalised.length;
      logEntry.status = "success";
      toolLogs.push(logEntry);
      toolResults.view_work_orders = normalised;
      if (normalised.length) {
        insights.push(summariseWorkOrders(normalised));
      }

      return JSON.stringify({
        type: "work_orders",
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

const viewAssetsTool = tool({
  name: "view_assets",
  description:
    "Retrieve assets for the current tenant. Use when the user asks about assets, equipment, or machines.",
  parameters: z
    .object({
      limit: z.number().int().min(1).max(MAX_TOOL_RESULTS).optional().nullable(),
      search: z.string().optional().nullable()
    })
    .strict(),
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
    ensureRoleAccess(userContext, ALLOWED_AGENT_ROLES, "view_assets");
    requireTenantId(userContext);

    const limit = coerceLimit(
      input?.limit == null ? 5 : input.limit,
      5
    );
    const searchTerm =
      typeof input?.search === "string" ? input.search : "";

    const criteria = buildAssetSearchPayload({
      limit,
      searchTerm
    });

    const logEntry = {
      toolName: "view_assets",
      arguments: criteria,
      resultCount: 0,
      status: "queued",
      sessionId
    };

    try {
      const response = await postAgentToolRequest({
        path: "/api/agent/tools/assets/search",
        authorizationHeader,
        body: criteria
      });

      const items = Array.isArray(response?.results)
        ? response.results
        : Array.isArray(response)
        ? response
        : [];
      const normalised = items
        .map(normaliseAsset)
        .filter(Boolean)
        .slice(0, limit);

      logEntry.resultCount = normalised.length;
      logEntry.status = "success";
      toolLogs.push(logEntry);
      toolResults.view_assets = normalised;
      if (normalised.length) {
        insights.push(summariseAssets(normalised));
      }

      return JSON.stringify({
        type: "assets",
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

const getUserContextTool = tool({
  name: "get_user_context",
  description:
    "Return the authenticated user's profile information and role for grounding responses.",
  parameters: z.object({}).strict(),
  execute: async (_, runContext) => {
    const ctx = ensureRunContext(runContext);
    const { userContext } = ctx;
    if (!userContext) {
      throw new AuthenticationError("No authenticated user context available.");
    }
    const safeContext = {
      id: userContext.id || userContext.userId || null,
      fullName: resolveDisplayName(userContext),
      role: deriveRoleName(userContext),
      companyId: resolveCompanyId(userContext)
    };
    return JSON.stringify(safeContext);
  }
});

const prepareCreationDraftTool = tool({
  name: "prepare_work_order_creation_draft",
  description:
    "Capture a work order title and short description, then stage a draft for user confirmation. REQUIRED: title (work order name). OPTIONAL: description (one sentence). Always collect a title before calling this tool; the proxy will enhance the text and default the priority to LOW. Leave all other fields for the user to update later.",
  parameters: z
    .object({
      title: z.string().min(1, "Title is required for work order creation"),
      description: z.string().optional().nullable(),
      summary: z.string().optional().nullable()
    })
    .strict(),
  execute: async (input, runContext) => {
    const ctx = ensureRunContext(runContext);
    const { userContext, sessionId, drafts } = ctx;
    ensureRoleAccess(
      userContext,
      ALLOWED_AGENT_ROLES,
      "prepare_work_order_creation_draft"
    );
    requireTenantId(userContext);

    // Validate required fields
    if (!input?.title || String(input.title).trim() === "") {
      throw new ToolCallError("Title is required to create a work order. Please provide a work order title.");
    }

    const { data: sanitized, summaryOverride } = normaliseCreationInput(input);
    const summary = summaryOverride || `Create work order: ${sanitized.title}`;
    const draft = buildCreationDraft(sessionId, sanitized, summary);
    logger.info("Prepared work order creation draft", { sessionId, summary, keys: Object.keys(sanitized) });
    drafts.push(draft);
    return JSON.stringify({ status: "draft_created", draft });
  }
});

const prepareCompletionDraftTool = tool({
  name: "prepare_work_order_completion_draft",
  description:
    "Create a completion draft for a work order after confirming the correct record. Provide the work order id or code.",
  parameters: z
    .object({
      workOrderId: z.union([z.string(), z.number()]),
      summary: z.string().optional().nullable()
    })
    .strict(),
  execute: async (input, runContext) => {
    const ctx = ensureRunContext(runContext);
    const { userContext, sessionId, drafts, toolResults } = ctx;
    ensureRoleAccess(
      userContext,
      ALLOWED_AGENT_ROLES,
      "prepare_work_order_completion_draft"
    );
    requireTenantId(userContext);

    const workOrders = toolResults.view_work_orders || [];
    const target = workOrders.find((order) => {
      const identifiers = [order.id, order.code, order.customId];
      return identifiers.some(
        (identifier) =>
          identifier !== undefined &&
          identifier !== null &&
          String(identifier) === String(input.workOrderId)
      );
    }) || {
      id: input.workOrderId,
      code: input.workOrderId,
      title: input.summary || "Work order"
    };

    const draft = buildCompletionDraft(sessionId, target, userContext);
    if (input.summary && input.summary.trim()) {
      draft.summary = input.summary.trim();
    }
    drafts.push(draft);
    return JSON.stringify({ status: "draft_created", draft });
  }
});

const createWorkOrderDirectlyTool = tool({
  name: "create_work_order_immediately",
  description:
    "Create a work order immediately without user confirmation. REQUIRED: title (work order name). OPTIONAL: description, priority (NONE/LOW/MEDIUM/HIGH), dueDate (ISO 8601), estimatedStartDate (ISO 8601), estimatedDurationHours, requireSignature, locationId, assetId, teamId, primaryUserId, assignedUserIds (array), categoryId. USE ONLY when the user explicitly requests immediate creation with 'create now' or 'create immediately'. For normal creation workflows, use prepare_work_order_creation_draft instead.",
  parameters: z
    .object({
      title: z.string().min(1, "Title is required for work order creation"),
      description: z.string().optional().nullable(),
      priority: z.enum(["NONE", "LOW", "MEDIUM", "HIGH"]).optional().nullable(),
      dueDate: z.string().optional().nullable(),
      estimatedStartDate: z.string().optional().nullable(),
      estimatedDurationHours: z.number().optional().nullable(),
      requireSignature: z.boolean().optional().nullable(),
      locationId: z.number().int().optional().nullable(),
      assetId: z.number().int().optional().nullable(),
      teamId: z.number().int().optional().nullable(),
      primaryUserId: z.number().int().optional().nullable(),
      assignedUserIds: z.array(z.number().int()).optional().nullable(),
      categoryId: z.number().int().optional().nullable()
    })
    .strict(),
  execute: async (input, runContext) => {
    const ctx = ensureRunContext(runContext);
    const {
      authorizationHeader,
      userContext,
      sessionId,
      toolLogs
    } = ctx;
    ensureRoleAccess(
      userContext,
      ALLOWED_AGENT_ROLES,
      "create_work_order_immediately"
    );
    requireTenantId(userContext);

    // Validate required fields
    if (!input?.title || String(input.title).trim() === "") {
      throw new ToolCallError("Title is required to create a work order. Please provide a work order title.");
    }

    const logEntry = {
      toolName: "create_work_order_immediately",
      arguments: input,
      resultCount: 0,
      status: "queued",
      sessionId
    };

    try {
      const response = await postAgentToolRequest({
        path: "/api/agent/tools/work-orders/create",
        authorizationHeader,
        body: input
      });

      logEntry.resultCount = 1;
      logEntry.status = "success";
      toolLogs.push(logEntry);

      return JSON.stringify({
        status: "created",
        workOrder: response.workOrder,
        message: response.message || "Work order created successfully"
      });
    } catch (error) {
      logEntry.status = "error";
      logEntry.error = error.message;
      toolLogs.push(logEntry);
      throw error;
    }
  }
});

const updateWorkOrderTool = tool({
  name: "update_work_order",
  description:
    "Update an existing work order's details or assignment. Use this when the user wants to modify a work order (change title, description, priority, assign users, etc.). REQUIRED: workOrderId (work order ID or code). OPTIONAL: Any fields to update. Only specified fields will be modified, others remain unchanged.",
  parameters: z.object({
    workOrderId: z.union([z.string(), z.number()]),
    title: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    priority: z.enum(["NONE", "LOW", "MEDIUM", "HIGH"]).optional().nullable(),
    dueDate: z.string().optional().nullable(),
    estimatedStartDate: z.string().optional().nullable(),
    estimatedDurationHours: z.number().optional().nullable(),
    requireSignature: z.boolean().optional().nullable(),
    locationId: z.number().int().optional().nullable(),
    assetId: z.number().int().optional().nullable(),
    teamId: z.number().int().optional().nullable(),
    primaryUserId: z.number().int().optional().nullable(),
    assignedUserIds: z.array(z.number().int()).optional().nullable(),
    categoryId: z.number().int().optional().nullable()
  }),
  execute: async (input, runContext) => {
    const ctx = ensureRunContext(runContext);
    const {
      authorizationHeader,
      userContext,
      sessionId,
      toolLogs
    } = ctx;
    ensureRoleAccess(
      userContext,
      ALLOWED_AGENT_ROLES,
      "update_work_order"
    );
    requireTenantId(userContext);

    if (!input?.workOrderId) {
      throw new ToolCallError("Work order ID is required to update a work order.");
    }

    const logEntry = {
      toolName: "update_work_order",
      arguments: input,
      resultCount: 0,
      status: "queued",
      sessionId
    };

    try {
      const response = await postAgentToolRequest({
        path: `/api/agent/tools/work-orders/${input.workOrderId}/update`,
        authorizationHeader,
        body: input
      });

      logEntry.resultCount = 1;
      logEntry.status = "success";
      toolLogs.push(logEntry);

      return JSON.stringify({
        status: "updated",
        workOrder: response.workOrder,
        message: response.message || "Work order updated successfully",
        updatedFields: response.updatedFields || []
      });
    } catch (error) {
      logEntry.status = "error";
      logEntry.error = error.message;
      toolLogs.push(logEntry);
      throw error;
    }
  }
});

const viewWorkOrderDetailsTool = tool({
  name: "view_work_order_details",
  description:
    "Get comprehensive details for a specific work order including tasks, labor, files, history, and all related entities. Use this when the user asks for full details about a work order, wants to see tasks or labor entries, or needs complete information before taking action. REQUIRED: workOrderId (work order ID or code).",
  parameters: z
    .object({
      workOrderId: z.union([z.string(), z.number()])
    })
    .strict(),
  execute: async (input, runContext) => {
    const ctx = ensureRunContext(runContext);
    const {
      authorizationHeader,
      userContext,
      sessionId,
      toolLogs,
      toolResults
    } = ctx;
    ensureRoleAccess(userContext, ALLOWED_AGENT_ROLES, "view_work_order_details");
    requireTenantId(userContext);

    if (!input?.workOrderId) {
      throw new ToolCallError("Work order ID is required to retrieve details.");
    }

    const logEntry = {
      toolName: "view_work_order_details",
      arguments: { workOrderId: input.workOrderId },
      resultCount: 0,
      status: "queued",
      sessionId
    };

    try {
      const response = await postAgentToolRequest({
        path: `/api/agent/tools/work-orders/${input.workOrderId}/details`,
        authorizationHeader,
        body: {}
      });

      logEntry.resultCount = 1;
      logEntry.status = "success";
      toolLogs.push(logEntry);

      // Store in toolResults for potential downstream use
      if (!toolResults.work_order_details) {
        toolResults.work_order_details = {};
      }
      toolResults.work_order_details[input.workOrderId] = response;

      return JSON.stringify({
        type: "work_order_details",
        details: response
      });
    } catch (error) {
      logEntry.status = "error";
      logEntry.error = error.message;
      toolLogs.push(logEntry);
      throw error;
    }
  }
});

const buildAgentInstructions = (runContext) => {
  const displayName = resolveDisplayName(runContext?.context?.userContext) || "there";
  return [
    "You are Atlas Assistant, a maintenance copilot for Atlas CMMS.",
    `Always greet ${displayName} by name in your first sentence.`,
    "",
    "CRITICAL TOOL USAGE RULES:",
    "- You MUST call tools to fetch real data. NEVER guess or make up information.",
    "- When users ask about work orders, you MUST call view_work_orders tool.",
    "- When users ask for details about a specific work order (tasks, labor, history, files), you MUST call view_work_order_details tool.",
    "- When users ask about assets or equipment, you MUST call view_assets tool.",
    "- When users want to create a work order, you MUST call prepare_work_order_creation_draft or create_work_order_immediately.",
    "- When users want to update or modify an existing work order (assign, change priority, update description, etc.), you MUST call update_work_order tool.",
    "- ALWAYS use tools before responding. Do not respond without using tools first.",
    "",
    "WORK ORDER CREATION:",
    "- When the user wants to create a work order, collect a concise title (required) and optionally a description.",
    "- ALWAYS use prepare_work_order_creation_draft for normal creation - this lets the user review and edit details before finalizing.",
    "- ONLY use create_work_order_immediately if the user explicitly says 'create now', 'create immediately', or similar urgent language.",
    "- The draft tool will enhance the text and default priority to LOW; other details can be updated after creation.",
    "",
    "FORMATTING REQUIREMENTS:",
    "- Format all responses using Markdown for clarity and readability",
    "- Use **bold** for work order codes, asset names, and important identifiers",
    "- Use bullet lists (- item) for multiple items",
    "- Use numbered lists (1. item) for sequential steps or priorities",
    "- Use tables for structured data comparisons when appropriate",
    "- Use > blockquotes for important warnings or notes",
    "- Add relevant emojis (⚠️ for warnings, ✅ for success, 📋 for lists, 🔧 for maintenance)",
    "- Group related information under clear headers (### Header)",
    "",
    "When presenting work orders:",
    "- Start with a summary count",
    "- List each work order with **bold code**",
    "- Show priority with emojis: 🔴 HIGH, 🟡 MEDIUM, 🟢 LOW",
    "- Include status badges and due dates clearly",
    "- End with actionable next steps",
    "",
    "When presenting assets:",
    "- Group by status or location when multiple assets shown",
    "- Use status indicators: ✅ OPERATIONAL, ⚠️ DOWN, ⏸️ STANDBY",
    "- Highlight critical information",
    "",
    "If the user requests to close or complete a work order, call prepare_work_order_completion_draft after identifying the correct record.",
    "If information is missing, explain what else you need and provide actionable guidance."
  ].join(" ");
};

const getAtlasAgent = (() => {
  let cachedAgent = null;
  return () => {
    if (cachedAgent) {
      return cachedAgent;
    }
    cachedAgent = new Agent({
      name: "Atlas Maintenance Copilot",
      instructions: (runContext) => buildAgentInstructions(runContext),
      model: OPENAI_MODEL,
      temperature: 0,  // Deterministic responses for better tool usage
      tools: [
        viewWorkOrdersTool,
        viewWorkOrderDetailsTool,
        viewAssetsTool,
        getUserContextTool,
        prepareCreationDraftTool,
        prepareCompletionDraftTool,
        createWorkOrderDirectlyTool,
        updateWorkOrderTool
      ]
    });
    return cachedAgent;
  };
})();

const getConversationEntry = (sessionId) => {
  if (!sessionId) {
    return null;
  }
  const entry = conversationStore.get(sessionId);
  if (!entry) {
    return null;
  }
  if (Date.now() - entry.updatedAt > CONVERSATION_TTL_MS) {
    conversationStore.delete(sessionId);
    return null;
  }
  return entry;
};

const saveConversationEntry = (sessionId, runResult, userContext = null) => {
  if (!sessionId || !runResult) {
    return;
  }
  if (!Array.isArray(runResult.history)) {
    return;
  }
  const entry = {
    history: runResult.history,
    lastResponseId: runResult.lastResponseId,
    updatedAt: Date.now()
  };

  // Store user identity to detect account switches
  if (userContext) {
    entry.userId = userContext.id || userContext.userId || userContext.sub;
    entry.companyId = resolveCompanyId(userContext);
  }

  conversationStore.set(sessionId, entry);
};

const getSessionId = (metadata = {}) => {
  const candidate =
    metadata.sessionId ??
    metadata.conversationId ??
    metadata.correlationId ??
    metadata.threadId;
  if (candidate && typeof candidate === "string" && candidate.trim()) {
    return candidate.trim();
  }
  return crypto.randomUUID();
};

const deriveFinalMessage = ({
  runResult,
  runContext,
  userContext,
  prompt
}) => {
  // First, try to get the agent's formatted response
  if (runResult?.finalOutput && typeof runResult.finalOutput === "string") {
    const trimmed = runResult.finalOutput.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  // Check conversation history for assistant's response
  if (Array.isArray(runResult?.history)) {
    for (let idx = runResult.history.length - 1; idx >= 0; idx -= 1) {
      const item = runResult.history[idx];
      if (item?.role === "assistant") {
        if (typeof item.content === "string" && item.content.trim()) {
          return item.content.trim();
        }
        if (Array.isArray(item.content)) {
          const textPart = item.content.find(
            (part) => part?.type === "output_text" || part?.type === "text"
          );
          if (textPart?.text && textPart.text.trim()) {
            return textPart.text.trim();
          }
        }
      }
    }
  }

  // Fallback: Build a formatted response from tool results
  const displayName = resolveDisplayName(userContext) || "there";
  const toolResults = runContext?.toolResults || {};
  const insights = runContext?.insights || [];

  // If we have insights (formatted summaries), use them
  if (insights.length > 0) {
    const greeting = `Hi **${displayName}**, here's what I found:\n\n`;
    return greeting + insights.join("\n\n");
  }

  // Legacy fallback with formatted summaries
  if (toolResults.view_work_orders?.length) {
    return `Hi **${displayName}**, here's what I found:\n\n${summariseWorkOrders(
      toolResults.view_work_orders
    )}`;
  }
  if (toolResults.view_assets?.length) {
    return `Hi **${displayName}**, here are the latest asset details:\n\n${summariseAssets(
      toolResults.view_assets
    )}`;
  }

  // Default message with formatting
  return `Hi **${displayName}**, I'm still processing your request. Try asking about:\n\n- 📋 Open work orders\n- 🏭 Assets and equipment\n- 🔧 Maintenance tasks`;
};

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
  let previousConversation = getConversationEntry(sessionId);

  // SECURITY: Verify the conversation belongs to the current user
  // If user identity changed, clear the old conversation to prevent context leakage
  if (previousConversation && userContext) {
    const currentUserId = userContext.id || userContext.userId || userContext.sub;
    const currentCompanyId = resolveCompanyId(userContext);

    if (previousConversation.userId && previousConversation.userId !== currentUserId) {
      logger.info("User identity changed - clearing old conversation", {
        sessionId,
        oldUserId: previousConversation.userId,
        newUserId: currentUserId
      });
      conversationStore.delete(sessionId);
      previousConversation = null;
    } else if (previousConversation.companyId && previousConversation.companyId !== currentCompanyId) {
      logger.info("Company context changed - clearing old conversation", {
        sessionId,
        oldCompanyId: previousConversation.companyId,
        newCompanyId: currentCompanyId
      });
      conversationStore.delete(sessionId);
      previousConversation = null;
    }
  }

  const runContextPayload = {
    authorizationHeader,
    userContext,
    sessionId,
    metadata: metadata || {},
    toolLogs: [],
    toolResults: {},
    drafts: [],
    insights: []
  };

  const agentInstructions = buildAgentInstructions({ context: runContextPayload });
  logger.info("Starting agent conversation", {
    sessionId,
    prompt: prompt.substring(0, 100),
    agentModel: agent.model || OPENAI_MODEL,
    hasTools: agent.tools ? agent.tools.length : 0,
    instructionsLength: agentInstructions.length,
    instructionsPreview: agentInstructions.substring(0, 200)
  });

  const runOptions = {
    context: runContextPayload
  };

  let conversationInput;
  if (previousConversation?.lastResponseId) {
    runOptions.previousResponseId = previousConversation.lastResponseId;
    conversationInput = [user(prompt)];
  } else {
    const baseHistory = previousConversation?.history
      ? [...previousConversation.history]
      : [];
    conversationInput = [...baseHistory, user(prompt)];
  }

  logger.info("Calling OpenAI Agent SDK", {
    sessionId,
    inputLength: conversationInput.length,
    hasPreviousResponse: !!previousConversation?.lastResponseId
  });

  // Add parallel tool calls configuration
  runOptions.parallel_tool_calls = true;

  const result = await run(agent, conversationInput, runOptions);

  // Debug: show full agent result + run context so we can see any function_call/tool events
  logger.debug("<<AGENT RUN RESULT RAW>>", { result });
  logger.debug("<<RUN CONTEXT AFTER RUN>>", { runContextPayload });

  logger.info("Agent execution completed", {
    sessionId,
    toolCallsMade: runContextPayload.toolLogs.length,
    draftsMade: runContextPayload.drafts.length,
    hasOutput: !!result?.finalOutput
  });

  saveConversationEntry(sessionId, result, userContext);
  const finalOutput = deriveFinalMessage({
    runResult: result,
    runContext: runContextPayload,
    userContext,
    prompt
  });

  return {
    sessionId,
    agentId,
    finalOutput,
    toolCalls: runContextPayload.toolLogs,
    drafts: runContextPayload.drafts
  };
};

const unwrapAgentError = (error) => {
  if (!error) {
    return error;
  }
  if (error instanceof ToolCallError && error.error) {
    return unwrapAgentError(error.error);
  }
  if (error.cause) {
    return unwrapAgentError(error.cause);
  }
  return error;
};

const buildOfflineResponse = ({
  agentId,
  metadata,
  userContext,
  sessionId
}) => {
  const resolvedSessionId = sessionId || getSessionId(metadata);
  const displayName = resolveDisplayName(userContext) || "there";
  return {
    status: "success",
    message: "Atlas assistant is not configured",
    agentId,
    sessionId: resolvedSessionId,
    messages: [
      {
        role: "assistant",
        content:
          `Hi ${displayName}, the Atlas AI assistant is offline because no OpenAI API key is configured. Ask an administrator to set OPENAI_API_KEY to enable agent responses.`
      }
    ],
    toolCalls: [],
    drafts: []
  };
};

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    openaiConfigured: Boolean(OPENAI_API_KEY)
  });
});

app.post("/v1/chat", async (req, res) => {
  const { prompt, agentId: requestedAgentId, metadata } = req.body || {};

  if (!prompt) {
    return res.status(400).json({ error: "prompt is required" });
  }

  const authorizationHeader = req.headers.authorization;
  if (!authorizationHeader) {
    logger.warn("Chat request missing Authorization header");
    return res.status(401).json({
      status: "error",
      message: "Authorization header is required for agent access."
    });
  }

  const agentId = requestedAgentId || DEFAULT_AGENT_ID || "default-agent";
  const userClaims = verifyToken(authorizationHeader);
  let userContext;
  const sessionId = getSessionId(metadata);

  try {
    userContext = await fetchUserContext(authorizationHeader);
    ensureAuthorisedUser(userContext);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      logger.warn("Authentication failed for agent request", {
        error: error.message
      });
      return res.status(401).json({
        status: "error",
        message: error.message
      });
    }
    if (error instanceof TenantContextError || error instanceof RbacError) {
      logger.warn("Authorisation failed for agent request", {
        error: error.message
      });
      return res.status(403).json({
        status: "error",
        message: error.message,
        agentId
      });
    }
    logger.error("Unexpected error while resolving user context", {
      error: error.message
    });
    return res.status(500).json({
      status: "error",
      message: "Failed to resolve user context."
    });
  }

  logger.info("Resolved agent user context", {
    hasAuthHeader: Boolean(authorizationHeader),
    metadataKeys: metadata ? Object.keys(metadata) : [],
    userContextRole: userContext?.role,
    userContextRoleType: typeof userContext?.role,
    derivedRole: deriveRoleName(userContext),
    companyId: resolveCompanyId(userContext)
  });

  logger.info("Received chat prompt", {
    agentId,
    openaiEnabled: Boolean(OPENAI_API_KEY),
    user: userClaims ? userClaims.sub : null
  });

  if (!OPENAI_API_KEY) {
    const stubbed = buildOfflineResponse({
      agentId,
      metadata,
      userContext,
      sessionId
    });
    return res.json(stubbed);
  }

  try {
    const agentResponse = await runAgentConversation({
      prompt,
      agentId,
      authorizationHeader,
      userContext,
      metadata,
      sessionOverride: sessionId
    });

    return res.json({
      status: "success",
      message: "Agent response generated",
      agentId,
      sessionId: agentResponse.sessionId,
      messages: [
        {
          role: "assistant",
          content: agentResponse.finalOutput
        }
      ],
      toolCalls: agentResponse.toolCalls,
      drafts: agentResponse.drafts
    });
  } catch (error) {
    const rootError = unwrapAgentError(error);
    conversationStore.delete(sessionId);
    if (rootError instanceof AuthenticationError) {
      logger.warn("Authentication failed during agent execution", {
        error: rootError.message
      });
      return res.status(401).json({
        status: "error",
        message: rootError.message,
        agentId
      });
    }
    if (rootError instanceof RbacError || rootError instanceof TenantContextError) {
      logger.warn("Access control prevented tool execution", {
        error: rootError.message
      });
      return res.status(403).json({
        status: "error",
        message: rootError.message,
        agentId
      });
    }
    if (rootError instanceof AgentsError) {
      logger.error("Agents runtime error", {
        error: rootError.message
      });
    } else {
      logger.error("Failed to process prompt", {
        error: rootError?.message || error.message
      });
    }
    return res.status(500).json({
      status: "error",
      message: "Failed to process agent request."
    });
  }
});

// Temporary test route - force tool call to verify tool wiring
app.post("/debug/force-create-test", async (req, res) => {
  const authorizationHeader = req.headers.authorization;
  if (!authorizationHeader) {
    return res.status(401).json({ error: "Authorization required" });
  }

  try {
    const userContext = await fetchUserContext(authorizationHeader);
    const sessionId = crypto.randomUUID();
    const runContextPayload = {
      authorizationHeader,
      userContext,
      sessionId,
      metadata: {},
      toolLogs: [],
      toolResults: {},
      drafts: [],
      insights: []
    };

    // Make the instruction explicit so the model MUST call the tool
    const prompt = `CALL_TOOL: use prepare_work_order_creation_draft tool with
    { "title": "HVAC maintenance", "description": "HVAC minutes in the main building" }
    Do not reply with text, only call the tool.`;

    const agent = getAtlasAgent();
    const result = await run(agent, [user(prompt)], { context: runContextPayload });

    logger.debug("force-create result", { result, runContextPayload });

    res.json({
      success: true,
      toolCallsMade: runContextPayload.toolLogs.length,
      draftsMade: runContextPayload.drafts.length,
      result: {
        hasOutput: !!result?.finalOutput,
        historyLength: result?.history?.length || 0
      },
      runContextPayload
    });
  } catch (error) {
    logger.error("Force create test failed", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`Agents proxy listening on port ${PORT}`, {
      apiBase: API_BASE,
      openaiConfigured: Boolean(OPENAI_API_KEY)
    });

    // Log registered tools for verification
    const agent = getAtlasAgent();
    logger.info("Registered agent tools", {
      tools: agent.tools.map(t => t.name || t?.parameters?.name || "unnamed"),
      toolCount: agent.tools.length,
      model: agent.model || OPENAI_MODEL,
      temperature: agent.temperature
    });
  });
}

module.exports = app;

if (process.env.NODE_ENV === "test") {
  module.exports.__testables = {
    normaliseCreationInput,
    enhanceTitle,
    enhanceDescription
  };
}
