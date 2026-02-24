# Deadline Fix, Spinner Verification & Topic Visibility — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the on-chain deadline race condition, verify spinner CSS works, and make topics visible across the entire UI including the site header.

**Architecture:** Single-computation deadline with ref storage; topic tabs in header as a new component; consistent `getTopicColor()` styling everywhere topics appear; tags sub-query added to search/bounty pages.

**Tech Stack:** Next.js 15 (App Router), React, Drizzle ORM, wagmi/viem, Tailwind CSS

---

### Task 1: Unify deadline computation with useRef

**Files:**
- Modify: `src/app/(forum)/bounties/new/page.tsx`

**Context:** The deadline is computed 3 times independently:
1. Line 201-203: For API bounty creation (no buffer)
2. Line 231-234: For on-chain `fundBounty` call (with 600s buffer)
3. Line 119-121: For `recordFunding` after tx confirmation (recomputed from `Date.now()`, no buffer)

All three must use the same buffered value.

**Step 1: Add a useRef import and deadline ref**

At line 2, `useRef` is not imported. Add it:
```typescript
import { useState, useEffect, useCallback, useRef } from "react";
```

Inside the component (after line 101), add:
```typescript
const deadlineMsRef = useRef<number>(0);
```

**Step 2: Compute deadline once in handleSubmit**

In `handleSubmit`, right after the `effectiveDays < 1` check (around line 184), add:
```typescript
    // Compute buffered deadline ONCE and store in ref for reuse
    const MEMPOOL_BUFFER_MS = 600_000; // 10 minutes in ms
    deadlineMsRef.current = Date.now() + effectiveDays * 86_400_000 + MEMPOOL_BUFFER_MS;
```

**Step 3: Use ref for API creation deadline**

Replace lines 201-203:
```typescript
                deadline: new Date(
                  Date.now() + effectiveDays * 24 * 60 * 60 * 1000
                ).toISOString(),
```
With:
```typescript
                deadline: new Date(deadlineMsRef.current).toISOString(),
```

**Step 4: Use ref for on-chain call**

Replace lines 227-234 (the entire MEMPOOL_BUFFER_SECS block and deadlineTimestamp computation):
```typescript
        // Add 10-minute buffer to account for mempool/block confirmation delay.
        // Without this, a 1-day deadline computed at time T can revert if
        // block.timestamp > T when the tx is mined (MIN_DEADLINE_OFFSET check).
        const MEMPOOL_BUFFER_SECS = 600;
        const deadlineTimestamp =
          Math.floor(
            (Date.now() + effectiveDays * 24 * 60 * 60 * 1000) / 1000
          ) + MEMPOOL_BUFFER_SECS;
```
With:
```typescript
        const deadlineTimestamp = Math.floor(deadlineMsRef.current / 1000);
```

**Step 5: Use ref for recordFunding**

Replace lines 119-121:
```typescript
        const deadlineDate = new Date(
          Date.now() + effectiveDays * 24 * 60 * 60 * 1000
        ).toISOString();
```
With:
```typescript
        const deadlineDate = new Date(deadlineMsRef.current).toISOString();
```

Also remove `effectiveDays` and `ethAmount` from the useEffect dependency array at line 152 since they're no longer used inside the effect. The `deadlineMsRef` is a ref and doesn't need to be a dependency. Keep `ethAmount` if it's still used (check: line 123 `parseEther(ethAmount)` — yes, keep `ethAmount`). Remove only `effectiveDays`.

**Step 6: Add pre-flight validation before on-chain tx**

In `handleSubmit`, right before `fund(bountyId, ethAmount, deadlineTimestamp)`, add:
```typescript
        // Pre-flight: verify deadline will pass contract check even if block is mined now
        const nowSecs = Math.floor(Date.now() / 1000);
        if (deadlineTimestamp < nowSecs + 86400 + 60) {
          setError("Deadline too close to pass on-chain validation. Please increase the deadline.");
          setSubmitting(false);
          return;
        }
```

**Step 7: Commit**

```bash
git add "src/app/(forum)/bounties/new/page.tsx"
git commit -m "fix: unify deadline computation with useRef to prevent race condition"
```

---

### Task 2: Add topic tabs to site header

**Files:**
- Modify: `src/app/(forum)/layout.tsx`

**Context:** The current header has: Logo, Search, New Post, Bounties, Digest, API, MobileNav, NotificationBell, WalletButton, SessionUserMenu, ThemeToggle. No topic navigation exists. The 4 topics are: Scale L1 (`scale-l1`), Scale L2 (`scale-l2`), Hardening (`hardening`), Misc (`misc`). Colors are in `src/lib/topic-colors.ts`.

**Step 1: Add topic tabs below the header**

Import `getTopicColor` at the top of the file:
```typescript
import { getTopicColor } from "@/lib/topic-colors";
```

After the closing `</header>` tag (before `<main>`), add a secondary nav bar:
```tsx
      <nav className="hidden md:block border-b border-border bg-background/80">
        <div className="mx-auto flex max-w-[1140px] items-center gap-1 px-7">
          {[
            { slug: "scale-l1", name: "Scale L1" },
            { slug: "scale-l2", name: "Scale L2" },
            { slug: "hardening", name: "Hardening" },
            { slug: "misc", name: "Misc" },
          ].map((topic) => {
            const color = getTopicColor(topic.slug);
            return (
              <Link
                key={topic.slug}
                href={`/topic/${topic.slug}`}
                className="group relative px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {topic.name}
                <span
                  className="absolute inset-x-3 bottom-0 h-0.5 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ backgroundColor: color.text }}
                />
              </Link>
            );
          })}
        </div>
      </nav>
```

**Step 2: Commit**

```bash
git add "src/app/(forum)/layout.tsx"
git commit -m "feat: add topic tabs to site header navigation"
```

---

### Task 3: Add topics to mobile nav

**Files:**
- Modify: `src/components/mobile-nav.tsx`

**Context:** `MobileNav` currently has 3 links (Bounties, Digest, API). Need to add topic links.

**Step 1: Add topic links to mobile nav**

Add a "Topics" section below the existing nav links, inside the dropdown `<nav>`:
```tsx
const TOPIC_LINKS = [
  { href: "/topic/scale-l1", label: "Scale L1" },
  { href: "/topic/scale-l2", label: "Scale L2" },
  { href: "/topic/hardening", label: "Hardening" },
  { href: "/topic/misc", label: "Misc" },
];
```

Inside the dropdown, after the existing `NAV_LINKS.map(...)`, add:
```tsx
              <div className="mt-2 border-t border-border pt-2">
                <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Topics</span>
                {TOPIC_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
```

**Step 2: Commit**

```bash
git add src/components/mobile-nav.tsx
git commit -m "feat: add topic links to mobile navigation"
```

---

### Task 4: Fix search results — pass tags to PostCard

**Files:**
- Modify: `src/app/(forum)/search/page.tsx`

**Context:** The search query (lines 57-81) already joins topics and returns `topicName`/`topicSlug`. But it doesn't fetch tags and doesn't pass `tags` to PostCard. The homepage uses this sub-query pattern:
```sql
COALESCE((SELECT json_agg(json_build_object('name', t.name, 'slug', t.slug)) FROM post_tags pt JOIN tags t ON pt.tag_id = t.id WHERE pt.post_id = posts.id), '[]')
```

**Step 1: Add tags sub-query and body preview**

Import `tags as tagsTable` and `postTags` from the schema (check which are already imported). Add to the select:
```typescript
        tags: sql<string>`COALESCE((SELECT json_agg(json_build_object('name', t.name, 'slug', t.slug)) FROM post_tags pt JOIN tags t ON pt.tag_id = t.id WHERE pt.post_id = ${posts.id}), '[]')`.as("tags"),
        bodyPreview: posts.body,
```

**Step 2: Pass tags and bodyPreview to PostCard**

In the PostCard usage (lines 103-118), add:
```tsx
              tags={typeof post.tags === 'string' ? JSON.parse(post.tags) : post.tags}
              bodyPreview={post.bodyPreview?.slice(0, 200) ?? null}
```

**Step 3: Commit**

```bash
git add "src/app/(forum)/search/page.tsx"
git commit -m "feat: pass tags and body preview to PostCard in search results"
```

---

### Task 5: Style topic badges on user profile

**Files:**
- Modify: `src/app/(forum)/user/[id]/page.tsx`

**Context:** The user profile (line 137-139) shows topic as plain text:
```tsx
<span className="rounded-md border border-border px-1.5 py-0.5 font-mono text-[11px]">{post.topicName}</span>
```
Should use `getTopicColor()` for consistent styling.

**Step 1: Import getTopicColor**

Add at top:
```typescript
import { getTopicColor } from "@/lib/topic-colors";
```

**Step 2: Add topicSlug to query**

In the select (line 118), add:
```typescript
        topicSlug: topics.slug,
```

**Step 3: Replace plain text badge with styled badge**

Replace line 138:
```tsx
<span className="rounded-md border border-border px-1.5 py-0.5 font-mono text-[11px]">{post.topicName}</span>
```
With:
```tsx
<span
  className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
  style={{ backgroundColor: getTopicColor(post.topicSlug).bg, color: getTopicColor(post.topicSlug).text }}
>
  {post.topicName}
</span>
```

**Step 4: Commit**

```bash
git add "src/app/(forum)/user/[id]/page.tsx"
git commit -m "feat: style topic badges with color on user profile"
```

---

### Task 6: Style topic badges on welcome page

**Files:**
- Modify: `src/app/welcome/page.tsx`

**Context:** The welcome page (line 188-190) shows topic as plain text:
```tsx
<span className="ml-1 rounded bg-secondary px-1 py-0.5 text-[9px]">{p.topicName}</span>
```

**Step 1: Import getTopicColor**

Add at top:
```typescript
import { getTopicColor } from "@/lib/topic-colors";
```

**Step 2: Add topicSlug to query**

Check the query for the trending posts. It should already have `topicName`. Add `topicSlug: topics.slug` if not present.

**Step 3: Replace plain badge with styled badge**

Replace line 189:
```tsx
<span className="ml-1 rounded bg-secondary px-1 py-0.5 text-[9px]">{p.topicName}</span>
```
With:
```tsx
<span
  className="ml-1 rounded px-1 py-0.5 text-[9px] font-semibold"
  style={{ backgroundColor: getTopicColor(p.topicSlug).bg, color: getTopicColor(p.topicSlug).text }}
>
  {p.topicName}
</span>
```

**Step 4: Commit**

```bash
git add src/app/welcome/page.tsx
git commit -m "feat: style topic badges with color on welcome page"
```

---

### Task 7: Add tags to bounty listing page

**Files:**
- Modify: `src/app/(forum)/bounties/page.tsx`

**Context:** The bounty listing query (lines 88-104) doesn't fetch tags. The bounty card (lines 175-199) shows topic badge but no tags.

**Step 1: Add tags sub-query to bounty listing query**

In the select object, add:
```typescript
        tags: sql<string>`COALESCE((SELECT json_agg(json_build_object('name', t.name, 'slug', t.slug)) FROM bounty_tags bt JOIN tags t ON bt.tag_id = t.id WHERE bt.bounty_id = ${bounties.id}), '[]')`.as("tags"),
```

**Step 2: Render tags in bounty card**

After the topic badge (around line 192), add tag chips:
```tsx
                      {(() => {
                        const parsedTags = typeof bounty.tags === 'string' ? JSON.parse(bounty.tags) : bounty.tags;
                        return parsedTags?.slice(0, 3).map((tag: { name: string; slug: string }) => (
                          <Link
                            key={tag.slug}
                            href={`/tag/${tag.slug}`}
                            className="rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
                          >
                            {tag.name}
                          </Link>
                        ));
                      })()}
```

**Step 3: Commit**

```bash
git add "src/app/(forum)/bounties/page.tsx"
git commit -m "feat: display tags on bounty listing cards"
```

---

### Task 8: Add tags to bounty detail page

**Files:**
- Modify: `src/app/(forum)/bounties/[id]/page.tsx`

**Context:** The bounty detail query (lines 55-78) fetches topic but not tags.

**Step 1: Add tags sub-query**

In the bounty select (line 72 area), add:
```typescript
      tags: sql<string>`COALESCE((SELECT json_agg(json_build_object('name', t.name, 'slug', t.slug)) FROM bounty_tags bt JOIN tags t ON bt.tag_id = t.id WHERE bt.bounty_id = ${bounties.id}), '[]')`.as("tags"),
```

**Step 2: Render tags after the topic badge in the bounty header**

Find where `topicName` is rendered (around line 155-161) and add tags after it:
```tsx
                    {(() => {
                      const parsedTags = typeof bounty.tags === 'string' ? JSON.parse(bounty.tags) : bounty.tags;
                      return parsedTags?.map((tag: { name: string; slug: string }) => (
                        <Link
                          key={tag.slug}
                          href={`/tag/${tag.slug}`}
                          className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {tag.name}
                        </Link>
                      ));
                    })()}
```

**Step 3: Commit**

```bash
git add "src/app/(forum)/bounties/[id]/page.tsx"
git commit -m "feat: display tags on bounty detail page"
```

---

### Task 9: Verify spinner CSS deployment

**Files:**
- Check: `src/app/globals.css` (lines 129-137)

**Context:** The CSS to hide number input spinners already exists. This task is about verifying it works after build.

**Step 1: Verify the CSS is present and correct**

Read `src/app/globals.css` and confirm lines 129-137 contain:
```css
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type="number"] {
  -moz-appearance: textfield;
}
```

**Step 2: Run a build to verify no CSS issues**

```bash
npx next build 2>&1 | tail -20
```

If the build passes, the CSS is correct and will deploy. If spinners persist after deployment, it's a browser cache issue.

**Step 3: Commit (only if changes were needed)**

No commit needed if CSS is already correct.
