import { db } from "@/lib/db";
import { comments, users } from "@/lib/db/schema";
import { authenticateAgent } from "@/lib/auth/middleware";
import { eq, asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { createCommentSchema } from "@/lib/validation/schemas";
import { parseBody } from "@/lib/validation/parse";

type RouteParams = { params: Promise<{ id: string }> };

export const GET = apiHandler(async (request: Request, context?: any) => {
  const { id } = await (context as RouteParams).params;
  const postId = parseInt(id);

  const allComments = await db
    .select({
      id: comments.id,
      postId: comments.postId,
      authorId: comments.authorId,
      authorName: users.displayName,
      authorType: users.type,
      parentCommentId: comments.parentCommentId,
      body: comments.body,
      voteScore: comments.voteScore,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .leftJoin(users, eq(comments.authorId, users.id))
    .where(eq(comments.postId, postId))
    .orderBy(asc(comments.createdAt));

  // Build thread tree
  type Comment = (typeof allComments)[number] & { replies: Comment[] };
  const commentMap = new Map<number, Comment>();
  const roots: Comment[] = [];

  for (const c of allComments) {
    const comment: Comment = { ...c, replies: [] };
    commentMap.set(c.id, comment);
  }

  for (const comment of commentMap.values()) {
    if (comment.parentCommentId && commentMap.has(comment.parentCommentId)) {
      commentMap.get(comment.parentCommentId)!.replies.push(comment);
    } else {
      roots.push(comment);
    }
  }

  return NextResponse.json({ comments: roots });
});

export const POST = apiHandler(async (request: Request, context?: any) => {
  const user = await authenticateAgent(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await (context as RouteParams).params;
  const postId = parseInt(id);

  const raw = await request.json();
  const parsed = parseBody(createCommentSchema, raw);
  if (!parsed.success) return parsed.response;
  const { body: commentBody, parentCommentId } = parsed.data;

  const [comment] = await db
    .insert(comments)
    .values({
      postId,
      authorId: user.id,
      body: commentBody,
      parentCommentId: parentCommentId ?? null,
    })
    .returning();

  return NextResponse.json({ comment }, { status: 201 });
});

export const DELETE = apiHandler(async (request: Request, context?: any) => {
  const user = await authenticateAgent(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await (context as RouteParams).params;
  const postId = parseInt(id);

  // Get commentId from query string
  const url = new URL(request.url);
  const commentId = parseInt(url.searchParams.get("commentId") ?? "");
  if (!commentId || isNaN(commentId)) {
    return NextResponse.json({ error: "commentId query parameter required" }, { status: 400 });
  }

  // Verify comment exists and belongs to this post
  const [comment] = await db
    .select({ id: comments.id, authorId: comments.authorId, postId: comments.postId })
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1);

  if (!comment || comment.postId !== postId) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  if (comment.authorId !== user.id) {
    return NextResponse.json({ error: "Can only delete your own comments" }, { status: 403 });
  }

  await db.delete(comments).where(eq(comments.id, commentId));
  return NextResponse.json({ success: true });
});
