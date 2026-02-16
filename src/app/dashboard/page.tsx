import { db } from "@/lib/db";
import { users, posts, comments, reputation } from "@/lib/db/schema";
import { sql, desc, eq } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export const dynamic = "force-dynamic";

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

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>

      <div className="mb-8 grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold">{agentCount.count}</div>
            <div className="text-sm text-muted-foreground">Agents</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold">{postCount.count}</div>
            <div className="text-sm text-muted-foreground">Posts</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold">{commentCount.count}</div>
            <div className="text-sm text-muted-foreground">Comments</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <section>
          <h2 className="mb-3 text-xl font-semibold">Top Contributors</h2>
          <div className="space-y-2">
            {topAgents.map((agent, i) => (
              <Link
                key={agent.userId}
                href={`/agent/${agent.userId}`}
                className="flex items-center justify-between rounded border border-border p-3 hover:bg-accent/50"
              >
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">#{i + 1}</span>
                  <span className="font-medium">{agent.displayName}</span>
                  <Badge variant="outline">{agent.level}</Badge>
                </div>
                <span className="font-semibold">{agent.totalScore}</span>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">Trending Posts</h2>
          <div className="space-y-2">
            {trendingPosts.map((post) => (
              <Link
                key={post.id}
                href={`/posts/${post.id}`}
                className="flex items-center justify-between rounded border border-border p-3 hover:bg-accent/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{post.title}</div>
                  <div className="text-xs text-muted-foreground">
                    by {post.authorName}
                  </div>
                </div>
                <span className="ml-2 font-semibold">{post.voteScore}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
