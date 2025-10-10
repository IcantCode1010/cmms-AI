const express = require("express");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const winston = require("winston");
const crypto = require("crypto");
let AgentsClient;
try {
  // Optional dependency: newer SDK versions expose helpers without a constructor.
  ({ AgentsClient } = require("@openai/agents"));
} catch (error) {
  // ignore – we'll fall back to REST calls if available.
}
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

const FALLBACK_WORK_ORDERS = [
  {
    id: 101,
    code: "WO-101",
    title: "Inspect HVAC filters",
    status: "OPEN",
    priority: "HIGH",
    asset: "HQ HVAC-1"
  },
  {
    id: 102,
    code: "WO-102",
    title: "Lubricate conveyor bearings",
    status: "OPEN",
    priority: "MEDIUM",
    asset: "Line 2 Conveyor"
  },
  {
    id: 103,
    code: "WO-103",
    title: "Replace safety signage",
    status: "OPEN",
    priority: "LOW",
    asset: "Warehouse Aisle 4"
  }
];

const FALLBACK_ASSETS = [
  {
    id: 301,
    name: "HQ HVAC-1",
    status: "OPERATIONAL",
    location: "Main HQ - Rooftop",
    customId: "AST-001"
  },
  {
    id: 302,
    name: "Line 2 Conveyor",
    status: "OPERATIONAL",
    location: "Plant 2 - Assembly",
    customId: "AST-117"
  },
  {
    id: 303,
    name: "Warehouse Forklift",
    status: "DOWN",
    location: "Warehouse Aisle 4",
    customId: "AST-209"
  }
];

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

let agentsClient = null;
if (OPENAI_API_KEY) {
  if (AgentsClient && typeof AgentsClient === "function") {
    try {
      agentsClient = new AgentsClient({
        apiKey: OPENAI_API_KEY
      });
      logger.info("Agents client initialised");
    } catch (error) {
      logger.warn(
        "AgentsClient instantiation failed; running in REST fallback mode.",
        { error: error.message }
      );
      agentsClient = null;
    }
  } else {
    logger.info(
      "Using OpenAI REST API for agent responses (AgentsClient constructor unavailable)."
    );
  }
} else {
  logger.warn(
    "OPENAI_API_KEY not provided; proxy will return stubbed responses."
  );
}

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
    return null;
  }
  try {
    const response = await axios.get(`${API_BASE}/auth/whoami`, {
      headers: {
        Authorization: authorizationHeader
      }
    });
    return response.data;
  } catch (error) {
    logger.warn("Unable to fetch user context from API", {
      error: error.message
    });
    return null;
  }
};

const deriveRoleName = (userContext) => {
  if (!userContext) {
    return null;
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
    return [userContext.firstName, userContext.lastName].filter(Boolean).join(" ").trim();
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

const coerceLimit = (value, fallback = 5) => {
  const numeric = Number.parseInt(value, 10);
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.min(numeric, MAX_TOOL_RESULTS);
  }
  return Math.min(fallback, MAX_TOOL_RESULTS);
};

const extractSearchTerm = (prompt, domainKeywords = []) => {
  if (!prompt || typeof prompt !== "string") {
    return "";
  }
  const quotedMatch = prompt.match(/["“”'‘’](.+?)["“”'‘’]/);
  if (quotedMatch && quotedMatch[1]) {
    return quotedMatch[1].trim();
  }

  const lowered = prompt.toLowerCase();
  for (const keyword of domainKeywords) {
    const keywordLower = keyword.toLowerCase();
    const idx = lowered.indexOf(keywordLower);
    if (idx !== -1) {
      const remainder = prompt.slice(idx + keyword.length);
      const contextualMatch = remainder.match(
        /(?:for|about|regarding|named|called)\s+([^?.!,]+)/i
      );
      if (contextualMatch && contextualMatch[1]) {
        return contextualMatch[1].trim();
      }
    }
  }

  const genericMatch = prompt.match(
    /(?:for|about|regarding|named|called)\s+([^?.!,]+)/i
  );
  if (genericMatch && genericMatch[1]) {
    return genericMatch[1].trim();
  }

  return "";
};

const buildWorkOrderSearchCriteria = ({
  tenantId,
  limit,
  statuses,
  searchTerm
}) => {
  const filterFields = [
    {
      field: "company",
      operation: "eq",
      value: tenantId,
      values: []
    },
    {
      field: "archived",
      operation: "eq",
      value: false,
      values: []
    }
  ];

  if (Array.isArray(statuses) && statuses.length) {
    filterFields.push({
      field: "status",
      operation: "in",
      value: "",
      values: statuses,
      enumName: "STATUS"
    });
  }

  if (searchTerm && searchTerm.trim().length) {
    const trimmed = searchTerm.trim();
    filterFields.push({
      field: "title",
      operation: "cn",
      value: trimmed,
      values: [],
      alternatives: [
        {
          field: "description",
          operation: "cn",
          value: trimmed,
          values: []
        },
        {
          field: "customId",
          operation: "cn",
          value: trimmed,
          values: []
        }
      ]
    });
  }

  return {
    pageNum: 0,
    pageSize: limit,
    sortField: "dueDate",
    direction: "ASC",
    filterFields
  };
};

const buildAssetSearchCriteria = ({ tenantId, limit, searchTerm }) => {
  const filterFields = [
    {
      field: "company",
      operation: "eq",
      value: tenantId,
      values: []
    },
    {
      field: "archived",
      operation: "eq",
      value: false,
      values: []
    }
  ];

  if (searchTerm && searchTerm.trim().length) {
    const trimmed = searchTerm.trim();
    filterFields.push({
      field: "name",
      operation: "cn",
      value: trimmed,
      values: [],
      alternatives: [
        {
          field: "customId",
          operation: "cn",
          value: trimmed,
          values: []
        },
        {
          field: "serialNumber",
          operation: "cn",
          value: trimmed,
          values: []
        },
        {
          field: "description",
          operation: "cn",
          value: trimmed,
          values: []
        }
      ]
    });
  }

  return {
    pageNum: 0,
    pageSize: limit,
    sortField: "name",
    direction: "ASC",
    filterFields
  };
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

const postApiSearchRequest = async ({
  path,
  authorizationHeader,
  tenantId,
  body
}) => {
  if (!authorizationHeader) {
    return null;
  }
  const headers = {
    Authorization: authorizationHeader,
    "Content-Type": "application/json"
  };
  if (tenantId) {
    headers["X-Company-Id"] = tenantId;
    headers["X-Tenant-Id"] = tenantId;
  }
  try {
    const response = await axios.post(`${API_BASE}${path}`, body, {
      headers
    });
    return response.data;
  } catch (error) {
    logger.debug("API search request failed; using fallback data", {
      path: `${API_BASE}${path}`,
      error: error.message
    });
    return null;
  }
};

const ensureRoleAccess = (userContext, allowedRoles, toolName) => {
  if (!allowedRoles || allowedRoles.length === 0) {
    return;
  }
  if (!userContext) {
    logger.warn(
      "User context missing; allowing tool %s for testing purposes",
      toolName
    );
    return;
  }
  const roleName = deriveRoleName(userContext);
  if (!roleName || !allowedRoles.includes(roleName)) {
    throw new RbacError(`User is not authorised to use tool ${toolName}`);
  }
};

const callOpenAIChat = async ({
  prompt,
  userContext,
  contextSummary,
  metadata
}) => {
  if (!OPENAI_API_KEY) {
    return null;
  }
  try {
    const displayName = resolveDisplayName(userContext) || "there";
    const systemPrompt = [
      `You are Atlas Assistant, an operations copilot for maintenance teams.`,
      `Always greet ${displayName} by name in your first sentence.`,
      `Use the provided context when relevant and keep responses concise and actionable.`,
      `If you don't have enough information to fulfill a request, explain what is missing and suggest next steps.`
    ].join(" ");

    const contextBlock = contextSummary
      ? `Context:\n${contextSummary}\n\n`
      : "";

    const payload = {
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `${contextBlock}User request:\n${prompt}`
        }
      ],
      metadata
    };

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      payload,
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 20000
      }
    );

    const assistantMessage =
      response.data?.choices?.[0]?.message?.content?.trim();
    return assistantMessage || null;
  } catch (error) {
    logger.error("Failed to contact OpenAI Chat Completions API", {
      error: error.message
    });
    return null;
  }
};

const toolDefinitions = {
  viewWorkOrders: {
    name: "view_work_orders",
    allowedRoles: ["ADMIN", "MANAGER", "TECHNICIAN", "SUPERVISOR"],
    handler: async ({ authorizationHeader, args, userContext }) => {
      const tenantId = requireTenantId(userContext);
      const limit = coerceLimit(args?.limit, 5);
      const statuses = Array.isArray(args?.status)
        ? args.status
        : args?.status
        ? [args.status]
        : ["OPEN", "IN_PROGRESS", "ON_HOLD"];
      const search = typeof args?.search === "string" ? args.search : "";

      const criteria = buildWorkOrderSearchCriteria({
        tenantId,
        limit,
        statuses,
        searchTerm: search
      });

      const response = await postApiSearchRequest({
        path: "/work-orders/search",
        authorizationHeader,
        tenantId,
        body: criteria
      });

      const content = Array.isArray(response?.content)
        ? response.content
        : Array.isArray(response)
        ? response
        : [];

      const normalised = content
        .map(normaliseWorkOrder)
        .filter(Boolean)
        .slice(0, limit);

      if (normalised.length) {
        return normalised;
      }
      return FALLBACK_WORK_ORDERS.slice(0, limit);
    }
  },
  viewAssets: {
    name: "view_assets",
    allowedRoles: ["ADMIN", "MANAGER", "TECHNICIAN", "SUPERVISOR"],
    handler: async ({ authorizationHeader, args, userContext }) => {
      const tenantId = requireTenantId(userContext);
      const limit = coerceLimit(args?.limit, 5);
      const search = typeof args?.search === "string" ? args.search : "";

      const criteria = buildAssetSearchCriteria({
        tenantId,
        limit,
        searchTerm: search
      });

      const response = await postApiSearchRequest({
        path: "/assets/search",
        authorizationHeader,
        tenantId,
        body: criteria
      });

      const content = Array.isArray(response?.content)
        ? response.content
        : Array.isArray(response)
        ? response
        : [];

      const normalised = content
        .map(normaliseAsset)
        .filter(Boolean)
        .slice(0, limit);

      if (normalised.length) {
        return normalised;
      }
      return FALLBACK_ASSETS.slice(0, limit);
    }
  },
  getUserContext: {
    name: "get_user_context",
    allowedRoles: [],
    handler: async ({ userContext }) => {
      return userContext || {};
    }
  }
};

const executeTool = async (
  key,
  args,
  authorizationHeader,
  userContext,
  sessionId
) => {
  const definition = toolDefinitions[key];
  if (!definition) {
    throw new Error(`Unknown tool ${key}`);
  }

  const logEntry = {
    toolName: definition.name,
    arguments: args,
    resultCount: 0,
    status: "queued",
    sessionId
  };

  try {
    ensureRoleAccess(userContext, definition.allowedRoles, definition.name);
    const results = await definition.handler({
      authorizationHeader,
      args,
      userContext
    });
    const normalised = Array.isArray(results)
      ? results
      : results
      ? [results]
      : [];
    logEntry.resultCount = normalised.length;
    logEntry.status = "success";
    return { logEntry, results: normalised };
  } catch (error) {
    if (error instanceof RbacError || error instanceof TenantContextError) {
      logEntry.status = "forbidden";
    } else {
      logEntry.status = "error";
    }
    logEntry.error = error.message;
    error.toolLog = logEntry;
    throw error;
  }
};

const summariseWorkOrders = (workOrders) => {
  if (!workOrders.length) {
    return "I could not find any open work orders right now.";
  }
  const headline = `I found ${workOrders.length} open work ${
    workOrders.length === 1 ? "order" : "orders"
  }.`;
  const details = workOrders
    .map(
      (order) =>
        `- ${order.code || order.id}: ${order.title || order.description || ""}`
    )
    .join("\n");
  return `${headline}\n${details}`;
};

const summariseAssets = (assets) => {
  if (!assets.length) {
    return "No assets matched that request.";
  }
  return assets
    .map((asset) => {
      const status = asset.status ? ` � ${asset.status}` : "";
      const location = asset.location ? ` @ ${asset.location}` : "";
      return `- ${asset.name || asset.customId || asset.id}${status}${location}`;
    })
    .join("\n");
};

const buildCompletionDraft = (sessionId, workOrder, userContext) => {
  const workOrderId = workOrder.id || workOrder.workOrderId || workOrder.code;
  const summary = `Complete work order ${workOrder.code || workOrderId}`;
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

const processPrompt = async ({
  prompt,
  agentId,
  authorizationHeader,
  userContext,
  metadata
}) => {
  const sessionId =
    (metadata && metadata.correlationId) || crypto.randomUUID();
  const toolCalls = [];
  let workOrderResults = [];
  let assetResults = [];
  const insightMessages = [];
  const lowerPrompt = (prompt || "").toLowerCase();

  const workOrderSearchTerm = extractSearchTerm(prompt, [
    "work order",
    "work orders",
    "ticket",
    "tickets"
  ]);
  const assetSearchTerm = extractSearchTerm(prompt, [
    "asset",
    "assets",
    "equipment",
    "machine",
    "machines"
  ]);

  const shouldFetchWorkOrders =
    lowerPrompt.includes("work order") || lowerPrompt.includes("ticket");
  const shouldFetchAssets =
    lowerPrompt.includes("asset") ||
    lowerPrompt.includes("equipment") ||
    lowerPrompt.includes("machine");

  if (shouldFetchWorkOrders) {
    try {
      const { logEntry, results } = await executeTool(
        "viewWorkOrders",
        {
          status: ["OPEN", "IN_PROGRESS", "ON_HOLD"],
          limit: 5,
          search: workOrderSearchTerm
        },
        authorizationHeader,
        userContext,
        sessionId
      );
      toolCalls.push(logEntry);
      workOrderResults = results;
      insightMessages.push(summariseWorkOrders(results));
    } catch (error) {
      if (error.toolLog) {
        toolCalls.push(error.toolLog);
      }
      throw error;
    }
  }

  if (shouldFetchAssets) {
    try {
      const { logEntry, results } = await executeTool(
        "viewAssets",
        {
          limit: 5,
          search: assetSearchTerm
        },
        authorizationHeader,
        userContext,
        sessionId
      );
      toolCalls.push(logEntry);
      assetResults = results;
      insightMessages.push(summariseAssets(results));
    } catch (error) {
      if (error.toolLog) {
        toolCalls.push(error.toolLog);
      }
      throw error;
    }
  }

  const drafts = [];
  if (
    (lowerPrompt.includes("complete") || lowerPrompt.includes("close")) &&
    workOrderResults.length
  ) {
    drafts.push(
      buildCompletionDraft(sessionId, workOrderResults[0], userContext)
    );
    insightMessages.push(
      `I prepared a draft to complete work order ${
        workOrderResults[0].code || workOrderResults[0].id
      }. Confirm it from your drafts list to apply the change.`
    );
  }

  const displayName = resolveDisplayName(userContext) || "there";
  const bulletify = (items, formatter) =>
    items.length ? items.map(formatter).join("\n") : "";

  const workOrderSection = bulletify(workOrderResults, (wo) => {
    const code = wo.code || wo.id;
    const title = wo.title || wo.description || "Work order";
    const meta = [
      wo.priority ? `Priority ${wo.priority}` : null,
      wo.status ? `Status ${wo.status}` : null,
      wo.asset ? `Asset ${wo.asset}` : null
    ].filter(Boolean);
    const suffix = meta.length ? ` (${meta.join("; ")})` : "";
    return `- ${code}: ${title}${suffix}`;
  });

  const assetSection = bulletify(assetResults, (asset) => {
    const meta = [
      asset.status ? `Status ${asset.status}` : null,
      asset.location ? `Location ${asset.location}` : null,
      asset.customId ? `ID ${asset.customId}` : null
    ].filter(Boolean);
    const suffix = meta.length ? ` (${meta.join("; ")})` : "";
    return `- ${asset.name}${suffix}`;
  });

  const sections = [];
  if (workOrderSection) {
    sections.push(`Work orders:\n${workOrderSection}`);
  }
  if (assetSection) {
    sections.push(`Assets:\n${assetSection}`);
  }
  if (drafts.length) {
    const draftSummary = drafts
      .map(
        (draft) => `- ${draft.operationType} (session ${draft.agentSessionId})`
      )
      .join("\n");
    sections.push(`Draft actions ready for review:\n${draftSummary}`);
  }

  let messageContent;
  if (sections.length) {
    messageContent = [
      `Hi ${displayName}, here's what I pulled together:`,
      ...sections
    ].join("\n\n");
  } else {
    messageContent = `Hi ${displayName}, I don't have fresh maintenance insights yet. Ask about open work orders or assets to get started.`;
  }

  let messages = [
    {
      role: "assistant",
      content: messageContent
    }
  ];

  return {
    status: "success",
    message: "Agent response generated",
    agentId,
    sessionId,
    messages,
    toolCalls,
    drafts
  };
};

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    openaiConfigured: Boolean(agentsClient)
  });
});

app.post("/v1/chat", async (req, res) => {
  const { prompt, agentId: requestedAgentId, metadata } = req.body || {};

  if (!prompt) {
    return res.status(400).json({ error: "prompt is required" });
  }

  const authorizationHeader = req.headers.authorization;
  const agentId = requestedAgentId || DEFAULT_AGENT_ID || "default-agent";
  const userClaims = verifyToken(authorizationHeader);
  const userContext = await fetchUserContext(authorizationHeader);

  logger.info("Received chat prompt", {
    agentId,
    hasOpenAIClient: Boolean(agentsClient),
    user: userClaims ? userClaims.sub : null
  });

  try {
    const response = await processPrompt({
      prompt,
      agentId,
      authorizationHeader,
      userContext,
      metadata
    });
    return res.json(response);
  } catch (error) {
    if (error instanceof RbacError) {
      logger.warn("RBAC prevented tool execution", { error: error.message });
      return res.status(403).json({
        status: "error",
        message: error.message,
        agentId,
        toolCalls: error.toolLog ? [error.toolLog] : []
      });
    }
    logger.error("Failed to process prompt", { error: error.message });
    return res.status(500).json({
      status: "error",
      message: "Failed to process agent request."
    });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`Agents proxy listening on port ${PORT}`, { apiBase: API_BASE });
  });
}

module.exports = app;



