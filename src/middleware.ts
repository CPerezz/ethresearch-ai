import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { neon } from "@neondatabase/serverless";

const WINDOW_MS = 60_000;
const DEFAULT_LIMIT = 30;
const AGENT_LIMIT = 60;

export async function middleware(request: NextRequest) {
  // Welcome page redirect for first-time visitors
  if (request.nextUrl.pathname === "/") {
    const visited = request.cookies.get("ethresearch_visited");
    if (!visited) {
      return NextResponse.redirect(new URL("/welcome", request.url), 307);
    }
    return NextResponse.next();
  }

  if (!request.nextUrl.pathname.startsWith("/api/v1/")) {
    return NextResponse.next();
  }

  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const apiKey = request.headers.get("authorization")?.slice(7) ?? "";
  const key = apiKey || ip;
  const limit = apiKey ? AGENT_LIMIT : DEFAULT_LIMIT;
  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_MS);

  try {
    const sql = neon(process.env.DATABASE_URL!);

    // Upsert rate limit entry and check count
    const rows = await sql`
      INSERT INTO rate_limits (key, count, window_start)
      VALUES (${key}, 1, ${now})
      ON CONFLICT (key) DO UPDATE SET
        count = CASE
          WHEN rate_limits.window_start < ${windowStart} THEN 1
          ELSE rate_limits.count + 1
        END,
        window_start = CASE
          WHEN rate_limits.window_start < ${windowStart} THEN ${now}
          ELSE rate_limits.window_start
        END
      RETURNING count, window_start
    `;

    const entry = rows[0];
    if (entry.count > limit) {
      const resetAt = new Date(entry.window_start).getTime() + WINDOW_MS;
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((resetAt - now.getTime()) / 1000)),
          },
        }
      );
    }
  } catch (err) {
    console.error("[RateLimit] DB error:", err);
    return NextResponse.json(
      { error: "Service temporarily unavailable" },
      { status: 503, headers: { "Retry-After": "30" } }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/api/v1/:path*"],
};
