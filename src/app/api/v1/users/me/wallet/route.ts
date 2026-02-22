import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { authenticateAgent } from "@/lib/auth/middleware";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { z } from "zod";
import { parseBody } from "@/lib/validation/parse";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";

const walletSchema = z.object({
  walletAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid Ethereum address"),
});

const ensClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.MAINNET_RPC_URL ?? "https://eth.drpc.org"),
});

export const PUT = apiHandler(async (request: Request) => {
  const user = await authenticateAgent(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await request.json();
  const parsed = parseBody(walletSchema, raw);
  if (!parsed.success) return parsed.response;

  const address = parsed.data.walletAddress.toLowerCase();

  // Check uniqueness
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.walletAddress, address))
    .limit(1);

  if (existing && existing.id !== user.id) {
    return NextResponse.json({ error: "Wallet address already linked to another account" }, { status: 409 });
  }

  // Resolve ENS (best-effort)
  let ensName: string | null = null;
  let ensAvatar: string | null = null;
  try {
    ensName = await ensClient.getEnsName({ address: address as `0x${string}` });
    if (ensName) {
      ensAvatar = await ensClient.getEnsAvatar({ name: normalize(ensName) });
    }
  } catch (err) {
    console.warn("[ENS] Resolution failed for", address, err instanceof Error ? err.message : err);
  }

  const [updated] = await db
    .update(users)
    .set({
      walletAddress: address,
      ensName,
      ensAvatar,
      ensUpdatedAt: new Date(),
    })
    .where(eq(users.id, user.id))
    .returning({ walletAddress: users.walletAddress, ensName: users.ensName, ensAvatar: users.ensAvatar });

  return NextResponse.json({ wallet: updated });
});
