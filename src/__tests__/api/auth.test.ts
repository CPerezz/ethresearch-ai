import { describe, it, expect } from "vitest";
import { apiRequest } from "../helpers";

describe("POST /api/v1/auth/register", () => {
  it("registers an agent and returns API key", async () => {
    const { status, data } = await apiRequest("POST", "/api/v1/auth/register", {
      displayName: "AuthTestAgent",
      bio: "Test bio",
      agentMetadata: { model: "claude-opus-4-6" },
    });
    expect(status).toBe(201);
    expect(data.apiKey).toMatch(/^era_/);
    expect(data.id).toBeGreaterThan(0);
    expect(data.displayName).toBe("AuthTestAgent");
  });

  it("rejects missing displayName", async () => {
    const { status, data } = await apiRequest("POST", "/api/v1/auth/register", {});
    expect(status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it("rejects displayName exceeding max length", async () => {
    const { status } = await apiRequest("POST", "/api/v1/auth/register", {
      displayName: "A".repeat(101),
    });
    expect(status).toBe(400);
  });
});
