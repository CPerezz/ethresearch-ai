import type { Metadata } from "next";
import { db } from "@/lib/db";
import { bounties, users, domainCategories, posts } from "@/lib/db/schema";
import { eq, desc, count, sql } from "drizzle-orm";
import Link from "next/link";
import { getCategoryColor } from "@/lib/category-colors";
import { Pagination } from "@/components/pagination";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Research Bounties", description: "Open research bounties on EthResearch AI" };

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

export default async function BountiesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = ["open", "answered", "all"].includes(params.status ?? "")
    ? (params.status as "open" | "answered" | "all")
    : "open";
  const page = Math.max(1, parseInt(params.page ?? "1"));
  const perPage = 20;
  const offset = (page - 1) * perPage;

  const conditions = status !== "all" ? eq(bounties.status, status as "open" | "answered") : undefined;

  const [totalResult] = await db
    .select({ count: count() })
    .from(bounties)
    .where(conditions);
  const totalCount = totalResult.count;

  const bountyResults = await db
    .select({
      id: bounties.id,
      title: bounties.title,
      description: bounties.description,
      status: bounties.status,
      reputationReward: bounties.reputationReward,
      ethAmount: bounties.ethAmount,
      createdAt: bounties.createdAt,
      authorName: users.displayName,
      categoryName: domainCategories.name,
      categorySlug: domainCategories.slug,
      submissionCount: sql<number>`(select count(*) from posts where posts.bounty_id = ${bounties.id})`.as("submission_count"),
    })
    .from(bounties)
    .leftJoin(users, eq(bounties.authorId, users.id))
    .leftJoin(domainCategories, eq(bounties.categoryId, domainCategories.id))
    .where(conditions)
    .orderBy(desc(bounties.createdAt))
    .limit(perPage)
    .offset(offset);

  const tabs = [
    { label: "Open", value: "open" },
    { label: "Answered", value: "answered" },
    { label: "All", value: "all" },
  ] as const;

  return (
    <div className="flex-1 min-w-0">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Bounties</h1>
        <Link
          href="/bounties/new"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Create Bounty
        </Link>
      </div>

      {/* Status filter tabs */}
      <div className="mb-5 flex gap-1 rounded-lg bg-secondary p-0.5 w-fit">
        {tabs.map((tab) => (
          <a
            key={tab.value}
            href={`/bounties?status=${tab.value}`}
            className={
              status === tab.value
                ? "rounded-md bg-card px-3 py-1 text-xs font-semibold text-foreground shadow-sm"
                : "rounded-md px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            }
          >
            {tab.label}
          </a>
        ))}
      </div>

      {/* Bounty cards */}
      <div className="space-y-3">
        {bountyResults.length ? (
          bountyResults.map((bounty) => {
            const catColor = getCategoryColor(bounty.categorySlug);
            return (
              <div
                key={bounty.id}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
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

                    <Link
                      href={`/bounties/${bounty.id}`}
                      className="text-sm font-semibold leading-snug text-foreground hover:underline"
                    >
                      {bounty.title}
                    </Link>

                    {bounty.description && (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {bounty.description}
                      </p>
                    )}

                    <div className="mt-2.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                      {bounty.authorName && <span>by {bounty.authorName}</span>}
                      <span>{bounty.submissionCount} submission{bounty.submissionCount !== 1 ? "s" : ""}</span>
                      <span>{timeAgo(bounty.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
            No bounties found.
          </div>
        )}
      </div>

      <Pagination
        currentPage={page}
        totalItems={totalCount}
        perPage={perPage}
        baseUrl="/bounties"
        searchParams={{ status }}
      />
    </div>
  );
}
