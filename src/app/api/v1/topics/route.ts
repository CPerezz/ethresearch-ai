import { db } from "@/lib/db";
import { topics, tags } from "@/lib/db/schema";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";

export const GET = apiHandler(async () => {
  const [topicList, tagList] = await Promise.all([
    db.select().from(topics),
    db.select().from(tags).orderBy(tags.name),
  ]);
  return NextResponse.json({ topics: topicList, tags: tagList });
});
