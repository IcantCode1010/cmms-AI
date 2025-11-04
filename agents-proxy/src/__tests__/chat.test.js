const request = require("supertest");

jest.mock("axios");
jest.mock("@openai/agents", () => {
  const actual = jest.requireActual("@openai/agents");
  return {
    ...actual,
    run: jest.fn()
  };
});

describe("POST /v1/chat", () => {
  let app;
  let runMock;
  let axiosMock;

  beforeEach(() => {
    jest.resetModules();
    process.env.OPENAI_API_KEY = "test-key";
    axiosMock = require("axios");
    axiosMock.get.mockReset();
    axiosMock.post.mockReset();

    const agents = require("@openai/agents");
    runMock = agents.run;
    runMock.mockReset();
    runMock.mockImplementation(async (_agent, input) => {
      const fallbackMessage = "Hi there, I'm still gathering maintenance insights.";
      const history = [...input, { role: "assistant", content: fallbackMessage }];
      return {
        finalOutput: fallbackMessage,
        history,
        lastResponseId: "resp_default"
      };
    });

    app = require("../index");
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it("orchestrates work order lookup and draft creation via tools", async () => {
    axiosMock.get.mockResolvedValueOnce({
      data: {
        id: 7,
        fullName: "Ava Agent",
        role: { name: "ADMIN" },
        company: { id: 42 }
      }
    });

    axiosMock.post.mockResolvedValueOnce({
      data: {
        results: [
          {
            id: 101,
            code: "WO-101",
            title: "Inspect HVAC filters",
            priority: "HIGH",
            status: "OPEN",
            asset: "HQ HVAC-1"
          }
        ],
        total: 1
      }
    });

    runMock.mockImplementationOnce(async (agent, input, options) => {
      const ctx = options.context;
      const workOrdersTool = agent.tools.find(
        (toolDef) => toolDef.name === "view_work_orders"
      );
      await workOrdersTool.invoke(
        { context: ctx },
        JSON.stringify({
          limit: 5,
          statuses: ["OPEN", "IN_PROGRESS", "ON_HOLD"],
          search: ""
        })
      );

      const draftTool = agent.tools.find(
        (toolDef) => toolDef.name === "prepare_work_order_completion_draft"
      );
      const workOrders = ctx.toolResults.view_work_orders || [];
      await draftTool.invoke(
        { context: ctx },
        JSON.stringify({
          workOrderId: workOrders[0].id,
          summary: `Complete ${workOrders[0].code}`
        })
      );

      const assistantMessage =
        "Hi Ava Agent, here's what I pulled together from the latest work orders.";
      const history = [...input, { role: "assistant", content: assistantMessage }];
      return {
        finalOutput: assistantMessage,
        history,
        lastResponseId: "resp_workorders"
      };
    });

    const response = await request(app)
      .post("/v1/chat")
      .set("Authorization", "Bearer fake-token")
      .send({
        prompt: "List open work orders and prepare to close the top result."
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.toolCalls[0].toolName).toBe("view_work_orders");
    expect(response.body.drafts.length).toBeGreaterThanOrEqual(1);

    expect(axiosMock.get).toHaveBeenCalledWith(
      "http://api:8080/auth/me",
      expect.objectContaining({
        headers: { Authorization: "Bearer fake-token" }
      })
    );
    expect(axiosMock.post).toHaveBeenCalledWith(
      "http://api:8080/api/agent/tools/work-orders/search",
      expect.objectContaining({
        limit: 5,
        statuses: ["OPEN", "IN_PROGRESS", "ON_HOLD"]
      }),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer fake-token" })
      })
    );
  });

  it("enforces RBAC and returns 403 for disallowed roles", async () => {
    axiosMock.get.mockResolvedValueOnce({
      data: {
        id: 8,
        fullName: "Viewer User",
        role: { name: "VIEWER" },
        company: { id: 42 }
      }
    });

    const response = await request(app)
      .post("/v1/chat")
      .set("Authorization", "Bearer fake-token")
      .send({
        prompt: "Show me active work orders."
      });

    expect(response.statusCode).toBe(403);
    expect(response.body.status).toBe("error");
    expect(response.body.message).toMatch(/not authorised/i);
    expect(runMock).not.toHaveBeenCalled();
    expect(axiosMock.post).not.toHaveBeenCalled();
    expect(axiosMock.get).toHaveBeenCalledTimes(1);
  });

  it("responds with guidance message when prompt has no known intent", async () => {
    axiosMock.get.mockResolvedValueOnce({
      data: {
        id: 9,
        fullName: "Guided User",
        role: { name: "ADMIN" },
        company: { id: 42 }
      }
    });

    runMock.mockImplementationOnce(async (_agent, input) => {
      const assistantMessage =
        "Hi Guided User, I don't have fresh maintenance insights yet. Ask about open work orders or assets to get started.";
      const history = [...input, { role: "assistant", content: assistantMessage }];
      return {
        finalOutput: assistantMessage,
        history,
        lastResponseId: "resp_guidance"
      };
    });

    const response = await request(app)
      .post("/v1/chat")
      .set("Authorization", "Bearer fake-token")
      .send({
        prompt: "Hello there."
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.messages[0].content).toMatch(/maintenance insights/i);
    expect(response.body.toolCalls.length).toBe(0);
    expect(response.body.drafts.length).toBe(0);
    expect(axiosMock.post).not.toHaveBeenCalled();
  });

  it("rejects requests without an authorization header", async () => {
    const response = await request(app)
      .post("/v1/chat")
      .send({
        prompt: "Tell me about my work orders."
      });

    expect(response.statusCode).toBe(401);
    expect(response.body.status).toBe("error");
    expect(response.body.message).toMatch(/authorization header/i);
    expect(runMock).not.toHaveBeenCalled();
  });

  it("rejects requests when identity service denies access", async () => {
    axiosMock.get.mockRejectedValueOnce({
      response: { status: 401 },
      message: "Unauthorized"
    });

    const response = await request(app)
      .post("/v1/chat")
      .set("Authorization", "Bearer fake-token")
      .send({
        prompt: "Show me work orders."
      });

    expect(response.statusCode).toBe(401);
    expect(response.body.status).toBe("error");
    expect(response.body.message).toMatch(/failed/i);
    expect(runMock).not.toHaveBeenCalled();
    expect(axiosMock.post).not.toHaveBeenCalled();
  });

  it("rejects requests when tenant context is missing", async () => {
    axiosMock.get.mockResolvedValueOnce({
      data: {
        id: 10,
        fullName: "No Tenant",
        role: { name: "ADMIN" }
      }
    });

    const response = await request(app)
      .post("/v1/chat")
      .set("Authorization", "Bearer fake-token")
      .send({
        prompt: "List assets."
      });

    expect(response.statusCode).toBe(403);
    expect(response.body.status).toBe("error");
    expect(response.body.message).toMatch(/tenant context/i);
    expect(runMock).not.toHaveBeenCalled();
    expect(axiosMock.post).not.toHaveBeenCalled();
  });
});

describe("normaliseCreationInput", () => {
  let normaliseCreationInput;

  beforeEach(() => {
    jest.resetModules();
    process.env.OPENAI_API_KEY = "test-key";
    const app = require("../index");
    normaliseCreationInput = app.__testables.normaliseCreationInput;
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it("returns enhanced title and description while dropping unsupported fields", () => {
    const { data, summaryOverride } = normaliseCreationInput({
      title: "  replace pump seals  ",
      description: "inspect and replace seals as needed",
      priority: "HIGH",
      dueDate: "2025-10-21",
      summary: "urgent maintenance"
    });

    expect(data).toEqual({
      title: "Replace pump seals",
      priority: "LOW",
      description: "Inspect and replace seals as needed."
    });
    expect(summaryOverride).toBe("Urgent maintenance");
  });

  it("falls back to placeholder description when none is provided", () => {
    const { data } = normaliseCreationInput({
      title: "boiler inspection"
    });

    expect(data).toEqual({
      title: "Boiler inspection",
      priority: "LOW",
      description: "Boiler inspection (details pending update)."
    });
  });
});
