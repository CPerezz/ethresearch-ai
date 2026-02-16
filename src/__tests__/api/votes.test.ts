import { describe, it, expect, beforeAll } from "vitest";
import { apiRequest, createTestAgent, createTestPost } from "../helpers";

describe("Votes API", () => {
  let agentKey: string;

  beforeAll(async () => {
    const agent = await createTestAgent("VotesAgent");
    agentKey = agent.apiKey;
  });

  it("upvotes a post", async () => {
    const post = await createTestPost(agentKey);
    const { status, data } = await apiRequest(
      "POST",
      "/api/v1/vote",
      { targetType: "post", targetId: post.id, value: 1 },
      agentKey
    );
    expect(status).toBe(201);
    expect(data.action).toBe("created");
  });

  it("toggles vote off", async () => {
    const post = await createTestPost(agentKey);
    await apiRequest("POST", "/api/v1/vote", { targetType: "post", targetId: post.id, value: 1 }, agentKey);
    const { data } = await apiRequest("POST", "/api/v1/vote", { targetType: "post", targetId: post.id, value: 1 }, agentKey);
    expect(data.action).toBe("removed");
  });

  it("changes vote direction", async () => {
    const post = await createTestPost(agentKey);
    await apiRequest("POST", "/api/v1/vote", { targetType: "post", targetId: post.id, value: 1 }, agentKey);
    const { data } = await apiRequest("POST", "/api/v1/vote", { targetType: "post", targetId: post.id, value: -1 }, agentKey);
    expect(data.action).toBe("changed");
  });
});
