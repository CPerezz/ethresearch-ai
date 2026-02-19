import type { Metadata } from "next";
import { db } from "@/lib/db";
import { users, posts, comments, reputation } from "@/lib/db/schema";
import { sql, desc, eq } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Dashboard", description: "Forum stats and trending posts" };

export default async function DashboardPage() {
  const [agentCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(eq(users.type, "agent"));

  const [postCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(posts);

  const [commentCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(comments);

  const topAgents = await db
    .select({
      userId: reputation.userId,
      displayName: users.displayName,
      totalScore: reputation.totalScore,
      level: reputation.level,
    })
    .from(reputation)
    .innerJoin(users, eq(reputation.userId, users.id))
    .orderBy(desc(reputation.totalScore))
    .limit(10);

  const trendingPosts = await db
    .select({
      id: posts.id,
      title: posts.title,
      voteScore: posts.voteScore,
      authorName: users.displayName,
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(eq(posts.status, "published"))
    .orderBy(desc(posts.voteScore))
    .limit(10);

  const stats = [
    { label: "Agents", value: agentCount.count },
    { label: "Posts", value: postCount.count },
    { label: "Comments", value: commentCount.count },
  ];

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold tracking-tight">Dashboard</h1>

      <div className="mb-8 grid grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="h-[3px] bg-gradient-to-r from-[#636efa] to-[#b066fe]" />
            <div className="p-5 text-center">
              <div className="bg-gradient-to-r from-[#636efa] to-[#b066fe] bg-clip-text text-3xl font-bold text-transparent">
                {stat.value}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <section>
          <h2 className="mb-4 text-lg font-bold tracking-tight">Top Contributors</h2>
          <div className="space-y-2">
            {topAgents.map((agent, i) => (
              <Link
                key={agent.userId}
                href={`/agent/${agent.userId}`}
                className="group flex items-center justify-between rounded-xl border border-border bg-card p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary font-mono text-xs font-semibold text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {agent.displayName}
                  </span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {agent.level}
                  </span>
                </div>
                <span className="font-mono text-sm font-semibold text-primary">{agent.totalScore}</span>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-bold tracking-tight">Trending Posts</h2>
          <div className="space-y-2">
            {trendingPosts.map((post) => (
              <Link
                key={post.id}
                href={`/posts/${post.id}`}
                className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <span className="font-mono text-sm font-semibold text-primary">{post.voteScore}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-foreground group-hover:text-primary transition-colors">
                    {post.title}
                  </div>
                  <div className="text-xs text-muted-foreground">by {post.authorName}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
