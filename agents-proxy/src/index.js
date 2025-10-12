const express = require("express");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const winston = require("winston");
const crypto = require("crypto");
const { Agent, run, tool, user, ToolCallError, AgentsError } = require("@openai/agents");
const { z } = require("zod");
require("dotenv").config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4005;
const API_BASE = process.env.API_BASE || "http://api:8080";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
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
  searchTerm
}) => {
  const payload = {
    limit
  };
  if (Array.isArray(statuses) && statuses.length) {
    payload.statuses = statuses;
  }
  if (typeof searchTerm === "string" && searchTerm.trim()) {
    payload.search = searchTerm.trim();
  }
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
  const headline = `Found ${workOrders.length} work ${
    workOrders.length === 1 ? "order" : "orders"
  }.`;
  const details = workOrders
    .map((order) => {
      const meta = [];
      if (order.priority) meta.push(`Priority ${order.priority}`);
      if (order.status) meta.push(`Status ${order.status}`);
      if (order.asset) meta.push(`Asset ${order.asset}`);
      const suffix = meta.length ? ` (${meta.join("; ")})` : "";
      return `- ${order.code || order.id}: ${order.title || "Work order"}${suffix}`;
    })
    .join("\n");
  return `${headline}\n${details}`;
};

const summariseAssets = (assets) => {
  if (!Array.isArray(assets) || !assets.length) {
    return "No assets matched that request.";
  }
  return assets
    .map((asset) => {
      const meta = [];
      if (asset.status) meta.push(`Status ${asset.status}`);
      if (asset.location) meta.push(`Location ${asset.location}`);
      if (asset.customId) meta.push(`ID ${asset.customId}`);
      const suffix = meta.length ? ` (${meta.join("; ")})` : "";
      return `- ${asset.name || asset.id}${suffix}`;
    })
    .join("\n");
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

const viewWorkOrdersTool = tool({
  name: "view_work_orders",
  description:
    "Retrieve work orders for the current tenant. Provide an optional search term and statuses to filter results.",
  parameters: z
    .object({
      limit: z.number().int().min(1).max(MAX_TOOL_RESULTS).optional().nullable(),
      statuses: z
        .union([z.array(z.string()), z.string()])
        .optional()
        .nullable(),
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

    const criteria = buildWorkOrderSearchPayload({
      limit,
      statuses: statusList,
      searchTerm
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

const buildAgentInstructions = (runContext) => {
  const displayName = resolveDisplayName(runContext?.context?.userContext) || "there";
  return [
    "You are Atlas Assistant, a maintenance copilot for Atlas CMMS.",
    `Always greet ${displayName} by name in your first sentence.`,
    "Use the available tools to fetch real data instead of guessing.",
    "Summarise tool outputs clearly, reference work order or asset identifiers, and suggest next steps when helpful.",
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
      tools: [
        viewWorkOrdersTool,
        viewAssetsTool,
        getUserContextTool,
        prepareCompletionDraftTool
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

const saveConversationEntry = (sessionId, runResult) => {
  if (!sessionId || !runResult) {
    return;
  }
  if (!Array.isArray(runResult.history)) {
    return;
  }
  conversationStore.set(sessionId, {
    history: runResult.history,
    lastResponseId: runResult.lastResponseId,
    updatedAt: Date.now()
  });
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
  if (runResult?.finalOutput && typeof runResult.finalOutput === "string") {
    const trimmed = runResult.finalOutput.trim();
    if (trimmed) {
      return trimmed;
    }
  }

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

  const displayName = resolveDisplayName(userContext) || "there";
  const toolResults = runContext?.toolResults || {};
  if (toolResults.view_work_orders?.length) {
    return `Hi ${displayName}, here's what I found:\n${summariseWorkOrders(
      toolResults.view_work_orders
    )}`;
  }
  if (toolResults.view_assets?.length) {
    return `Hi ${displayName}, here are the latest asset details:\n${summariseAssets(
      toolResults.view_assets
    )}`;
  }

  return `Hi ${displayName}, I'm still processing your request. Try asking about open work orders or assets to get started.`;
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
  const previousConversation = getConversationEntry(sessionId);
  const baseHistory = previousConversation?.history
    ? [...previousConversation.history]
    : [];
  const conversationInput = [...baseHistory, user(prompt)];

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

  const runOptions = {
    context: runContextPayload
  };

  if (previousConversation?.lastResponseId) {
    runOptions.previousResponseId = previousConversation.lastResponseId;
  }

  const result = await run(agent, conversationInput, runOptions);
  saveConversationEntry(sessionId, result);
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

if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`Agents proxy listening on port ${PORT}`, {
      apiBase: API_BASE,
      openaiConfigured: Boolean(OPENAI_API_KEY)
    });
  });
}

module.exports = app;
