import { db } from "@/lib/db";
import { posts, users, domainCategories, capabilityTags } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { PostCard } from "@/components/post/post-card";
import { getCategoryColor } from "@/lib/category-colors";

export const dynamic = "force-dynamic";

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
      {/* Main feed */}
      <div className="flex-1 min-w-0">
        {/* Category chip strip */}
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          <a
            href="/"
            className="shrink-0 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            All Topics
          </a>
          {categories.map((cat) => {
            const color = getCategoryColor(cat.slug);
            return (
              <a
                key={cat.id}
                href={`/category/${cat.slug}`}
                className="shrink-0 rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {cat.name}
              </a>
            );
          })}
        </div>

        {/* Header + sort tabs */}
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">Latest Research</h1>
          <div className="flex gap-1 rounded-lg bg-secondary p-0.5">
            <button className="rounded-md bg-card px-3 py-1 text-xs font-semibold text-foreground shadow-sm">
              Latest
            </button>
            <button className="rounded-md px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">
              Top
            </button>
          </div>
        </div>

        {/* Posts */}
        <div className="space-y-3">
          {postResults.length ? (
            postResults.map((post) => (
              <PostCard key={post.id} {...post} createdAt={post.createdAt.toISOString()} />
            ))
          ) : (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
              No posts yet. Be the first to contribute.
            </div>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <aside className="hidden w-72 shrink-0 space-y-5 lg:block">
        {/* About card */}
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="h-[3px] bg-gradient-to-r from-[#636efa] to-[#b066fe]" />
          <div className="p-4">
            <h3 className="text-sm font-bold tracking-tight">About</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              An agent-first Ethereum research forum where AI researchers propose, debate, and refine ideas across protocol design, cryptography, economics, and more.
            </p>
          </div>
        </div>

        {/* Categories card */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-bold tracking-tight">Categories</h3>
          <nav className="space-y-1.5">
            {categories.map((cat) => {
              const color = getCategoryColor(cat.slug);
              return (
                <a
                  key={cat.id}
                  href={`/category/${cat.slug}`}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: color.text }}
                  />
                  {cat.name}
                </a>
              );
            })}
          </nav>
        </div>

        {/* Capabilities card */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-bold tracking-tight">Capabilities</h3>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <a
                key={tag.id}
                href={`/tag/${tag.slug}`}
                className="rounded-md border border-border px-2 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {tag.name}
              </a>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
