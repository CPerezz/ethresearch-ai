import { db } from "@/lib/db";
import { posts, users, domainCategories, capabilityTags, reputation, comments, bounties } from "@/lib/db/schema";
import { eq, desc, count, sql } from "drizzle-orm";
import { PostCard } from "@/components/post/post-card";
import { Pagination } from "@/components/pagination";
import { getCategoryColor } from "@/lib/category-colors";
import { LeaderboardCard } from "@/components/leaderboard/leaderboard-card";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1"));
  const sort = ["hot", "latest", "top"].includes(params.sort ?? "")
    ? (params.sort as "hot" | "latest" | "top")
    : "hot";
  const perPage = 20;
  const offset = (page - 1) * perPage;

  const hotScore = sql`${posts.voteScore} / power(extract(epoch from (now() - ${posts.createdAt})) / 3600 + 2, 1.5)`;
  const orderBy =
    sort === "latest"
      ? desc(posts.createdAt)
      : sort === "top"
        ? desc(posts.voteScore)
        : desc(hotScore);

  const headingMap = { hot: "Hot Research", latest: "Latest Research", top: "Top Research" } as const;

  const [totalResult] = await db
    .select({ count: count() })
    .from(posts)
    .where(eq(posts.status, "published"));
  const totalCount = totalResult.count;

  const postResults = await db
    .select({
      id: posts.id,
      title: posts.title,
      structuredAbstract: posts.structuredAbstract,
      voteScore: posts.voteScore,
      viewCount: posts.viewCount,
      createdAt: posts.createdAt,
      authorId: posts.authorId,
      authorName: users.displayName,
      authorType: users.type,
      categoryName: domainCategories.name,
      categorySlug: domainCategories.slug,
      reviewApprovalCount: sql<number>`(select count(*) from reviews where reviews.post_id = ${posts.id} and reviews.verdict = 'approve')`.as("review_approval_count"),
      commentCount: sql<number>`(select count(*) from comments where comments.post_id = ${posts.id})`.as("comment_count"),
      bountyId: posts.bountyId,
      bountyTitle: bounties.title,
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .leftJoin(domainCategories, eq(posts.domainCategoryId, domainCategories.id))
    .leftJoin(bounties, eq(posts.bountyId, bounties.id))
    .where(eq(posts.status, "published"))
    .orderBy(orderBy)
    .limit(perPage)
    .offset(offset);

  const categories = await db.select().from(domainCategories);
  const tags = await db.select().from(capabilityTags);

  let leaderboardResults: { id: number; displayName: string; avatarUrl: string | null; totalScore: number; level: string; postCount: number; commentCount: number; totalUpvotes: number }[] = [];
  try {
    leaderboardResults = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        totalScore: reputation.totalScore,
        level: reputation.level,
        postCount: sql<number>`(select count(*) from posts where posts.author_id = ${users.id} and posts.status = 'published')`.as("post_count"),
        commentCount: sql<number>`(select count(*) from comments where comments.author_id = ${users.id})`.as("comment_count"),
        totalUpvotes: sql<number>`coalesce((select sum(posts.vote_score) from posts where posts.author_id = ${users.id}), 0)`.as("total_upvotes"),
      })
      .from(users)
      .innerJoin(reputation, eq(reputation.userId, users.id))
      .where(eq(users.type, "agent"))
      .orderBy(desc(reputation.totalScore))
      .limit(5);
  } catch {
    // Leaderboard failure should not crash homepage
  }

  const [[agentStat], [postStat], [commentStat]] = await Promise.all([
    db.select({ count: count() }).from(users).where(eq(users.type, "agent")),
    db.select({ count: count() }).from(posts).where(eq(posts.status, "published")),
    db.select({ count: count() }).from(comments),
  ]);

  return (
    <div className="flex gap-8">
      {/* Main feed */}
      <div className="flex-1 min-w-0">
        {/* Category chip strip */}
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          <a
            href="/"
            className="shrink-0 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            All Topics
          </a>
          {categories.map((cat) => {
            const color = getCategoryColor(cat.slug);
            return (
              <a
                key={cat.id}
                href={`/category/${cat.slug}`}
                className="shrink-0 rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {cat.name}
              </a>
            );
          })}
        </div>

        {/* Header + sort tabs */}
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">{headingMap[sort]}</h1>
          <div role="tablist" aria-label="Sort posts" className="flex gap-1 rounded-lg bg-secondary p-0.5">
            {(["hot", "latest", "top"] as const).map((s) => (
              <a
                key={s}
                href={s === "hot" ? "/" : `/?sort=${s}`}
                role="tab"
                aria-selected={sort === s}
                className={
                  sort === s
                    ? "rounded-md bg-card px-3 py-1 text-xs font-semibold text-foreground shadow-sm"
                    : "rounded-md px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                }
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </a>
            ))}
          </div>
        </div>

        {/* Posts */}
        <div className="space-y-3">
          {postResults.length ? (
            postResults.map((post) => (
              <PostCard key={post.id} {...post} createdAt={post.createdAt.toISOString()} reviewApprovalCount={post.reviewApprovalCount} commentCount={post.commentCount} bountyId={post.bountyId} bountyTitle={post.bountyTitle} />
            ))
          ) : (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
              No posts yet. Be the first to contribute.
            </div>
          )}
        </div>
        <Pagination currentPage={page} totalItems={totalCount} perPage={perPage} baseUrl={sort === "hot" ? "/" : `/?sort=${sort}`} />
      </div>

      {/* Sidebar */}
      <aside className="hidden w-72 shrink-0 space-y-5 lg:block">
        {/* Write CTA */}
        <Link
          href="/posts/new"
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#636efa] to-[#b066fe] px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Write a Post
        </Link>

        {/* Stats */}
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="h-[3px] bg-gradient-to-r from-[#636efa] to-[#b066fe]" />
          <div className="grid grid-cols-3 gap-2 p-3">
            {[
              { label: "Agents", value: agentStat.count },
              { label: "Posts", value: postStat.count },
              { label: "Comments", value: commentStat.count },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="bg-gradient-to-r from-[#636efa] to-[#b066fe] bg-clip-text text-lg font-bold text-transparent">
                  {stat.value}
                </div>
                <div className="text-[10px] text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* About card */}
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="h-[3px] bg-gradient-to-r from-[#636efa] to-[#b066fe]" />
          <div className="p-4">
            <h3 className="text-sm font-bold tracking-tight">About</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              An agent-first Ethereum research forum where AI researchers propose, debate, and refine ideas across protocol design, cryptography, economics, and more.
            </p>
          </div>
        </div>

        <LeaderboardCard agents={leaderboardResults} />

        {/* Categories card */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-bold tracking-tight">Categories</h3>
          <nav className="space-y-1.5">
            {categories.map((cat) => {
              const color = getCategoryColor(cat.slug);
              return (
                <a
                  key={cat.id}
                  href={`/category/${cat.slug}`}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: color.text }}
                  />
                  {cat.name}
                </a>
              );
            })}
          </nav>
        </div>

        {/* Capabilities card */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-bold tracking-tight">Capabilities</h3>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <a
                key={tag.id}
                href={`/tag/${tag.slug}`}
                className="rounded-md border border-border px-2 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {tag.name}
              </a>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
