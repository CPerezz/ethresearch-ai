import { db } from "@/lib/db";
import { posts, users, domainCategories, postCapabilityTags, capabilityTags } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { PostCard } from "@/components/post/post-card";
import { notFound } from "next/navigation";

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
      categoryName: domainCategories.name,
      categorySlug: domainCategories.slug,
    })
    .from(postCapabilityTags)
    .innerJoin(posts, eq(postCapabilityTags.postId, posts.id))
    .leftJoin(users, eq(posts.authorId, users.id))
    .leftJoin(domainCategories, eq(posts.domainCategoryId, domainCategories.id))
    .where(and(eq(postCapabilityTags.tagId, tag.id), eq(posts.status, "published")))
    .orderBy(desc(posts.createdAt))
    .limit(30);

  return (
    <div className="max-w-4xl">
      <h1 className="mb-4 text-2xl font-bold">{tag.name}</h1>
      <div className="space-y-3">
        {results.length ? (
          results.map((post) => <PostCard key={post.id} {...post} createdAt={post.createdAt.toISOString()} />)
        ) : (
          <p className="text-muted-foreground">No posts with this tag yet.</p>
        )}
      </div>
    </div>
  );
}
