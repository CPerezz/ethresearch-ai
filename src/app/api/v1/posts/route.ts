import { db } from "@/lib/db";
import { posts, users, topics, tags, postTags, bounties } from "@/lib/db/schema";
import { authenticateAgent } from "@/lib/auth/middleware";
import { forumEvents } from "@/lib/events/emitter";
import { checkAndAwardBadges } from "@/lib/badges/check";
import { eq, desc, sql, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { createPostSchema } from "@/lib/validation/schemas";
import { parseBody } from "@/lib/validation/parse";

export const GET = apiHandler(async (request: Request) => {
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);
  const topic = searchParams.get("topic");
  const sort = searchParams.get("sort") ?? "hot";
  const offset = (page - 1) * limit;

  const conditions = [eq(posts.status, "published")];
  if (topic) {
    const [t] = await db.select({ id: topics.id }).from(topics).where(eq(topics.slug, topic)).limit(1);
    if (t) conditions.push(eq(posts.topicId, t.id));
  }

  const hotScore = sql`${posts.voteScore} / power(extract(epoch from (now() - ${posts.createdAt})) / 3600 + 2, 1.5)`;
  const orderBy =
    sort === "hot" ? desc(hotScore) : sort === "top" ? desc(posts.voteScore) : desc(posts.createdAt);

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
      topicName: topics.name,
      topicSlug: topics.slug,
      tags: sql<string>`COALESCE((SELECT json_agg(json_build_object('name', t.name, 'slug', t.slug)) FROM post_tags pt JOIN tags t ON pt.tag_id = t.id WHERE pt.post_id = ${posts.id}), '[]')`.as("tags"),
      bountyId: posts.bountyId,
      bountyTitle: bounties.title,
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .leftJoin(topics, eq(posts.topicId, topics.id))
    .leftJoin(bounties, eq(posts.bountyId, bounties.id))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  return NextResponse.json({ posts: results, page, limit });
});

export const POST = apiHandler(async (request: Request) => {
  const user = await authenticateAgent(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await request.json();
  const parsed = parseBody(createPostSchema, raw);
  if (!parsed.success) return parsed.response;
  const { title, body: postBody, structuredAbstract, topicSlug, tags: tagNames, citationRefs, evidenceLinks, status, bountyId } = parsed.data;

  if (bountyId) {
    const [bounty] = await db.select({ status: bounties.status }).from(bounties).where(eq(bounties.id, bountyId)).limit(1);
    if (!bounty || bounty.status !== "open") {
      return NextResponse.json({ error: "Bounty not found or not open" }, { status: 400 });
    }
  }

  let topicId: number | null = null;
  if (topicSlug) {
    const [t] = await db
      .select({ id: topics.id })
      .from(topics)
      .where(eq(topics.slug, topicSlug))
      .limit(1);
    if (!t) return NextResponse.json({ error: "Invalid topic" }, { status: 400 });
    topicId = t.id;
  }

  const [post] = await db
    .insert(posts)
    .values({
      authorId: user.id,
      title,
      body: postBody,
      structuredAbstract: structuredAbstract ?? null,
      topicId,
      citationRefs: citationRefs ?? [],
      evidenceLinks: evidenceLinks ?? [],
      status: status ?? "published",
      bountyId: bountyId ?? null,
    })
    .returning();

  if (tagNames?.length) {
    for (const tagName of tagNames) {
      const slug = tagName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      if (!slug) continue;
      const [tag] = await db.insert(tags).values({ name: tagName, slug }).onConflictDoUpdate({ target: tags.slug, set: { name: sql`${tags.name}` } }).returning({ id: tags.id });
      await db.insert(postTags).values({ postId: post.id, tagId: tag.id }).onConflictDoNothing();
    }
  }

  forumEvents.emit({
    type: "post:created",
    data: { postId: post.id, title: post.title, authorId: user.id },
  });

  await checkAndAwardBadges(user.id);

  return NextResponse.json({ post }, { status: 201 });
});
