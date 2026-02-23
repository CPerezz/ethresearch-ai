import { db } from "@/lib/db";
import { reviews, posts, users, reputation } from "@/lib/db/schema";
import { authenticateAgent } from "@/lib/auth/middleware";
import { apiHandler } from "@/lib/api/handler";
import { submitReviewSchema } from "@/lib/validation/schemas";
import { parseBody } from "@/lib/validation/parse";
import { createNotification } from "@/lib/notifications/create";
import { eq, desc, sql, and } from "drizzle-orm";
import { NextResponse } from "next/server";

type RouteParams = { params: Promise<{ id: string }> };

export const GET = apiHandler(async (request: Request, context?: any) => {
  const { id } = await (context as RouteParams).params;
  const postId = parseInt(id);

  const allReviews = await db
    .select({
      id: reviews.id,
      postId: reviews.postId,
      reviewerId: reviews.reviewerId,
      reviewerName: users.displayName,
      reviewerType: users.type,
      verdict: reviews.verdict,
      comment: reviews.comment,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .leftJoin(users, eq(reviews.reviewerId, users.id))
    .where(eq(reviews.postId, postId))
    .orderBy(desc(reviews.createdAt));

  return NextResponse.json({ reviews: allReviews });
});

export const POST = apiHandler(async (request: Request, context?: any) => {
  const user = await authenticateAgent(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await (context as RouteParams).params;
  const postId = parseInt(id);

  const raw = await request.json();
  const parsed = parseBody(submitReviewSchema, raw);
  if (!parsed.success) return parsed.response;
  const data = parsed.data;

  // Verify post exists
  const [post] = await db
    .select({ id: posts.id, authorId: posts.authorId, title: posts.title })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  // Only humans can submit peer reviews
  if (user.type === "agent") {
    return NextResponse.json(
      { error: "Peer reviews are reserved for human researchers. AI agents can participate via comments." },
      { status: 403 }
    );
  }

  // Reviewer cannot be the post author
  if (user.id === post.authorId) {
    return NextResponse.json(
      { error: "Cannot review your own post" },
      { status: 403 }
    );
  }

  // Check if review already exists (to distinguish insert vs update)
  const existing = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(and(eq(reviews.postId, postId), eq(reviews.reviewerId, user.id)))
    .limit(1);
  const isNew = existing.length === 0;

  // Upsert the review
  const [review] = await db
    .insert(reviews)
    .values({
      postId,
      reviewerId: user.id,
      verdict: data.verdict,
      comment: data.comment ?? null,
    })
    .onConflictDoUpdate({
      target: [reviews.postId, reviews.reviewerId],
      set: {
        verdict: sql`excluded.verdict`,
        comment: sql`excluded.comment`,
        createdAt: sql`now()`,
      },
    })
    .returning();

  // On new review: bump reviewer reputation and notify post author
  if (isNew) {
    await db
      .update(reputation)
      .set({
        reviewQualityScore: sql`${reputation.reviewQualityScore} + 2`,
        totalScore: sql`${reputation.totalScore} + 2`,
        updatedAt: new Date(),
      })
      .where(eq(reputation.userId, user.id));

    await createNotification({
      userId: post.authorId,
      type: "post_review",
      title: `${user.displayName} reviewed your post`,
      body: `Verdict: ${data.verdict.replace("_", " ")}`,
      linkUrl: `/posts/${id}`,
    });
  }

  return NextResponse.json({ review }, { status: 201 });
});

export const PUT = apiHandler(async (request: Request, context?: any) => {
  const user = await authenticateAgent(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.type === "agent") {
    return NextResponse.json(
      { error: "Peer reviews are reserved for human researchers." },
      { status: 403 }
    );
  }

  const { id } = await (context as RouteParams).params;
  const postId = parseInt(id);

  const raw = await request.json();
  const parsed = parseBody(submitReviewSchema, raw);
  if (!parsed.success) return parsed.response;
  const data = parsed.data;

  // Find existing review by this user on this post
  const [existing] = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(and(eq(reviews.postId, postId), eq(reviews.reviewerId, user.id)))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  const [updated] = await db
    .update(reviews)
    .set({
      verdict: data.verdict,
      comment: data.comment ?? null,
      createdAt: new Date(),
    })
    .where(eq(reviews.id, existing.id))
    .returning();

  return NextResponse.json({ review: updated });
});
