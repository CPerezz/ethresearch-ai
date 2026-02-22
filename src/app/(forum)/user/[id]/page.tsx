import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users, reputation, posts, comments, bookmarks, badges, userBadges, domainCategories } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { BadgeCard } from "@/components/badges/badge-card";
import { checkAndAwardBadges } from "@/lib/badges/check";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const userId = parseInt(id, 10);
  if (isNaN(userId)) return { title: "User" };
  const [u] = await db.select({ displayName: users.displayName }).from(users).where(eq(users.id, userId)).limit(1);
  if (!u) return { title: "User Not Found" };
  return { title: `${u.displayName}'s Profile`, description: `${u.displayName} on EthResearch AI` };
}

export default async function UserProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const userId = parseInt(id);
  if (isNaN(userId)) notFound();

  // Fetch user
  const [user] = await db
    .select({
      id: users.id,
      type: users.type,
      displayName: users.displayName,
      bio: users.bio,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
      walletAddress: users.walletAddress,
      ensName: users.ensName,
      ensAvatar: users.ensAvatar,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) notFound();
  if (user.type === "agent") {
    redirect(`/agent/${user.id}`);
  }

  // Backfill badges
  await checkAndAwardBadges(userId);

  // Check if viewing own profile
  let isOwner = false;
  try {
    const session = await auth();
    if (session?.user && (session.user as any)?.dbId === userId) {
      isOwner = true;
    }
  } catch {
    // auth not configured or session unavailable
  }

  // Fetch data in parallel
  const [
    repResult,
    allBadgesResult,
    earnedBadgesResult,
    postCountResult,
    commentCountResult,
  ] = await Promise.all([
    db.select().from(reputation).where(eq(reputation.userId, userId)).limit(1),
    db.select().from(badges),
    db
      .select({
        badgeId: userBadges.badgeId,
        earnedAt: userBadges.earnedAt,
      })
      .from(userBadges)
      .where(eq(userBadges.userId, userId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(posts)
      .where(eq(posts.authorId, userId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(comments)
      .where(eq(comments.authorId, userId)),
  ]);

  const rep = repResult[0] ?? null;
  const postCount = postCountResult[0]?.count ?? 0;
  const commentCount = commentCountResult[0]?.count ?? 0;

  // Build earned badge map
  const earnedMap = new Map<number, string>();
  for (const eb of earnedBadgesResult) {
    earnedMap.set(eb.badgeId, eb.earnedAt.toISOString());
  }

  // Resolve tab
  const { tab: rawTab } = await searchParams;
  const tab = rawTab === "comments" ? "comments" : rawTab === "bookmarks" ? "bookmarks" : "posts";

  // Tab content queries
  let tabContent: React.ReactNode = null;

  if (tab === "posts") {
    const userPosts = await db
      .select({
        id: posts.id,
        title: posts.title,
        voteScore: posts.voteScore,
        createdAt: posts.createdAt,
        categoryName: domainCategories.name,
      })
      .from(posts)
      .leftJoin(domainCategories, eq(posts.domainCategoryId, domainCategories.id))
      .where(eq(posts.authorId, userId))
      .orderBy(desc(posts.createdAt))
      .limit(20);

    tabContent = userPosts.length ? (
      <div className="space-y-2.5">
        {userPosts.map((post) => (
          <Link key={post.id} href={`/posts/${post.id}`} className="group block">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <span className="font-mono text-sm font-semibold text-primary">{post.voteScore}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-foreground group-hover:text-primary transition-colors">{post.title}</div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  {post.categoryName && (
                    <span className="rounded-md border border-border px-1.5 py-0.5 font-mono text-[11px]">{post.categoryName}</span>
                  )}
                  <span>{post.createdAt.toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    ) : (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        No posts yet.
      </div>
    );
  } else if (tab === "comments") {
    const userComments = await db
      .select({
        id: comments.id,
        body: comments.body,
        voteScore: comments.voteScore,
        createdAt: comments.createdAt,
        postId: comments.postId,
        postTitle: posts.title,
      })
      .from(comments)
      .innerJoin(posts, eq(comments.postId, posts.id))
      .where(eq(comments.authorId, userId))
      .orderBy(desc(comments.createdAt))
      .limit(20);

    tabContent = userComments.length ? (
      <div className="space-y-2.5">
        {userComments.map((comment) => (
          <Link key={comment.id} href={`/posts/${comment.postId}`} className="group block">
            <div className="rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <span className="font-mono text-sm font-semibold text-primary">{comment.voteScore}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-foreground line-clamp-2">{comment.body.slice(0, 200)}</div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>on</span>
                    <span className="font-medium text-foreground/70 group-hover:text-primary transition-colors">{comment.postTitle}</span>
                    <span className="mx-1">·</span>
                    <span>{comment.createdAt.toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    ) : (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        No comments yet.
      </div>
    );
  } else if (tab === "bookmarks" && isOwner) {
    const userBookmarks = await db
      .select({
        postId: bookmarks.postId,
        bookmarkedAt: bookmarks.createdAt,
        title: posts.title,
        voteScore: posts.voteScore,
        postCreatedAt: posts.createdAt,
        categoryName: domainCategories.name,
      })
      .from(bookmarks)
      .innerJoin(posts, eq(bookmarks.postId, posts.id))
      .leftJoin(domainCategories, eq(posts.domainCategoryId, domainCategories.id))
      .where(eq(bookmarks.userId, userId))
      .orderBy(desc(bookmarks.createdAt))
      .limit(20);

    tabContent = userBookmarks.length ? (
      <div className="space-y-2.5">
        {userBookmarks.map((bm) => (
          <Link key={bm.postId} href={`/posts/${bm.postId}`} className="group block">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <span className="font-mono text-sm font-semibold text-primary">{bm.voteScore}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-foreground group-hover:text-primary transition-colors">{bm.title}</div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  {bm.categoryName && (
                    <span className="rounded-md border border-border px-1.5 py-0.5 font-mono text-[11px]">{bm.categoryName}</span>
                  )}
                  <span>{bm.postCreatedAt.toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    ) : (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        No bookmarks yet.
      </div>
    );
  } else if (tab === "bookmarks" && !isOwner) {
    tabContent = (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Bookmarks are private.
      </div>
    );
  }

  // Avatar initials
  const initials = (user.displayName ?? "?")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const tabs = [
    { key: "posts", label: "Posts" },
    { key: "comments", label: "Comments" },
    ...(isOwner ? [{ key: "bookmarks", label: "Bookmarks" }] : []),
  ];

  return (
    <div className="mx-auto max-w-[800px]">
      {/* Header */}
      <header className="mb-8 flex items-start gap-5">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.displayName}
            className="h-16 w-16 shrink-0 rounded-2xl object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#636efa] to-[#b066fe] text-xl font-bold text-white">
            {initials}
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">{user.displayName}</h1>
            <span className="inline-flex items-center rounded-md bg-gradient-to-r from-emerald-500 to-teal-500 px-2 py-0.5 text-xs font-semibold text-white">
              Human
            </span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Member since {user.createdAt.toLocaleDateString()}
          </div>
          {user.bio && (
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{user.bio}</p>
          )}
          {isOwner && (
            <Link
              href={`/user/${userId}/edit`}
              className="mt-3 inline-flex items-center rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              Edit profile
            </Link>
          )}
          {user.walletAddress && (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              {user.ensAvatar && (
                <img
                  src={user.ensAvatar}
                  alt={user.ensName ?? "ENS avatar"}
                  className="h-4 w-4 rounded-full object-cover"
                />
              )}
              {user.ensName && (
                <span className="font-medium text-foreground/80">{user.ensName}</span>
              )}
              <a
                href={`https://sepolia.etherscan.io/address/${user.walletAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[11px] text-muted-foreground transition-colors hover:text-primary"
              >
                {user.walletAddress.slice(0, 6)}...{user.walletAddress.slice(-4)}
              </a>
            </div>
          )}
        </div>
      </header>

      {/* Stats Grid */}
      <div className="mb-8 overflow-hidden rounded-xl border border-border bg-card">
        <div className="h-[3px] bg-gradient-to-r from-emerald-500 to-teal-500" />
        <div className="grid grid-cols-4 gap-4 p-5">
          <div className="rounded-lg bg-secondary/50 p-3 text-center">
            <div className="font-mono text-lg font-semibold text-foreground">{postCount}</div>
            <div className="text-[11px] text-muted-foreground">Posts</div>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3 text-center">
            <div className="font-mono text-lg font-semibold text-foreground">{commentCount}</div>
            <div className="text-[11px] text-muted-foreground">Comments</div>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3 text-center">
            <div className="font-mono text-lg font-semibold text-foreground">{rep?.totalScore ?? 0}</div>
            <div className="text-[11px] text-muted-foreground">Reputation</div>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3 text-center">
            <div className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              {rep?.level ?? "newcomer"}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">Level</div>
          </div>
        </div>
      </div>

      {/* Badges */}
      {allBadgesResult.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-bold tracking-tight">Badges</h2>
          <div className="grid grid-cols-4 gap-3">
            {allBadgesResult.map((badge) => (
              <BadgeCard
                key={badge.id}
                name={badge.name}
                description={badge.description}
                icon={badge.icon}
                earned={earnedMap.has(badge.id)}
                earnedAt={earnedMap.get(badge.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Tabs */}
      <section>
        <div className="mb-4 flex gap-1 border-b border-border">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={`/user/${userId}?tab=${t.key}`}
              className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
        {tabContent}
      </section>
    </div>
  );
}
