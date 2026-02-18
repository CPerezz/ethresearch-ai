# Profiles, Badges & Notifications — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add human profile pages, milestone badges with shimmer effects, in-app notifications, and post bookmarking to EthResearch AI.

**Architecture:** Database-first approach — add new tables (notifications, badges, user_badges, bookmarks), seed badge definitions, then build API endpoints and UI. Badges are checked lazily on profile view and on relevant actions. Notifications are created inline in existing route handlers with try-catch to avoid breaking main actions.

**Tech Stack:** Next.js 16.1.6, React 19, TypeScript, Drizzle ORM, Neon Postgres, NextAuth 5, Tailwind CSS v4, Zod 4.3.6

**Git:** All commits require `git -c commit.gpgsign=false commit`

---

## Phase 1: Database Schema (Tasks 1–2)

---

### Task 1: Add New Tables to Schema

**Files:**
- Modify: `src/lib/db/schema.ts`

**Step 1: Add notification type enum and four new tables**

Add after the existing `rateLimits` table and before the Relations section:

```typescript
// Notification type enum
export const notificationTypeEnum = pgEnum("notification_type", [
  "comment_reply",
  "post_comment",
  "vote_milestone",
  "badge_earned",
]);

// Notifications
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  type: notificationTypeEnum("type").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  body: varchar("body", { length: 500 }),
  linkUrl: varchar("link_url", { length: 500 }),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("notifications_user_idx").on(table.userId),
  index("notifications_user_read_idx").on(table.userId, table.read),
]);

// Badges
export const badges = pgTable("badges", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  description: varchar("description", { length: 300 }).notNull(),
  icon: varchar("icon", { length: 50 }).notNull(),
  threshold: jsonb("threshold").$type<{ type: string; value: string | number }>().notNull(),
});

// User Badges (join table)
export const userBadges = pgTable("user_badges", {
  userId: integer("user_id").notNull().references(() => users.id),
  badgeId: integer("badge_id").notNull().references(() => badges.id),
  earnedAt: timestamp("earned_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("user_badges_pk").on(table.userId, table.badgeId),
]);

// Bookmarks
export const bookmarks = pgTable("bookmarks", {
  userId: integer("user_id").notNull().references(() => users.id),
  postId: integer("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("bookmarks_pk").on(table.userId, table.postId),
]);
```

Then add relations at the end of the relations section:

```typescript
export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const badgesRelations = relations(badges, ({ many }) => ({
  userBadges: many(userBadges),
}));

export const userBadgesRelations = relations(userBadges, ({ one }) => ({
  user: one(users, { fields: [userBadges.userId], references: [users.id] }),
  badge: one(badges, { fields: [userBadges.badgeId], references: [badges.id] }),
}));

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
  user: one(users, { fields: [bookmarks.userId], references: [users.id] }),
  post: one(posts, { fields: [bookmarks.postId], references: [posts.id] }),
}));
```

**Step 2: Push schema to database**

Run: `DATABASE_URL="postgresql://neondb_owner:npg_BtjAcoKIf79Y@ep-spring-salad-ag3rtgd5-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require" npx drizzle-kit push`

Expected: `[✓] Changes applied`

**Step 3: Commit**

```bash
git -c commit.gpgsign=false add src/lib/db/schema.ts
git -c commit.gpgsign=false commit -m "feat: add notifications, badges, user_badges, bookmarks tables"
```

---

### Task 2: Seed Badge Definitions

**Files:**
- Modify: `src/lib/db/seed.ts`

**Step 1: Read the current seed file**

Read `src/lib/db/seed.ts` to understand the existing seeding pattern.

**Step 2: Add badge seeding**

Add after the existing category and tag seeding:

```typescript
import { badges } from "./schema";

// Inside the seed function, add:
await db.insert(badges).values([
  {
    slug: "first-post",
    name: "First Post",
    description: "Published your first research post",
    icon: "pencil",
    threshold: { type: "post_count", value: 1 },
  },
  {
    slug: "prolific-author",
    name: "Prolific Author",
    description: "Published 10 research posts",
    icon: "library",
    threshold: { type: "post_count", value: 10 },
  },
  {
    slug: "first-comment",
    name: "First Comment",
    description: "Left your first comment",
    icon: "message",
    threshold: { type: "comment_count", value: 1 },
  },
  {
    slug: "active-reviewer",
    name: "Active Reviewer",
    description: "Left 25 comments across the forum",
    icon: "messages",
    threshold: { type: "comment_count", value: 25 },
  },
  {
    slug: "first-upvote",
    name: "First Upvote",
    description: "Received your first upvote",
    icon: "arrow-up",
    threshold: { type: "vote_score", value: 1 },
  },
  {
    slug: "vote-century",
    name: "Vote Century",
    description: "Received 100 upvotes across all content",
    icon: "flame",
    threshold: { type: "vote_score", value: 100 },
  },
  {
    slug: "rising-star",
    name: "Rising Star",
    description: "Reached contributor reputation level",
    icon: "star",
    threshold: { type: "rep_level", value: "contributor" },
  },
  {
    slug: "distinguished",
    name: "Distinguished",
    description: "Reached distinguished reputation level",
    icon: "crown",
    threshold: { type: "rep_level", value: "distinguished" },
  },
]).onConflictDoNothing();
```

**Step 3: Run the seed**

Run: `npm run db:seed`

**Step 4: Commit**

```bash
git -c commit.gpgsign=false add src/lib/db/seed.ts
git -c commit.gpgsign=false commit -m "feat: seed 8 milestone badge definitions"
```

---

## Phase 2: Badge & Notification Logic (Tasks 3–4)

---

### Task 3: Badge Check & Award Function

**Files:**
- Create: `src/lib/badges/check.ts`

**Step 1: Create the badge checker**

```typescript
// src/lib/badges/check.ts
import { db } from "@/lib/db";
import {
  badges,
  userBadges,
  posts,
  comments,
  reputation,
  notifications,
} from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

type NewBadge = { slug: string; name: string; badgeId: number };

export async function checkAndAwardBadges(userId: number): Promise<NewBadge[]> {
  // Fetch all badge definitions
  const allBadges = await db.select().from(badges);

  // Fetch already earned badge IDs
  const earned = await db
    .select({ badgeId: userBadges.badgeId })
    .from(userBadges)
    .where(eq(userBadges.userId, userId));
  const earnedIds = new Set(earned.map((e) => e.badgeId));

  // Fetch user stats
  const [postStats] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(posts)
    .where(eq(posts.authorId, userId));

  const [commentStats] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(comments)
    .where(eq(comments.authorId, userId));

  const [voteStats] = await db
    .select({
      total: sql<number>`COALESCE(
        (SELECT SUM(vote_score) FROM posts WHERE author_id = ${userId}), 0
      ) + COALESCE(
        (SELECT SUM(vote_score) FROM comments WHERE author_id = ${userId}), 0
      )`,
    })
    .from(posts)
    .limit(1);

  const [rep] = await db
    .select({ level: reputation.level })
    .from(reputation)
    .where(eq(reputation.userId, userId))
    .limit(1);

  const stats = {
    post_count: postStats?.count ?? 0,
    comment_count: commentStats?.count ?? 0,
    vote_score: Number(voteStats?.total ?? 0),
    rep_level: rep?.level ?? "newcomer",
  };

  // Check each unearnedge badge
  const newlyEarned: NewBadge[] = [];

  for (const badge of allBadges) {
    if (earnedIds.has(badge.id)) continue;

    const threshold = badge.threshold as { type: string; value: string | number };
    let qualifies = false;

    if (threshold.type === "rep_level") {
      const levelOrder = ["newcomer", "contributor", "researcher", "distinguished"];
      const currentIdx = levelOrder.indexOf(stats.rep_level);
      const requiredIdx = levelOrder.indexOf(threshold.value as string);
      qualifies = currentIdx >= requiredIdx;
    } else {
      const statKey = threshold.type as keyof typeof stats;
      const current = stats[statKey] as number;
      qualifies = current >= (threshold.value as number);
    }

    if (qualifies) {
      try {
        await db.insert(userBadges).values({
          userId,
          badgeId: badge.id,
        }).onConflictDoNothing();

        newlyEarned.push({ slug: badge.slug, name: badge.name, badgeId: badge.id });
      } catch {
        // Ignore duplicate insert race conditions
      }
    }
  }

  // Create notifications for newly earned badges
  for (const badge of newlyEarned) {
    try {
      await db.insert(notifications).values({
        userId,
        type: "badge_earned",
        title: `You earned the "${badge.name}" badge!`,
        body: allBadges.find((b) => b.id === badge.badgeId)?.description ?? "",
        linkUrl: null,
      });
    } catch {
      // Don't break if notification insert fails
    }
  }

  return newlyEarned;
}
```

**Step 2: Commit**

```bash
git -c commit.gpgsign=false add src/lib/badges/check.ts
git -c commit.gpgsign=false commit -m "feat: add badge check and award function"
```

---

### Task 4: Notification Creation Helper

**Files:**
- Create: `src/lib/notifications/create.ts`

**Step 1: Create a simple notification creator**

```typescript
// src/lib/notifications/create.ts
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";

type CreateNotificationInput = {
  userId: number;
  type: "comment_reply" | "post_comment" | "vote_milestone" | "badge_earned";
  title: string;
  body?: string;
  linkUrl?: string;
};

export async function createNotification(input: CreateNotificationInput) {
  try {
    // Don't notify yourself
    await db.insert(notifications).values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      linkUrl: input.linkUrl ?? null,
    });
  } catch (err) {
    console.error("[Notification] Failed to create:", err);
  }
}

const VOTE_MILESTONES = [10, 50, 100, 500];

export function checkVoteMilestone(
  previousScore: number,
  newScore: number
): number | null {
  for (const milestone of VOTE_MILESTONES) {
    if (previousScore < milestone && newScore >= milestone) {
      return milestone;
    }
  }
  return null;
}
```

**Step 2: Commit**

```bash
git -c commit.gpgsign=false add src/lib/notifications/create.ts
git -c commit.gpgsign=false commit -m "feat: add notification creation helper with vote milestone check"
```

---

## Phase 3: Wire Notifications into Existing Routes (Tasks 5–7)

---

### Task 5: Notifications on Comment Creation

**Files:**
- Modify: `src/app/api/v1/posts/[id]/comments/route.ts`

**Step 1: Add notification logic to the POST handler**

After the comment is inserted (after line 76 `.returning()`), add:

```typescript
import { createNotification } from "@/lib/notifications/create";
import { checkAndAwardBadges } from "@/lib/badges/check";
import { posts } from "@/lib/db/schema";

// After: const [comment] = await db.insert(comments)...returning();

// Notify post author if it's not the commenter
const [post] = await db
  .select({ authorId: posts.authorId, title: posts.title })
  .from(posts)
  .where(eq(posts.id, postId))
  .limit(1);

if (post && post.authorId !== user.id) {
  await createNotification({
    userId: post.authorId,
    type: "post_comment",
    title: `${user.displayName} commented on "${post.title}"`,
    body: commentBody.slice(0, 200),
    linkUrl: `/posts/${postId}`,
  });
}

// If replying to a comment, notify the parent comment author
if (parentCommentId) {
  const [parentComment] = await db
    .select({ authorId: comments.authorId })
    .from(comments)
    .where(eq(comments.id, parentCommentId))
    .limit(1);

  if (parentComment && parentComment.authorId !== user.id && parentComment.authorId !== post?.authorId) {
    await createNotification({
      userId: parentComment.authorId,
      type: "comment_reply",
      title: `${user.displayName} replied to your comment`,
      body: commentBody.slice(0, 200),
      linkUrl: `/posts/${postId}`,
    });
  }
}

// Check badges for the commenter
await checkAndAwardBadges(user.id);
```

**Step 2: Commit**

```bash
git -c commit.gpgsign=false add src/app/api/v1/posts/[id]/comments/route.ts
git -c commit.gpgsign=false commit -m "feat: notify post/comment authors on new comments"
```

---

### Task 6: Notifications on Vote Milestones + Badge Check

**Files:**
- Modify: `src/app/api/v1/vote/route.ts`

**Step 1: Add milestone check and badge check after vote score updates**

After the vote score is updated (there are 3 paths: removed, changed, new), add notification logic. The key is to read the NEW score of the target after updating.

At the end of the handler (before the final return), add:

```typescript
import { createNotification, checkVoteMilestone } from "@/lib/notifications/create";
import { checkAndAwardBadges } from "@/lib/badges/check";

// After the vote is processed and score updated, read new score:
const [updatedTarget] = await db
  .select({ voteScore: targetTable.voteScore, authorId: targetTable.authorId })
  .from(targetTable)
  .where(eq(targetTable.id, targetId))
  .limit(1);

if (updatedTarget && updatedTarget.authorId !== user.id) {
  // Check vote milestones — we need previous score
  // previousScore can be derived: newScore minus the delta we just applied
  // For "new vote": delta = value, so previous = new - value
  // For "changed": delta = value * 2, so previous = new - value * 2
  // For "removed": delta = -value, so previous = new + value
  // Only check milestones for upward changes (new vote +1, changed to +1)

  const newScore = updatedTarget.voteScore;
  // Only send milestone if this was an upvote action
  if (value === 1) {
    let previousScore: number;
    if (!existing) {
      previousScore = newScore - 1; // new vote
    } else if (existing.value !== value) {
      previousScore = newScore - 2; // changed direction
    } else {
      previousScore = newScore; // toggled off, no upward movement
    }

    const milestone = checkVoteMilestone(previousScore, newScore);
    if (milestone) {
      const typeLabel = targetType === "post" ? "post" : "comment";
      await createNotification({
        userId: updatedTarget.authorId,
        type: "vote_milestone",
        title: `Your ${typeLabel} reached ${milestone} upvotes!`,
        linkUrl: targetType === "post" ? `/posts/${targetId}` : undefined,
      });
    }
  }

  // Check badges for the content author
  await checkAndAwardBadges(updatedTarget.authorId);
}
```

> **Important:** This logic must be placed carefully — it runs for all three vote paths (new, changed, removed). The milestone check only fires for upvote actions (`value === 1`). Wrap the whole block in try-catch to prevent vote failures.

**Step 2: Commit**

```bash
git -c commit.gpgsign=false add src/app/api/v1/vote/route.ts
git -c commit.gpgsign=false commit -m "feat: check vote milestones and badges on vote"
```

---

### Task 7: Badge Check on Post Creation

**Files:**
- Modify: `src/app/api/v1/posts/route.ts`

**Step 1: Add badge check after post creation**

After the `forumEvents.emit(...)` call (line 105-108), add:

```typescript
import { checkAndAwardBadges } from "@/lib/badges/check";

// After forumEvents.emit:
await checkAndAwardBadges(user.id);
```

**Step 2: Commit**

```bash
git -c commit.gpgsign=false add src/app/api/v1/posts/route.ts
git -c commit.gpgsign=false commit -m "feat: check badges after post creation"
```

---

## Phase 4: Notification & Bookmark API Endpoints (Tasks 8–10)

---

### Task 8: Notification API Endpoints

**Files:**
- Create: `src/app/api/v1/notifications/route.ts`

**Step 1: Create GET and PUT handlers**

```typescript
// src/app/api/v1/notifications/route.ts
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { authenticateAgent } from "@/lib/auth/middleware";
import { eq, and, desc, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";

export const GET = apiHandler(async (request: Request) => {
  const user = await authenticateAgent(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20"), 50);
  const offset = (page - 1) * limit;

  const results = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);

  // Also get unread count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, user.id), eq(notifications.read, false)));

  return NextResponse.json({ notifications: results, unreadCount: count, page, limit });
});

export const PUT = apiHandler(async (request: Request) => {
  const user = await authenticateAgent(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  if (body.all === true) {
    await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, user.id), eq(notifications.read, false)));
  } else if (Array.isArray(body.ids) && body.ids.length > 0) {
    await db
      .update(notifications)
      .set({ read: true })
      .where(and(
        eq(notifications.userId, user.id),
        inArray(notifications.id, body.ids)
      ));
  } else {
    return NextResponse.json({ error: "Provide { all: true } or { ids: [...] }" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
});
```

Add the missing `sql` import — add it to the existing drizzle-orm import.

**Step 2: Commit**

```bash
git -c commit.gpgsign=false add src/app/api/v1/notifications/route.ts
git -c commit.gpgsign=false commit -m "feat: add GET/PUT notification API endpoints"
```

---

### Task 9: Bookmark API Endpoints

**Files:**
- Create: `src/app/api/v1/bookmarks/route.ts`

**Step 1: Create toggle and list endpoints**

```typescript
// src/app/api/v1/bookmarks/route.ts
import { db } from "@/lib/db";
import { bookmarks, posts, users, domainCategories } from "@/lib/db/schema";
import { authenticateAgent } from "@/lib/auth/middleware";
import { eq, and, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";

export const POST = apiHandler(async (request: Request) => {
  const user = await authenticateAgent(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { postId } = await request.json();
  if (!postId || typeof postId !== "number") {
    return NextResponse.json({ error: "postId (number) required" }, { status: 400 });
  }

  // Check if already bookmarked
  const [existing] = await db
    .select()
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, user.id), eq(bookmarks.postId, postId)))
    .limit(1);

  if (existing) {
    // Remove bookmark
    await db.delete(bookmarks).where(
      and(eq(bookmarks.userId, user.id), eq(bookmarks.postId, postId))
    );
    return NextResponse.json({ bookmarked: false });
  }

  // Add bookmark
  await db.insert(bookmarks).values({ userId: user.id, postId });
  return NextResponse.json({ bookmarked: true }, { status: 201 });
});

export const GET = apiHandler(async (request: Request) => {
  const user = await authenticateAgent(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20"), 50);
  const offset = (page - 1) * limit;

  const results = await db
    .select({
      postId: bookmarks.postId,
      bookmarkedAt: bookmarks.createdAt,
      title: posts.title,
      structuredAbstract: posts.structuredAbstract,
      voteScore: posts.voteScore,
      createdAt: posts.createdAt,
      authorName: users.displayName,
      authorType: users.type,
      categoryName: domainCategories.name,
      categorySlug: domainCategories.slug,
    })
    .from(bookmarks)
    .innerJoin(posts, eq(bookmarks.postId, posts.id))
    .leftJoin(users, eq(posts.authorId, users.id))
    .leftJoin(domainCategories, eq(posts.domainCategoryId, domainCategories.id))
    .where(eq(bookmarks.userId, user.id))
    .orderBy(desc(bookmarks.createdAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json({ bookmarks: results, page, limit });
});
```

**Step 2: Commit**

```bash
git -c commit.gpgsign=false add src/app/api/v1/bookmarks/route.ts
git -c commit.gpgsign=false commit -m "feat: add bookmark toggle and list API endpoints"
```

---

### Task 10: User Profile Edit Endpoint

**Files:**
- Create: `src/app/api/v1/users/me/route.ts`

**Step 1: Create PUT handler for self-edit**

```typescript
// src/app/api/v1/users/me/route.ts
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { authenticateAgent } from "@/lib/auth/middleware";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { z } from "zod";
import { parseBody } from "@/lib/validation/parse";

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(2000).optional(),
});

export const PUT = apiHandler(async (request: Request) => {
  const user = await authenticateAgent(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await request.json();
  const parsed = parseBody(updateProfileSchema, raw);
  if (!parsed.success) return parsed.response;

  const { displayName, bio } = parsed.data;
  if (!displayName && bio === undefined) {
    return NextResponse.json(
      { error: "At least one field must be provided" },
      { status: 400 }
    );
  }

  const [updated] = await db
    .update(users)
    .set({
      ...(displayName && { displayName }),
      ...(bio !== undefined && { bio }),
    })
    .where(eq(users.id, user.id))
    .returning({
      id: users.id,
      displayName: users.displayName,
      bio: users.bio,
    });

  return NextResponse.json({ user: updated });
});
```

**Step 2: Commit**

```bash
git -c commit.gpgsign=false add src/app/api/v1/users/me/route.ts
git -c commit.gpgsign=false commit -m "feat: add user profile edit endpoint"
```

---

## Phase 5: Frontend Components (Tasks 11–16)

---

### Task 11: Badge Card Component with Shimmer Effect

**Files:**
- Create: `src/components/badges/badge-card.tsx`

**Step 1: Create the badge card with CSS shimmer animation**

```tsx
// src/components/badges/badge-card.tsx

const BADGE_ICONS: Record<string, string> = {
  pencil: "\u270F\uFE0F",
  library: "\uD83D\uDCDA",
  message: "\uD83D\uDCAC",
  messages: "\uD83D\uDCAC",
  "arrow-up": "\u2B06\uFE0F",
  flame: "\uD83D\uDD25",
  star: "\u2B50",
  crown: "\uD83D\uDC51",
};

type BadgeCardProps = {
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedAt?: string;
};

export function BadgeCard({ name, description, icon, earned, earnedAt }: BadgeCardProps) {
  if (!earned) {
    return (
      <div className="relative rounded-xl border border-border bg-card/50 p-4 opacity-40">
        <div className="mb-2 text-2xl grayscale">?</div>
        <div className="text-sm font-semibold text-muted-foreground">{name}</div>
        <div className="mt-0.5 text-xs text-muted-foreground/60">{description}</div>
      </div>
    );
  }

  return (
    <div className="badge-card group relative overflow-hidden rounded-xl border border-primary/20 bg-card p-4 transition-all duration-300 hover:scale-[1.03] hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10">
      {/* Shimmer overlay */}
      <div className="pointer-events-none absolute inset-0 badge-shimmer" />
      <div className="relative">
        <div className="mb-2 text-2xl">{BADGE_ICONS[icon] ?? "\uD83C\uDFC5"}</div>
        <div className="text-sm font-semibold text-foreground">{name}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
        {earnedAt && (
          <div className="mt-2 text-[10px] font-medium text-primary/70">
            Earned {new Date(earnedAt).toLocaleDateString()}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Add shimmer CSS to globals.css**

Add to `src/app/globals.css`:

```css
/* Badge shimmer effect */
.badge-shimmer {
  background: linear-gradient(
    110deg,
    transparent 25%,
    rgba(99, 110, 250, 0.08) 37%,
    rgba(176, 102, 254, 0.12) 50%,
    rgba(99, 110, 250, 0.08) 63%,
    transparent 75%
  );
  background-size: 250% 100%;
  animation: badge-shimmer 4s ease-in-out infinite;
}

@keyframes badge-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.badge-card:hover .badge-shimmer {
  animation-duration: 1.5s;
}
```

**Step 3: Commit**

```bash
git -c commit.gpgsign=false add src/components/badges/badge-card.tsx src/app/globals.css
git -c commit.gpgsign=false commit -m "feat: add badge card component with shimmer animation"
```

---

### Task 12: Notification Bell Component

**Files:**
- Create: `src/components/notifications/notification-bell.tsx`
- Create: `src/components/notifications/notification-dropdown.tsx`

**Step 1: Create the bell icon with unread count**

```tsx
// src/components/notifications/notification-bell.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { NotificationDropdown } from "./notification-dropdown";

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/notifications?limit=20");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    // Poll every 60 seconds
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  async function markAllRead() {
    try {
      await fetch("/api/v1/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // silently fail
    }
  }

  async function markRead(id: number) {
    try {
      await fetch("/api/v1/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // silently fail
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label="Notifications"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <NotificationDropdown
            notifications={notifications}
            loading={loading}
            onMarkAllRead={markAllRead}
            onMarkRead={markRead}
            onClose={() => setOpen(false)}
          />
        </>
      )}
    </div>
  );
}
```

**Step 2: Create the dropdown panel**

```tsx
// src/components/notifications/notification-dropdown.tsx
"use client";

type Notification = {
  id: number;
  type: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  read: boolean;
  createdAt: string;
};

type Props = {
  notifications: Notification[];
  loading: boolean;
  onMarkAllRead: () => void;
  onMarkRead: (id: number) => void;
  onClose: () => void;
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

const TYPE_ICONS: Record<string, string> = {
  post_comment: "\uD83D\uDCAC",
  comment_reply: "\u21A9\uFE0F",
  vote_milestone: "\uD83C\uDF89",
  badge_earned: "\uD83C\uDFC5",
};

export function NotificationDropdown({ notifications, loading, onMarkAllRead, onMarkRead, onClose }: Props) {
  return (
    <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-background shadow-xl">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-semibold">Notifications</span>
        <button
          onClick={onMarkAllRead}
          className="text-xs text-primary hover:text-primary/80 transition-colors"
        >
          Mark all read
        </button>
      </div>
      <div className="max-h-[400px] overflow-y-auto">
        {loading && notifications.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No notifications yet</div>
        ) : (
          notifications.map((n) => (
            <a
              key={n.id}
              href={n.linkUrl ?? "#"}
              onClick={() => {
                onMarkRead(n.id);
                onClose();
              }}
              className={`flex gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-accent ${
                !n.read ? "bg-primary/5" : ""
              }`}
            >
              <span className="shrink-0 text-base">{TYPE_ICONS[n.type] ?? "\uD83D\uDD14"}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <span className={`text-sm leading-snug ${!n.read ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                    {n.title}
                  </span>
                  {!n.read && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
              </div>
            </a>
          ))
        )}
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git -c commit.gpgsign=false add src/components/notifications/notification-bell.tsx src/components/notifications/notification-dropdown.tsx
git -c commit.gpgsign=false commit -m "feat: add notification bell and dropdown components"
```

---

### Task 13: Bookmark Button Component

**Files:**
- Create: `src/components/bookmarks/bookmark-button.tsx`

**Step 1: Create the toggle button**

```tsx
// src/components/bookmarks/bookmark-button.tsx
"use client";

import { useState, useTransition } from "react";

type BookmarkButtonProps = {
  postId: number;
  initialBookmarked?: boolean;
};

export function BookmarkButton({ postId, initialBookmarked = false }: BookmarkButtonProps) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [isPending, startTransition] = useTransition();

  function handleToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const previous = bookmarked;
    setBookmarked(!bookmarked);

    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId }),
        });
        if (!res.ok) setBookmarked(previous);
      } catch {
        setBookmarked(previous);
      }
    });
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`rounded p-1 transition-colors ${
        bookmarked
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground"
      }`}
      aria-label={bookmarked ? "Remove bookmark" : "Bookmark"}
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill={bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
      </svg>
    </button>
  );
}
```

**Step 2: Commit**

```bash
git -c commit.gpgsign=false add src/components/bookmarks/bookmark-button.tsx
git -c commit.gpgsign=false commit -m "feat: add bookmark toggle button component"
```

---

### Task 14: Human Profile Page

**Files:**
- Create: `src/app/(forum)/user/[id]/page.tsx`

**Step 1: Create the full profile page**

This is the largest component. It needs to:
- Fetch user data, reputation, badges (earned + all), posts, comments, bookmarks
- Show profile header with avatar, name, human badge, member since, bio
- Show stats row
- Show badge grid using `BadgeCard`
- Show tabbed content (Posts / Comments / Bookmarks)
- Show edit button if viewing own profile
- Call `checkAndAwardBadges(userId)` on load for backfill

The page is a Server Component. Tabs are implemented via URL search params (`?tab=comments`) for Server Component compatibility.

```tsx
// src/app/(forum)/user/[id]/page.tsx
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  users,
  reputation,
  posts,
  comments,
  bookmarks,
  badges,
  userBadges,
  domainCategories,
} from "@/lib/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { BadgeCard } from "@/components/badges/badge-card";
import { checkAndAwardBadges } from "@/lib/badges/check";

export default async function UserProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const userId = parseInt(id);
  if (isNaN(userId)) notFound();

  const [user] = await db
    .select({
      id: users.id,
      type: users.type,
      displayName: users.displayName,
      bio: users.bio,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || user.type !== "human") notFound();

  // Check and backfill badges
  await checkAndAwardBadges(userId);

  // Get session to check if viewing own profile
  let isOwner = false;
  try {
    const session = await auth();
    isOwner = (session?.user as any)?.dbId === userId;
  } catch {}

  // Fetch reputation
  const [rep] = await db
    .select()
    .from(reputation)
    .where(eq(reputation.userId, userId))
    .limit(1);

  // Fetch all badges + earned ones
  const allBadges = await db.select().from(badges);
  const earnedBadges = await db
    .select({
      badgeId: userBadges.badgeId,
      earnedAt: userBadges.earnedAt,
    })
    .from(userBadges)
    .where(eq(userBadges.userId, userId));
  const earnedMap = new Map(earnedBadges.map((e) => [e.badgeId, e.earnedAt]));

  // Stats
  const [postCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(posts)
    .where(eq(posts.authorId, userId));
  const [commentCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(comments)
    .where(eq(comments.authorId, userId));

  // Tab content
  const activeTab = tab ?? "posts";

  let tabContent: any[] = [];
  if (activeTab === "posts") {
    tabContent = await db
      .select({
        id: posts.id,
        title: posts.title,
        voteScore: posts.voteScore,
        createdAt: posts.createdAt,
        categoryName: domainCategories.name,
      })
      .from(posts)
      .leftJoin(domainCategories, eq(posts.domainCategoryId, domainCategories.id))
      .where(eq(posts.authorId, userId))
      .orderBy(desc(posts.createdAt))
      .limit(20);
  } else if (activeTab === "comments") {
    tabContent = await db
      .select({
        id: comments.id,
        body: comments.body,
        voteScore: comments.voteScore,
        createdAt: comments.createdAt,
        postId: comments.postId,
        postTitle: posts.title,
      })
      .from(comments)
      .leftJoin(posts, eq(comments.postId, posts.id))
      .where(eq(comments.authorId, userId))
      .orderBy(desc(comments.createdAt))
      .limit(20);
  } else if (activeTab === "bookmarks" && isOwner) {
    tabContent = await db
      .select({
        postId: bookmarks.postId,
        createdAt: bookmarks.createdAt,
        title: posts.title,
        voteScore: posts.voteScore,
        postCreatedAt: posts.createdAt,
      })
      .from(bookmarks)
      .innerJoin(posts, eq(bookmarks.postId, posts.id))
      .where(eq(bookmarks.userId, userId))
      .orderBy(desc(bookmarks.createdAt))
      .limit(20);
  }

  const tabs = [
    { key: "posts", label: "Posts", count: postCount?.count ?? 0 },
    { key: "comments", label: "Comments", count: commentCount?.count ?? 0 },
    ...(isOwner ? [{ key: "bookmarks", label: "Bookmarks", count: null }] : []),
  ];

  return (
    <div className="mx-auto max-w-[800px]">
      {/* Header */}
      <header className="mb-8 flex items-start gap-5">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="h-16 w-16 shrink-0 rounded-2xl" />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#636efa] to-[#b066fe] text-xl font-bold text-white">
            {user.displayName[0]?.toUpperCase() ?? "?"}
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">{user.displayName}</h1>
            <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600">
              Human
            </span>
          </div>
          {user.bio && (
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{user.bio}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Member since {user.createdAt.toLocaleDateString()}
          </p>
          {isOwner && (
            <Link
              href={`/user/${userId}/edit`}
              className="mt-2 inline-block rounded-lg border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Edit profile
            </Link>
          )}
        </div>
      </header>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <div className="font-mono text-lg font-semibold">{postCount?.count ?? 0}</div>
          <div className="text-[11px] text-muted-foreground">Posts</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <div className="font-mono text-lg font-semibold">{commentCount?.count ?? 0}</div>
          <div className="text-[11px] text-muted-foreground">Comments</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <div className="font-mono text-lg font-semibold">{rep?.totalScore ?? 0}</div>
          <div className="text-[11px] text-muted-foreground">Reputation</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <div className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            {rep?.level ?? "newcomer"}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">Level</div>
        </div>
      </div>

      {/* Badges */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">Badges</h2>
        <div className="grid grid-cols-4 gap-3">
          {allBadges.map((badge) => (
            <BadgeCard
              key={badge.id}
              name={badge.name}
              description={badge.description}
              icon={badge.icon}
              earned={earnedMap.has(badge.id)}
              earnedAt={earnedMap.get(badge.id)?.toISOString()}
            />
          ))}
        </div>
      </section>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/user/${userId}?tab=${t.key}`}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            {t.count !== null && (
              <span className="ml-1.5 text-xs text-muted-foreground">({t.count})</span>
            )}
          </Link>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "posts" && (
        <div className="space-y-2.5">
          {tabContent.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">No posts yet.</div>
          ) : (
            tabContent.map((post: any) => (
              <Link key={post.id} href={`/posts/${post.id}`} className="group block">
                <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <span className="font-mono text-sm font-semibold text-primary">{post.voteScore}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-foreground group-hover:text-primary transition-colors">{post.title}</div>
                    <div className="mt-0.5 flex gap-2 text-xs text-muted-foreground">
                      {post.categoryName && <span>{post.categoryName}</span>}
                      <span>{post.createdAt.toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      )}

      {activeTab === "comments" && (
        <div className="space-y-2.5">
          {tabContent.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">No comments yet.</div>
          ) : (
            tabContent.map((c: any) => (
              <Link key={c.id} href={`/posts/${c.postId}`} className="group block">
                <div className="rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40">
                  <div className="mb-1 text-xs text-muted-foreground">
                    on <span className="font-medium text-foreground">{c.postTitle}</span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{c.body}</p>
                  <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                    <span className="font-mono">{c.voteScore} votes</span>
                    <span>{c.createdAt.toLocaleDateString()}</span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      )}

      {activeTab === "bookmarks" && isOwner && (
        <div className="space-y-2.5">
          {tabContent.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">No bookmarks yet.</div>
          ) : (
            tabContent.map((b: any) => (
              <Link key={b.postId} href={`/posts/${b.postId}`} className="group block">
                <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <span className="font-mono text-sm font-semibold text-primary">{b.voteScore}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-foreground group-hover:text-primary transition-colors">{b.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      Bookmarked {b.createdAt.toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git -c commit.gpgsign=false add src/app/\(forum\)/user/\[id\]/page.tsx
git -c commit.gpgsign=false commit -m "feat: add human profile page with badges, tabs, stats"
```

---

### Task 15: Add Badges to Agent Profile Page

**Files:**
- Modify: `src/app/(forum)/agent/[id]/page.tsx`

**Step 1: Add badge grid to agent profile**

Import `BadgeCard` and `checkAndAwardBadges`. After the reputation section and before the Recent Posts section, add a badge grid using the same pattern as the human profile (fetch all badges + user's earned badges, render `BadgeCard` grid).

Also call `checkAndAwardBadges(userId)` near the top of the page function for backfill.

**Step 2: Commit**

```bash
git -c commit.gpgsign=false add src/app/\(forum\)/agent/\[id\]/page.tsx
git -c commit.gpgsign=false commit -m "feat: add badge grid to agent profile page"
```

---

### Task 16: Edit Profile Page

**Files:**
- Create: `src/app/(forum)/user/[id]/edit/page.tsx`

**Step 1: Create edit profile form**

A simple client component page with a form for `displayName` and `bio`. On submit, calls `PUT /api/v1/users/me`. On success, redirects back to the profile with `router.push()`.

Wrap in auth check — redirect to profile if not the owner.

```tsx
// src/app/(forum)/user/[id]/edit/page.tsx
"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter, useParams } from "next/navigation";

export default function EditProfilePage() {
  const params = useParams();
  const userId = params.id;
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Fetch current profile data
    fetch(`/api/v1/agents/${userId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.agent) {
          setDisplayName(data.agent.displayName ?? "");
          setBio(data.agent.bio ?? "");
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [userId]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/users/me", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayName, bio }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Failed to update profile");
          return;
        }

        router.push(`/user/${userId}`);
        router.refresh();
      } catch {
        setError("Network error. Please try again.");
      }
    });
  }

  if (!loaded) return <div className="animate-pulse p-8">Loading...</div>;

  return (
    <div className="mx-auto max-w-[600px]">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Edit Profile</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Display Name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={100}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={2000}
            rows={4}
            className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
          />
          <div className="mt-1 text-xs text-muted-foreground">{bio.length}/2000</div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git -c commit.gpgsign=false add src/app/\(forum\)/user/\[id\]/edit/page.tsx
git -c commit.gpgsign=false commit -m "feat: add edit profile page"
```

---

## Phase 6: Wire Everything into Existing UI (Tasks 17–19)

---

### Task 17: Add Notification Bell and Profile Link to Header

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/components/auth/session-user-menu.tsx`
- Modify: `src/components/auth/user-menu.tsx`

**Step 1: Update session-user-menu to pass dbId**

In `session-user-menu.tsx`, pass the user's `dbId` to `UserMenu`:

```tsx
export async function SessionUserMenu() {
  try {
    const session = await auth();
    const user = session?.user ?? null;
    const dbId = user ? (user as any).dbId : null;
    return <UserMenu user={user} dbId={dbId} />;
  } catch {
    return <UserMenu user={null} dbId={null} />;
  }
}
```

**Step 2: Update user-menu to add "My Profile" link**

In `user-menu.tsx`, accept `dbId` prop. In the dropdown, add a "My Profile" link above "Sign out":

```tsx
<a
  href={`/user/${dbId}`}
  className="block px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
>
  My Profile
</a>
```

**Step 3: Add NotificationBell to layout header**

In `src/app/layout.tsx`, import `NotificationBell` and add it inside the header's right-side div, before `<SessionUserMenu />`:

```tsx
import { NotificationBell } from "@/components/notifications/notification-bell";

// In the header div.ml-auto:
<NotificationBell />
<SessionUserMenu />
<ThemeToggle />
```

> **Note:** `NotificationBell` is a client component that fetches its own data via `fetch()`, so it works fine inside the server-rendered layout.

**Step 4: Commit**

```bash
git -c commit.gpgsign=false add src/app/layout.tsx src/components/auth/session-user-menu.tsx src/components/auth/user-menu.tsx
git -c commit.gpgsign=false commit -m "feat: add notification bell and profile link to header"
```

---

### Task 18: Add Author Profile Links and Bookmark Button to Post Cards

**Files:**
- Modify: `src/components/post/post-card.tsx`

**Step 1: Make author names link to profiles**

The `PostCard` component needs two new props: `authorId` and `authorType`. Use these to link author names:

- If `authorType === "agent"`: link to `/agent/${authorId}`
- If `authorType === "human"`: link to `/user/${authorId}`

Wrap the author name span in a `<Link>` with `onClick={(e) => e.stopPropagation()}` to prevent the parent Link from navigating.

**Step 2: Add BookmarkButton**

Add `<BookmarkButton postId={id} />` next to the vote buttons. Since `BookmarkButton` is a client component and handles its own click interception, it works inside the parent `<Link>`.

Add `authorId: number` to `PostCardProps` and pass it from all call sites (homepage, search, category, tag pages).

**Step 3: Commit**

```bash
git -c commit.gpgsign=false add src/components/post/post-card.tsx
git -c commit.gpgsign=false commit -m "feat: add author profile links and bookmark button to post cards"
```

---

### Task 19: Add Author Profile Links to Comment Thread

**Files:**
- Modify: `src/components/comment/comment-thread.tsx`

**Step 1: Make comment author names link to profiles**

Similar to post cards — the comment thread component already has `authorId` and `authorType` in the comment data. Wrap author names in `<Link>` pointing to the appropriate profile route.

**Step 2: Commit**

```bash
git -c commit.gpgsign=false add src/components/comment/comment-thread.tsx
git -c commit.gpgsign=false commit -m "feat: add author profile links to comment thread"
```

---

### Task 20: Build Verification and Push

**Step 1: Verify build**

Run: `npm run build`

Expected: Build succeeds with no errors.

**Step 2: Test locally**

Run: `npx next start -p 3333`

Verify:
- Homepage shows bookmark buttons on post cards
- Post cards have clickable author names linking to profiles
- `/user/[id]` shows human profile with badges, tabs
- `/agent/[id]` shows badge grid
- Notification bell appears in header (empty for now)
- Edit profile page works at `/user/[id]/edit`

**Step 3: Push to deploy**

```bash
git push
```

**Step 4: Commit (if any fixes needed)**

```bash
git -c commit.gpgsign=false add -A
git -c commit.gpgsign=false commit -m "fix: build and integration fixes for profiles feature"
git push
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| **1: Schema** | 1–2 | New tables + badge seed data |
| **2: Logic** | 3–4 | Badge checker + notification helper |
| **3: Wire routes** | 5–7 | Notifications on comments, votes, posts |
| **4: API endpoints** | 8–10 | Notification, bookmark, profile-edit APIs |
| **5: Components** | 11–16 | Badge card, bell, bookmark button, profile pages |
| **6: Integration** | 17–20 | Header wiring, author links, build verification |

**Total: 20 tasks, ~20 commits.**

**Parallelization:** Phases 1→2→3 are sequential (schema needed for logic, logic needed for routes). Phase 4 needs Phase 1 only. Phase 5 needs Phases 1+2. Phase 6 needs Phase 5. Best path: do 1→2→3 and 4 in sequence, then 5→6.
