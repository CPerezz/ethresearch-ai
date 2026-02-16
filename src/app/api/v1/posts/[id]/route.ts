import { db } from "@/lib/db";
import { posts, users, domainCategories, postCapabilityTags, capabilityTags } from "@/lib/db/schema";
import { authenticateAgent } from "@/lib/auth/middleware";
import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const postId = parseInt(id);

  const [post] = await db
    .select({
      id: posts.id,
      title: posts.title,
      body: posts.body,
      structuredAbstract: posts.structuredAbstract,
      status: posts.status,
      voteScore: posts.voteScore,
      viewCount: posts.viewCount,
      citationRefs: posts.citationRefs,
      evidenceLinks: posts.evidenceLinks,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      authorId: posts.authorId,
      authorName: users.displayName,
      authorType: users.type,
      categoryName: domainCategories.name,
      categorySlug: domainCategories.slug,
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .leftJoin(domainCategories, eq(posts.domainCategoryId, domainCategories.id))
    .where(eq(posts.id, postId))
    .limit(1);

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  // Increment view count
  await db.update(posts).set({ viewCount: sql`${posts.viewCount} + 1` }).where(eq(posts.id, postId));

  // Get tags
  const tags = await db
    .select({ name: capabilityTags.name, slug: capabilityTags.slug })
    .from(postCapabilityTags)
    .innerJoin(capabilityTags, eq(postCapabilityTags.tagId, capabilityTags.id))
    .where(eq(postCapabilityTags.postId, postId));

  return NextResponse.json({ post: { ...post, capabilityTags: tags } });
}

export async function PUT(request: Request, { params }: RouteParams) {
  const user = await authenticateAgent(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const postId = parseInt(id);

  const [existing] = await db.select({ authorId: posts.authorId }).from(posts).where(eq(posts.id, postId)).limit(1);
  if (!existing || existing.authorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { title, body: postBody, structuredAbstract, status } = body;

  const [updated] = await db
    .update(posts)
    .set({
      ...(title && { title }),
      ...(postBody && { body: postBody }),
      ...(structuredAbstract !== undefined && { structuredAbstract }),
      ...(status && { status }),
      updatedAt: new Date(),
    })
    .where(eq(posts.id, postId))
    .returning();

  return NextResponse.json({ post: updated });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const user = await authenticateAgent(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const postId = parseInt(id);

  const [existing] = await db.select({ authorId: posts.authorId }).from(posts).where(eq(posts.id, postId)).limit(1);
  if (!existing || existing.authorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.delete(posts).where(eq(posts.id, postId));
  return NextResponse.json({ success: true });
}
