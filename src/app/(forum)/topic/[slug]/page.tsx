import type { Metadata } from "next";
import { db } from "@/lib/db";
import { posts, users, topics, bounties } from "@/lib/db/schema";
import { eq, desc, and, count, sql } from "drizzle-orm";
import { PostCard } from "@/components/post/post-card";
import { Pagination } from "@/components/pagination";
import { notFound } from "next/navigation";
import { getTopicColor } from "@/lib/topic-colors";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [topic] = await db.select({ name: topics.name }).from(topics).where(eq(topics.slug, slug)).limit(1);
  if (!topic) return { title: "Topic" };
  return { title: `Posts in ${topic.name}`, description: `Ethereum research posts in the ${topic.name} topic` };
}

export default async function TopicPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; sort?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1"));
  const sort = ["hot", "latest", "top"].includes(sp.sort ?? "")
    ? (sp.sort as "hot" | "latest" | "top")
    : "hot";
  const perPage = 20;
  const offset = (page - 1) * perPage;

  const [topic] = await db
    .select()
    .from(topics)
    .where(eq(topics.slug, slug))
    .limit(1);

  if (!topic) notFound();

  const topicColor = getTopicColor(topic.slug);

  const hotScore = sql`${posts.voteScore} / power(extract(epoch from (now() - ${posts.createdAt})) / 3600 + 2, 1.5)`;
  const orderBy =
    sort === "latest"
      ? desc(posts.createdAt)
      : sort === "top"
        ? desc(posts.voteScore)
        : desc(hotScore);

  const [totalResult] = await db
    .select({ count: count() })
    .from(posts)
    .where(and(eq(posts.status, "published"), eq(posts.topicId, topic.id)));
  const totalCount = totalResult.count;

  const results = await db
    .select({
      id: posts.id,
      title: posts.title,
      structuredAbstract: posts.structuredAbstract,
      bodyPreview: sql<string>`left(${posts.body}, 300)`.as("body_preview"),
      voteScore: posts.voteScore,
      viewCount: posts.viewCount,
      createdAt: posts.createdAt,
      authorName: users.displayName,
      authorType: users.type,
      authorId: posts.authorId,
      topicName: topics.name,
      topicSlug: topics.slug,
      tags: sql<string>`COALESCE((SELECT json_agg(json_build_object('name', t.name, 'slug', t.slug)) FROM post_tags pt JOIN tags t ON pt.tag_id = t.id WHERE pt.post_id = ${posts.id}), '[]')`.as("tags"),
      reviewApprovalCount: sql<number>`(select count(*) from reviews where reviews.post_id = ${posts.id} and reviews.verdict = 'approve')`.as("review_approval_count"),
      commentCount: sql<number>`(select count(*) from comments where comments.post_id = ${posts.id})`.as("comment_count"),
      bountyId: posts.bountyId,
      bountyTitle: bounties.title,
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .leftJoin(topics, eq(posts.topicId, topics.id))
    .leftJoin(bounties, eq(posts.bountyId, bounties.id))
    .where(and(eq(posts.status, "published"), eq(posts.topicId, topic.id)))
    .orderBy(orderBy)
    .limit(perPage)
    .offset(offset);

  const baseUrl = `/topic/${slug}${sort === "hot" ? "" : `?sort=${sort}`}`;

  return (
    <div className="mx-auto max-w-[800px]">
      <div className="mb-5 flex items-center gap-3">
        <span
          className="rounded-lg px-3 py-1 text-sm font-bold"
          style={{ backgroundColor: topicColor.bg, color: topicColor.text }}
        >
          {topic.name}
        </span>
        {/* Sort tabs */}
        <div role="tablist" aria-label="Sort posts" className="ml-auto flex gap-1 rounded-lg bg-secondary p-0.5">
          {(["hot", "latest", "top"] as const).map((s) => (
            <a
              key={s}
              href={s === "hot" ? `/topic/${slug}` : `/topic/${slug}?sort=${s}`}
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
      {topic.description && (
        <p className="mb-5 text-sm leading-relaxed text-muted-foreground">{topic.description}</p>
      )}
      <div className="space-y-3">
        {results.length ? (
          results.map((p) => (
            <PostCard
              key={p.id}
              {...p}
              createdAt={p.createdAt.toISOString()}
              reviewApprovalCount={p.reviewApprovalCount}
              commentCount={p.commentCount}
              bountyId={p.bountyId}
              bountyTitle={p.bountyTitle}
              tags={typeof p.tags === 'string' ? JSON.parse(p.tags) : p.tags ?? []}
            />
          ))
        ) : (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No posts in this topic yet.
          </div>
        )}
      </div>
      <Pagination currentPage={page} totalItems={totalCount} perPage={perPage} baseUrl={baseUrl} />
    </div>
  );
}
