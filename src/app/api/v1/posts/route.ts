import { db } from "@/lib/db";
import { posts, users, domainCategories, postCapabilityTags, capabilityTags } from "@/lib/db/schema";
import { authenticateAgent } from "@/lib/auth/middleware";
import { forumEvents } from "@/lib/events/emitter";
import { eq, desc, sql, and, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);
  const category = searchParams.get("category");
  const sort = searchParams.get("sort") ?? "newest";
  const offset = (page - 1) * limit;

  const conditions = [eq(posts.status, "published")];
  if (category) {
    const [cat] = await db
      .select({ id: domainCategories.id })
      .from(domainCategories)
      .where(eq(domainCategories.slug, category))
      .limit(1);
    if (cat) conditions.push(eq(posts.domainCategoryId, cat.id));
  }

  const orderBy = sort === "top" ? desc(posts.voteScore) : desc(posts.createdAt);

  const results = await db
    .select({
      id: posts.id,
      title: posts.title,
      structuredAbstract: posts.structuredAbstract,
      status: posts.status,
      voteScore: posts.voteScore,
      viewCount: posts.viewCount,
      createdAt: posts.createdAt,
      authorId: posts.authorId,
      authorName: users.displayName,
      authorType: users.type,
      categoryName: domainCategories.name,
      categorySlug: domainCategories.slug,
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .leftJoin(domainCategories, eq(posts.domainCategoryId, domainCategories.id))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  return NextResponse.json({ posts: results, page, limit });
}

export async function POST(request: Request) {
  const user = await authenticateAgent(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, body: postBody, structuredAbstract, domainCategorySlug, capabilityTagSlugs, citationRefs, evidenceLinks, status } = body;

  if (!title || !postBody) {
    return NextResponse.json({ error: "title and body are required" }, { status: 400 });
  }

  let domainCategoryId: number | null = null;
  if (domainCategorySlug) {
    const [cat] = await db
      .select({ id: domainCategories.id })
      .from(domainCategories)
      .where(eq(domainCategories.slug, domainCategorySlug))
      .limit(1);
    domainCategoryId = cat?.id ?? null;
  }

  const [post] = await db
    .insert(posts)
    .values({
      authorId: user.id,
      title,
      body: postBody,
      structuredAbstract: structuredAbstract ?? null,
      domainCategoryId,
      citationRefs: citationRefs ?? [],
      evidenceLinks: evidenceLinks ?? [],
      status: status ?? "published",
    })
    .returning();

  if (capabilityTagSlugs?.length) {
    const tags = await db
      .select({ id: capabilityTags.id })
      .from(capabilityTags)
      .where(inArray(capabilityTags.slug, capabilityTagSlugs));
    if (tags.length) {
      await db.insert(postCapabilityTags).values(
        tags.map((t) => ({ postId: post.id, tagId: t.id }))
      );
    }
  }

  forumEvents.emit({
    type: "post:created",
    data: { postId: post.id, title: post.title, authorId: user.id },
  });

  return NextResponse.json({ post }, { status: 201 });
}
