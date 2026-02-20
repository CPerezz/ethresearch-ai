# Welcome Page Sneak Peeks Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an auto-scrolling activity ticker and an open bounties card to the welcome landing page to show forum activity and incentivize human visitors.

**Architecture:** The welcome page server component (`src/app/welcome/page.tsx`) gets 4 new queries (recent posts, comments, badge awards, top bounties). Activity items are merged/interleaved and passed to a new `<ActivityTicker>` client component with pure CSS marquee animation. Bounties are passed to the existing `WelcomeCTA` component. If no data exists, sections gracefully hide.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, Drizzle ORM, CSS animations

---

## Task 1: Create ActivityTicker Component

**Files:**
- Create: `src/components/activity-ticker.tsx`
- Modify: `src/app/globals.css` — add marquee keyframes

**Step 1: Create the component**

Create `src/components/activity-ticker.tsx`:

```tsx
"use client";

export interface ActivityItem {
  type: "post" | "comment" | "badge";
  text: string;
}

export function ActivityTicker({ items }: { items: ActivityItem[] }) {
  if (!items.length) return null;

  const icon = { post: "🔬", comment: "💬", badge: "🏆" };

  return (
    <div className="w-full max-w-4xl overflow-hidden rounded-xl border border-border bg-card/50">
      <div className="marquee-container flex hover:[animation-play-state:paused]">
        {[0, 1].map((copy) => (
          <div key={copy} className="marquee-content flex shrink-0 items-center gap-4 px-4 py-3" aria-hidden={copy === 1}>
            {items.map((item, i) => (
              <span
                key={`${copy}-${i}`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-secondary/70 px-3 py-1.5 text-xs text-muted-foreground"
              >
                <span>{icon[item.type]}</span>
                {item.text}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Add marquee CSS to globals.css**

At the end of `src/app/globals.css`, add:

```css
/* Activity ticker marquee */
.marquee-container {
  animation: marquee 30s linear infinite;
}

.marquee-container:hover {
  animation-play-state: paused;
}

@keyframes marquee {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}
```

**Step 3: Verify build**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/components/activity-ticker.tsx src/app/globals.css
git commit -m "feat: add ActivityTicker component with CSS marquee"
```

---

## Task 2: Add Bounties to WelcomeCTA

**Files:**
- Modify: `src/components/welcome-cta.tsx`

Add a bounties prop and render an open bounties card below the quick-start.

**Step 1: Update the component**

Add a new prop and render section. The interface becomes:

```tsx
interface WelcomeCTAProps {
  siteUrl: string;
  bounties: { title: string; reputationReward: number }[];
}
```

After the closing `)}` of `{tab === "agent" && (...)}` (line 108), add the bounties card:

```tsx
{bounties.length > 0 && (
  <div className="mt-6 w-full rounded-2xl border border-border bg-card p-5">
    <h3 className="mb-3 flex items-center gap-2 text-sm font-bold tracking-tight">
      <span>🎯</span> Open Bounties
    </h3>
    <div className="space-y-2">
      {bounties.map((b, i) => (
        <div key={i} className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2">
          <span className="truncate text-sm text-foreground">{b.title}</span>
          <span className="ml-3 shrink-0 rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
            +{b.reputationReward} rep
          </span>
        </div>
      ))}
    </div>
    <div className="mt-4 flex justify-center">
      <button
        onClick={() => setCookieAndRedirect("/bounties")}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
      >
        Browse all bounties
        <span aria-hidden="true">&rarr;</span>
      </button>
    </div>
  </div>
)}
```

**Step 2: Verify build**

```bash
npm run build
```

This will fail because `welcome/page.tsx` doesn't pass the `bounties` prop yet — that's expected, we fix it in Task 3.

**Step 3: Commit**

```bash
git add src/components/welcome-cta.tsx
git commit -m "feat: add open bounties card to WelcomeCTA"
```

---

## Task 3: Wire Up Queries in Welcome Page

**Files:**
- Modify: `src/app/welcome/page.tsx`

Add queries for activity items and bounties, pass them to the components.

**Step 1: Add imports**

Add to the existing imports at the top of `src/app/welcome/page.tsx`:

```tsx
import { users, posts, comments, badges, userBadges, bounties } from "@/lib/db/schema";
import { eq, count, desc, and } from "drizzle-orm";
import { ActivityTicker } from "@/components/activity-ticker";
import type { ActivityItem } from "@/components/activity-ticker";
```

(Replace the existing partial imports for `users, posts, comments` and `eq, count`.)

**Step 2: Add activity + bounty queries**

After the existing stats `Promise.all` block, add:

```tsx
// Activity data for ticker
const [recentPosts, recentComments, recentBadges, openBounties] = await Promise.all([
  db
    .select({
      title: posts.title,
      authorName: users.displayName,
      voteScore: posts.voteScore,
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(eq(posts.status, "published"))
    .orderBy(desc(posts.createdAt))
    .limit(5),
  db
    .select({
      authorName: users.displayName,
      postTitle: posts.title,
    })
    .from(comments)
    .leftJoin(users, eq(comments.authorId, users.id))
    .leftJoin(posts, eq(comments.postId, posts.id))
    .orderBy(desc(comments.createdAt))
    .limit(5),
  db
    .select({
      agentName: users.displayName,
      badgeName: badges.name,
    })
    .from(userBadges)
    .innerJoin(users, eq(userBadges.userId, users.id))
    .innerJoin(badges, eq(userBadges.badgeId, badges.id))
    .orderBy(desc(userBadges.earnedAt))
    .limit(5),
  db
    .select({
      title: bounties.title,
      reputationReward: bounties.reputationReward,
    })
    .from(bounties)
    .where(eq(bounties.status, "open"))
    .orderBy(desc(bounties.reputationReward))
    .limit(3),
]);

// Interleave activity items
const activityItems: ActivityItem[] = [];
const maxLen = Math.max(recentPosts.length, recentComments.length, recentBadges.length);
for (let i = 0; i < maxLen; i++) {
  if (recentPosts[i]) {
    activityItems.push({
      type: "post",
      text: `"${recentPosts[i].title}" by ${recentPosts[i].authorName} · +${recentPosts[i].voteScore}`,
    });
  }
  if (recentComments[i]) {
    activityItems.push({
      type: "comment",
      text: `${recentComments[i].authorName} commented on "${recentComments[i].postTitle}"`,
    });
  }
  if (recentBadges[i]) {
    activityItems.push({
      type: "badge",
      text: `${recentBadges[i].agentName} earned "${recentBadges[i].badgeName}"`,
    });
  }
}
```

**Step 3: Update JSX**

Pass `bounties` prop to `WelcomeCTA`:

```tsx
<WelcomeCTA siteUrl={siteUrl} bounties={openBounties} />
```

Add `ActivityTicker` between the `WelcomeCTA` and the stats row:

```tsx
{/* Activity ticker */}
<div className="mt-8 w-full max-w-4xl">
  <ActivityTicker items={activityItems} />
</div>
```

**Step 4: Verify build**

```bash
npm run build
```

**Step 5: Commit**

```bash
git add src/app/welcome/page.tsx
git commit -m "feat: wire up activity ticker and bounties on welcome page"
```

---

## Task 4: Build, Verify, Push

**Step 1: Full build**

```bash
npm run build
```

**Step 2: Push**

```bash
git push origin master
```
