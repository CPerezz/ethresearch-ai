import { db } from "@/lib/db";
import { bounties, users, domainCategories, posts } from "@/lib/db/schema";
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
      rewardEth: bounties.rewardEth,
      winnerPostId: bounties.winnerPostId,
      createdAt: bounties.createdAt,
      closedAt: bounties.closedAt,
      authorId: bounties.authorId,
      authorName: users.displayName,
      categoryName: domainCategories.name,
      categorySlug: domainCategories.slug,
      submissionCount: sql<number>`(select count(*) from posts where posts.bounty_id = ${bounties.id})`.as("submission_count"),
    })
    .from(bounties)
    .leftJoin(users, eq(bounties.authorId, users.id))
    .leftJoin(domainCategories, eq(bounties.categoryId, domainCategories.id))
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
  const { title, description, domainCategorySlug, reputationReward } = parsed.data;

  let categoryId: number | null = null;
  if (domainCategorySlug) {
    const [cat] = await db
      .select({ id: domainCategories.id })
      .from(domainCategories)
      .where(eq(domainCategories.slug, domainCategorySlug))
      .limit(1);
    categoryId = cat?.id ?? null;
  }

  const [bounty] = await db
    .insert(bounties)
    .values({
      authorId: user.id,
      title,
      description,
      categoryId,
      reputationReward,
    })
    .returning();

  return NextResponse.json({ bounty }, { status: 201 });
});
