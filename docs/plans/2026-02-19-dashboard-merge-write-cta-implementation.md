# Dashboard Merge + Write Post CTA Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the separate Dashboard page, merge its stats into the homepage sidebar, and add a "New Post" CTA with a full `/posts/new` creation page for human users.

**Architecture:** Delete the `/dashboard` route and its references from navigation. Add 3 compact stat cards to the homepage sidebar. Add a "New Post" CTA button in the header and sidebar. Create a client-component form at `/posts/new` that POSTs to the existing `/api/v1/posts` endpoint (which already accepts session cookie auth).

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4, Drizzle ORM

---

## Task 1: Delete Dashboard Page

**Files:**
- Delete: `src/app/dashboard/page.tsx`
- Delete: `src/app/dashboard/error.tsx`
- Delete: `src/app/dashboard/loading.tsx`

**Step 1: Delete the three dashboard files**

```bash
rm src/app/dashboard/page.tsx src/app/dashboard/error.tsx src/app/dashboard/loading.tsx
rmdir src/app/dashboard
```

**Step 2: Verify no remaining imports reference these files**

```bash
grep -r "dashboard" src/ --include="*.tsx" --include="*.ts" -l
```

Expect: only layout.tsx, mobile-nav.tsx, sitemap.ts (handled in Task 2). No imports of deleted files.

**Step 3: Commit**

```bash
git add -A && git commit -m "chore: delete dashboard page (merging into homepage)"
```

---

## Task 2: Remove Dashboard from Navigation + Sitemap

**Files:**
- Modify: `src/app/layout.tsx:69` — remove Dashboard link
- Modify: `src/components/mobile-nav.tsx:7` — remove Dashboard from NAV_LINKS
- Modify: `src/app/sitemap.ts:14` — remove `/dashboard` static route

**Step 1: Remove Dashboard link from header nav**

In `src/app/layout.tsx`, delete the entire Dashboard `<Link>` block (lines 69-71):

```tsx
// DELETE these 3 lines:
<Link href="/dashboard" className="hidden lg:inline-flex rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
  Dashboard
</Link>
```

**Step 2: Remove Dashboard from mobile nav**

In `src/components/mobile-nav.tsx`, change the NAV_LINKS array (line 6-11) from:

```tsx
const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/bounties", label: "Bounties" },
  { href: "/digest", label: "Digest" },
  { href: "/docs", label: "API" },
];
```

To:

```tsx
const NAV_LINKS = [
  { href: "/bounties", label: "Bounties" },
  { href: "/digest", label: "Digest" },
  { href: "/docs", label: "API" },
];
```

**Step 3: Remove Dashboard from sitemap**

In `src/app/sitemap.ts`, delete line 14:

```tsx
// DELETE this line:
{ url: `${siteUrl}/dashboard`, changeFrequency: "daily", priority: 0.6 },
```

**Step 4: Verify build**

```bash
npm run build
```

**Step 5: Commit**

```bash
git add src/app/layout.tsx src/components/mobile-nav.tsx src/app/sitemap.ts
git commit -m "chore: remove Dashboard from nav, mobile nav, and sitemap"
```

---

## Task 3: Add Stat Cards to Homepage Sidebar

**Files:**
- Modify: `src/app/(forum)/page.tsx`

Add 3 stat queries (agents, posts, comments) to the homepage server component, and render compact stat cards at the top of the sidebar, above the About card.

**Step 1: Add stat queries**

At the end of the existing query block (after the `leaderboardResults` try-catch around line 87), add:

```tsx
const [[agentStat], [postStat], [commentStat]] = await Promise.all([
  db.select({ count: count() }).from(users).where(eq(users.type, "agent")),
  db.select({ count: count() }).from(posts).where(eq(posts.status, "published")),
  db.select({ count: count() }).from(comments),
]);
```

The `users` and `comments` imports already exist in the file. `count` is already imported from `drizzle-orm`.

**Step 2: Add stat cards to sidebar JSX**

Inside the `<aside>` element (line 153), add the stat cards as the FIRST child, before the About card:

```tsx
{/* Stats */}
<div className="overflow-hidden rounded-xl border border-border bg-card">
  <div className="h-[3px] bg-gradient-to-r from-[#636efa] to-[#b066fe]" />
  <div className="grid grid-cols-3 gap-2 p-3">
    {[
      { label: "Agents", value: agentStat.count },
      { label: "Posts", value: postStat.count },
      { label: "Comments", value: commentStat.count },
    ].map((stat) => (
      <div key={stat.label} className="text-center">
        <div className="bg-gradient-to-r from-[#636efa] to-[#b066fe] bg-clip-text text-lg font-bold text-transparent">
          {stat.value}
        </div>
        <div className="text-[10px] text-muted-foreground">{stat.label}</div>
      </div>
    ))}
  </div>
</div>
```

**Step 3: Verify build**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/app/\(forum\)/page.tsx
git commit -m "feat: add forum stats cards to homepage sidebar"
```

---

## Task 4: Add "New Post" CTA to Header + Sidebar

**Files:**
- Modify: `src/app/layout.tsx` — add "New Post" button in header nav
- Modify: `src/app/(forum)/page.tsx` — add "Write a Post" button at top of sidebar

**Step 1: Add "New Post" button to header**

In `src/app/layout.tsx`, inside the `<nav>` element (line 68), add a "New Post" button BEFORE the first nav link. Place it as the first child of `<nav>`:

```tsx
<Link
  href="/posts/new"
  className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#636efa] to-[#b066fe] px-3 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
>
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
  <span className="hidden sm:inline">New Post</span>
</Link>
```

This gives a filled gradient button with a `+` icon. On mobile (`<sm`), only the icon shows. The button sits before the nav links.

**Step 2: Add "Write a Post" button to homepage sidebar**

In `src/app/(forum)/page.tsx`, inside the `<aside>`, add a full-width CTA button as the VERY FIRST child (above the stats card from Task 3):

```tsx
{/* Write CTA */}
<Link
  href="/posts/new"
  className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#636efa] to-[#b066fe] px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
>
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
  Write a Post
</Link>
```

The `Link` import already exists in page.tsx (it's used for category chips). Wait — checking... the homepage uses `<a>` tags, not `<Link>`. Add `import Link from "next/link"` to the imports if not present.

**Step 3: Verify build**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/app/layout.tsx src/app/\(forum\)/page.tsx
git commit -m "feat: add New Post CTA to header and homepage sidebar"
```

---

## Task 5: Create Post Creation Page `/posts/new`

**Files:**
- Create: `src/app/(forum)/posts/new/page.tsx`

Create a client component form modeled after `src/app/(forum)/bounties/new/page.tsx`. The form submits to `POST /api/v1/posts` with session cookie auth (already supported by `authenticateAgent`).

**Step 1: Create the directory**

```bash
mkdir -p src/app/\(forum\)/posts/new
```

**Step 2: Create the page**

Create `src/app/(forum)/posts/new/page.tsx` with:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const CATEGORIES = [
  { slug: "consensus", name: "Consensus" },
  { slug: "cryptography", name: "Cryptography" },
  { slug: "economics", name: "Economics" },
  { slug: "execution", name: "Execution" },
  { slug: "security", name: "Security" },
  { slug: "mev", name: "MEV" },
  { slug: "layer2", name: "Layer 2" },
  { slug: "governance", name: "Governance" },
];

const TAGS = [
  "formal-verification",
  "zk-proofs",
  "game-theory",
  "mechanism-design",
  "data-analysis",
  "simulation",
  "literature-review",
  "protocol-design",
];

interface EvidenceLink {
  url: string;
  label: string;
  type: string;
}

export default function NewPostPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [structuredAbstract, setStructuredAbstract] = useState("");
  const [body, setBody] = useState("");
  const [evidenceLinks, setEvidenceLinks] = useState<EvidenceLink[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : prev.length < 5 ? [...prev, tag] : prev
    );
  }

  function addEvidenceLink() {
    setEvidenceLinks((prev) => [...prev, { url: "", label: "", type: "webpage" }]);
  }

  function updateEvidenceLink(index: number, field: keyof EvidenceLink, value: string) {
    setEvidenceLinks((prev) => prev.map((link, i) => (i === index ? { ...link, [field]: value } : link)));
  }

  function removeEvidenceLink(index: number) {
    setEvidenceLinks((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          ...(structuredAbstract.trim() ? { structuredAbstract: structuredAbstract.trim() } : {}),
          ...(category ? { domainCategorySlug: category } : {}),
          ...(selectedTags.length ? { capabilityTagSlugs: selectedTags } : {}),
          ...(evidenceLinks.filter((l) => l.url.trim() && l.label.trim()).length
            ? { evidenceLinks: evidenceLinks.filter((l) => l.url.trim() && l.label.trim()) }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setError("You must be signed in to create posts. Please sign in first.");
        } else {
          setError(data.error || "Failed to create post");
        }
        return;
      }
      router.push(`/posts/${data.post.id}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          &larr; Back to Home
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Write a Post</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Share your Ethereum research with the community.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-border bg-card p-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Title */}
        <div>
          <label htmlFor="title" className="mb-1.5 block text-sm font-medium text-foreground">
            Title
          </label>
          <input
            id="title"
            type="text"
            required
            maxLength={300}
            placeholder="e.g. A Novel Approach to Single-Slot Finality"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
          />
          <p className="mt-1 text-xs text-muted-foreground">{title.length}/300 characters</p>
        </div>

        {/* Category */}
        <div>
          <label htmlFor="category" className="mb-1.5 block text-sm font-medium text-foreground">
            Category <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
          >
            <option value="">Select a category</option>
            {CATEGORIES.map((cat) => (
              <option key={cat.slug} value={cat.slug}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Tags */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Tags <span className="font-normal text-muted-foreground">(up to 5)</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={
                  selectedTags.includes(tag)
                    ? "rounded-md border border-primary bg-primary/10 px-2.5 py-1 font-mono text-xs font-semibold text-primary"
                    : "rounded-md border border-border px-2.5 py-1 font-mono text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                }
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Structured Abstract */}
        <div>
          <label htmlFor="abstract" className="mb-1.5 block text-sm font-medium text-foreground">
            Abstract <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <textarea
            id="abstract"
            maxLength={1000}
            placeholder="A brief summary of your research..."
            value={structuredAbstract}
            onChange={(e) => setStructuredAbstract(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 min-h-[100px]"
          />
          <p className="mt-1 text-xs text-muted-foreground">{structuredAbstract.length}/1000 characters</p>
        </div>

        {/* Body */}
        <div>
          <label htmlFor="body" className="mb-1.5 block text-sm font-medium text-foreground">
            Body <span className="font-normal text-muted-foreground">(Markdown supported)</span>
          </label>
          <textarea
            id="body"
            required
            maxLength={100000}
            placeholder="Write your research post in Markdown. You can use tables, code blocks, LaTeX math ($..$ and $$..$$), and more."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-mono transition-colors placeholder:font-sans placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 min-h-[300px]"
          />
          <p className="mt-1 text-xs text-muted-foreground">{body.length}/100000 characters</p>
        </div>

        {/* Evidence Links */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Evidence Links <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          {evidenceLinks.map((link, i) => (
            <div key={i} className="mb-2 flex gap-2">
              <input
                type="url"
                placeholder="https://..."
                value={link.url}
                onChange={(e) => updateEvidenceLink(i, "url", e.target.value)}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
              />
              <input
                type="text"
                placeholder="Label"
                value={link.label}
                onChange={(e) => updateEvidenceLink(i, "label", e.target.value)}
                className="w-32 rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
              />
              <select
                value={link.type}
                onChange={(e) => updateEvidenceLink(i, "type", e.target.value)}
                className="w-28 rounded-lg border border-border bg-background px-2 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
              >
                <option value="webpage">Webpage</option>
                <option value="paper">Paper</option>
                <option value="github">GitHub</option>
                <option value="eip">EIP</option>
              </select>
              <button
                type="button"
                onClick={() => removeEvidenceLink(i)}
                className="rounded-lg px-2 py-2 text-muted-foreground hover:text-red-500 transition-colors"
              >
                &times;
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addEvidenceLink}
            className="text-sm text-primary hover:underline"
          >
            + Add evidence link
          </button>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/"
            className="rounded-lg px-5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || !title.trim() || !body.trim()}
            className="rounded-lg bg-gradient-to-r from-[#636efa] to-[#b066fe] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Publishing..." : "Publish Post"}
          </button>
        </div>
      </form>
    </div>
  );
}
```

**Step 3: Verify build**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/app/\(forum\)/posts/new/page.tsx
git commit -m "feat: add /posts/new page for human post creation"
```

---

## Task 6: Build, Final Commit, Push

**Step 1: Full build verification**

```bash
npm run build
```

**Step 2: Push**

```bash
git push origin master
```

This triggers a Vercel redeployment.
