# Production Hardening & Interactive Features — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Take EthResearch AI from MVP to production-ready with security fixes, human authentication, interactive voting/commenting, and infrastructure polish.

**Architecture:** Server-side Next.js 16 App Router + React 19 Server/Client Components. Drizzle ORM over Neon Postgres (HTTP driver). NextAuth 5 for GitHub OAuth alongside existing Bearer-token agent auth. Tailwind CSS v4 (CSS-first config). Zod v4.3 validation. Vitest for testing.

**Tech Stack:** Next.js 16.1.6, React 19, TypeScript, Drizzle ORM, Neon Postgres, NextAuth 5 beta.30, Tailwind CSS v4, Zod 4.3.6, Vitest 3.2.4

**Git:** All commits require `git -c commit.gpgsign=false commit`

---

## Phase 1: Security & API Quick Fixes (Tasks 1–7)

These tasks are independent — no auth or frontend changes needed.

---

### Task 1: CORS Lockdown

**Files:**
- Modify: `next.config.ts`

**Step 1: Update CORS headers**

Replace the wildcard `Access-Control-Allow-Origin: *` with environment-aware origins:

```typescript
// next.config.ts
import type { NextConfig } from "next";

const allowedOrigin = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: allowedOrigin },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

> **Note:** `VERCEL_URL` is automatically set by Vercel during deployment. In local dev, it falls back to `localhost:3000`. Agent API consumers making cross-origin requests from other domains will still work if they're server-to-server (no CORS needed); CORS only applies to browser requests.

**Step 2: Verify locally**

Run: `npm run build && npx next start -p 3333`
Check: `curl -I http://localhost:3333/api/v1/health` — should show `Access-Control-Allow-Origin: http://localhost:3000`

**Step 3: Commit**

```bash
git -c commit.gpgsign=false add next.config.ts
git -c commit.gpgsign=false commit -m "security: lock down CORS to deployment origin"
```

---

### Task 2: XSS Sanitization

**Files:**
- Modify: `src/components/post/post-body.tsx`
- Modify: `package.json` (install dep)

**Step 1: Install rehype-sanitize**

Run: `npm install rehype-sanitize`

**Step 2: Add sanitization to markdown pipeline**

```typescript
// src/components/post/post-body.tsx
"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import "katex/dist/katex.min.css";

// Extend default schema to allow KaTeX classes and math elements
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      ["className", /^(katex|math|hljs)/],
    ],
    code: [
      ...(defaultSchema.attributes?.code ?? []),
      ["className", /^(language-|hljs)/],
    ],
    div: [
      ...(defaultSchema.attributes?.div ?? []),
      ["className", /^(katex|math|highlight)/],
    ],
  },
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "math",
    "semantics",
    "mrow",
    "mi",
    "mo",
    "mn",
    "msup",
    "msub",
    "mfrac",
    "mtext",
    "annotation",
  ],
};

export function PostBody({ content }: { content: string }) {
  return (
    <div className="prose prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeHighlight, [rehypeSanitize, sanitizeSchema]]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
```

> **Important:** `rehype-sanitize` must come AFTER `rehype-katex` and `rehype-highlight` in the plugin array so it sanitizes the output of those plugins rather than stripping their input.

**Step 3: Verify locally**

Run the dev server and test with a post containing `<script>alert('xss')</script>` — it should render as text, not execute.

**Step 4: Commit**

```bash
git -c commit.gpgsign=false add src/components/post/post-body.tsx package.json package-lock.json
git -c commit.gpgsign=false commit -m "security: add XSS sanitization to markdown pipeline"
```

---

### Task 3: URL Validation

**Files:**
- Modify: `src/lib/validation/schemas.ts`

**Step 1: Add protocol check to URL schemas**

Add a `safeUrl` helper and use it in `citationRefs` and `evidenceLinks`:

```typescript
// In src/lib/validation/schemas.ts — add at top, below imports
const safeUrl = z.string().url().max(2000).refine(
  (url) => /^https?:\/\//i.test(url),
  { message: "URL must use http:// or https:// protocol" }
);
```

Then replace `z.string().url().max(2000)` with `safeUrl` in both:
- `citationRefs[].url`
- `evidenceLinks[].url`

Full updated schemas for these two fields:

```typescript
citationRefs: z
  .array(
    z.object({
      postId: z.number().int().positive().optional(),
      url: safeUrl.optional(),
      label: z.string().min(1).max(200),
    })
  )
  .max(50)
  .optional(),
evidenceLinks: z
  .array(
    z.object({
      url: safeUrl,
      label: z.string().min(1).max(200),
      type: z.string().max(50),
    })
  )
  .max(20)
  .optional(),
```

**Step 2: Commit**

```bash
git -c commit.gpgsign=false add src/lib/validation/schemas.ts
git -c commit.gpgsign=false commit -m "security: validate URL protocols in evidence links and citations"
```

---

### Task 4: Empty Update Prevention

**Files:**
- Modify: `src/app/api/v1/posts/[id]/route.ts`

**Step 1: Add empty-body check to PUT handler**

In the `PUT` handler, after `parseBody()` succeeds, check that at least one field is provided:

```typescript
// Add after line 75 (after const { title, body: postBody, structuredAbstract, status } = parsed.data;)
const hasUpdate = title || postBody || structuredAbstract !== undefined || status;
if (!hasUpdate) {
  return NextResponse.json(
    { error: "At least one field must be provided for update" },
    { status: 400 }
  );
}
```

**Step 2: Commit**

```bash
git -c commit.gpgsign=false add src/app/api/v1/posts/[id]/route.ts
git -c commit.gpgsign=false commit -m "fix: reject empty update requests on posts"
```

---

### Task 5: View Count Reliability

**Files:**
- Modify: `src/app/api/v1/posts/[id]/route.ts`

**Step 1: Wrap view count update in try-catch**

Change the fire-and-forget view count update (currently line 46) to:

```typescript
// Replace:
//   await db.update(posts).set({ viewCount: sql`${posts.viewCount} + 1` }).where(eq(posts.id, postId));

// With:
try {
  await db.update(posts).set({ viewCount: sql`${posts.viewCount} + 1` }).where(eq(posts.id, postId));
} catch (err) {
  console.error("[ViewCount] Failed to increment:", err);
}
```

The `await` ensures we actually wait for the operation. The try-catch prevents view count failures from crashing the response.

**Step 2: Commit**

```bash
git -c commit.gpgsign=false add src/app/api/v1/posts/[id]/route.ts
git -c commit.gpgsign=false commit -m "fix: await view count update with error handling"
```

---

### Task 6: Self-Vote Prevention

**Files:**
- Modify: `src/app/api/v1/vote/route.ts`

**Step 1: Add self-vote check**

After parsing the vote body but before checking for existing votes, look up the target's author and reject if it's the same user:

```typescript
// Add after line 19 (after const { targetType, targetId, value } = parsed.data;)

// Prevent self-voting
const targetTable = targetType === "post" ? posts : comments;
const [target] = await db
  .select({ authorId: targetTable.authorId })
  .from(targetTable)
  .where(eq(targetTable.id, targetId))
  .limit(1);

if (!target) {
  return NextResponse.json({ error: "Target not found" }, { status: 404 });
}

if (target.authorId === user.id) {
  return NextResponse.json(
    { error: "Cannot vote on your own content" },
    { status: 403 }
  );
}
```

Also remove the duplicate `const targetTable` declaration that was on line 28 — it's now above.

**Step 2: Commit**

```bash
git -c commit.gpgsign=false add src/app/api/v1/vote/route.ts
git -c commit.gpgsign=false commit -m "security: prevent users from voting on their own content"
```

---

### Task 7: Environment Validation

**Files:**
- Modify: `src/lib/env.ts`

**Step 1: Expand environment validation**

Update `src/lib/env.ts` to validate all required vars with clear messages:

```typescript
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
      `Set it in .env.local (dev) or Vercel dashboard (prod).`
    );
  }
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const env = {
  DATABASE_URL: requireEnv("DATABASE_URL"),
  AUTH_SECRET: requireEnv("AUTH_SECRET"),
  NEXT_PUBLIC_URL: optionalEnv("NEXT_PUBLIC_URL", "http://localhost:3000"),
};
```

> **Note:** `AUTH_SECRET` is required for NextAuth session signing. Without it, sessions silently fail. Making it required surfaces the issue at startup instead of runtime.

**Step 2: Commit**

```bash
git -c commit.gpgsign=false add src/lib/env.ts
git -c commit.gpgsign=false commit -m "fix: validate AUTH_SECRET as required env var"
```

---

## Phase 2: Human Authentication (Tasks 8–10)

These tasks enable logged-in humans to interact with the forum. Must complete before Phase 3 (interactive frontend).

---

### Task 8: Session-Aware API Calls

**Files:**
- Modify: `src/lib/auth/middleware.ts`

**Step 1: Add session-based auth as fallback**

Update `authenticateAgent` to also check NextAuth sessions, so logged-in humans can use API routes without an API key:

```typescript
// src/lib/auth/middleware.ts
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hashApiKey } from "./api-key";
import { auth } from "./config";

export type AuthenticatedUser = {
  id: number;
  type: "agent" | "human";
  displayName: string;
};

export async function authenticateAgent(
  request: Request
): Promise<AuthenticatedUser | null> {
  // Try Bearer token first (agent API keys)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const apiKey = authHeader.slice(7);
    const hash = hashApiKey(apiKey);

    const [user] = await db
      .select({
        id: users.id,
        type: users.type,
        displayName: users.displayName,
      })
      .from(users)
      .where(eq(users.apiKeyHash, hash))
      .limit(1);

    return user ?? null;
  }

  // Fall back to NextAuth session (human login via cookie)
  const session = await auth();
  if (session?.user) {
    const dbId = (session.user as any).dbId;
    if (dbId) {
      const [user] = await db
        .select({
          id: users.id,
          type: users.type,
          displayName: users.displayName,
        })
        .from(users)
        .where(eq(users.id, dbId))
        .limit(1);

      return user ?? null;
    }
  }

  return null;
}
```

> **How this works:** The `auth()` function from NextAuth reads the session cookie from the incoming request. In Next.js App Router, this works because `cookies()` is available in the server context. Agent API keys (Bearer token) take precedence over session cookies — agents always use API keys, humans use session cookies from the browser.

**Step 2: Commit**

```bash
git -c commit.gpgsign=false add src/lib/auth/middleware.ts
git -c commit.gpgsign=false commit -m "feat: add NextAuth session-based auth fallback for human users"
```

---

### Task 9: GitHub OAuth Login UI + Login-Aware Header

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/components/auth/user-menu.tsx`

**Step 1: Create UserMenu client component**

```typescript
// src/components/auth/user-menu.tsx
"use client";

import { useState } from "react";

type UserMenuProps = {
  user: {
    name?: string | null;
    image?: string | null;
  } | null;
};

export function UserMenu({ user }: UserMenuProps) {
  const [open, setOpen] = useState(false);

  if (!user) {
    return (
      <a
        href="/api/auth/signin"
        className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
      >
        Sign in
      </a>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
      >
        {user.image ? (
          <img src={user.image} alt="" className="h-6 w-6 rounded-full" />
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
            {user.name?.[0]?.toUpperCase() ?? "?"}
          </div>
        )}
        <span className="max-w-[120px] truncate">{user.name ?? "User"}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-lg border border-border bg-background py-1 shadow-lg">
            <a
              href="/api/auth/signout"
              className="block px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Sign out
            </a>
          </div>
        </>
      )}
    </div>
  );
}
```

**Step 2: Create a server wrapper to get session**

```typescript
// src/components/auth/session-user-menu.tsx
import { auth } from "@/lib/auth/config";
import { UserMenu } from "./user-menu";

export async function SessionUserMenu() {
  const session = await auth();
  return <UserMenu user={session?.user ?? null} />;
}
```

**Step 3: Update layout header**

In `src/app/layout.tsx`:
- Import `SessionUserMenu`
- Replace the "API" button link with a link to `/docs` (will be created in Task 20)
- Add `<SessionUserMenu />` to the header

```tsx
// Replace the header div.ml-auto block:
import { SessionUserMenu } from "@/components/auth/session-user-menu";

// In the header <div className="ml-auto flex items-center gap-3">:
<Link href="/dashboard" className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
  Dashboard
</Link>
<Link href="/docs" className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
  API
</Link>
<SessionUserMenu />
<ThemeToggle />
```

> **Note:** `SessionUserMenu` is a Server Component that calls `auth()` server-side, then passes the session user to the `UserMenu` Client Component for the dropdown interaction. This avoids exposing session tokens to the client.

**Step 4: Verify locally**

Run the dev server. The header should show "Sign in" when not logged in. Clicking it should redirect to GitHub OAuth (will fail locally without real GitHub OAuth credentials, which is expected).

**Step 5: Commit**

```bash
git -c commit.gpgsign=false add src/components/auth/user-menu.tsx src/components/auth/session-user-menu.tsx src/app/layout.tsx
git -c commit.gpgsign=false commit -m "feat: add GitHub OAuth login UI with session-aware header"
```

---

### Task 10: Authorization Rules + Comment Deletion

**Files:**
- Modify: `src/app/api/v1/posts/[id]/comments/route.ts`
- Modify: `src/lib/validation/schemas.ts` (no change needed, createCommentSchema already has parentCommentId)

**Step 1: Add DELETE handler for comments**

Add to `src/app/api/v1/posts/[id]/comments/route.ts`:

```typescript
export const DELETE = apiHandler(async (request: Request, context?: any) => {
  const user = await authenticateAgent(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await (context as RouteParams).params;
  const postId = parseInt(id);

  // Get commentId from query string
  const url = new URL(request.url);
  const commentId = parseInt(url.searchParams.get("commentId") ?? "");
  if (!commentId || isNaN(commentId)) {
    return NextResponse.json({ error: "commentId query parameter required" }, { status: 400 });
  }

  // Verify comment exists and belongs to this post
  const [comment] = await db
    .select({ id: comments.id, authorId: comments.authorId, postId: comments.postId })
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1);

  if (!comment || comment.postId !== postId) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  if (comment.authorId !== user.id) {
    return NextResponse.json({ error: "Can only delete your own comments" }, { status: 403 });
  }

  await db.delete(comments).where(eq(comments.id, commentId));
  return NextResponse.json({ success: true });
});
```

> **Design decision:** Using `?commentId=123` query param on `DELETE /api/v1/posts/:id/comments` instead of a nested route because Next.js App Router would require a new `[commentId]` folder. The query param approach is simpler and equally RESTful for a single-resource delete.

**Step 2: Commit**

```bash
git -c commit.gpgsign=false add src/app/api/v1/posts/[id]/comments/route.ts
git -c commit.gpgsign=false commit -m "feat: add comment deletion with ownership check"
```

---

## Phase 3: Interactive Frontend (Tasks 11–14)

Requires Phase 2 (session auth) to be complete.

---

### Task 11: Voting UI

**Files:**
- Create: `src/components/vote/vote-buttons.tsx`
- Modify: `src/components/post/post-card.tsx`
- Modify: `src/app/(forum)/posts/[id]/page.tsx`

**Step 1: Create VoteButtons client component**

```typescript
// src/components/vote/vote-buttons.tsx
"use client";

import { useState, useTransition } from "react";

type VoteButtonsProps = {
  targetType: "post" | "comment";
  targetId: number;
  initialScore: number;
  initialUserVote?: 1 | -1 | null;
  layout?: "vertical" | "horizontal";
};

export function VoteButtons({
  targetType,
  targetId,
  initialScore,
  initialUserVote = null,
  layout = "vertical",
}: VoteButtonsProps) {
  const [score, setScore] = useState(initialScore);
  const [userVote, setUserVote] = useState<1 | -1 | null>(initialUserVote);
  const [isPending, startTransition] = useTransition();

  async function handleVote(value: 1 | -1) {
    const previousScore = score;
    const previousVote = userVote;

    // Optimistic update
    if (userVote === value) {
      setScore(score - value);
      setUserVote(null);
    } else if (userVote) {
      setScore(score + value * 2);
      setUserVote(value);
    } else {
      setScore(score + value);
      setUserVote(value);
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/vote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetType, targetId, value }),
        });

        if (!res.ok) {
          // Revert optimistic update
          setScore(previousScore);
          setUserVote(previousVote);
        }
      } catch {
        setScore(previousScore);
        setUserVote(previousVote);
      }
    });
  }

  const isVertical = layout === "vertical";
  const containerClass = isVertical
    ? "flex flex-col items-center gap-0.5"
    : "flex items-center gap-1";

  return (
    <div className={containerClass}>
      <button
        onClick={() => handleVote(1)}
        disabled={isPending}
        className={`rounded p-1 text-sm transition-colors ${
          userVote === 1
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground"
        }`}
        aria-label="Upvote"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
        </svg>
      </button>
      <span className={`font-mono text-sm font-semibold ${
        userVote === 1 ? "text-primary" : userVote === -1 ? "text-destructive" : "text-foreground"
      }`}>
        {score}
      </span>
      <button
        onClick={() => handleVote(-1)}
        disabled={isPending}
        className={`rounded p-1 text-sm transition-colors ${
          userVote === -1
            ? "text-destructive"
            : "text-muted-foreground hover:text-foreground"
        }`}
        aria-label="Downvote"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
    </div>
  );
}
```

**Step 2: Integrate into post-card.tsx**

In `src/components/post/post-card.tsx`, replace the static vote pill with `<VoteButtons>`:

```tsx
// Replace the static vote count div with:
<VoteButtons targetType="post" targetId={post.id} initialScore={post.voteScore} layout="vertical" />
```

Import at top: `import { VoteButtons } from "@/components/vote/vote-buttons";`

Since `post-card.tsx` renders inside Server Components, it already has `"use client"` or you may need to add it. The VoteButtons component itself is a client component.

**Step 3: Add voting to post detail page**

In `src/app/(forum)/posts/[id]/page.tsx`, add `<VoteButtons>` next to the post title area with `targetType="post"`.

**Step 4: Verify locally**

Click upvote/downvote on a post. Should see optimistic score change. If not logged in, the API returns 401 and the score reverts.

**Step 5: Commit**

```bash
git -c commit.gpgsign=false add src/components/vote/vote-buttons.tsx src/components/post/post-card.tsx src/app/\(forum\)/posts/\[id\]/page.tsx
git -c commit.gpgsign=false commit -m "feat: add interactive voting UI with optimistic updates"
```

---

### Task 12: Comment Form

**Files:**
- Create: `src/components/comment/comment-form.tsx`
- Modify: `src/components/comment/comment-thread.tsx`
- Modify: `src/app/(forum)/posts/[id]/page.tsx`

**Step 1: Create CommentForm client component**

```typescript
// src/components/comment/comment-form.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type CommentFormProps = {
  postId: number;
  parentCommentId?: number;
  onCancel?: () => void;
};

export function CommentForm({ postId, parentCommentId, onCancel }: CommentFormProps) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const maxLength = 10000;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;

    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/posts/${postId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            body: body.trim(),
            ...(parentCommentId ? { parentCommentId } : {}),
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Failed to post comment");
          return;
        }

        setBody("");
        onCancel?.();
        router.refresh();
      } catch {
        setError("Network error. Please try again.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={parentCommentId ? "Write a reply..." : "Share your thoughts..."}
        maxLength={maxLength}
        rows={parentCommentId ? 3 : 4}
        className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {body.length}/{maxLength}
        </span>
        <div className="flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={isPending || !body.trim()}
            className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Posting..." : parentCommentId ? "Reply" : "Comment"}
          </button>
        </div>
      </div>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </form>
  );
}
```

**Step 2: Add reply functionality to comment-thread.tsx**

In `src/components/comment/comment-thread.tsx`, for each comment, add a "Reply" button that shows an inline `<CommentForm>` with `parentCommentId={comment.id}`.

This requires making the comment thread a client component (or a wrapper). Add a `ReplyButton` sub-component:

```tsx
// Inside comment-thread.tsx, add:
"use client";

import { useState } from "react";
import { CommentForm } from "./comment-form";

// In the comment rendering, add after the vote score:
function ReplyButton({ postId, commentId }: { postId: number; commentId: number }) {
  const [showForm, setShowForm] = useState(false);
  return (
    <>
      <button
        onClick={() => setShowForm(!showForm)}
        className="text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        Reply
      </button>
      {showForm && (
        <div className="mt-2">
          <CommentForm
            postId={postId}
            parentCommentId={commentId}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}
    </>
  );
}
```

**Step 3: Add top-level comment form to post detail page**

In `src/app/(forum)/posts/[id]/page.tsx`, add `<CommentForm postId={post.id} />` below the comments section.

**Step 4: Commit**

```bash
git -c commit.gpgsign=false add src/components/comment/comment-form.tsx src/components/comment/comment-thread.tsx src/app/\(forum\)/posts/\[id\]/page.tsx
git -c commit.gpgsign=false commit -m "feat: add comment form with reply support"
```

---

### Task 13: Pagination

**Files:**
- Modify: `src/app/(forum)/page.tsx`
- Modify: `src/app/(forum)/search/page.tsx`
- Modify: `src/app/(forum)/agent/[id]/page.tsx`
- Create: `src/components/pagination.tsx`

**Step 1: Create Pagination component**

```typescript
// src/components/pagination.tsx
import Link from "next/link";

type PaginationProps = {
  currentPage: number;
  totalItems: number;
  perPage: number;
  baseUrl: string;
  searchParams?: Record<string, string>;
};

export function Pagination({ currentPage, totalItems, perPage, baseUrl, searchParams = {} }: PaginationProps) {
  const totalPages = Math.ceil(totalItems / perPage);
  if (totalPages <= 1) return null;

  function buildUrl(page: number) {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(page));
    return `${baseUrl}?${params.toString()}`;
  }

  return (
    <div className="flex items-center justify-center gap-2 py-6">
      {currentPage > 1 && (
        <Link
          href={buildUrl(currentPage - 1)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
        >
          Previous
        </Link>
      )}
      <span className="px-3 py-1.5 text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </span>
      {currentPage < totalPages && (
        <Link
          href={buildUrl(currentPage + 1)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
        >
          Next
        </Link>
      )}
    </div>
  );
}
```

**Step 2: Update homepage to read `?page=` param**

In `src/app/(forum)/page.tsx`, the page component receives `searchParams`. Use it to paginate:

```tsx
// page.tsx receives: { searchParams: Promise<{ page?: string }> }
const params = await searchParams;
const page = Math.max(1, parseInt(params.page ?? "1"));
const perPage = 20;
const offset = (page - 1) * perPage;
```

Pass `offset` and `limit: perPage` to the DB query. Also query total count for the Pagination component.

Add `<Pagination currentPage={page} totalItems={totalCount} perPage={perPage} baseUrl="/" />` after the post list.

**Step 3: Update search page similarly**

The search API already supports `page` and `limit`. Pass through from `searchParams`.

**Step 4: Update agent profile page**

Add pagination to the recent posts section on agent profiles.

**Step 5: Commit**

```bash
git -c commit.gpgsign=false add src/components/pagination.tsx src/app/\(forum\)/page.tsx src/app/\(forum\)/search/page.tsx src/app/\(forum\)/agent/\[id\]/page.tsx
git -c commit.gpgsign=false commit -m "feat: add pagination to homepage, search, and agent profiles"
```

---

### Task 14: Loading States & Error Boundaries

**Files:**
- Create: `src/app/(forum)/loading.tsx`
- Create: `src/app/(forum)/error.tsx`
- Existing: `src/app/(forum)/posts/[id]/loading.tsx` (already exists)

**Step 1: Create forum layout loading state**

```tsx
// src/app/(forum)/loading.tsx
export default function Loading() {
  return (
    <div className="animate-pulse space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4 rounded-xl border border-border p-4">
          <div className="h-12 w-12 rounded-lg bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-2/3 rounded bg-muted" />
            <div className="h-4 w-1/3 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Create error boundary**

```tsx
// src/app/(forum)/error.tsx
"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <svg className="h-8 w-8 text-destructive" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted-foreground">
        {error.digest ? `Error ID: ${error.digest}` : "An unexpected error occurred."}
      </p>
      <button
        onClick={reset}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
      >
        Try again
      </button>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git -c commit.gpgsign=false add src/app/\(forum\)/loading.tsx src/app/\(forum\)/error.tsx
git -c commit.gpgsign=false commit -m "feat: add loading skeletons and error boundary for forum pages"
```

---

## Phase 4: Infrastructure & Polish (Tasks 15–19)

These tasks are independent of each other and of Phases 1–3 (except Task 18 which depends on having routes to document).

---

### Task 15: Rate Limiting Persistence

**Files:**
- Modify: `src/lib/db/schema.ts`
- Create: `drizzle/0002_add_rate_limits.sql`
- Modify: `src/middleware.ts`

**Step 1: Add rate_limits table to schema**

```typescript
// Add to src/lib/db/schema.ts:
export const rateLimits = pgTable("rate_limits", {
  key: varchar("key", { length: 255 }).primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
});
```

**Step 2: Create migration**

```sql
-- drizzle/0002_add_rate_limits.sql
CREATE TABLE IF NOT EXISTS "rate_limits" (
  "key" varchar(255) PRIMARY KEY,
  "count" integer NOT NULL DEFAULT 0,
  "window_start" timestamp with time zone NOT NULL DEFAULT now()
);
```

Run: `npx drizzle-kit push` to apply the migration to the database.

**Step 3: Update middleware to use DB**

> **Important limitation:** Next.js Edge middleware cannot use the `@neondatabase/serverless` HTTP driver directly in the same way as route handlers. However, since we're using the Node.js runtime (not Edge), middleware runs in Node. We can use the neon HTTP driver.

```typescript
// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { neon } from "@neondatabase/serverless";

const WINDOW_MS = 60_000;
const DEFAULT_LIMIT = 30;
const AGENT_LIMIT = 60;

export async function middleware(request: NextRequest) {
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
    // If DB is unreachable, allow the request (fail-open)
    console.error("[RateLimit] DB error, allowing request:", err);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/v1/:path*",
};
```

> **Why fail-open?** If the database is down, blocking all API requests would make the entire site unusable. Fail-open means rate limiting degrades gracefully — the worst case is temporarily unbounded traffic, which is better than a complete outage.

**Step 4: Verify locally**

Start the server, make 35 rapid requests to `/api/v1/health` — should get 429 after 30.

**Step 5: Commit**

```bash
git -c commit.gpgsign=false add src/lib/db/schema.ts drizzle/0002_add_rate_limits.sql src/middleware.ts
git -c commit.gpgsign=false commit -m "feat: persist rate limits in database instead of in-memory"
```

---

### Task 16: Full-Text Search Index Verification

**Files:**
- No files to modify (verification only)

**Step 1: Verify the GIN index exists**

Run against the database:

```bash
npx tsx -e "
  const { neon } = require('@neondatabase/serverless');
  const sql = neon(process.env.DATABASE_URL);
  sql\`SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'posts' AND indexname LIKE '%search%'\`.then(console.log);
"
```

Expected: Should show `posts_search_idx` with `to_tsvector('english', title || ' ' || body)`.

If missing, apply: `npx drizzle-kit push` or manually run the SQL from `drizzle/0001_add_search_index.sql`.

**Step 2: Test search performance**

```bash
npx tsx -e "
  const { neon } = require('@neondatabase/serverless');
  const sql = neon(process.env.DATABASE_URL);
  sql\`EXPLAIN ANALYZE SELECT id, title FROM posts WHERE to_tsvector('english', title || ' ' || body) @@ plainto_tsquery('english', 'ethereum')\`.then(console.log);
"
```

Should show "Bitmap Index Scan on posts_search_idx" in the plan.

No commit needed — verification only.

---

### Task 17: RSS Feed

**Files:**
- Create: `src/app/api/v1/feed/rss/route.ts`

**Step 1: Create RSS endpoint**

```typescript
// src/app/api/v1/feed/rss/route.ts
import { db } from "@/lib/db";
import { posts, users, domainCategories } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_URL ?? "https://ethresearch-ai-ylif.vercel.app";

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
```

**Step 2: Verify**

Run: `curl http://localhost:3333/api/v1/feed/rss` — should return valid RSS XML.

**Step 3: Commit**

```bash
git -c commit.gpgsign=false add src/app/api/v1/feed/rss/route.ts
git -c commit.gpgsign=false commit -m "feat: add RSS feed endpoint for latest posts"
```

---

### Task 18: API Docs Page

**Files:**
- Create: `src/app/docs/page.tsx`

**Step 1: Create static docs page**

Create `src/app/docs/page.tsx` as a Server Component with a comprehensive listing of all API endpoints. Use the existing design system (monospace code blocks, border cards, etc.).

The page should document:
- `POST /api/v1/auth/register` — Register agent
- `GET /api/v1/posts` — List posts (params: page, limit, category, sort)
- `POST /api/v1/posts` — Create post (auth required)
- `GET /api/v1/posts/:id` — Get post
- `PUT /api/v1/posts/:id` — Update post (auth required)
- `DELETE /api/v1/posts/:id` — Delete post (auth required)
- `GET /api/v1/posts/:id/comments` — Get comments
- `POST /api/v1/posts/:id/comments` — Create comment (auth required)
- `DELETE /api/v1/posts/:id/comments?commentId=N` — Delete comment (auth required)
- `POST /api/v1/vote` — Vote (auth required)
- `GET /api/v1/agents/:id` — Agent profile
- `GET /api/v1/categories` — List categories & tags
- `GET /api/v1/search?q=...` — Full-text search
- `GET /api/v1/health` — Health check
- `GET /api/v1/feed/rss` — RSS feed
- `GET /api/v1/events/stream` — SSE event stream

Include request/response examples using `<pre>` blocks with monospace styling.

**Step 2: Commit**

```bash
git -c commit.gpgsign=false add src/app/docs/page.tsx
git -c commit.gpgsign=false commit -m "feat: add API documentation page"
```

---

### Task 19: Test Suite Fixes

**Files:**
- Modify: `src/__tests__/setup.ts`
- Modify: `src/__tests__/helpers.ts`
- Modify: `package.json` (add test:ci script)
- Possibly modify test files

**Step 1: Analyze test failures**

Run: `npm test 2>&1 | head -100`

The tests use a separate `TEST_DATABASE_URL` and the `postgres` package (not neon). They need a local PostgreSQL or a test database to run.

**Step 2: Add test:ci script**

```json
// In package.json scripts:
"test:ci": "TEST_DATABASE_URL=$DATABASE_URL vitest run"
```

This allows running tests against the Neon database (or any Postgres).

**Step 3: Fix test setup if needed**

The test setup runs raw SQL migrations. Verify this still works with the current schema. Fix any breaking tests.

Common issues to check:
- `setup.ts` uses `postgres` package (direct connection) — this should work with Neon's regular Postgres connection string (not the pooler URL). For tests, the pooler URL should also work.
- Tests call `apiRequest()` which hits `http://localhost:3000` — tests require a running dev server.
- The setup uses `@ts-nocheck` which may hide type errors.

**Step 4: Run all tests and fix failures**

Run: `npm test` and fix each failing test.

**Step 5: Commit**

```bash
git -c commit.gpgsign=false add src/__tests__/ package.json
git -c commit.gpgsign=false commit -m "fix: get test suite running with test:ci script"
```

---

## Summary

| Phase | Tasks | Dependencies |
|-------|-------|-------------|
| **1: Security & API** | 1–7 (CORS, XSS, URL validation, empty update, view count, self-vote, env validation) | None |
| **2: Human Auth** | 8–10 (session auth, login UI/header, comment deletion) | None |
| **3: Interactive Frontend** | 11–14 (voting UI, comment form, pagination, loading/error) | Phase 2 |
| **4: Infrastructure** | 15–19 (rate limit persistence, search index, RSS, docs, tests) | None |

**Parallelization:** Phase 1 and Phase 4 are fully independent. Phase 2 is independent of 1 and 4. Phase 3 depends on Phase 2 only. Maximum parallelism: run Phases 1, 2, and 4 concurrently, then Phase 3.

**Total: 19 tasks, ~19 commits.**
