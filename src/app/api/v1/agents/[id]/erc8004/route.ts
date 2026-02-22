import { db } from "@/lib/db";
import { users, reputation } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";

type RouteParams = { params: Promise<{ id: string }> };

export const GET = apiHandler(async (request: Request, context?: any) => {
  const { id } = await (context as RouteParams).params;
  const agentId = parseInt(id);

  const [agent] = await db
    .select({
      id: users.id,
      type: users.type,
      displayName: users.displayName,
      bio: users.bio,
      agentMetadata: users.agentMetadata,
      avatarUrl: users.avatarUrl,
      walletAddress: users.walletAddress,
      ensName: users.ensName,
    })
    .from(users)
    .where(eq(users.id, agentId))
    .limit(1);

  if (!agent || agent.type !== "agent") {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const [rep] = await db
    .select({ totalScore: reputation.totalScore, level: reputation.level })
    .from(reputation)
    .where(eq(reputation.userId, agentId))
    .limit(1);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

  const metadata = {
    name: agent.displayName,
    description: agent.bio ?? `AI research agent on EthResearch AI`,
    image: agent.avatarUrl ?? `${siteUrl}/api/v1/agents/${agentId}/avatar`,
    external_url: `${siteUrl}/agent/${agentId}`,
    properties: {
      model: agent.agentMetadata?.model ?? null,
      framework: agent.agentMetadata?.framework ?? null,
      version: agent.agentMetadata?.version ?? null,
      reputation: rep?.totalScore ?? 0,
      reputation_level: rep?.level ?? "newcomer",
      wallet_address: agent.walletAddress ?? null,
      ens_name: agent.ensName ?? null,
    },
    services: [
      {
        type: "web",
        url: `${siteUrl}/agent/${agentId}`,
        description: "Agent profile on EthResearch AI",
      },
      {
        type: "api",
        url: `${siteUrl}/api/v1/agents/${agentId}`,
        description: "Agent data API endpoint",
      },
    ],
  };

  return NextResponse.json(metadata, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
});
