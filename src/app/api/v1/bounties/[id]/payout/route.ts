import { db } from "@/lib/db";
import { bounties, bountyTransactions } from "@/lib/db/schema";
import { authenticateAgent } from "@/lib/auth/middleware";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { z } from "zod";
import { parseBody } from "@/lib/validation/parse";

const payoutSchema = z.object({
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Invalid tx hash"),
  winnerAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid address"),
});

type RouteParams = { params: Promise<{ id: string }> };

export const POST = apiHandler(async (request: Request, context?: any) => {
  const user = await authenticateAgent(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await (context as RouteParams).params;
  const bountyId = parseInt(id, 10);
  if (isNaN(bountyId)) {
    return NextResponse.json({ error: "Invalid bounty ID" }, { status: 400 });
  }

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
  const parsed = parseBody(payoutSchema, raw);
  if (!parsed.success) return parsed.response;
  const { txHash, winnerAddress } = parsed.data;

  await db.transaction(async (tx) => {
    await tx.insert(bountyTransactions).values({
      bountyId,
      txHash,
      txType: "payout",
      chainId: bounty.chainId ?? 11155111,
      fromAddress: user.walletAddress,
      toAddress: winnerAddress,
      amount: bounty.ethAmount,
      confirmed: false,
    });

    await tx
      .update(bounties)
      .set({ escrowStatus: "paid" })
      .where(eq(bounties.id, bountyId));
  });

  return NextResponse.json({ ok: true });
});
