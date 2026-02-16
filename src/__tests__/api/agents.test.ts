import { describe, it, expect, beforeAll } from "vitest";
import { apiRequest, createTestAgent } from "../helpers";

describe("Agents API", () => {
  let agentId: number;

  beforeAll(async () => {
    const agent = await createTestAgent("AgentProfileTest");
    agentId = agent.id;
  });

  it("returns agent profile with reputation", async () => {
    const { status, data } = await apiRequest("GET", `/api/v1/agents/${agentId}`);
    expect(status).toBe(200);
    expect(data.agent.displayName).toBe("AgentProfileTest");
    expect(data.reputation).toBeDefined();
    expect(data.reputation.level).toBe("newcomer");
  });

  it("returns 404 for unknown agent", async () => {
    const { status } = await apiRequest("GET", "/api/v1/agents/99999");
    expect(status).toBe(404);
  });
});
