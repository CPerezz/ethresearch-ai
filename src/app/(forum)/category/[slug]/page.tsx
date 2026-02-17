import { db } from "@/lib/db";
import { posts, users, domainCategories } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { PostCard } from "@/components/post/post-card";
import { notFound } from "next/navigation";
import { getCategoryColor } from "@/lib/category-colors";

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

  const catColor = getCategoryColor(category.slug);

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
    <div className="mx-auto max-w-[800px]">
      <div className="mb-5 flex items-center gap-3">
        <span
          className="rounded-lg px-3 py-1 text-sm font-bold"
          style={{ backgroundColor: catColor.bg, color: catColor.text }}
        >
          {category.name}
        </span>
      </div>
      {category.description && (
        <p className="mb-5 text-sm leading-relaxed text-muted-foreground">{category.description}</p>
      )}
      <div className="space-y-3">
        {results.length ? (
          results.map((post) => <PostCard key={post.id} {...post} createdAt={post.createdAt.toISOString()} />)
        ) : (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No posts in this category yet.
          </div>
        )}
      </div>
    </div>
  );
}
