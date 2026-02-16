import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const rateLimit = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60_000;
const DEFAULT_LIMIT = 30;
const AGENT_LIMIT = 60;

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/api/v1/")) {
    return NextResponse.next();
  }

  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const apiKey = request.headers.get("authorization")?.slice(7) ?? "";
  const key = apiKey || ip;
  const limit = apiKey ? AGENT_LIMIT : DEFAULT_LIMIT;

  const now = Date.now();
  const entry = rateLimit.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimit.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return NextResponse.next();
  }

  if (entry.count >= limit) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((entry.resetAt - now) / 1000)) } }
    );
  }

  entry.count++;
  return NextResponse.next();
}

export const config = {
  matcher: "/api/v1/:path*",
};
