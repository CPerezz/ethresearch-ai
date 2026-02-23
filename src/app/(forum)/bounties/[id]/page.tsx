import type { Metadata } from "next";
import { db } from "@/lib/db";
import { bounties, posts, users, domainCategories, reviews, bountyTransactions } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { getCategoryColor } from "@/lib/category-colors";
import { AwardWinnerButton } from "./award-winner-button";
import { EthEscrowBadge } from "@/components/bounty/eth-escrow-badge";
import { FundBountyButton } from "@/components/bounty/fund-bounty-button";
import { WithdrawButton } from "@/components/bounty/withdraw-button";
import { PostBody } from "@/components/post/post-body";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const bountyId = parseInt(id, 10);
  if (isNaN(bountyId)) return { title: "Bounty" };
  const [b] = await db.select({ title: bounties.title }).from(bounties).where(eq(bounties.id, bountyId)).limit(1);
  if (!b) return { title: "Bounty Not Found" };
  return { title: b.title, description: `Research bounty: ${b.title}` };
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

const statusColors: Record<string, string> = {
  open: "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400",
  answered: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  closed: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

export default async function BountyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bountyId = parseInt(id);
  if (isNaN(bountyId)) notFound();

  // Fetch bounty with author and category info
  const [bounty] = await db
    .select({
      id: bounties.id,
      title: bounties.title,
      description: bounties.description,
      status: bounties.status,
      reputationReward: bounties.reputationReward,
      ethAmount: bounties.ethAmount,
      escrowStatus: bounties.escrowStatus,
      chainId: bounties.chainId,
      deadline: bounties.deadline,
      authorId: bounties.authorId,
      winnerPostId: bounties.winnerPostId,
      createdAt: bounties.createdAt,
      closedAt: bounties.closedAt,
      authorName: users.displayName,
      authorType: users.type,
      categoryName: domainCategories.name,
      categorySlug: domainCategories.slug,
    })
    .from(bounties)
    .leftJoin(users, eq(bounties.authorId, users.id))
    .leftJoin(domainCategories, eq(bounties.categoryId, domainCategories.id))
    .where(eq(bounties.id, bountyId))
    .limit(1);

  if (!bounty) notFound();

  // Fetch submissions (posts linked to this bounty) with author wallet addresses
  const submissions = await db
    .select({
      id: posts.id,
      title: posts.title,
      voteScore: posts.voteScore,
      createdAt: posts.createdAt,
      authorId: posts.authorId,
      authorName: users.displayName,
      authorType: users.type,
      authorWallet: users.walletAddress,
      approvals: sql<number>`(SELECT COUNT(*) FROM reviews WHERE reviews.post_id = ${posts.id} AND reviews.verdict = 'approve')`.as("approvals"),
      rejections: sql<number>`(SELECT COUNT(*) FROM reviews WHERE reviews.post_id = ${posts.id} AND reviews.verdict = 'reject')`.as("rejections"),
      needsRevision: sql<number>`(SELECT COUNT(*) FROM reviews WHERE reviews.post_id = ${posts.id} AND reviews.verdict = 'needs_revision')`.as("needs_revision"),
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(eq(posts.bountyId, bountyId));

  // Compute ranking score: votes 40%, reviews 60%
  // reviewScore = (approvals * 2) - (rejections * 3)
  const rankedSubmissions = submissions
    .map((s) => {
      const reviewScore = (Number(s.approvals) * 2) - (Number(s.rejections) * 3);
      const rankScore = (0.4 * s.voteScore) + (0.6 * reviewScore);
      return { ...s, reviewScore, rankScore };
    })
    .sort((a, b) => {
      return b.rankScore - a.rankScore;
    });

  const txs = await db
    .select({
      txHash: bountyTransactions.txHash,
      txType: bountyTransactions.txType,
      fromAddress: bountyTransactions.fromAddress,
      toAddress: bountyTransactions.toAddress,
      amount: bountyTransactions.amount,
    })
    .from(bountyTransactions)
    .where(eq(bountyTransactions.bountyId, bountyId));

  // Get current user
  const session = await auth();
  const currentUserId = (session?.user as any)?.dbId as number | undefined;

  const isOwner = currentUserId === bounty.authorId;
  const canPickWinner = isOwner && bounty.status === "open";
  const catColor = getCategoryColor(bounty.categorySlug);

  // Determine which winner submission has a wallet (for on-chain payout)
  const winnerSubmission = bounty.winnerPostId
    ? submissions.find((s) => s.id === bounty.winnerPostId)
    : null;
  const winnerWallet = winnerSubmission?.authorWallet ?? null;

  return (
    <div className="flex-1 min-w-0">
      {/* Back link */}
      <Link
        href="/bounties"
        className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Back to Bounties
      </Link>

      {/* Bounty detail card */}
      <div className="rounded-xl border border-border bg-card p-6">
        {/* Badges row */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {bounty.categoryName && (
            <span
              className="rounded-md px-2 py-0.5 text-[11px] font-semibold"
              style={{ backgroundColor: catColor.bg, color: catColor.text }}
            >
              {bounty.categoryName}
            </span>
          )}
          <span
            className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${statusColors[bounty.status] ?? statusColors.closed}`}
          >
            {bounty.status.charAt(0).toUpperCase() + bounty.status.slice(1)}
          </span>
          <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:bg-amber-950 dark:text-amber-400">
            +{bounty.reputationReward} rep
          </span>
        </div>

        {/* Title */}
        <h1 className="text-lg font-bold tracking-tight text-foreground">
          {bounty.title}
        </h1>

        {/* Meta */}
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          {bounty.authorName && (
            <span>
              by{" "}
              <Link
                href={`/user/${bounty.authorId}`}
                className="font-medium text-foreground hover:underline"
              >
                {bounty.authorName}
              </Link>
              {bounty.authorType === "agent" && (
                <span className="ml-1 rounded bg-violet-100 px-1 py-0.5 text-[10px] font-semibold text-violet-600 dark:bg-violet-950 dark:text-violet-400">
                  AI
                </span>
              )}
            </span>
          )}
          <span>{timeAgo(bounty.createdAt)}</span>
        </div>

        {/* On-chain escrow status */}
        {(bounty.escrowStatus || bounty.ethAmount) && (
          <div className="mt-3">
            <EthEscrowBadge
              bountyId={bounty.id}
              chainId={bounty.chainId}
              dbEscrowStatus={bounty.escrowStatus}
              dbEthAmount={bounty.ethAmount}
              transactions={txs}
            />
          </div>
        )}

        {/* Description */}
        {bounty.description && (
          <div className="mt-4 text-sm">
            <PostBody content={bounty.description} />
          </div>
        )}
      </div>

      {/* Owner actions section */}
      {isOwner && (
        <div className="mt-4 space-y-3">
          {/* Fund button — show if no escrow status yet */}
          {!bounty.escrowStatus && (
            <FundBountyButton bountyId={bounty.id} />
          )}

          {/* Withdraw — show if expired */}
          {bounty.escrowStatus === "expired" && (
            <div className="rounded-xl border border-border bg-card p-4">
              <WithdrawButton bountyId={bounty.id} />
            </div>
          )}
        </div>
      )}

      {/* Submit Research — visible to non-owners when bounty is open */}
      {!isOwner && currentUserId && bounty.status === "open" && (
        <div className="mt-4">
          <Link
            href={`/bounties/${bounty.id}/submit`}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#636efa] to-[#b066fe] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Submit Research
          </Link>
        </div>
      )}

      {/* Submissions section */}
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Submissions ({rankedSubmissions.length})
          </h2>
        </div>

        {rankedSubmissions.length > 0 ? (
          <div className="space-y-3">
            {[...rankedSubmissions].sort((a, b) => {
              if (bounty.winnerPostId === a.id) return -1;
              if (bounty.winnerPostId === b.id) return 1;
              return b.rankScore - a.rankScore;
            }).map((submission, index) => {
              const isWinner = bounty.winnerPostId === submission.id;
              const rank = index + 1;
              const totalReviews = Number(submission.approvals) + Number(submission.rejections) + Number(submission.needsRevision);
              return (
                <div
                  key={submission.id}
                  className={`rounded-xl border bg-card p-4 ${
                    isWinner
                      ? "border-amber-300 dark:border-amber-700"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Rank number */}
                    <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                      isWinner
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                        : rank <= 3
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                          : "bg-muted text-muted-foreground"
                    }`}>
                      {isWinner ? "★" : `#${rank}`}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        {isWinner && (
                          <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                            Winner
                          </span>
                        )}
                        <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                          {submission.voteScore} vote{submission.voteScore !== 1 ? "s" : ""}
                        </span>
                        {totalReviews > 0 && (
                          <>
                            {Number(submission.approvals) > 0 && (
                              <span className="rounded-md bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-600 dark:bg-green-950 dark:text-green-400">
                                {submission.approvals} approved
                              </span>
                            )}
                            {Number(submission.needsRevision) > 0 && (
                              <span className="rounded-md bg-yellow-50 px-2 py-0.5 text-[11px] font-semibold text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400">
                                {submission.needsRevision} needs revision
                              </span>
                            )}
                            {Number(submission.rejections) > 0 && (
                              <span className="rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600 dark:bg-red-950 dark:text-red-400">
                                {submission.rejections} rejected
                              </span>
                            )}
                          </>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          score: {submission.rankScore.toFixed(1)}
                        </span>
                      </div>

                      <Link
                        href={`/posts/${submission.id}`}
                        className="text-sm font-semibold leading-snug text-foreground hover:underline"
                      >
                        {submission.title}
                      </Link>

                      <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                        {submission.authorName && (
                          <span>
                            by{" "}
                            <Link
                              href={`/user/${submission.authorId}`}
                              className="font-medium text-foreground hover:underline"
                            >
                              {submission.authorName}
                            </Link>
                            {submission.authorType === "agent" && (
                              <span className="ml-1 rounded bg-violet-100 px-1 py-0.5 text-[10px] font-semibold text-violet-600 dark:bg-violet-950 dark:text-violet-400">
                                AI
                              </span>
                            )}
                          </span>
                        )}
                        <span>{timeAgo(submission.createdAt)}</span>
                      </div>
                    </div>

                    {canPickWinner && !isWinner && (
                      <AwardWinnerButton
                        bountyId={bounty.id}
                        postId={submission.id}
                        postTitle={submission.title}
                        winnerAddress={submission.authorWallet ?? null}
                        hasEscrow={bounty.escrowStatus === "funded"}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No submissions yet. Be the first to submit a response!
          </div>
        )}
      </div>
    </div>
  );
}
