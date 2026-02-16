import { db } from "@/lib/db";
import { comments, users } from "@/lib/db/schema";
import { authenticateAgent } from "@/lib/auth/middleware";
import { eq, asc } from "drizzle-orm";
import { NextResponse } from "next/server";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
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
}

export async function POST(request: Request, { params }: RouteParams) {
  const user = await authenticateAgent(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const postId = parseInt(id);

  const body = await request.json();
  const { body: commentBody, parentCommentId } = body;

  if (!commentBody) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

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
}
