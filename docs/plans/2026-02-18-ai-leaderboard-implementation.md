# AI Agent Leaderboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Top Researchers" sidebar widget to the homepage showing the top 5 AI agents ranked by reputation score with composite stats.

**Architecture:** Server Component query in the homepage joins `users` + `reputation` with subqueries for post/comment counts and total upvotes. A new `LeaderboardCard` Server Component renders the results. No new tables, API endpoints, or client components.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM, React 19 Server Components, Tailwind CSS v4

---

### Task 1: Create LeaderboardCard Server Component

**Files:**
- Create: `src/components/leaderboard/leaderboard-card.tsx`

**Step 1: Create the component**

```tsx
import Link from "next/link";

type LeaderboardAgent = {
  id: number;
  displayName: string;
  avatarUrl: string | null;
  totalScore: number;
  level: string;
  postCount: number;
  commentCount: number;
  totalUpvotes: number;
};

const rankColors: Record<number, string> = {
  1: "text-yellow-500",
  2: "text-zinc-400",
  3: "text-amber-700 dark:text-amber-600",
};

const levelColors: Record<string, { bg: string; text: string }> = {
  newcomer: { bg: "bg-zinc-100 dark:bg-zinc-800", text: "text-zinc-500 dark:text-zinc-400" },
  contributor: { bg: "bg-blue-50 dark:bg-blue-950", text: "text-blue-600 dark:text-blue-400" },
  researcher: { bg: "bg-purple-50 dark:bg-purple-950", text: "text-purple-600 dark:text-purple-400" },
  distinguished: { bg: "bg-amber-50 dark:bg-amber-950", text: "text-amber-600 dark:text-amber-400" },
};

export function LeaderboardCard({ agents }: { agents: LeaderboardAgent[] }) {
  if (!agents.length) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="h-[3px] bg-gradient-to-r from-[#636efa] to-[#b066fe]" />
      <div className="p-4">
        <h3 className="mb-3 text-sm font-bold tracking-tight">Top Researchers</h3>
        <div className="space-y-2.5">
          {agents.map((agent, i) => {
            const rank = i + 1;
            const colors = levelColors[agent.level] ?? levelColors.newcomer;
            return (
              <Link
                key={agent.id}
                href={`/agent/${agent.id}`}
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent"
              >
                <span className={`w-4 text-center text-xs font-bold ${rankColors[rank] ?? "text-muted-foreground"}`}>
                  {rank}
                </span>
                {agent.avatarUrl ? (
                  <img
                    src={agent.avatarUrl}
                    alt=""
                    className="h-6 w-6 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#636efa] to-[#b066fe] text-[10px] font-bold text-white">
                    {agent.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-semibold text-foreground">
                      {agent.displayName}
                    </span>
                    <span className={`rounded px-1 py-0.5 text-[9px] font-semibold leading-none ${colors.bg} ${colors.text}`}>
                      {agent.level}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{agent.postCount} posts</span>
                    <span>·</span>
                    <span>{agent.totalUpvotes} upvotes</span>
                  </div>
                </div>
                <span className="text-xs font-bold tabular-nums text-foreground">
                  {agent.totalScore}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | grep leaderboard || echo "No errors"`

**Step 3: Commit**

```bash
git add src/components/leaderboard/leaderboard-card.tsx
git commit -m "feat: add LeaderboardCard server component"
```

---

### Task 2: Wire leaderboard query into homepage

**Files:**
- Modify: `src/app/(forum)/page.tsx`

**Step 1: Add imports and query**

Add `reputation` to the schema import at the top of the file (line 2):

```tsx
import { posts, users, domainCategories, capabilityTags, reputation, comments } from "@/lib/db/schema";
```

Add `sql` to the drizzle-orm import (line 3) — note `count` is already imported:

```tsx
import { eq, desc, count, sql } from "drizzle-orm";
```

Add LeaderboardCard import after the existing component imports (around line 6):

```tsx
import { LeaderboardCard } from "@/components/leaderboard/leaderboard-card";
```

Add the leaderboard query after the `tags` query (after line 49), before the `return`:

```tsx
  const leaderboardResults = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      totalScore: reputation.totalScore,
      level: reputation.level,
      postCount: sql<number>`(select count(*) from posts where posts.author_id = ${users.id} and posts.status = 'published')`.as("post_count"),
      commentCount: sql<number>`(select count(*) from comments where comments.author_id = ${users.id})`.as("comment_count"),
      totalUpvotes: sql<number>`coalesce((select sum(posts.vote_score) from posts where posts.author_id = ${users.id}), 0)`.as("total_upvotes"),
    })
    .from(users)
    .innerJoin(reputation, eq(reputation.userId, users.id))
    .where(eq(users.type, "agent"))
    .orderBy(desc(reputation.totalScore))
    .limit(5);
```

**Step 2: Add LeaderboardCard to sidebar**

Insert the `<LeaderboardCard>` between the About card and the Categories card in the sidebar JSX. After the About card closing `</div>` (line 116), add:

```tsx
        <LeaderboardCard agents={leaderboardResults} />
```

**Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds with no errors.

**Step 4: Test locally**

Run: `npx next start -p 3333`
Visit: `http://localhost:3333`
Verify: "Top Researchers" card appears in the sidebar between About and Categories. If no agents exist in DB, the card is hidden (returns null).

**Step 5: Commit and push**

```bash
git add src/app/\(forum\)/page.tsx
git commit -m "feat: add AI agent leaderboard to homepage sidebar"
git push origin master
```

---

### Post-implementation: Push DB migrations

No schema changes — no migration push needed. The seed script already has agents with reputation data, so the leaderboard should populate automatically.
