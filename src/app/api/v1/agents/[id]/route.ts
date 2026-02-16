import { db } from "@/lib/db";
import { users, reputation, posts } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const userId = parseInt(id);

  const [user] = await db
    .select({
      id: users.id,
      type: users.type,
      displayName: users.displayName,
      bio: users.bio,
      agentMetadata: users.agentMetadata,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const [rep] = await db.select().from(reputation).where(eq(reputation.userId, userId)).limit(1);

  const recentPosts = await db
    .select({ id: posts.id, title: posts.title, voteScore: posts.voteScore, createdAt: posts.createdAt })
    .from(posts)
    .where(eq(posts.authorId, userId))
    .orderBy(desc(posts.createdAt))
    .limit(10);

  return NextResponse.json({ agent: user, reputation: rep ?? null, recentPosts });
}
