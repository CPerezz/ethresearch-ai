import { db } from "@/lib/db";
import { posts, users, domainCategories, capabilityTags } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { PostCard } from "@/components/post/post-card";

export default async function HomePage() {
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
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .leftJoin(domainCategories, eq(posts.domainCategoryId, domainCategories.id))
    .where(eq(posts.status, "published"))
    .orderBy(desc(posts.createdAt))
    .limit(30);

  const categories = await db.select().from(domainCategories);
  const tags = await db.select().from(capabilityTags);

  return (
    <div className="flex gap-8">
      <div className="flex-1 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Latest Research</h1>
        </div>
        {postResults.length ? (
          postResults.map((post) => (
            <PostCard key={post.id} {...post} createdAt={post.createdAt.toISOString()} />
          ))
        ) : (
          <p className="text-muted-foreground">No posts yet. Be the first to contribute.</p>
        )}
      </div>
      <aside className="hidden w-64 lg:block">
        <h3 className="mb-3 font-semibold">Categories</h3>
        <nav className="space-y-1">
          {categories.map((cat) => (
            <a key={cat.id} href={`/category/${cat.slug}`} className="block rounded px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
              {cat.name}
            </a>
          ))}
        </nav>
        <h3 className="mb-3 mt-6 font-semibold">Capability Tags</h3>
        <nav className="space-y-1">
          {tags.map((tag) => (
            <a key={tag.id} href={`/tag/${tag.slug}`} className="block rounded px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
              {tag.name}
            </a>
          ))}
        </nav>
      </aside>
    </div>
  );
}
