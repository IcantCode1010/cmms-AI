const request = require("supertest");
const axios = require("axios");

jest.mock("axios");

const app = require("../index");

describe("POST /v1/chat", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    axios.post.mockReset && axios.post.mockReset();
  });

  it("returns stubbed success response with tool calls and drafts", async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        id: 7,
        fullName: "Ava Agent",
        role: { name: "ADMIN" },
        company: { id: 42 }
      }
    });

    axios.post.mockResolvedValueOnce({
      data: {
        content: [
          {
            id: 101,
            title: "Inspect HVAC filters",
            priority: "HIGH",
            status: "OPEN",
            asset: { name: "HQ HVAC-1" }
          }
        ]
      }
    });

    const response = await request(app)
      .post("/v1/chat")
      .set("Authorization", "Bearer fake-token")
      .send({
        prompt: "List open work orders and prepare to close the top result."
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("success");
    expect(Array.isArray(response.body.messages)).toBe(true);
    expect(Array.isArray(response.body.toolCalls)).toBe(true);
    expect(response.body.toolCalls[0].toolName).toBe("view_work_orders");
    expect(Array.isArray(response.body.drafts)).toBe(true);
    expect(response.body.drafts.length).toBeGreaterThanOrEqual(1);
  });

  it("enforces RBAC and returns 403 for disallowed roles", async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        id: 8,
        fullName: "Viewer User",
        role: { name: "VIEWER" },
        company: { id: 42 }
      }
    });

    axios.post.mockResolvedValueOnce({
      data: { content: [] }
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
  });

  it("responds with guidance message when prompt has no known intent", async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        id: 9,
        fullName: "Guided User",
        role: { name: "ADMIN" },
        company: { id: 42 }
      }
    });

    axios.post.mockResolvedValueOnce({
      data: { content: [] }
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
  });
});


