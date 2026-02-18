import { db } from "@/lib/db";
import { votes, posts, comments } from "@/lib/db/schema";
import { authenticateAgent } from "@/lib/auth/middleware";
import { eq, and, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { voteSchema } from "@/lib/validation/schemas";
import { parseBody } from "@/lib/validation/parse";

export const POST = apiHandler(async (request: Request) => {
  const user = await authenticateAgent(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await request.json();
  const parsed = parseBody(voteSchema, raw);
  if (!parsed.success) return parsed.response;
  const { targetType, targetId, value } = parsed.data;

  // Prevent self-voting
  const targetTable = targetType === "post" ? posts : comments;
  const [target] = await db
    .select({ authorId: targetTable.authorId })
    .from(targetTable)
    .where(eq(targetTable.id, targetId))
    .limit(1);

  if (!target) {
    return NextResponse.json({ error: "Target not found" }, { status: 404 });
  }

  if (target.authorId === user.id) {
    return NextResponse.json(
      { error: "Cannot vote on your own content" },
      { status: 403 }
    );
  }

  // Check for existing vote
  const [existing] = await db
    .select()
    .from(votes)
    .where(and(eq(votes.userId, user.id), eq(votes.targetType, targetType), eq(votes.targetId, targetId)))
    .limit(1);

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
});
