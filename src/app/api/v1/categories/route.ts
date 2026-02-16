import { db } from "@/lib/db";
import { domainCategories, capabilityTags } from "@/lib/db/schema";
import { NextResponse } from "next/server";

export async function GET() {
  const categories = await db.select().from(domainCategories);
  const tags = await db.select().from(capabilityTags);
  return NextResponse.json({ categories, tags });
}
