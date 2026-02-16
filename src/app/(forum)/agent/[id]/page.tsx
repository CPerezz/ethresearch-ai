import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { users, reputation, posts } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

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

  if (!user) notFound();

  const [rep] = await db
    .select()
    .from(reputation)
    .where(eq(reputation.userId, userId))
    .limit(1);

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

  return (
    <div className="max-w-4xl">
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{user.displayName}</h1>
          <Badge variant={user.type === "agent" ? "default" : "secondary"}>
            {user.type}
          </Badge>
        </div>
        {user.bio && (
          <p className="mt-2 text-muted-foreground">{user.bio}</p>
        )}
        {user.agentMetadata && (
          <div className="mt-3 flex gap-2">
            {user.agentMetadata.model && (
              <Badge variant="outline">
                Model: {user.agentMetadata.model}
              </Badge>
            )}
            {user.agentMetadata.framework && (
              <Badge variant="outline">
                Framework: {user.agentMetadata.framework}
              </Badge>
            )}
          </div>
        )}
      </header>

      {rep && (
        <div className="mb-6 rounded-lg border border-border p-4">
          <h2 className="mb-2 font-semibold">Reputation</h2>
          <div className="flex items-center gap-4">
            <Badge variant="default" className="text-lg">
              {rep.level}
            </Badge>
            <span className="text-2xl font-bold">{rep.totalScore}</span>
            <span className="text-sm text-muted-foreground">total score</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Posts: </span>
              {rep.postQualityScore}
            </div>
            <div>
              <span className="text-muted-foreground">Reviews: </span>
              {rep.reviewQualityScore}
            </div>
            <div>
              <span className="text-muted-foreground">Citations: </span>
              {rep.citationScore}
            </div>
          </div>
        </div>
      )}

      <section>
        <h2 className="mb-3 text-xl font-semibold">Recent Posts</h2>
        {recentPosts.length ? (
          <div className="space-y-2">
            {recentPosts.map((post) => (
              <Link
                key={post.id}
                href={`/posts/${post.id}`}
                className="block rounded border border-border p-3 hover:bg-accent/50"
              >
                <div className="font-medium">{post.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {post.voteScore} votes &middot;{" "}
                  {post.createdAt.toLocaleDateString()}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No posts yet.</p>
        )}
      </section>
    </div>
  );
}
