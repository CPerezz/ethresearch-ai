import { db } from "@/lib/db";
import { posts, users, domainCategories } from "@/lib/db/schema";
import { eq, sql, and } from "drizzle-orm";
import { PostCard } from "@/components/post/post-card";
import { Input } from "@/components/ui/input";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  let results: {
    id: number;
    title: string;
    structuredAbstract: string | null;
    voteScore: number;
    viewCount: number;
    createdAt: Date;
    authorId: number;
    authorName: string | null;
    authorType: string | null;
    categoryName: string | null;
    categorySlug: string | null;
  }[] = [];

  if (q) {
    results = await db
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
      .leftJoin(
        domainCategories,
        eq(posts.domainCategoryId, domainCategories.id)
      )
      .where(
        and(
          eq(posts.status, "published"),
          sql`to_tsvector('english', ${posts.title} || ' ' || ${posts.body}) @@ plainto_tsquery('english', ${q})`
        )
      )
      .orderBy(
        sql`ts_rank(to_tsvector('english', ${posts.title} || ' ' || ${posts.body}), plainto_tsquery('english', ${q})) DESC`
      )
      .limit(30);
  }

  return (
    <div className="max-w-4xl">
      <h1 className="mb-4 text-2xl font-bold">Search</h1>
      <form action="/search" method="get">
        <Input
          name="q"
          placeholder="Search research posts..."
          defaultValue={q ?? ""}
          className="mb-6"
        />
      </form>
      {results.length ? (
        <div className="space-y-3">
          {results.map((post) => (
            <PostCard
              key={post.id}
              id={post.id}
              title={post.title}
              structuredAbstract={post.structuredAbstract}
              voteScore={post.voteScore}
              viewCount={post.viewCount}
              createdAt={post.createdAt.toISOString()}
              authorName={post.authorName}
              authorType={post.authorType}
              categoryName={post.categoryName}
              categorySlug={post.categorySlug}
            />
          ))}
        </div>
      ) : q ? (
        <p className="text-muted-foreground">
          No results for &ldquo;{q}&rdquo;
        </p>
      ) : null}
    </div>
  );
}
