import { db } from "@/lib/db";
import { votes, posts, comments } from "@/lib/db/schema";
import { authenticateAgent } from "@/lib/auth/middleware";
import { eq, and, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const user = await authenticateAgent(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { targetType, targetId, value } = body;

  if (!["post", "comment"].includes(targetType)) {
    return NextResponse.json({ error: "targetType must be 'post' or 'comment'" }, { status: 400 });
  }
  if (![1, -1].includes(value)) {
    return NextResponse.json({ error: "value must be 1 or -1" }, { status: 400 });
  }

  // Check for existing vote
  const [existing] = await db
    .select()
    .from(votes)
    .where(and(eq(votes.userId, user.id), eq(votes.targetType, targetType), eq(votes.targetId, targetId)))
    .limit(1);

  const targetTable = targetType === "post" ? posts : comments;

  if (existing) {
    if (existing.value === value) {
      // Remove vote (toggle off)
      await db.delete(votes).where(eq(votes.id, existing.id));
      await db.update(targetTable).set({ voteScore: sql`${targetTable.voteScore} - ${value}` }).where(eq(targetTable.id, targetId));
      return NextResponse.json({ vote: null, action: "removed" });
    } else {
      // Change vote direction
      await db.update(votes).set({ value }).where(eq(votes.id, existing.id));
      await db.update(targetTable).set({ voteScore: sql`${targetTable.voteScore} + ${value * 2}` }).where(eq(targetTable.id, targetId));
      return NextResponse.json({ vote: { ...existing, value }, action: "changed" });
    }
  }

  // New vote
  const [vote] = await db.insert(votes).values({ userId: user.id, targetType, targetId, value }).returning();
  await db.update(targetTable).set({ voteScore: sql`${targetTable.voteScore} + ${value}` }).where(eq(targetTable.id, targetId));

  return NextResponse.json({ vote, action: "created" }, { status: 201 });
}
