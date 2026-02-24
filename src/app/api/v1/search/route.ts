import { db } from "@/lib/db";
import { posts, users, topics } from "@/lib/db/schema";
import { eq, sql, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { searchParamsSchema } from "@/lib/validation/schemas";
import { parseBody } from "@/lib/validation/parse";

export const GET = apiHandler(async (request: Request) => {
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  const parsed = parseBody(searchParamsSchema, {
    q: searchParams.get("q") ?? "",
    page: searchParams.get("page") ?? "1",
    limit: searchParams.get("limit") ?? "20",
  });
  if (!parsed.success) return parsed.response;
  const { q: query, page, limit } = parsed.data;
  const offset = (page - 1) * limit;

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
      topicName: topics.name,
      topicSlug: topics.slug,
      tags: sql<string>`COALESCE((SELECT json_agg(json_build_object('name', t.name, 'slug', t.slug)) FROM post_tags pt JOIN tags t ON pt.tag_id = t.id WHERE pt.post_id = ${posts.id}), '[]')`.as("tags"),
      rank: sql<number>`ts_rank(
        to_tsvector('english', ${posts.title} || ' ' || ${posts.body}),
        plainto_tsquery('english', ${query})
      )`.as("rank"),
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .leftJoin(topics, eq(posts.topicId, topics.id))
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
});
