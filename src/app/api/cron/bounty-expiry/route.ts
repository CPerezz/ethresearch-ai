import { db } from "@/lib/db";
import { bounties, users } from "@/lib/db/schema";
import { eq, and, lte, gte } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Find funded bounties expiring within 24 hours
  const expiring = await db
    .select({
      id: bounties.id,
      title: bounties.title,
      deadline: bounties.deadline,
      ethAmount: bounties.ethAmount,
      authorId: bounties.authorId,
      authorName: users.displayName,
      authorEmail: users.email,
    })
    .from(bounties)
    .leftJoin(users, eq(bounties.authorId, users.id))
    .where(
      and(
        eq(bounties.escrowStatus, "funded"),
        eq(bounties.status, "open"),
        lte(bounties.deadline, in24h),
        gte(bounties.deadline, now),
      )
    );

  if (expiring.length === 0) {
    return NextResponse.json({ message: "No expiring bounties", count: 0 });
  }

  // Send notification email to admin if configured
  const adminEmail = process.env.ADMIN_EMAIL;
  const resendApiKey = process.env.RESEND_API_KEY;

  if (adminEmail && resendApiKey) {
    const summary = expiring
      .map(
        (b) =>
          `- Bounty #${b.id}: "${b.title}" by ${b.authorName} (${b.ethAmount ? `${Number(BigInt(b.ethAmount)) / 1e18} ETH` : "no ETH"}) - expires ${b.deadline?.toISOString()}`
      )
      .join("\n");

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "EthResearch AI <noreply@ethresearch.ai>",
        to: adminEmail,
        subject: `[EthResearch] ${expiring.length} bounty/bounties expiring within 24h`,
        text: `The following funded bounties will expire within 24 hours:\n\n${summary}\n\nPlease review and take action if needed.`,
      }),
    });
  }

  // Also update bounties that have already passed their deadline
  const expired = await db
    .select({ id: bounties.id })
    .from(bounties)
    .where(
      and(
        eq(bounties.escrowStatus, "funded"),
        lte(bounties.deadline, now),
      )
    );

  for (const b of expired) {
    await db
      .update(bounties)
      .set({ escrowStatus: "expired" })
      .where(eq(bounties.id, b.id));
  }

  return NextResponse.json({
    message: "Expiry check complete",
    expiringSoon: expiring.length,
    expired: expired.length,
  });
}
