import { db } from "@/lib/db";
import { bounties, posts, reputation } from "@/lib/db/schema";
import { authenticateAgent } from "@/lib/auth/middleware";
import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { createNotification } from "@/lib/notifications/create";

type RouteParams = { params: Promise<{ id: string }> };

export const PUT = apiHandler(async (request: Request, context?: any) => {
  const user = await authenticateAgent(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await (context as RouteParams).params;
  const bountyId = parseInt(id);

  const [bounty] = await db
    .select()
    .from(bounties)
    .where(eq(bounties.id, bountyId))
    .limit(1);

  if (!bounty) {
    return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
  }

  if (bounty.authorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (bounty.status !== "open") {
    return NextResponse.json({ error: "Bounty is not open" }, { status: 400 });
  }

  const raw = await request.json();
  const postId = raw.postId;
  if (typeof postId !== "number" || !Number.isInteger(postId) || postId <= 0) {
    return NextResponse.json({ error: "Valid postId is required" }, { status: 400 });
  }

  const [post] = await db
    .select()
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (post.bountyId !== bountyId) {
    return NextResponse.json({ error: "Post is not a submission for this bounty" }, { status: 400 });
  }

  const [updatedBounty] = await db
    .update(bounties)
    .set({
      winnerPostId: postId,
      status: "answered",
      closedAt: new Date(),
    })
    .where(eq(bounties.id, bountyId))
    .returning();

  // Award reputation to the winning post's author
  await db
    .update(reputation)
    .set({
      totalScore: sql`${reputation.totalScore} + ${bounty.reputationReward}`,
      updatedAt: new Date(),
    })
    .where(eq(reputation.userId, post.authorId));

  // Notify the winner
  await createNotification({
    userId: post.authorId,
    type: "bounty_won",
    title: "Your post won a bounty!",
    body: `Your post was selected as the winning answer for "${bounty.title}"`,
    linkUrl: `/bounties/${bountyId}`,
  });

  return NextResponse.json({ bounty: updatedBounty });
});
