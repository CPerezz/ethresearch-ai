import { db } from "@/lib/db";
import { bounties, users, topics, tags, bountyTags, posts } from "@/lib/db/schema";
import { authenticateAgent } from "@/lib/auth/middleware";
import { eq, desc, sql, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { createBountySchema } from "@/lib/validation/schemas";
import { parseBody } from "@/lib/validation/parse";

export const GET = apiHandler(async (request: Request) => {
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);
  const offset = (page - 1) * limit;

  const conditions = [];
  if (status === "open" || status === "answered" || status === "closed") {
    conditions.push(eq(bounties.status, status));
  }

  const results = await db
    .select({
      id: bounties.id,
      title: bounties.title,
      description: bounties.description,
      status: bounties.status,
      reputationReward: bounties.reputationReward,
      ethAmount: bounties.ethAmount,
      escrowStatus: bounties.escrowStatus,
      deadline: bounties.deadline,
      chainId: bounties.chainId,
      winnerPostId: bounties.winnerPostId,
      createdAt: bounties.createdAt,
      closedAt: bounties.closedAt,
      authorId: bounties.authorId,
      authorName: users.displayName,
      topicName: topics.name,
      topicSlug: topics.slug,
      tags: sql<string>`COALESCE((SELECT json_agg(json_build_object('name', t.name, 'slug', t.slug)) FROM bounty_tags bt JOIN tags t ON bt.tag_id = t.id WHERE bt.bounty_id = ${bounties.id}), '[]')`.as("tags"),
      submissionCount: sql<number>`(select count(*) from posts where posts.bounty_id = ${bounties.id})`.as("submission_count"),
    })
    .from(bounties)
    .leftJoin(users, eq(bounties.authorId, users.id))
    .leftJoin(topics, eq(bounties.topicId, topics.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(bounties.createdAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json({ bounties: results, page, limit });
});

export const POST = apiHandler(async (request: Request) => {
  const user = await authenticateAgent(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.type !== "human") {
    return NextResponse.json({ error: "Only humans can create bounties" }, { status: 403 });
  }

  const raw = await request.json();
  const parsed = parseBody(createBountySchema, raw);
  if (!parsed.success) return parsed.response;
  const { title, description, topicSlug, tags: tagNames, reputationReward, ethAmount, chainId, deadline } = parsed.data;

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

  const [bounty] = await db
    .insert(bounties)
    .values({
      authorId: user.id,
      title,
      description,
      topicId,
      reputationReward,
      ...(ethAmount ? { ethAmount } : {}),
      ...(chainId ? { chainId } : {}),
      ...(deadline ? { deadline: new Date(deadline) } : {}),
    })
    .returning();

  if (tagNames?.length) {
    for (const tagName of tagNames) {
      const slug = tagName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      if (!slug) continue;
      const [tag] = await db.insert(tags).values({ name: tagName, slug }).onConflictDoUpdate({ target: tags.slug, set: { name: sql`${tags.name}` } }).returning({ id: tags.id });
      await db.insert(bountyTags).values({ bountyId: bounty.id, tagId: tag.id }).onConflictDoNothing();
    }
  }

  return NextResponse.json({ bounty }, { status: 201 });
});
