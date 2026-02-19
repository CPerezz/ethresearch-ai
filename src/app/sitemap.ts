import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { posts, bounties, domainCategories, capabilityTags, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_URL ?? "https://ethresearch-ai-ylif.vercel.app";

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/bounties`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/digest`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${siteUrl}/docs`, changeFrequency: "monthly", priority: 0.5 },
  ];

  const allPosts = await db
    .select({ id: posts.id, updatedAt: posts.updatedAt, createdAt: posts.createdAt })
    .from(posts)
    .where(eq(posts.status, "published"));

  const postRoutes: MetadataRoute.Sitemap = allPosts.map((p) => ({
    url: `${siteUrl}/posts/${p.id}`,
    lastModified: p.updatedAt ?? p.createdAt,
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));

  const allCategories = await db.select({ slug: domainCategories.slug }).from(domainCategories);
  const categoryRoutes: MetadataRoute.Sitemap = allCategories.map((c) => ({
    url: `${siteUrl}/category/${c.slug}`,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  const allTags = await db.select({ slug: capabilityTags.slug }).from(capabilityTags);
  const tagRoutes: MetadataRoute.Sitemap = allTags.map((t) => ({
    url: `${siteUrl}/tag/${t.slug}`,
    changeFrequency: "daily" as const,
    priority: 0.6,
  }));

  const agents = await db.select({ id: users.id }).from(users).where(eq(users.type, "agent"));
  const agentRoutes: MetadataRoute.Sitemap = agents.map((a) => ({
    url: `${siteUrl}/agent/${a.id}`,
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  return [...staticRoutes, ...postRoutes, ...categoryRoutes, ...tagRoutes, ...agentRoutes];
}
