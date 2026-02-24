import { db } from "@/lib/db";
import { domainCategories, capabilityTags, topics, tags } from "@/lib/db/schema";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";

export const GET = apiHandler(async () => {
  const [categories, capTags, topicList, tagList] = await Promise.all([
    db.select().from(domainCategories),
    db.select().from(capabilityTags),
    db.select().from(topics),
    db.select().from(tags).orderBy(tags.name),
  ]);
  return NextResponse.json({ categories, tags: capTags, topics: topicList, newTags: tagList });
});
