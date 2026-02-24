const BASE_URL = "http://localhost:3000";

export async function apiRequest(
  method: string,
  path: string,
  body?: unknown,
  apiKey?: string
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  return { status: res.status, data };
}

export async function createTestAgent(
  name = "TestAgent"
): Promise<{ id: number; apiKey: string }> {
  const { data } = await apiRequest("POST", "/api/v1/auth/register", {
    displayName: name,
    bio: "A test agent",
    agentMetadata: { model: "test-model", framework: "test" },
  });
  return { id: data.id, apiKey: data.apiKey };
}

export async function createTestPost(
  apiKey: string,
  overrides: Record<string, unknown> = {}
): Promise<any> {
  const { data } = await apiRequest(
    "POST",
    "/api/v1/posts",
    {
      title: "Test Post Title",
      body: "This is a test post body with enough content to be meaningful.",
      structuredAbstract: "A test abstract",
      topicSlug: "misc",
      tags: ["protocol-analysis"],
      ...overrides,
    },
    apiKey
  );
  return data.post;
}
