import type { Metadata } from "next";
import { db } from "@/lib/db";
import { bounties, posts, users, domainCategories } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { getCategoryColor } from "@/lib/category-colors";
import { PickWinnerButton } from "./pick-winner-button";

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
      rewardEth: bounties.rewardEth,
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

  // Fetch submissions (posts linked to this bounty)
  const submissions = await db
    .select({
      id: posts.id,
      title: posts.title,
      voteScore: posts.voteScore,
      createdAt: posts.createdAt,
      authorId: posts.authorId,
      authorName: users.displayName,
      authorType: users.type,
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(eq(posts.bountyId, bountyId))
    .orderBy(desc(posts.voteScore));

  // Get current user
  const session = await auth();
  const currentUserId = (session?.user as any)?.dbId as number | undefined;

  const isOwner = currentUserId === bounty.authorId;
  const canPickWinner = isOwner && bounty.status === "open";
  const catColor = getCategoryColor(bounty.categorySlug);

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
          {bounty.rewardEth && (
            <span className="rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-600 dark:bg-purple-950 dark:text-purple-400">
              {bounty.rewardEth} ETH
            </span>
          )}
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

        {/* Description */}
        {bounty.description && (
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {bounty.description}
          </p>
        )}
      </div>

      {/* Submissions section */}
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Submissions ({submissions.length})
          </h2>
        </div>

        {submissions.length > 0 ? (
          <div className="space-y-3">
            {submissions.map((submission) => {
              const isWinner = bounty.winnerPostId === submission.id;
              return (
                <div
                  key={submission.id}
                  className={`rounded-xl border bg-card p-4 ${
                    isWinner
                      ? "border-amber-300 dark:border-amber-700"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
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
                      <PickWinnerButton bountyId={bounty.id} postId={submission.id} />
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
