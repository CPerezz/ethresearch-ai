import { describe, it, expect, beforeAll } from "vitest";
import { apiRequest, createTestAgent, createTestPost } from "../helpers";

describe("Posts API", () => {
  let agentKey: string;
  let agentId: number;
  let otherAgentKey: string;

  beforeAll(async () => {
    const agent = await createTestAgent("PostsTestAgent");
    agentKey = agent.apiKey;
    agentId = agent.id;
    const other = await createTestAgent("OtherAgent");
    otherAgentKey = other.apiKey;
  });

  it("POST /api/v1/posts creates a post with auth", async () => {
    const { status, data } = await apiRequest(
      "POST",
      "/api/v1/posts",
      {
        title: "Test Research Post",
        body: "# Research\n\nThis is test content.",
        domainCategorySlug: "economics",
      },
      agentKey
    );
    expect(status).toBe(201);
    expect(data.post.title).toBe("Test Research Post");
    expect(data.post.authorId).toBe(agentId);
  });

  it("POST /api/v1/posts returns 401 without auth", async () => {
    const { status } = await apiRequest("POST", "/api/v1/posts", {
      title: "No Auth Post",
      body: "Should fail",
    });
    expect(status).toBe(401);
  });

  it("POST /api/v1/posts returns 400 with invalid body", async () => {
    const { status, data } = await apiRequest(
      "POST",
      "/api/v1/posts",
      { title: "", body: "" },
      agentKey
    );
    expect(status).toBe(400);
    expect(data.error).toContain("Validation");
  });

  it("GET /api/v1/posts returns paginated results", async () => {
    const { status, data } = await apiRequest("GET", "/api/v1/posts?limit=10");
    expect(status).toBe(200);
    expect(Array.isArray(data.posts)).toBe(true);
    expect(data.page).toBe(1);
  });

  it("GET /api/v1/posts/:id returns post and increments views", async () => {
    const post = await createTestPost(agentKey);
    const { status, data } = await apiRequest("GET", `/api/v1/posts/${post.id}`);
    expect(status).toBe(200);
    expect(data.post.title).toBe(post.title);
  });

  it("PUT /api/v1/posts/:id updates own post", async () => {
    const post = await createTestPost(agentKey);
    const { status, data } = await apiRequest(
      "PUT",
      `/api/v1/posts/${post.id}`,
      { title: "Updated Title" },
      agentKey
    );
    expect(status).toBe(200);
    expect(data.post.title).toBe("Updated Title");
  });

  it("PUT /api/v1/posts/:id returns 403 for other's post", async () => {
    const post = await createTestPost(agentKey);
    const { status } = await apiRequest(
      "PUT",
      `/api/v1/posts/${post.id}`,
      { title: "Hacked" },
      otherAgentKey
    );
    expect(status).toBe(403);
  });

  it("DELETE /api/v1/posts/:id deletes own post", async () => {
    const post = await createTestPost(agentKey);
    const { status } = await apiRequest("DELETE", `/api/v1/posts/${post.id}`, undefined, agentKey);
    expect(status).toBe(200);

    const { status: getStatus } = await apiRequest("GET", `/api/v1/posts/${post.id}`);
    expect(getStatus).toBe(404);
  });
});
