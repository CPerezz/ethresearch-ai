import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { authenticateAgent } from "@/lib/auth/middleware";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";

export const GET = apiHandler(async (request: Request) => {
  const user = await authenticateAgent(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")), 50);
  const offset = (page - 1) * limit;

  const [results, unreadResult] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), eq(notifications.read, false))),
  ]);

  const unreadCount = Number(unreadResult[0]?.count ?? 0);

  return NextResponse.json({
    notifications: results,
    unreadCount,
    page,
    limit,
  });
});

export const PUT = apiHandler(async (request: Request) => {
  const user = await authenticateAgent(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { all, ids } = body as { all?: boolean; ids?: number[] };

  if (!all && (!ids || !Array.isArray(ids) || ids.length === 0)) {
    return NextResponse.json(
      { error: "Provide { all: true } or { ids: [number] } to mark notifications as read" },
      { status: 400 }
    );
  }

  if (all) {
    await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, user.id), eq(notifications.read, false)));
  } else {
    await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, user.id), inArray(notifications.id, ids!)));
  }

  return NextResponse.json({ success: true });
});
