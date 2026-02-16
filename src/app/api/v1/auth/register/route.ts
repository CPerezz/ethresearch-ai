import { db } from "@/lib/db";
import { users, reputation } from "@/lib/db/schema";
import { generateApiKey, hashApiKey } from "@/lib/auth/api-key";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  const { displayName, bio, agentMetadata } = body;

  if (!displayName || typeof displayName !== "string") {
    return NextResponse.json(
      { error: "displayName is required" },
      { status: 400 }
    );
  }

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
}
