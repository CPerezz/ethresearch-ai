# Topics & Tags Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the flat 10-category system with a 2-tier Topics (4 fixed) + Tags (open, many-to-many) system.

**Architecture:** Repurpose `domain_categories` table as `topics` (4 rows). Add `tags`, `post_tags`, `bounty_tags` tables. Rename FK columns. Migrate existing data. Update all ~20 affected files.

**Tech Stack:** Drizzle ORM, PostgreSQL, Next.js 15 (App Router), Tailwind CSS, viem

---

### Task 1: Schema — Add topics, tags, and join tables

**Files:**
- Modify: `src/lib/db/schema.ts`

**Step 1: Add new tables and modify existing ones**

In `schema.ts`, add these new table definitions after the existing `domainCategories` definition:

```typescript
// Topics table (replaces domain_categories)
export const topics = pgTable("topics", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  description: text("description"),
  color: varchar("color", { length: 20 }).notNull(),
});

// Tags table (free-form, user-created)
export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 80 }).notNull(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Post-tag join table
export const postTags = pgTable("post_tags", {
  postId: integer("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  tagId: integer("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.postId, table.tagId] }),
  index("post_tags_post_idx").on(table.postId),
  index("post_tags_tag_idx").on(table.tagId),
]);

// Bounty-tag join table
export const bountyTags = pgTable("bounty_tags", {
  bountyId: integer("bounty_id").notNull().references(() => bounties.id, { onDelete: "cascade" }),
  tagId: integer("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.bountyId, table.tagId] }),
  index("bounty_tags_bounty_idx").on(table.bountyId),
  index("bounty_tags_tag_idx").on(table.tagId),
]);
```

Add a `topicId` column to `posts` table (line ~89, alongside existing `domainCategoryId`):
```typescript
topicId: integer("topic_id").references(() => topics.id),
```
Add index: `index("posts_topic_idx").on(table.topicId)` in the posts table callback.

Add a `topicId` column to `bounties` table (line ~208, alongside existing `categoryId`):
```typescript
topicId: integer("topic_id").references(() => topics.id),
```

Add relations for the new tables:
```typescript
export const topicsRelations = relations(topics, ({ many }) => ({
  posts: many(posts),
  bounties: many(bounties),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  postTags: many(postTags),
  bountyTags: many(bountyTags),
}));

export const postTagsRelations = relations(postTags, ({ one }) => ({
  post: one(posts, { fields: [postTags.postId], references: [posts.id] }),
  tag: one(tags, { fields: [postTags.tagId], references: [tags.id] }),
}));

export const bountyTagsRelations = relations(bountyTags, ({ one }) => ({
  bounty: one(bounties, { fields: [bountyTags.bountyId], references: [bounties.id] }),
  tag: one(tags, { fields: [bountyTags.tagId], references: [tags.id] }),
}));
```

Update `postsRelations` (line ~264) to add:
```typescript
topic: one(topics, { fields: [posts.topicId], references: [topics.id] }),
postTags: many(postTags),
```

Update `bountiesRelations` (line ~312) to add:
```typescript
topic: one(topics, { fields: [bounties.topicId], references: [topics.id] }),
bountyTags: many(bountyTags),
```

**Step 2: Generate and run migration**

Run: `npx drizzle-kit generate`
Then: `npx drizzle-kit push` (or apply migration)

**Step 3: Commit**
```bash
git add src/lib/db/schema.ts drizzle/
git commit -m "feat: add topics, tags, post_tags, bounty_tags schema"
```

---

### Task 2: Seed data — Topics and tags + migration script

**Files:**
- Modify: `src/lib/db/seed.ts`

**Step 1: Replace category seed with topics + tags seed**

Replace the existing category seed section (lines 12-24) with:

```typescript
// --- Topics (4 fixed) ---
const topicData = [
  { name: "Scale L1", slug: "scale-l1", description: "Execution layer, consensus, state management, EVM optimizations", color: "#636efa" },
  { name: "Scale L2", slug: "scale-l2", description: "Rollups, bridges, data availability, L2 scaling solutions", color: "#b066fe" },
  { name: "Hardening", slug: "hardening", description: "Security, cryptography, privacy, formal verification", color: "#ef553b" },
  { name: "Misc", slug: "misc", description: "Economics, governance, applications, general research", color: "#00cc96" },
];

for (const t of topicData) {
  await db.insert(topics).values(t).onConflictDoNothing();
}

// --- Tags (seeded) ---
const tagData = [
  // Scale L1 related
  "state-execution-separation", "repricing", "consensus", "networking", "sharding",
  "evm", "proof-of-stake", "zkevm", "statelessness", "binary-trees", "eip-analysis",
  // Scale L2 related
  "rollups", "bridges", "data-availability", "zk-rollups", "optimistic-rollups",
  "layer-2", "blobs",
  // Hardening related
  "zk-snarks", "post-quantum", "formal-verification", "auditing",
  "cryptography", "security", "privacy",
  // Misc related
  "governance", "public-goods", "identity", "dex", "economics", "defi", "mev",
];

for (const name of tagData) {
  const slug = name; // already slug-format
  const displayName = name.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  await db.insert(tags).values({ name: displayName, slug }).onConflictDoNothing();
}
```

**Step 2: Add migration logic for existing posts/bounties**

After seeding, add a data migration that:
1. Fetches all old `domain_categories` rows
2. For each old category, maps to topic slug and tag slug per the mapping table
3. For each post with a `domainCategoryId`, sets `topicId` and creates a `post_tags` entry
4. Same for bounties

```typescript
// --- Migrate old categories to topics + tags ---
const CATEGORY_TO_TOPIC: Record<string, string> = {
  "proof-of-stake": "scale-l1",
  "layer-2": "scale-l2",
  "evm": "scale-l1",
  "cryptography": "hardening",
  "economics": "misc",
  "security": "hardening",
  "privacy": "hardening",
  "networking": "scale-l1",
  "sharding": "scale-l1",
  "defi": "misc",
};

const allTopics = await db.select().from(topics);
const allTags = await db.select().from(tags);
const oldCategories = await db.select().from(domainCategories);

const topicBySlug = Object.fromEntries(allTopics.map(t => [t.slug, t]));
const tagBySlug = Object.fromEntries(allTags.map(t => [t.slug, t]));

for (const oldCat of oldCategories) {
  const topicSlug = CATEGORY_TO_TOPIC[oldCat.slug];
  if (!topicSlug) continue;
  const topic = topicBySlug[topicSlug];
  const tag = tagBySlug[oldCat.slug];
  if (!topic) continue;

  // Migrate posts
  const postsInCat = await db.select({ id: posts.id }).from(posts).where(eq(posts.domainCategoryId, oldCat.id));
  for (const p of postsInCat) {
    await db.update(posts).set({ topicId: topic.id }).where(eq(posts.id, p.id));
    if (tag) {
      await db.insert(postTags).values({ postId: p.id, tagId: tag.id }).onConflictDoNothing();
    }
  }

  // Migrate bounties
  const bountiesInCat = await db.select({ id: bounties.id }).from(bounties).where(eq(bounties.categoryId, oldCat.id));
  for (const b of bountiesInCat) {
    await db.update(bounties).set({ topicId: topic.id }).where(eq(bounties.id, b.id));
    if (tag) {
      await db.insert(bountyTags).values({ bountyId: b.id, tagId: tag.id }).onConflictDoNothing();
    }
  }
}
```

**Step 3: Run seed**
Run: `npx tsx src/lib/db/seed.ts` (or however the project runs seeds)

**Step 4: Commit**
```bash
git add src/lib/db/seed.ts
git commit -m "feat: seed topics and tags, migrate existing category data"
```

---

### Task 3: Topic colors utility — Replace category-colors.ts

**Files:**
- Modify: `src/lib/category-colors.ts` → rename to `src/lib/topic-colors.ts`

**Step 1: Create new topic-colors.ts**

```typescript
const TOPIC_COLORS: Record<string, { bg: string; text: string }> = {
  "scale-l1": { bg: "#636efa22", text: "#636efa" },
  "scale-l2": { bg: "#b066fe22", text: "#b066fe" },
  "hardening": { bg: "#ef553b22", text: "#ef553b" },
  "misc": { bg: "#00cc9622", text: "#00cc96" },
};

const FALLBACK = { bg: "var(--muted)", text: "var(--muted-foreground)" };

export function getTopicColor(slug: string | null): { bg: string; text: string } {
  if (!slug) return FALLBACK;
  return TOPIC_COLORS[slug] ?? FALLBACK;
}
```

Note: Uses hex colors with `22` alpha suffix for backgrounds instead of CSS variables. This is simpler and the color is stored in the DB too.

**Step 2: Remove old CSS variables**

In `src/app/globals.css`, remove all `--cat-*` CSS variable definitions (the category color variables). They are no longer needed.

**Step 3: Commit**
```bash
git add src/lib/topic-colors.ts src/app/globals.css
git rm src/lib/category-colors.ts
git commit -m "feat: replace category-colors with topic-colors utility"
```

---

### Task 4: Validation schemas — Update to topicSlug + tags

**Files:**
- Modify: `src/lib/validation/schemas.ts`

**Step 1: Update createPostSchema (line ~25)**

Replace `domainCategorySlug: z.string().max(100).optional()` with:
```typescript
topicSlug: z.enum(["scale-l1", "scale-l2", "hardening", "misc"]),
tags: z.array(z.string().max(80)).max(20).optional(),
```

**Step 2: Update createBountySchema (line ~73)**

Same replacement: `domainCategorySlug` → `topicSlug` + `tags`.

**Step 3: Commit**
```bash
git add src/lib/validation/schemas.ts
git commit -m "feat: update validation schemas for topicSlug + tags"
```

---

### Task 5: API routes — Categories → Topics

**Files:**
- Modify: `src/app/api/v1/categories/route.ts` (or create `src/app/api/v1/topics/route.ts`)
- Modify: `src/app/api/v1/posts/route.ts`
- Modify: `src/app/api/v1/bounties/route.ts`
- Modify: `src/app/api/v1/posts/[id]/route.ts`
- Modify: `src/app/api/v1/bounties/[id]/route.ts`
- Modify: `src/app/api/v1/search/route.ts`

**Step 1: Create GET /api/v1/topics**

Rename or rewrite the categories route to return topics + tags:
```typescript
export const GET = apiHandler(async () => {
  const [topicList, tagList] = await Promise.all([
    db.select().from(topics),
    db.select().from(tags).orderBy(tags.name),
  ]);
  return NextResponse.json({ topics: topicList, tags: tagList });
});
```

**Step 2: Update POST /api/v1/posts**

Replace the category resolution logic (lines 82-90) with:
- Resolve `topicSlug` to topic ID (required)
- For each tag in `tags[]`: find-or-create tag row, insert into `post_tags`

```typescript
// Resolve topic (required)
const [topic] = await db.select({ id: topics.id }).from(topics).where(eq(topics.slug, topicSlug)).limit(1);
if (!topic) return NextResponse.json({ error: "Invalid topic" }, { status: 400 });

// Insert post with topicId
const [newPost] = await db.insert(posts).values({ ...values, topicId: topic.id }).returning({ id: posts.id });

// Handle tags
if (body.tags?.length) {
  for (const tagName of body.tags) {
    const slug = tagName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const [tag] = await db.insert(tags).values({ name: tagName, slug }).onConflictDoUpdate({ target: tags.slug, set: { slug: sql`${tags.slug}` } }).returning({ id: tags.id });
    await db.insert(postTags).values({ postId: newPost.id, tagId: tag.id }).onConflictDoNothing();
  }
}
```

**Step 3: Update GET endpoints** in posts, bounties, search

In all GET queries, replace:
- `domainCategories` join → `topics` join
- `categoryName`/`categorySlug` → `topicName`/`topicSlug`/`topicColor`
- Add a sub-select or separate query for tags on each post/bounty

For tags, the simplest approach is a SQL sub-select:
```typescript
sql<string>`(SELECT COALESCE(json_agg(json_build_object('name', t.name, 'slug', t.slug)), '[]') FROM post_tags pt JOIN tags t ON pt.tag_id = t.id WHERE pt.post_id = ${posts.id})`.as("tags"),
```

**Step 4: Update POST /api/v1/bounties** — same pattern as posts

**Step 5: Commit**
```bash
git add src/app/api/v1/
git commit -m "feat: update all API routes for topics + tags"
```

---

### Task 6: Homepage — Topic tabs + sidebar

**Files:**
- Modify: `src/app/(forum)/page.tsx`

**Step 1: Replace category imports**

Replace `getCategoryColor` import with `getTopicColor` from `@/lib/topic-colors`.
Replace `domainCategories` references with `topics` in the DB query (line ~69).

**Step 2: Replace category chips (lines 104-124) with topic tabs**

4 topic tabs + "All" default. Each tab links to `/topic/${slug}` or filters inline.

**Step 3: Replace sidebar categories (lines 208-229) with topic list**

4 topics with colored dots instead of 10 categories.

**Step 4: Update post query** to join on `topics` instead of `domainCategories`, return `topicName`/`topicSlug`.

**Step 5: Commit**
```bash
git add src/app/(forum)/page.tsx
git commit -m "feat: homepage topic tabs and sidebar"
```

---

### Task 7: Topic page — Replace /category/[slug]

**Files:**
- Delete: `src/app/(forum)/category/[slug]/page.tsx`
- Create: `src/app/(forum)/topic/[slug]/page.tsx`

**Step 1: Create topic page**

Same structure as old category page, but:
- Fetch from `topics` table instead of `domainCategories`
- Join on `topics` for post listing
- Use `getTopicColor` for styling
- Display tags on each post card
- Route is `/topic/[slug]`

**Step 2: Commit**
```bash
git add src/app/(forum)/topic/
git rm -r src/app/(forum)/category/
git commit -m "feat: replace /category/[slug] with /topic/[slug]"
```

---

### Task 8: PostCard — Show topic + tags

**Files:**
- Modify: `src/components/post/post-card.tsx`

**Step 1: Update props**

Replace `categoryName`/`categorySlug` with:
```typescript
topicName: string | null;
topicSlug: string | null;
tags?: { name: string; slug: string }[];
```

**Step 2: Update rendering**

- Topic badge uses `getTopicColor(topicSlug)` instead of `getCategoryColor`
- After topic badge, render tag chips:
```tsx
{tags?.slice(0, 3).map((tag) => (
  <span key={tag.slug} className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
    {tag.name}
  </span>
))}
{tags && tags.length > 3 && (
  <span className="text-[10px] text-muted-foreground">+{tags.length - 3}</span>
)}
```

**Step 3: Commit**
```bash
git add src/components/post/post-card.tsx
git commit -m "feat: post card shows topic badge + tag chips"
```

---

### Task 9: Bounties page + filters — Topic instead of category

**Files:**
- Modify: `src/app/(forum)/bounties/page.tsx`
- Modify: `src/components/bounty/bounty-filters.tsx`

**Step 1: Update BountyFilters**

Change category dropdown to topic dropdown. Rename props from `categories` to `topics`.
Options: All Topics, Scale L1, Scale L2, Hardening, Misc.
URL param: `topic` instead of `category`.

**Step 2: Update bounties page**

- Replace `domainCategories` imports/joins with `topics`
- Filter by `topics.slug` instead of `domainCategories.slug`
- Fetch topics list (only 4 rows) for filter dropdown
- Update card rendering to use `getTopicColor`

**Step 3: Commit**
```bash
git add src/app/(forum)/bounties/page.tsx src/components/bounty/bounty-filters.tsx
git commit -m "feat: bounties page uses topics instead of categories"
```

---

### Task 10: Detail pages + search — Topic + tags

**Files:**
- Modify: `src/app/(forum)/bounties/[id]/page.tsx`
- Modify: `src/app/(forum)/posts/[id]/page.tsx`
- Modify: `src/app/(forum)/search/page.tsx`

**Step 1: Update bounty detail page**

Replace `domainCategories` join with `topics` join. Use `getTopicColor`. Display tags if present.

**Step 2: Update post detail page**

Same pattern. Display topic badge + tag chips.

**Step 3: Update search page**

Replace category join with topic join. Pass `topicName`/`topicSlug` to PostCard.

**Step 4: Commit**
```bash
git add src/app/(forum)/bounties/[id]/page.tsx src/app/(forum)/posts/[id]/page.tsx src/app/(forum)/search/page.tsx
git commit -m "feat: detail pages and search use topics + tags"
```

---

### Task 11: Welcome page + sitemap — Update references

**Files:**
- Modify: `src/app/welcome/page.tsx`
- Modify: `src/app/sitemap.ts`

**Step 1: Update welcome page**

Replace `domainCategories` join in topPosts query with `topics` join.

**Step 2: Update sitemap**

Replace category routes with topic routes:
```typescript
const allTopics = await db.select({ slug: topics.slug }).from(topics);
const topicRoutes = allTopics.map((t) => ({
  url: `${siteUrl}/topic/${t.slug}`,
  changeFrequency: "daily" as const,
  priority: 0.7,
}));
```

**Step 3: Commit**
```bash
git add src/app/welcome/page.tsx src/app/sitemap.ts
git commit -m "feat: welcome page and sitemap use topics"
```

---

### Task 12: Bounty creation form — Tags input + topic selector

**Files:**
- Modify: `src/app/(forum)/bounties/new/page.tsx`

**Step 1: Replace category dropdown with topic dropdown**

Replace any existing category selector with a required 4-option topic dropdown.

**Step 2: Add tags input**

Add a free-text comma-separated tags input field. Simple `<input>` with instructions.

**Step 3: Commit**
```bash
git add src/app/(forum)/bounties/new/page.tsx
git commit -m "feat: bounty creation uses topic selector + tags input"
```

---

### Task 13: Cleanup — Remove old category artifacts

**Files:**
- Modify: `src/lib/db/schema.ts` — remove `domainCategories` table export (keep for migration reference or remove if seed handles it)
- Delete: `src/lib/category-colors.ts`
- Remove old `domainCategoryId` and `categoryId` columns after verifying topicId works
- Remove CSS variables from globals.css

**Step 1: Final cleanup pass**

Grep for any remaining references to `domainCategor`, `categorySlug`, `categoryName`, `getCategoryColor` and fix them.

**Step 2: Type-check**
Run: `npx tsc --noEmit`

**Step 3: Commit**
```bash
git add -A
git commit -m "chore: remove old category system artifacts"
```

---

### Task 14: Bug fix — Reputation reward input spinner arrows

**Files:**
- Modify: `src/app/globals.css`

**Step 1: Add CSS to hide number input spinners**

```css
/* Hide number input spinners */
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type="number"] {
  -moz-appearance: textfield;
}
```

**Step 2: Commit**
```bash
git add src/app/globals.css
git commit -m "fix: hide number input spinner arrows"
```

---

### Task 15: Bug fix — Fund bounty transaction failure handling

**Files:**
- Modify: `src/app/(forum)/bounties/new/page.tsx`

**Step 1: Fix useEffect dependencies (line ~152)**

Remove the eslint-disable comment and add proper dependencies:
```typescript
}, [isSuccess, txState, hash, pendingBountyId]);
```

**Step 2: Add timeout for stuck confirming state**

Add a timeout that resets state after 2 minutes of confirming:
```typescript
useEffect(() => {
  if (txState !== "confirming") return;
  const timeout = setTimeout(() => {
    setError("Transaction confirmation timed out. Check your wallet or block explorer for status.");
    setTxState("idle");
    setSubmitting(false);
  }, 120_000);
  return () => clearTimeout(timeout);
}, [txState]);
```

**Step 3: Improve error display**

Ensure the error message is visible in the UI when txState resets to "idle" after a failure. Make sure the error is shown prominently (not just below a hidden form section).

**Step 4: Commit**
```bash
git add src/app/(forum)/bounties/new/page.tsx
git commit -m "fix: handle fund bounty transaction failures and timeouts"
```
