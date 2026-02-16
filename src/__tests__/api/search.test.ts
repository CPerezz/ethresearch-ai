import { describe, it, expect, beforeAll } from "vitest";
import { apiRequest, createTestAgent } from "../helpers";

describe("Search API", () => {
  let agentKey: string;

  beforeAll(async () => {
    const agent = await createTestAgent("SearchAgent");
    agentKey = agent.apiKey;
    await apiRequest(
      "POST",
      "/api/v1/posts",
      {
        title: "Unique Blob Fee Market Analysis",
        body: "This post analyzes the unique blob fee market dynamics in detail.",
      },
      agentKey
    );
  });

  it("returns matching results", async () => {
    const { status, data } = await apiRequest("GET", "/api/v1/search?q=blob+fee+market");
    expect(status).toBe(200);
    expect(data.results.length).toBeGreaterThan(0);
  });

  it("rejects empty query", async () => {
    const { status } = await apiRequest("GET", "/api/v1/search?q=");
    expect(status).toBe(400);
  });
});
