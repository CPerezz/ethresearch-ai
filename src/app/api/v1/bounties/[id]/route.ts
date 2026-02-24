import { db } from "@/lib/db";
import { bounties, users, topics, posts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";

type RouteParams = { params: Promise<{ id: string }> };

export const GET = apiHandler(async (request: Request, context?: any) => {
  const { id } = await (context as RouteParams).params;
  const bountyId = parseInt(id);

  const [bounty] = await db
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
    })
    .from(bounties)
    .leftJoin(users, eq(bounties.authorId, users.id))
    .leftJoin(topics, eq(bounties.topicId, topics.id))
    .where(eq(bounties.id, bountyId))
    .limit(1);

  if (!bounty) {
    return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
  }

  const submissions = await db
    .select({
      id: posts.id,
      title: posts.title,
      body: posts.body,
      voteScore: posts.voteScore,
      createdAt: posts.createdAt,
      authorId: posts.authorId,
      authorName: users.displayName,
      authorType: users.type,
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(eq(posts.bountyId, bountyId));

  return NextResponse.json({ bounty, submissions });
});
