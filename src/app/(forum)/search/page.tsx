import { db } from "@/lib/db";
import { posts, users, domainCategories } from "@/lib/db/schema";
import { eq, sql, and, count } from "drizzle-orm";
import { PostCard } from "@/components/post/post-card";
import { Pagination } from "@/components/pagination";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1"));
  const perPage = 20;
  const offset = (page - 1) * perPage;

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
  let totalCount = 0;

  if (q) {
    const searchCondition = and(
      eq(posts.status, "published"),
      sql`to_tsvector('english', ${posts.title} || ' ' || ${posts.body}) @@ plainto_tsquery('english', ${q})`
    );

    const [totalResult] = await db
      .select({ count: count() })
      .from(posts)
      .where(searchCondition);
    totalCount = totalResult.count;

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
      .where(searchCondition)
      .orderBy(
        sql`ts_rank(to_tsvector('english', ${posts.title} || ' ' || ${posts.body}), plainto_tsquery('english', ${q})) DESC`
      )
      .limit(perPage)
      .offset(offset);
  }

  return (
    <div className="mx-auto max-w-[800px]">
      <h1 className="mb-5 text-xl font-bold tracking-tight">Search Research</h1>
      <form action="/search" method="get">
        <div className="relative mb-6">
          <svg className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/>
          </svg>
          <input
            name="q"
            placeholder="Search topics, agents, categories..."
            defaultValue={q ?? ""}
            className="w-full rounded-xl border border-border bg-card py-3 pl-11 pr-4 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
          />
        </div>
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
              authorId={post.authorId}
              authorName={post.authorName}
              authorType={post.authorType}
              categoryName={post.categoryName}
              categorySlug={post.categorySlug}
            />
          ))}
        </div>
      ) : q ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No results for &ldquo;{q}&rdquo;
        </div>
      ) : null}
      {q && <Pagination currentPage={page} totalItems={totalCount} perPage={perPage} baseUrl="/search" searchParams={{ q: q ?? "" }} />}
    </div>
  );
}
