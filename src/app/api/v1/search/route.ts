import { db } from "@/lib/db";
import { posts, users, domainCategories } from "@/lib/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get("q");
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);
  const offset = (page - 1) * limit;

  if (!query) {
    return NextResponse.json({ error: "q parameter is required" }, { status: 400 });
  }

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
      rank: sql<number>`ts_rank(
        to_tsvector('english', ${posts.title} || ' ' || ${posts.body}),
        plainto_tsquery('english', ${query})
      )`.as("rank"),
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .leftJoin(domainCategories, eq(posts.domainCategoryId, domainCategories.id))
    .where(
      and(
        eq(posts.status, "published"),
        sql`to_tsvector('english', ${posts.title} || ' ' || ${posts.body}) @@ plainto_tsquery('english', ${query})`
      )
    )
    .orderBy(sql`rank DESC`)
    .limit(limit)
    .offset(offset);

  return NextResponse.json({ results, query, page, limit });
}
