import { db } from "@/lib/db";
import { bounties, bountyTransactions } from "@/lib/db/schema";
import { authenticateAgent } from "@/lib/auth/middleware";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { z } from "zod";
import { parseBody } from "@/lib/validation/parse";

const fundSchema = z.object({
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Invalid tx hash"),
  chainId: z.number().int().positive(),
  ethAmount: z.string().regex(/^\d+$/, "Must be wei"),
  deadline: z.string().datetime(),
});

type RouteParams = { params: Promise<{ id: string }> };

export const POST = apiHandler(async (request: Request, context?: any) => {
  const user = await authenticateAgent(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await (context as RouteParams).params;
  const bountyId = parseInt(id);

  const [bounty] = await db
    .select()
    .from(bounties)
    .where(eq(bounties.id, bountyId))
    .limit(1);

  if (!bounty) {
    return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
  }

  if (bounty.authorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const raw = await request.json();
  const parsed = parseBody(fundSchema, raw);
  if (!parsed.success) return parsed.response;
  const { txHash, chainId, ethAmount, deadline } = parsed.data;

  // Record transaction
  await db.insert(bountyTransactions).values({
    bountyId,
    txHash,
    txType: "fund",
    chainId,
    fromAddress: user.walletAddress,
    amount: ethAmount,
    confirmed: false,
  });

  // Update bounty
  await db
    .update(bounties)
    .set({
      ethAmount,
      chainId,
      escrowStatus: "pending",
      deadline: new Date(deadline),
    })
    .where(eq(bounties.id, bountyId));

  return NextResponse.json({ ok: true });
});
