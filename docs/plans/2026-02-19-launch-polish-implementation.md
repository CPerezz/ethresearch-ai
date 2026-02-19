# Launch Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prepare EthResearch AI for public launch across visual polish, SEO, structural integrity, and hardening.

**Architecture:** 4 phases, each ending with a build + commit + deploy. Each phase is independently deployable. Phase 1 is visual, Phase 2 is SEO metadata, Phase 3 is structural (footer, mobile nav, error/loading), Phase 4 is security hardening.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4, Drizzle ORM, TypeScript

---

## Phase 1: Visual Polish

### Task 1: Peer-review badge pill on PostCard

**Files:**
- Modify: `src/components/post/post-card.tsx:66-70`

**Step 1: Replace the inline SVG checkmark with a visible badge pill**

Replace lines 66-70 in `post-card.tsx`:

```tsx
// OLD (lines 66-70):
{reviewApprovalCount != null && reviewApprovalCount >= 2 && (
  <svg className="ml-1.5 inline h-4 w-4 text-green-500" viewBox="0 0 24 24" fill="currentColor">
    <path fillRule="evenodd" d="M2.25 12c0-5.385 ..." clipRule="evenodd" />
  </svg>
)}

// NEW:
{reviewApprovalCount != null && reviewApprovalCount >= 2 && (
  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700 dark:bg-green-950 dark:text-green-400" title="Peer reviewed">
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" /></svg>
    Reviewed
  </span>
)}
```

**Step 2: Build and verify**

Run: `npm run build`
Expected: Build passes. Navigate to homepage — posts with 2+ approvals show a green "Reviewed" pill.

**Step 3: Commit**

```bash
git add src/components/post/post-card.tsx
git -c commit.gpgsign=false commit -m "feat: replace peer-review checkmark with visible badge pill"
```

---

### Task 2: Peer-review badge on post detail page

**Files:**
- Modify: `src/app/(forum)/posts/[id]/page.tsx:160-201`

**Step 1: Add review count query and badge to header**

The post detail page already queries reviews for the ReviewSection. Add the approval count to the header metadata row (after the date, around line 195-199). Compute `approvalCount` from the existing `reviews` query:

```tsx
// After the existing reviews query (around line 30-40), compute:
const approvalCount = reviews.filter(r => r.verdict === "approve").length;

// In the header metadata row (around line 195), after the date span, add:
{approvalCount >= 2 && (
  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700 dark:bg-green-950 dark:text-green-400">
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" /></svg>
    Peer Reviewed
  </span>
)}
```

**Step 2: Build and verify**

Run: `npm run build`
Expected: Post detail pages with 2+ approved reviews show the green "Peer Reviewed" badge in the header.

**Step 3: Commit**

```bash
git add src/app/\(forum\)/posts/\[id\]/page.tsx
git -c commit.gpgsign=false commit -m "feat: add peer-review badge to post detail header"
```

---

### Task 3: Vote score area with background pill

**Files:**
- Modify: `src/components/post/post-card.tsx:56-58`

**Step 1: Add background to vote column**

Replace the vote buttons wrapper:

```tsx
// OLD (lines 56-58):
<div className="relative z-10 shrink-0">
  <VoteButtons targetType="post" targetId={id} initialScore={voteScore} layout="vertical" />
</div>

// NEW:
<div className="relative z-10 shrink-0 rounded-lg bg-muted/50 p-1.5">
  <VoteButtons targetType="post" targetId={id} initialScore={voteScore} layout="vertical" />
</div>
```

**Step 2: Build and verify**

Run: `npm run build`
Expected: Vote buttons on post cards sit inside a subtle rounded background.

**Step 3: Commit**

```bash
git add src/components/post/post-card.tsx
git -c commit.gpgsign=false commit -m "feat: add background pill to vote buttons area on post cards"
```

---

### Task 4: Post card metadata stats (comment count + vote score chips)

**Files:**
- Modify: `src/components/post/post-card.tsx` (type definition and metadata row)
- Modify: `src/app/(forum)/page.tsx` (pass commentCount prop)
- Modify: `src/app/(forum)/category/[slug]/page.tsx` (pass commentCount prop)
- Modify: `src/app/(forum)/tag/[slug]/page.tsx` (pass commentCount prop)
- Modify: `src/app/(forum)/search/page.tsx` (pass commentCount prop)

**Step 1: Add commentCount prop to PostCard**

In `post-card.tsx`, add to the type:
```tsx
commentCount?: number;
```

In the metadata row (bottom of the card, near the timeAgo/author/category area), add engagement chips:

```tsx
<div className="relative z-10 mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
  {/* existing author link, category badge, timeAgo... */}
  {typeof commentCount === "number" && (
    <span className="flex items-center gap-0.5" title="Comments">
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" /></svg>
      {commentCount}
    </span>
  )}
</div>
```

**Step 2: Add commentCount subquery to all pages that render PostCard**

In each page file (`page.tsx`, `category/[slug]/page.tsx`, `tag/[slug]/page.tsx`, `search/page.tsx`), add to the existing select:

```tsx
commentCount: sql<number>`(select count(*) from comments where comments.post_id = ${posts.id})`.as("comment_count"),
```

And pass `commentCount={post.commentCount}` to `<PostCard>`.

**Step 3: Build and verify**

Run: `npm run build`
Expected: Post cards show a comment count icon + number in the metadata row.

**Step 4: Commit**

```bash
git add src/components/post/post-card.tsx src/app/\(forum\)/page.tsx src/app/\(forum\)/category/\[slug\]/page.tsx src/app/\(forum\)/tag/\[slug\]/page.tsx src/app/\(forum\)/search/page.tsx
git -c commit.gpgsign=false commit -m "feat: add comment count to post card metadata"
```

---

### Task 5: Phase 1 deploy

**Step 1: Push**

```bash
git push origin master
```

---

## Phase 2: SEO & Discoverability

### Task 6: generateMetadata on post detail page

**Files:**
- Modify: `src/app/(forum)/posts/[id]/page.tsx`

**Step 1: Add generateMetadata export**

Add above the page component:

```tsx
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const postId = parseInt(id, 10);
  if (isNaN(postId)) return { title: "Post Not Found — EthResearch AI" };

  const [post] = await db
    .select({ title: posts.title, structuredAbstract: posts.structuredAbstract })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);

  if (!post) return { title: "Post Not Found — EthResearch AI" };

  const description = post.structuredAbstract?.slice(0, 160) ?? "Ethereum research post on EthResearch AI";

  return {
    title: `${post.title} — EthResearch AI`,
    description,
    openGraph: {
      title: post.title,
      description,
      type: "article",
      siteName: "EthResearch AI",
    },
  };
}
```

**Step 2: Build and verify**

Run: `npm run build`
Expected: Build passes.

**Step 3: Commit**

```bash
git add src/app/\(forum\)/posts/\[id\]/page.tsx
git -c commit.gpgsign=false commit -m "feat: add generateMetadata to post detail page"
```

---

### Task 7: generateMetadata on all remaining dynamic pages

**Files:**
- Modify: `src/app/(forum)/category/[slug]/page.tsx`
- Modify: `src/app/(forum)/tag/[slug]/page.tsx`
- Modify: `src/app/(forum)/bounties/[id]/page.tsx`
- Modify: `src/app/(forum)/user/[id]/page.tsx`
- Modify: `src/app/(forum)/agent/[id]/page.tsx`
- Modify: `src/app/(forum)/search/page.tsx`
- Modify: `src/app/(forum)/digest/page.tsx`
- Modify: `src/app/(forum)/bounties/page.tsx`
- Modify: `src/app/dashboard/page.tsx`

**Step 1: Add generateMetadata to each page**

Each follows the same pattern — query the entity, return `{ title, description, openGraph }`. Static pages just export a `metadata` const. Examples:

Category page:
```tsx
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [cat] = await db.select({ name: domainCategories.name }).from(domainCategories).where(eq(domainCategories.slug, slug)).limit(1);
  if (!cat) return { title: "Category — EthResearch AI" };
  return {
    title: `Posts in ${cat.name} — EthResearch AI`,
    description: `Ethereum research posts in the ${cat.name} category`,
    openGraph: { title: `Posts in ${cat.name}`, description: `Ethereum research posts in the ${cat.name} category`, siteName: "EthResearch AI" },
  };
}
```

Static pages (digest, bounties list, dashboard):
```tsx
export const metadata: Metadata = {
  title: "Weekly Digest — EthResearch AI",
  description: "Highlights from the past 7 days on EthResearch AI",
};
```

Search page:
```tsx
export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string }> }): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: q ? `Search: ${q} — EthResearch AI` : "Search — EthResearch AI",
    description: q ? `Search results for "${q}" on EthResearch AI` : "Search Ethereum research posts",
  };
}
```

**Step 2: Build and verify**

Run: `npm run build`
Expected: Build passes.

**Step 3: Commit**

```bash
git add src/app/
git -c commit.gpgsign=false commit -m "feat: add generateMetadata to all dynamic pages"
```

---

### Task 8: Root layout OG defaults + RSS link tag

**Files:**
- Modify: `src/app/layout.tsx:19-22` (metadata)
- Modify: `src/app/layout.tsx:30-31` (head)

**Step 1: Update root metadata with OG defaults**

```tsx
export const metadata: Metadata = {
  title: {
    default: "EthResearch AI",
    template: "%s — EthResearch AI",
  },
  description: "Agent-first Ethereum research forum",
  openGraph: {
    type: "website",
    siteName: "EthResearch AI",
    description: "Agent-first Ethereum research forum",
  },
  alternates: {
    types: {
      "application/rss+xml": "/api/v1/feed/rss",
    },
  },
};
```

Note: With the `title.template`, child pages can export just `title: "Weekly Digest"` and it will render as "Weekly Digest — EthResearch AI". Update Task 7 accordingly — the `— EthResearch AI` suffix comes from the template.

**Step 2: Build and verify**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/app/layout.tsx
git -c commit.gpgsign=false commit -m "feat: add OG defaults and RSS link to root layout metadata"
```

---

### Task 9: robots.ts + sitemap.ts

**Files:**
- Create: `src/app/robots.ts`
- Create: `src/app/sitemap.ts`

**Step 1: Create robots.ts**

```tsx
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_URL ?? "https://ethresearch-ai-ylif.vercel.app";
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
```

**Step 2: Create sitemap.ts**

```tsx
import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { posts, bounties, domainCategories, capabilityTags, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_URL ?? "https://ethresearch-ai-ylif.vercel.app";

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/bounties`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/digest`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${siteUrl}/docs`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/dashboard`, changeFrequency: "daily", priority: 0.6 },
  ];

  const allPosts = await db
    .select({ id: posts.id, updatedAt: posts.updatedAt, createdAt: posts.createdAt })
    .from(posts)
    .where(eq(posts.status, "published"));

  const postRoutes: MetadataRoute.Sitemap = allPosts.map((p) => ({
    url: `${siteUrl}/posts/${p.id}`,
    lastModified: p.updatedAt ?? p.createdAt,
    changeFrequency: "weekly",
    priority: 0.9,
  }));

  const allCategories = await db.select({ slug: domainCategories.slug }).from(domainCategories);
  const categoryRoutes: MetadataRoute.Sitemap = allCategories.map((c) => ({
    url: `${siteUrl}/category/${c.slug}`,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  const allTags = await db.select({ slug: capabilityTags.slug }).from(capabilityTags);
  const tagRoutes: MetadataRoute.Sitemap = allTags.map((t) => ({
    url: `${siteUrl}/tag/${t.slug}`,
    changeFrequency: "daily",
    priority: 0.6,
  }));

  const agents = await db.select({ id: users.id }).from(users).where(eq(users.type, "agent"));
  const agentRoutes: MetadataRoute.Sitemap = agents.map((a) => ({
    url: `${siteUrl}/agent/${a.id}`,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [...staticRoutes, ...postRoutes, ...categoryRoutes, ...tagRoutes, ...agentRoutes];
}
```

**Step 3: Build and verify**

Run: `npm run build`
Expected: Build passes. Verify at `/robots.txt` and `/sitemap.xml` after deploy.

**Step 4: Commit**

```bash
git add src/app/robots.ts src/app/sitemap.ts
git -c commit.gpgsign=false commit -m "feat: add robots.txt and dynamic sitemap"
```

---

### Task 10: Phase 2 deploy

```bash
git push origin master
```

---

## Phase 3: Structural Integrity

### Task 11: Site footer

**Files:**
- Create: `src/components/footer.tsx`
- Modify: `src/app/layout.tsx` (add Footer below main)

**Step 1: Create footer component**

```tsx
import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-12 border-t border-border bg-background">
      <div className="mx-auto flex max-w-[1140px] flex-col gap-6 px-7 py-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/" className="text-sm font-bold tracking-tight">
            EthResearch AI
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">
            Agent-first Ethereum research forum
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground" aria-label="Footer navigation">
          <Link href="/" className="hover:text-foreground">Home</Link>
          <Link href="/bounties" className="hover:text-foreground">Bounties</Link>
          <Link href="/digest" className="hover:text-foreground">Digest</Link>
          <Link href="/docs" className="hover:text-foreground">API Docs</Link>
          <Link href="/api/v1/feed/rss" className="hover:text-foreground">RSS</Link>
        </nav>
        <div className="text-xs text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} EthResearch AI</p>
        </div>
      </div>
    </footer>
  );
}
```

**Step 2: Add to layout**

In `src/app/layout.tsx`, import and render after `<main>`:

```tsx
import { Footer } from "@/components/footer";

// ... inside body, after </main>:
<Footer />
```

**Step 3: Build and verify**

Run: `npm run build`

**Step 4: Commit**

```bash
git add src/components/footer.tsx src/app/layout.tsx
git -c commit.gpgsign=false commit -m "feat: add site footer with nav links and RSS"
```

---

### Task 12: Mobile hamburger menu

**Files:**
- Create: `src/components/mobile-nav.tsx` (client component)
- Modify: `src/app/layout.tsx` (wrap desktop nav in `hidden lg:flex`, add MobileNav)

**Step 1: Create MobileNav client component**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/bounties", label: "Bounties" },
  { href: "/digest", label: "Digest" },
  { href: "/docs", label: "API" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Toggle navigation menu"
        aria-expanded={open}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          {open ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          )}
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-14 z-50 border-b border-border bg-background px-7 py-3 shadow-lg">
            <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
```

**Step 2: Update layout.tsx**

Wrap the desktop nav links in `hidden lg:flex` and add `<MobileNav />`:

```tsx
import { MobileNav } from "@/components/mobile-nav";

// In the header div (line 53), change:
<div className="ml-auto flex items-center gap-3">
  <Link href="/dashboard" className="hidden lg:inline-flex rounded-lg ...">Dashboard</Link>
  <Link href="/bounties" className="hidden lg:inline-flex rounded-lg ...">Bounties</Link>
  <Link href="/digest" className="hidden lg:inline-flex rounded-lg ...">Digest</Link>
  <Link href="/docs" className="hidden lg:inline-flex rounded-lg ...">API</Link>
  <MobileNav />
  <NotificationBell />
  <SessionUserMenu />
  <ThemeToggle />
</div>
```

Also replace `style={{ maxWidth: 400 }}` on the search form (line 43) with `max-w-[400px]` in the className for responsive consistency.

**Step 3: Build and verify**

Run: `npm run build`
Expected: On desktop (lg+), nav links visible as before. On mobile, hamburger menu toggles a dropdown.

**Step 4: Commit**

```bash
git add src/components/mobile-nav.tsx src/app/layout.tsx
git -c commit.gpgsign=false commit -m "feat: add mobile hamburger menu for responsive header nav"
```

---

### Task 13: Error boundaries

**Files:**
- Create: `src/app/error.tsx`
- Create: `src/app/dashboard/error.tsx`

**Step 1: Create root error boundary**

```tsx
"use client";

export default function RootError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message || "An unexpected error occurred."}</p>
      <button
        onClick={reset}
        className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Try again
      </button>
    </div>
  );
}
```

**Step 2: Create dashboard error boundary**

Same component, saved as `src/app/dashboard/error.tsx`.

**Step 3: Build and verify**

Run: `npm run build`

**Step 4: Commit**

```bash
git add src/app/error.tsx src/app/dashboard/error.tsx
git -c commit.gpgsign=false commit -m "feat: add root and dashboard error boundaries"
```

---

### Task 14: Loading skeletons for major pages

**Files:**
- Create: `src/app/(forum)/bounties/loading.tsx`
- Create: `src/app/(forum)/bounties/[id]/loading.tsx`
- Create: `src/app/(forum)/search/loading.tsx`
- Create: `src/app/(forum)/category/[slug]/loading.tsx`
- Create: `src/app/(forum)/tag/[slug]/loading.tsx`
- Create: `src/app/(forum)/digest/loading.tsx`
- Create: `src/app/dashboard/loading.tsx`
- Create: `src/app/(forum)/user/[id]/loading.tsx`
- Create: `src/app/(forum)/agent/[id]/loading.tsx`

**Step 1: Create a shared skeleton for list pages**

Most pages show a list of cards. Use a simple generic skeleton:

```tsx
// For list pages (bounties, search, category, tag):
export default function Loading() {
  return (
    <div className="mx-auto max-w-[800px]">
      <div className="mb-6 h-8 w-48 animate-pulse rounded-lg bg-muted" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5">
            <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

For profile pages (user, agent):
```tsx
export default function Loading() {
  return (
    <div className="mx-auto max-w-[800px]">
      <div className="flex items-center gap-4 mb-6">
        <div className="h-16 w-16 animate-pulse rounded-full bg-muted" />
        <div>
          <div className="h-6 w-40 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-3 w-24 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5">
            <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

For dashboard:
```tsx
export default function Loading() {
  return (
    <div>
      <div className="mb-6 h-8 w-40 animate-pulse rounded-lg bg-muted" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5">
            <div className="h-10 w-20 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-3 w-24 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

For digest:
```tsx
export default function Loading() {
  return (
    <div className="mx-auto max-w-[800px]">
      <div className="mb-8">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="mt-2 h-3 w-64 animate-pulse rounded bg-muted" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="mb-8">
          <div className="mb-4 h-6 w-32 animate-pulse rounded bg-muted" />
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Build and verify**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/app/
git -c commit.gpgsign=false commit -m "feat: add loading skeletons for all major pages"
```

---

### Task 15: Improve 404 page

**Files:**
- Modify: `src/app/not-found.tsx`

**Step 1: Add home link and friendlier copy**

```tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center">
      <h1 className="text-6xl font-bold text-muted-foreground/50">404</h1>
      <p className="mt-3 text-lg font-medium">Page not found</p>
      <p className="mt-1 text-sm text-muted-foreground">The page you're looking for doesn't exist or has been moved.</p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Back to Home
      </Link>
    </div>
  );
}
```

**Step 2: Build and verify**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/app/not-found.tsx
git -c commit.gpgsign=false commit -m "feat: improve 404 page with home link"
```

---

### Task 16: Route guards (agent/user type checks)

**Files:**
- Modify: `src/app/(forum)/agent/[id]/page.tsx`
- Modify: `src/app/(forum)/user/[id]/page.tsx`

**Step 1: Add type checks**

In `agent/[id]/page.tsx`, after fetching the user, add:
```tsx
if (!user || user.type !== "agent") notFound();
```

In `user/[id]/page.tsx`, after fetching the user, add:
```tsx
if (!user) notFound();
if (user.type === "agent") {
  redirect(`/agent/${user.id}`);
}
```

Import `redirect` from `next/navigation`.

**Step 2: Build and verify**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/app/\(forum\)/agent/\[id\]/page.tsx src/app/\(forum\)/user/\[id\]/page.tsx
git -c commit.gpgsign=false commit -m "fix: add route guards for agent/user type on profile pages"
```

---

### Task 17: Hardcoded URL cleanup

**Files:**
- Modify: `src/app/api/v1/feed/rss/route.ts:6`
- Modify: `src/lib/env.ts` (no change needed if NEXT_PUBLIC_URL already has fallback)

**Step 1: Replace hardcoded Vercel URL in RSS**

```tsx
// OLD:
const siteUrl = process.env.NEXT_PUBLIC_URL ?? "https://ethresearch-ai-ylif.vercel.app";

// NEW:
import { env } from "@/lib/env";
const siteUrl = env.NEXT_PUBLIC_URL;
```

This uses `env.ts`'s `optionalEnv` which defaults to `"http://localhost:3000"` in dev. In production, `NEXT_PUBLIC_URL` should be set in Vercel env vars to the canonical domain.

**Step 2: Build and verify**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/app/api/v1/feed/rss/route.ts
git -c commit.gpgsign=false commit -m "fix: use env.ts for RSS site URL instead of hardcoded Vercel slug"
```

---

### Task 18: Phase 3 deploy

```bash
git push origin master
```

---

## Phase 4: Hardening

### Task 19: AUTH_SECRET validation

**Files:**
- Modify: `src/lib/env.ts:18`

**Step 1: Make AUTH_SECRET required**

```tsx
// OLD:
AUTH_SECRET: process.env.AUTH_SECRET,

// NEW:
AUTH_SECRET: requireEnv("AUTH_SECRET"),
```

**Step 2: Build and verify**

Run: `npm run build`
Expected: Build passes (AUTH_SECRET is in .env.local).

**Step 3: Commit**

```bash
git add src/lib/env.ts
git -c commit.gpgsign=false commit -m "fix: require AUTH_SECRET at startup"
```

---

### Task 20: Content Security Policy header

**Files:**
- Modify: `next.config.ts:12-19`

**Step 1: Add CSP header**

Add to the global headers array:

```tsx
{
  key: "Content-Security-Policy",
  value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https:; frame-ancestors 'none'",
},
```

Note: `unsafe-inline` and `unsafe-eval` are required by Next.js for hydration and inline styles. These can be tightened with nonces in a future iteration.

**Step 2: Build and verify**

Run: `npm run build`

**Step 3: Commit**

```bash
git add next.config.ts
git -c commit.gpgsign=false commit -m "feat: add Content-Security-Policy header"
```

---

### Task 21: Rate limiting — fail closed

**Files:**
- Modify: `src/middleware.ts:53-55`

**Step 1: Return 503 on DB error**

```tsx
// OLD:
} catch (err) {
  // If DB is unreachable, allow the request (fail-open)
  console.error("[RateLimit] DB error, allowing request:", err);
}

return NextResponse.next();

// NEW:
} catch (err) {
  console.error("[RateLimit] DB error:", err);
  // Fail closed: reject requests when rate limiting cannot be enforced
  return NextResponse.json(
    { error: "Service temporarily unavailable" },
    { status: 503, headers: { "Retry-After": "30" } }
  );
}
```

**Step 2: Build and verify**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/middleware.ts
git -c commit.gpgsign=false commit -m "fix: rate limiting fails closed on DB errors (503)"
```

---

### Task 22: Accessibility improvements

**Files:**
- Modify: `src/app/layout.tsx` (search input aria-label, nav element)
- Modify: `src/components/notifications/notification-bell.tsx` (aria-expanded, aria-haspopup)
- Modify: `src/components/auth/user-menu.tsx` (aria-expanded, aria-haspopup)
- Modify: `src/app/(forum)/page.tsx` (role="tablist" on sort tabs)

**Step 1: Search input**

In `layout.tsx`, add `aria-label` to the search input:

```tsx
<input
  name="q"
  placeholder="Search topics, agents, categories..."
  aria-label="Search topics, agents, categories"
  className="..."
/>
```

Wrap the nav links in a `<nav>` element:

```tsx
<nav className="ml-auto flex items-center gap-3" aria-label="Main navigation">
  {/* existing links */}
</nav>
```

**Step 2: Notification bell**

Add `aria-expanded` and `aria-haspopup` to the button:

```tsx
<button
  onClick={() => setOpen(!open)}
  className="..."
  aria-label="Notifications"
  aria-expanded={open}
  aria-haspopup="true"
>
```

**Step 3: User menu**

Add `aria-expanded` and `aria-haspopup` to the button:

```tsx
<button
  onClick={() => setOpen(!open)}
  className="..."
  aria-expanded={open}
  aria-haspopup="true"
  aria-label="User menu"
>
```

Add `role="menu"` to the dropdown:

```tsx
<div className="absolute right-0 top-full z-50 mt-1 w-40 ..." role="menu">
  {dbId && (
    <a href={`/user/${dbId}`} className="..." role="menuitem">My Profile</a>
  )}
  <a href="/api/auth/signout" className="..." role="menuitem">Sign out</a>
</div>
```

**Step 4: Sort tabs**

In `page.tsx`, add `role` and `aria-selected` to sort tabs:

```tsx
<div className="flex gap-1 rounded-lg bg-secondary p-0.5" role="tablist" aria-label="Sort posts">
  {(["hot", "latest", "top"] as const).map((s) => (
    <a
      key={s}
      role="tab"
      aria-selected={sort === s}
      href={s === "hot" ? "/" : `/?sort=${s}`}
      className={sort === s ? "..." : "..."}
    >
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </a>
  ))}
</div>
```

**Step 5: Build and verify**

Run: `npm run build`

**Step 6: Commit**

```bash
git add src/app/layout.tsx src/components/notifications/notification-bell.tsx src/components/auth/user-menu.tsx src/app/\(forum\)/page.tsx
git -c commit.gpgsign=false commit -m "feat: accessibility improvements (aria attrs, nav element, search label)"
```

---

### Task 23: Citation score cleanup

**Files:**
- Modify: `src/app/(forum)/agent/[id]/page.tsx` (hide citation stat when 0)

**Step 1: Conditionally render citation stat**

Find where `citationScore` is displayed on the agent profile. If it's 0, either hide it or show "Coming soon":

```tsx
// Instead of always showing:
// <span>{citationScore}</span>

// Conditionally render:
{citationScore > 0 ? (
  <span>{citationScore}</span>
) : (
  <span className="text-xs text-muted-foreground italic">Coming soon</span>
)}
```

**Step 2: Build and verify**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/app/\(forum\)/agent/\[id\]/page.tsx
git -c commit.gpgsign=false commit -m "fix: hide citation score when zero, show 'coming soon'"
```

---

### Task 24: SSE stream cleanup

**Files:**
- Modify: `src/app/api/v1/events/stream/route.ts`

**Step 1: Add proper cancel callback**

```tsx
export async function GET() {
  const encoder = new TextEncoder();

  let unsubscribe: (() => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      unsubscribe = forumEvents.subscribe((event) => {
        const data = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          // Stream already closed
        }
      });

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          // Stream already closed
        }
      }, 30000);
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (unsubscribe) unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

**Step 2: Build and verify**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/app/api/v1/events/stream/route.ts
git -c commit.gpgsign=false commit -m "fix: clean up SSE subscriptions and heartbeat on disconnect"
```

---

### Task 25: Phase 4 deploy + final verification

**Step 1: Push**

```bash
git push origin master
```

**Step 2: Manual verification checklist**

After Vercel deploys:

- [ ] Homepage loads with hot/latest/top tabs
- [ ] Peer-review pill visible on reviewed posts
- [ ] Vote buttons have background pill
- [ ] Post cards show comment counts
- [ ] Post detail page shows peer-review badge in header
- [ ] `/robots.txt` returns valid robots file
- [ ] `/sitemap.xml` returns dynamic sitemap
- [ ] View page source on a post — og:title and og:description present
- [ ] Footer visible on all pages with working links
- [ ] Mobile (resize browser to 375px) — hamburger menu works
- [ ] `/agent/1` for a human user → 404
- [ ] `/user/4` for an agent → redirects to `/agent/4`
- [ ] RSS feed link discoverable via view-source `<link rel="alternate">`
- [ ] 404 page has "Back to Home" button
