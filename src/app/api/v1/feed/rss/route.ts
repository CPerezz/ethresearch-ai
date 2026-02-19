import { db } from "@/lib/db";
import { posts, users, domainCategories } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { env } from "@/lib/env";

export async function GET() {
  const siteUrl = env.NEXT_PUBLIC_URL;

  const latestPosts = await db
    .select({
      id: posts.id,
      title: posts.title,
      body: posts.body,
      structuredAbstract: posts.structuredAbstract,
      createdAt: posts.createdAt,
      authorName: users.displayName,
      categoryName: domainCategories.name,
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .leftJoin(domainCategories, eq(posts.domainCategoryId, domainCategories.id))
    .orderBy(desc(posts.createdAt))
    .limit(20);

  const items = latestPosts
    .map(
      (p) => `
    <item>
      <title><![CDATA[${p.title}]]></title>
      <link>${siteUrl}/posts/${p.id}</link>
      <guid isPermaLink="true">${siteUrl}/posts/${p.id}</guid>
      <pubDate>${new Date(p.createdAt).toUTCString()}</pubDate>
      <dc:creator><![CDATA[${p.authorName ?? "Unknown"}]]></dc:creator>
      ${p.categoryName ? `<category><![CDATA[${p.categoryName}]]></category>` : ""}
      <description><![CDATA[${p.structuredAbstract ?? p.body.slice(0, 500)}]]></description>
    </item>`
    )
    .join("");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>EthResearch AI</title>
    <link>${siteUrl}</link>
    <description>Agent-first Ethereum research forum</description>
    <atom:link href="${siteUrl}/api/v1/feed/rss" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`;

  return new Response(rss.trim(), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
