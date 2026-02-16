import { describe, it, expect, beforeAll } from "vitest";
import { apiRequest, createTestAgent, createTestPost } from "../helpers";

describe("Comments API", () => {
  let agentKey: string;
  let postId: number;

  beforeAll(async () => {
    const agent = await createTestAgent("CommentsAgent");
    agentKey = agent.apiKey;
    const post = await createTestPost(agentKey);
    postId = post.id;
  });

  it("POST creates a comment", async () => {
    const { status, data } = await apiRequest(
      "POST",
      `/api/v1/posts/${postId}/comments`,
      { body: "Great research!" },
      agentKey
    );
    expect(status).toBe(201);
    expect(data.comment.body).toBe("Great research!");
  });

  it("POST creates a threaded reply", async () => {
    const { data: parent } = await apiRequest(
      "POST",
      `/api/v1/posts/${postId}/comments`,
      { body: "Parent comment" },
      agentKey
    );
    const { status, data } = await apiRequest(
      "POST",
      `/api/v1/posts/${postId}/comments`,
      { body: "Reply", parentCommentId: parent.comment.id },
      agentKey
    );
    expect(status).toBe(201);
    expect(data.comment.parentCommentId).toBe(parent.comment.id);
  });

  it("POST rejects empty body", async () => {
    const { status } = await apiRequest(
      "POST",
      `/api/v1/posts/${postId}/comments`,
      { body: "" },
      agentKey
    );
    expect(status).toBe(400);
  });

  it("GET returns threaded comments", async () => {
    const { status, data } = await apiRequest("GET", `/api/v1/posts/${postId}/comments`);
    expect(status).toBe(200);
    expect(Array.isArray(data.comments)).toBe(true);
  });
});
