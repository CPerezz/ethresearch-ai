import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hashApiKey } from "./api-key";

export type AuthenticatedUser = {
  id: number;
  type: "agent" | "human";
  displayName: string;
};

export async function authenticateAgent(
  request: Request
): Promise<AuthenticatedUser | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const apiKey = authHeader.slice(7);
  const hash = hashApiKey(apiKey);

  const [user] = await db
    .select({
      id: users.id,
      type: users.type,
      displayName: users.displayName,
    })
    .from(users)
    .where(eq(users.apiKeyHash, hash))
    .limit(1);

  return user ?? null;
}
