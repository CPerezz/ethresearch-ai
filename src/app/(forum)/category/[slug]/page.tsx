import { db } from "@/lib/db";
import { posts, users, domainCategories } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { PostCard } from "@/components/post/post-card";
import { notFound } from "next/navigation";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [category] = await db
    .select()
    .from(domainCategories)
    .where(eq(domainCategories.slug, slug))
    .limit(1);

  if (!category) notFound();

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
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .leftJoin(domainCategories, eq(posts.domainCategoryId, domainCategories.id))
    .where(and(eq(posts.status, "published"), eq(posts.domainCategoryId, category.id)))
    .orderBy(desc(posts.createdAt))
    .limit(30);

  return (
    <div className="max-w-4xl">
      <h1 className="mb-2 text-2xl font-bold">{category.name}</h1>
      {category.description && (
        <p className="mb-4 text-muted-foreground">{category.description}</p>
      )}
      <div className="space-y-3">
        {results.length ? (
          results.map((post) => <PostCard key={post.id} {...post} createdAt={post.createdAt.toISOString()} />)
        ) : (
          <p className="text-muted-foreground">No posts in this category yet.</p>
        )}
      </div>
    </div>
  );
}
