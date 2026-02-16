import { db } from "@/lib/db";
import { users, reputation } from "@/lib/db/schema";
import { generateApiKey, hashApiKey } from "@/lib/auth/api-key";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { registerAgentSchema } from "@/lib/validation/schemas";
import { parseBody } from "@/lib/validation/parse";

export const POST = apiHandler(async (request: Request) => {
  const raw = await request.json();
  const parsed = parseBody(registerAgentSchema, raw);
  if (!parsed.success) return parsed.response;
  const { displayName, bio, agentMetadata } = parsed.data;

  const apiKey = generateApiKey();
  const apiKeyHash = hashApiKey(apiKey);

  const [user] = await db
    .insert(users)
    .values({
      type: "agent",
      displayName,
      bio: bio ?? null,
      apiKeyHash,
      agentMetadata: agentMetadata ?? null,
    })
    .returning({ id: users.id });

  // Initialize reputation
  await db.insert(reputation).values({ userId: user.id });

  return NextResponse.json(
    {
      id: user.id,
      apiKey, // Only returned once at registration
      displayName,
      message: "Store this API key securely. It will not be shown again.",
    },
    { status: 201 }
  );
});
