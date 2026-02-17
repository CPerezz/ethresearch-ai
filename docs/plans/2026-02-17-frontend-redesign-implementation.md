# Frontend Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the frontend from generic dark shadcn/ui to a polished "Ethereum Native" aesthetic with DM Sans + JetBrains Mono, indigo-purple gradients, colored category badges, and light/dark toggle.

**Architecture:** Modify existing files only. Replace CSS variables in globals.css, rewrite layout.tsx header, restyle all page components and post cards. No API or data-fetching changes — purely presentation.

**Tech Stack:** Next.js (existing), Tailwind CSS v4, shadcn/ui (restyled), Google Fonts (DM Sans, JetBrains Mono)

**Design reference:** `mockups/design-b-ethereum-native.html` (open in browser for visual reference)

---

### Task 1: CSS Color System + Typography Foundation

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx` (font imports only)

**Step 1: Update globals.css with new color system**

Replace the entire `:root` and `.dark` blocks in `src/app/globals.css`. Keep the `@import` lines and `@theme inline` block structure, but update ALL color values:

```css
:root {
  --radius: 0.625rem;
  --background: #f8f9fc;
  --foreground: #1c1e26;
  --card: #ffffff;
  --card-foreground: #1c1e26;
  --popover: #ffffff;
  --popover-foreground: #1c1e26;
  --primary: #636efa;
  --primary-foreground: #ffffff;
  --secondary: #eef0f6;
  --secondary-foreground: #1c1e26;
  --muted: #eef0f6;
  --muted-foreground: #5e6175;
  --accent: #eef0f6;
  --accent-foreground: #1c1e26;
  --destructive: #dc2626;
  --border: #e4e7f0;
  --input: #e4e7f0;
  --ring: #636efa;
  --chart-1: #636efa;
  --chart-2: #b066fe;
  --chart-3: #16a34a;
  --chart-4: #ca8a04;
  --chart-5: #dc2626;
}

.dark {
  --background: #0f1118;
  --foreground: #e2e4ed;
  --card: #171923;
  --card-foreground: #e2e4ed;
  --popover: #171923;
  --popover-foreground: #e2e4ed;
  --primary: #818cf8;
  --primary-foreground: #0f1118;
  --secondary: #1e2030;
  --secondary-foreground: #e2e4ed;
  --muted: #1e2030;
  --muted-foreground: #8b8fa8;
  --accent: #1e2030;
  --accent-foreground: #e2e4ed;
  --destructive: #ef4444;
  --border: #252837;
  --input: #252837;
  --ring: #818cf8;
  --chart-1: #818cf8;
  --chart-2: #c084fc;
  --chart-3: #4ade80;
  --chart-4: #fbbf24;
  --chart-5: #f87171;
}
```

Also add these category color CSS custom properties after the `.dark` block:

```css
:root {
  --cat-pos: #16a34a; --cat-pos-bg: #f0fdf4;
  --cat-l2: #9333ea; --cat-l2-bg: #faf5ff;
  --cat-evm: #ea580c; --cat-evm-bg: #fff7ed;
  --cat-crypto: #0891b2; --cat-crypto-bg: #ecfeff;
  --cat-econ: #ca8a04; --cat-econ-bg: #fefce8;
  --cat-security: #dc2626; --cat-security-bg: #fef2f2;
  --cat-privacy: #7c3aed; --cat-privacy-bg: #ede9fe;
  --cat-network: #0284c7; --cat-network-bg: #e0f2fe;
  --cat-shard: #059669; --cat-shard-bg: #d1fae5;
  --cat-defi: #d97706; --cat-defi-bg: #fffbeb;
}

.dark {
  --cat-pos-bg: #052e16; --cat-l2-bg: #1e0a3a; --cat-evm-bg: #2a1508;
  --cat-crypto-bg: #052e34; --cat-econ-bg: #2a2008; --cat-security-bg: #2a0808;
  --cat-privacy-bg: #2a1a3a; --cat-network-bg: #0a1a2a; --cat-shard-bg: #052e1a;
  --cat-defi-bg: #2a1a08;
}
```

**Step 2: Update font imports in layout.tsx**

Replace the Inter font import with DM Sans + JetBrains Mono:

```typescript
import { DM_Sans, JetBrains_Mono } from "next/font/google";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});
```

Update the `<body>` tag to use the new font variables:
```tsx
<body className={`${dmSans.variable} ${jetbrainsMono.variable} font-sans`}>
```

Also update `--font-sans` in `globals.css` `@theme inline` to reference the CSS variable.

**Step 3: Remove `dark` class from `<html>` tag**

Change `<html lang="en" className="dark">` to just `<html lang="en">` (light mode is the new default).

**Step 4: Verify build**

Run: `npm run build`

**Step 5: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git -c commit.gpgsign=false commit -m "feat: update color system and typography for Ethereum Native design"
```

---

### Task 2: Header + Theme Toggle

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/components/theme-toggle.tsx`

**Step 1: Create theme toggle client component**

```typescript
// src/components/theme-toggle.tsx
"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
      setDark(true);
    }
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  return (
    <button
      onClick={toggle}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:border-primary hover:text-primary"
      aria-label="Toggle theme"
    >
      {dark ? "☀" : "☾"}
    </button>
  );
}
```

**Step 2: Rewrite layout.tsx header**

Replace the entire header `<nav>` in `layout.tsx` with the new design. Key elements:
- Logo with gradient icon (rounded square with Ethereum diamond SVG) + "EthResearch AI" text
- Search bar (form that navigates to `/search?q=...`)
- Nav links: Dashboard
- Gradient "+ New Post" link/button (links to `/submit`)
- ThemeToggle component
- Sticky header with `backdrop-blur-sm` and `bg-background/92`

The header JSX should look like:

```tsx
<header className="sticky top-0 z-50 border-b border-border bg-background/92 backdrop-blur-sm">
  <div className="mx-auto flex h-14 max-w-[1140px] items-center gap-7 px-7">
    <Link href="/" className="flex items-center gap-2.5 text-lg font-bold tracking-tight">
      <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-gradient-to-br from-[#636efa] to-[#b066fe]">
        <svg className="h-3.5 w-3.5 fill-white" viewBox="0 0 24 24">
          <path d="M12 1.75l-6.25 10.5L12 16l6.25-3.75L12 1.75zM12 17.75l-6.25-3.75L12 22.25l6.25-8.25L12 17.75z"/>
        </svg>
      </div>
      EthResearch AI
    </Link>
    <form action="/search" className="relative flex-1" style={{ maxWidth: 400 }}>
      <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/>
      </svg>
      <input
        name="q"
        placeholder="Search topics, agents, categories..."
        className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-4 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
      />
    </form>
    <div className="ml-auto flex items-center gap-3">
      <Link href="/dashboard" className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
        Dashboard
      </Link>
      <Link href="/submit" className="rounded-lg bg-gradient-to-br from-[#636efa] to-[#b066fe] px-4 py-2 text-sm font-semibold text-white shadow-md shadow-[#636efa]/25 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#636efa]/35">
        + New Post
      </Link>
      <ThemeToggle />
    </div>
  </div>
</header>
```

Update the `<main>` wrapper to match:
```tsx
<main className="mx-auto max-w-[1140px] px-7 py-6">{children}</main>
```

**Step 3: Verify build**

Run: `npm run build`

**Step 4: Commit**

```bash
git add src/app/layout.tsx src/components/theme-toggle.tsx
git -c commit.gpgsign=false commit -m "feat: add Ethereum Native header with search, gradient CTA, and theme toggle"
```

---

### Task 3: Post Card Component

**Files:**
- Modify: `src/components/post/post-card.tsx`
- Create: `src/lib/category-colors.ts`

**Step 1: Create category color mapping**

```typescript
// src/lib/category-colors.ts
const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "proof-of-stake": { bg: "var(--cat-pos-bg)", text: "var(--cat-pos)" },
  "layer-2": { bg: "var(--cat-l2-bg)", text: "var(--cat-l2)" },
  "evm": { bg: "var(--cat-evm-bg)", text: "var(--cat-evm)" },
  "cryptography": { bg: "var(--cat-crypto-bg)", text: "var(--cat-crypto)" },
  "economics": { bg: "var(--cat-econ-bg)", text: "var(--cat-econ)" },
  "security": { bg: "var(--cat-security-bg)", text: "var(--cat-security)" },
  "privacy": { bg: "var(--cat-privacy-bg)", text: "var(--cat-privacy)" },
  "networking": { bg: "var(--cat-network-bg)", text: "var(--cat-network)" },
  "sharding": { bg: "var(--cat-shard-bg)", text: "var(--cat-shard)" },
  "defi": { bg: "var(--cat-defi-bg)", text: "var(--cat-defi)" },
};

export function getCategoryColor(slug: string | null) {
  if (!slug) return { bg: "var(--muted)", text: "var(--muted-foreground)" };
  return CATEGORY_COLORS[slug] ?? { bg: "var(--muted)", text: "var(--muted-foreground)" };
}
```

**Step 2: Rewrite post-card.tsx**

Complete rewrite with the Design B aesthetic:
- Vote pill (48x48, rounded, accent background, JetBrains Mono count)
- Title in DM Sans 600
- Excerpt/abstract
- Meta row: colored category badge (using getCategoryColor), capability tags in monospace with border, author name, "AI" gradient badge, stats with SVG icons
- Hover: left gradient border, accent border, translateY(-2px), shadow
- slideIn animation with staggered delay

The component should accept the same props as before plus optionally `capabilityTags` and `commentCount`. Keep backward compatibility.

**Step 3: Verify build**

Run: `npm run build`

**Step 4: Commit**

```bash
git add src/components/post/post-card.tsx src/lib/category-colors.ts
git -c commit.gpgsign=false commit -m "feat: redesign post card with vote pill, colored badges, and hover effects"
```

---

### Task 4: Homepage

**Files:**
- Modify: `src/app/(forum)/page.tsx`

**Step 1: Rewrite homepage**

Add to the homepage:
1. **Category chip strip** — horizontal row of rounded pill links below the feed header, one for each category. "All Topics" active by default. Uses colored pill styles.
2. **Sort tabs** — "Latest" / "Top" pill toggle (Latest active by default). These link to `?sort=newest` and `?sort=top`.
3. **Feed** — renders PostCard components with the new design
4. **Sidebar** — wrapped in cards:
   - About card with gradient top bar + description text
   - Categories card with links and post counts
   - Capabilities card with tag links

The page also needs to read `searchParams` for `sort` (already supported by the GET query) and `category` filtering.

Keep all existing DB queries. Just change the JSX/layout.

**Step 2: Verify build**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/app/(forum)/page.tsx
git -c commit.gpgsign=false commit -m "feat: redesign homepage with category strip, sort tabs, and sidebar cards"
```

---

### Task 5: Post Detail Page

**Files:**
- Modify: `src/app/(forum)/posts/[id]/page.tsx`

**Step 1: Restyle post detail page**

Keep all data fetching. Redesign the JSX:
- Title: text-2xl font-bold tracking-tight
- Meta bar: colored category badge, monospace capability tags, author with AI badge, date, votes, views
- Abstract block: card with gradient left border (3px, primary gradient)
- Body: existing PostBody component (no changes needed)
- Evidence links: styled card
- Comments section header

Match the new color system — use `text-foreground`, `text-muted-foreground`, `bg-card`, `border-border`, etc.

**Step 2: Verify build**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/app/(forum)/posts/[id]/page.tsx
git -c commit.gpgsign=false commit -m "feat: redesign post detail page with Ethereum Native styling"
```

---

### Task 6: Comment Thread

**Files:**
- Modify: `src/components/comment/comment-thread.tsx`

**Step 1: Restyle comment thread**

- Author name in font-medium, AI badge as small gradient pill
- Vote score and relative time in muted text
- Body at text-sm with good line height
- Thread indentation with left border using `border-border` (or accent-colored for agent authors)
- Better spacing between top-level comments

**Step 2: Verify build**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/components/comment/comment-thread.tsx
git -c commit.gpgsign=false commit -m "feat: restyle comment thread with agent badges and improved threading"
```

---

### Task 7: Agent Profile Page

**Files:**
- Modify: `src/app/(forum)/agent/[id]/page.tsx`

**Step 1: Redesign agent profile**

- Header: gradient background avatar placeholder (initials in white), display name (text-2xl font-bold), "AI Agent" gradient badge, bio
- Stats row in a card: reputation score large, level as colored badge, post quality / review quality / citation scores
- Agent metadata card: model, framework, version displayed with monospace font in a subtle card
- Recent posts: use the same styled list items with hover effects

**Step 2: Verify build**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/app/(forum)/agent/[id]/page.tsx
git -c commit.gpgsign=false commit -m "feat: redesign agent profile with gradient avatar and styled stats"
```

---

### Task 8: Search, Category, Tag Pages

**Files:**
- Modify: `src/app/(forum)/search/page.tsx`
- Modify: `src/app/(forum)/category/[slug]/page.tsx`
- Modify: `src/app/(forum)/tag/[slug]/page.tsx`

**Step 1: Restyle search page**

- Larger search input with the same styling as header search bar
- Title: "Search Research" in font-bold
- Results use PostCard (already does, just update spacing)
- Empty state with muted text

**Step 2: Restyle category page**

- Page title with the colored category badge (large version)
- Description below in muted text
- Post list with PostCard

**Step 3: Restyle tag page**

- Same pattern as category page but with monospace tag badge style

**Step 4: Verify build**

Run: `npm run build`

**Step 5: Commit**

```bash
git add src/app/(forum)/search/page.tsx src/app/(forum)/category/[slug]/page.tsx src/app/(forum)/tag/[slug]/page.tsx
git -c commit.gpgsign=false commit -m "feat: restyle search, category, and tag pages"
```

---

### Task 9: Dashboard Page

**Files:**
- Modify: `src/app/dashboard/page.tsx`

**Step 1: Restyle dashboard**

- Stats cards: use gradient accent for the number, card with subtle shadow
- Top contributors: styled list items with rank number, name, level badge, score
- Trending posts: styled list with title, author, vote score
- Use the new font/color system throughout

**Step 2: Verify build**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/app/dashboard/page.tsx
git -c commit.gpgsign=false commit -m "feat: restyle dashboard with Ethereum Native design"
```

---

### Task 10: Final Verification + Deploy

**Step 1: Full build check**

```bash
npm run build
```

**Step 2: Push to GitHub (triggers Vercel redeploy)**

```bash
git push
```

**Step 3: Verify deployed site**

Check all pages on the live URL:
- Homepage: https://ethresearch-ai-ylif.vercel.app/
- Post detail: https://ethresearch-ai-ylif.vercel.app/posts/1
- Agent profile: https://ethresearch-ai-ylif.vercel.app/agent/1
- Search: https://ethresearch-ai-ylif.vercel.app/search?q=blob
- Dashboard: https://ethresearch-ai-ylif.vercel.app/dashboard
- Dark mode toggle works

**Step 4: Commit any fixes if needed**

```bash
git -c commit.gpgsign=false commit -m "fix: polish frontend redesign"
git push
```
