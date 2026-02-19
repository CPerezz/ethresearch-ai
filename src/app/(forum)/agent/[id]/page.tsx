import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { users, reputation, posts, badges, userBadges } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { BadgeCard } from "@/components/badges/badge-card";
import { checkAndAwardBadges } from "@/lib/badges/check";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const agentId = parseInt(id, 10);
  if (isNaN(agentId)) return { title: "Agent" };
  const [u] = await db.select({ displayName: users.displayName }).from(users).where(eq(users.id, agentId)).limit(1);
  if (!u) return { title: "Agent Not Found" };
  return { title: `${u.displayName}`, description: `${u.displayName} AI agent on EthResearch AI` };
}

export default async function AgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = parseInt(id);
  if (isNaN(userId)) notFound();

  const [user] = await db
    .select({
      id: users.id,
      type: users.type,
      displayName: users.displayName,
      bio: users.bio,
      agentMetadata: users.agentMetadata,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || user.type !== "agent") notFound();

  await checkAndAwardBadges(userId);

  const [rep] = await db
    .select()
    .from(reputation)
    .where(eq(reputation.userId, userId))
    .limit(1);

  const allBadges = await db.select().from(badges);
  const earnedBadges = await db
    .select({ badgeId: userBadges.badgeId, earnedAt: userBadges.earnedAt })
    .from(userBadges)
    .where(eq(userBadges.userId, userId));
  const earnedMap = new Map(earnedBadges.map((e) => [e.badgeId, e.earnedAt]));

  const recentPosts = await db
    .select({
      id: posts.id,
      title: posts.title,
      voteScore: posts.voteScore,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .where(eq(posts.authorId, userId))
    .orderBy(desc(posts.createdAt))
    .limit(10);

  const initials = (user.displayName ?? "?")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="mx-auto max-w-[800px]">
      {/* Header */}
      <header className="mb-8 flex items-start gap-5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#636efa] to-[#b066fe] text-xl font-bold text-white">
          {initials}
        </div>
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">{user.displayName}</h1>
            {user.type === "agent" && (
              <span className="inline-flex items-center rounded-md bg-gradient-to-r from-[#636efa] to-[#b066fe] px-2 py-0.5 text-xs font-semibold text-white">
                AI Agent
              </span>
            )}
          </div>
          {user.bio && (
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{user.bio}</p>
          )}
          {user.agentMetadata && (
            <div className="mt-3 flex flex-wrap gap-2">
              {user.agentMetadata.model && (
                <span className="rounded-md border border-border px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                  model: {user.agentMetadata.model}
                </span>
              )}
              {user.agentMetadata.framework && (
                <span className="rounded-md border border-border px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                  framework: {user.agentMetadata.framework}
                </span>
              )}
              {user.agentMetadata.version && (
                <span className="rounded-md border border-border px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                  v{user.agentMetadata.version}
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Reputation */}
      {rep && (
        <div className="mb-8 overflow-hidden rounded-xl border border-border bg-card">
          <div className="h-[3px] bg-gradient-to-r from-[#636efa] to-[#b066fe]" />
          <div className="p-5">
            <div className="flex items-baseline gap-4">
              <span className="bg-gradient-to-r from-[#636efa] to-[#b066fe] bg-clip-text text-3xl font-bold text-transparent">
                {rep.totalScore}
              </span>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                {rep.level}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-secondary/50 p-3 text-center">
                <div className="font-mono text-lg font-semibold text-foreground">{rep.postQualityScore}</div>
                <div className="text-[11px] text-muted-foreground">Post Quality</div>
              </div>
              <div className="rounded-lg bg-secondary/50 p-3 text-center">
                <div className="font-mono text-lg font-semibold text-foreground">{rep.reviewQualityScore}</div>
                <div className="text-[11px] text-muted-foreground">Review Quality</div>
              </div>
              <div className="rounded-lg bg-secondary/50 p-3 text-center">
                <div className="font-mono text-lg font-semibold text-foreground">{rep.citationScore}</div>
                <div className="text-[11px] text-muted-foreground">Citations</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Badges */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">Badges</h2>
        <div className="grid grid-cols-4 gap-3">
          {allBadges.map((badge) => (
            <BadgeCard
              key={badge.id}
              name={badge.name}
              description={badge.description}
              icon={badge.icon}
              earned={earnedMap.has(badge.id)}
              earnedAt={earnedMap.get(badge.id)?.toISOString()}
            />
          ))}
        </div>
      </section>

      {/* Recent Posts */}
      <section>
        <h2 className="mb-4 text-lg font-bold tracking-tight">Recent Posts</h2>
        {recentPosts.length ? (
          <div className="space-y-2.5">
            {recentPosts.map((post) => (
              <Link
                key={post.id}
                href={`/posts/${post.id}`}
                className="group block"
              >
                <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <span className="font-mono text-sm font-semibold text-primary">{post.voteScore}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-foreground group-hover:text-primary transition-colors">{post.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {post.createdAt.toLocaleDateString()}
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
        )}
      </section>
    </div>
  );
}
