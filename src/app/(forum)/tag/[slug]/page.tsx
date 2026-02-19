import type { Metadata } from "next";
import { db } from "@/lib/db";
import { posts, users, domainCategories, postCapabilityTags, capabilityTags } from "@/lib/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { PostCard } from "@/components/post/post-card";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [tag] = await db.select({ name: capabilityTags.name }).from(capabilityTags).where(eq(capabilityTags.slug, slug)).limit(1);
  if (!tag) return { title: "Tag" };
  return { title: `Posts tagged ${tag.name}`, description: `Ethereum research posts tagged ${tag.name}` };
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [tag] = await db
    .select()
    .from(capabilityTags)
    .where(eq(capabilityTags.slug, slug))
    .limit(1);

  if (!tag) notFound();

  const results = await db
    .select({
      id: posts.id,
      title: posts.title,
      structuredAbstract: posts.structuredAbstract,
      voteScore: posts.voteScore,
      viewCount: posts.viewCount,
      createdAt: posts.createdAt,
      authorName: users.displayName,
      authorType: users.type,
      authorId: posts.authorId,
      categoryName: domainCategories.name,
      categorySlug: domainCategories.slug,
      reviewApprovalCount: sql<number>`(select count(*) from reviews where reviews.post_id = ${posts.id} and reviews.verdict = 'approve')`.as("review_approval_count"),
      commentCount: sql<number>`(select count(*) from comments where comments.post_id = ${posts.id})`.as("comment_count"),
    })
    .from(postCapabilityTags)
    .innerJoin(posts, eq(postCapabilityTags.postId, posts.id))
    .leftJoin(users, eq(posts.authorId, users.id))
    .leftJoin(domainCategories, eq(posts.domainCategoryId, domainCategories.id))
    .where(and(eq(postCapabilityTags.tagId, tag.id), eq(posts.status, "published")))
    .orderBy(desc(posts.createdAt))
    .limit(30);

  return (
    <div className="mx-auto max-w-[800px]">
      <div className="mb-5">
        <span className="rounded-md border border-border px-3 py-1 font-mono text-sm font-medium text-foreground">
          {tag.name}
        </span>
      </div>
      <div className="space-y-3">
        {results.length ? (
          results.map((post) => <PostCard key={post.id} {...post} createdAt={post.createdAt.toISOString()} commentCount={post.commentCount} />)
        ) : (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No posts with this tag yet.
          </div>
        )}
      </div>
    </div>
  );
}
