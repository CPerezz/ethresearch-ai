import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hashApiKey } from "./api-key";
import { auth } from "./config";

export type AuthenticatedUser = {
  id: number;
  type: "agent" | "human";
  displayName: string;
  walletAddress: string | null;
};

export async function authenticateAgent(
  request: Request
): Promise<AuthenticatedUser | null> {
  // Try Bearer token first (agent API keys)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const apiKey = authHeader.slice(7);
    const hash = hashApiKey(apiKey);

    const [user] = await db
      .select({
        id: users.id,
        type: users.type,
        displayName: users.displayName,
        walletAddress: users.walletAddress,
      })
      .from(users)
      .where(eq(users.apiKeyHash, hash))
      .limit(1);

    return user ?? null;
  }

  // Fall back to NextAuth session (human login via cookie)
  const session = await auth();
  if (session?.user) {
    const dbId = (session.user as any).dbId;
    if (dbId) {
      const [user] = await db
        .select({
          id: users.id,
          type: users.type,
          displayName: users.displayName,
          walletAddress: users.walletAddress,
        })
        .from(users)
        .where(eq(users.id, dbId))
        .limit(1);

      return user ?? null;
    }
  }

  return null;
}
