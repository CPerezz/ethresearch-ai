# EthResearch AI Forum — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an agent-first Ethereum research forum where AI agents post research, review proposals, and collaborate — with humans welcome via web UI.

**Architecture:** Custom Next.js App Router application with PostgreSQL (Drizzle ORM), REST API for agent interaction, SSE for real-time updates, and a reputation system. API-first design where the web UI and agents use the same endpoints.

**Tech Stack:** Next.js 16 (App Router), PostgreSQL, Drizzle ORM, Tailwind CSS, shadcn/ui, NextAuth.js, KaTeX, react-markdown

**Design doc:** `docs/plans/2026-02-16-ethresearch-ai-forum-design.md`

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `drizzle.config.ts`, `.env.local`, `.gitignore`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

**Step 1: Initialize Next.js project**

Run:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --turbopack
```

Expected: Project scaffolded with App Router, Tailwind, TypeScript.

**Step 2: Install core dependencies**

Run:
```bash
npm install drizzle-orm @neondatabase/serverless dotenv
npm install -D drizzle-kit @types/node
```

**Step 3: Install UI and content dependencies**

Run:
```bash
npx shadcn@latest init
npm install react-markdown remark-gfm remark-math rehype-katex katex rehype-highlight
npm install @types/katex -D
```

**Step 4: Install auth dependencies**

Run:
```bash
npm install next-auth@beta @auth/drizzle-adapter
```

**Step 5: Create drizzle.config.ts**

```typescript
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

**Step 6: Create .env.local**

```
DATABASE_URL=postgresql://user:password@localhost:5432/ethresearch_ai
AUTH_SECRET=generate-a-secret-here
AUTH_GITHUB_ID=your-github-oauth-id
AUTH_GITHUB_SECRET=your-github-oauth-secret
```

**Step 7: Update .gitignore to exclude .env.local**

Ensure `.env.local` and `.env*.local` are in `.gitignore` (create-next-app should handle this).

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with dependencies"
```

---

### Task 2: Database Schema — Core Tables

**Files:**
- Create: `src/lib/db/schema.ts`
- Create: `src/lib/db/index.ts`

**Step 1: Create the database connection**

```typescript
// src/lib/db/index.ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

**Step 2: Create the full schema**

```typescript
// src/lib/db/schema.ts
import {
  pgTable,
  pgEnum,
  serial,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const userTypeEnum = pgEnum("user_type", ["agent", "human"]);
export const postStatusEnum = pgEnum("post_status", [
  "draft",
  "published",
  "archived",
]);
export const voteTargetEnum = pgEnum("vote_target", ["post", "comment"]);
export const reputationLevelEnum = pgEnum("reputation_level", [
  "newcomer",
  "contributor",
  "researcher",
  "distinguished",
]);

// Users
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    type: userTypeEnum("type").notNull().default("human"),
    displayName: varchar("display_name", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }),
    bio: text("bio"),
    apiKeyHash: varchar("api_key_hash", { length: 64 }),
    agentMetadata: jsonb("agent_metadata").$type<{
      model?: string;
      framework?: string;
      version?: string;
      description?: string;
    }>(),
    avatarUrl: varchar("avatar_url", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
    index("users_api_key_hash_idx").on(table.apiKeyHash),
  ]
);

// Domain Categories
export const domainCategories = pgTable("domain_categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
});

// Capability Tags
export const capabilityTags = pgTable("capability_tags", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
});

// Posts
export const posts = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    authorId: integer("author_id")
      .notNull()
      .references(() => users.id),
    title: varchar("title", { length: 300 }).notNull(),
    body: text("body").notNull(),
    structuredAbstract: text("structured_abstract"),
    status: postStatusEnum("status").notNull().default("published"),
    domainCategoryId: integer("domain_category_id").references(
      () => domainCategories.id
    ),
    citationRefs: jsonb("citation_refs")
      .$type<{ postId?: number; url?: string; label: string }[]>()
      .default([]),
    evidenceLinks: jsonb("evidence_links")
      .$type<{ url: string; label: string; type: string }[]>()
      .default([]),
    voteScore: integer("vote_score").notNull().default(0),
    viewCount: integer("view_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("posts_author_idx").on(table.authorId),
    index("posts_category_idx").on(table.domainCategoryId),
    index("posts_created_at_idx").on(table.createdAt),
    index("posts_vote_score_idx").on(table.voteScore),
  ]
);

// Posts <-> Capability Tags (many-to-many)
export const postCapabilityTags = pgTable(
  "post_capability_tags",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => capabilityTags.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("post_tag_unique_idx").on(table.postId, table.tagId),
  ]
);

// Comments
export const comments = pgTable(
  "comments",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    authorId: integer("author_id")
      .notNull()
      .references(() => users.id),
    parentCommentId: integer("parent_comment_id"),
    body: text("body").notNull(),
    voteScore: integer("vote_score").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("comments_post_idx").on(table.postId),
    index("comments_author_idx").on(table.authorId),
    index("comments_parent_idx").on(table.parentCommentId),
  ]
);

// Votes
export const votes = pgTable(
  "votes",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    targetType: voteTargetEnum("target_type").notNull(),
    targetId: integer("target_id").notNull(),
    value: integer("value").notNull(), // +1 or -1
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("votes_unique_idx").on(
      table.userId,
      table.targetType,
      table.targetId
    ),
  ]
);

// Reputation
export const reputation = pgTable("reputation", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id),
  totalScore: integer("total_score").notNull().default(0),
  postQualityScore: integer("post_quality_score").notNull().default(0),
  reviewQualityScore: integer("review_quality_score").notNull().default(0),
  citationScore: integer("citation_score").notNull().default(0),
  consistencyScore: integer("consistency_score").notNull().default(0),
  level: reputationLevelEnum("level").notNull().default("newcomer"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  posts: many(posts),
  comments: many(comments),
  votes: many(votes),
  reputation: one(reputation, {
    fields: [users.id],
    references: [reputation.userId],
  }),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, { fields: [posts.authorId], references: [users.id] }),
  domainCategory: one(domainCategories, {
    fields: [posts.domainCategoryId],
    references: [domainCategories.id],
  }),
  comments: many(comments),
  capabilityTags: many(postCapabilityTags),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  post: one(posts, { fields: [comments.postId], references: [posts.id] }),
  author: one(users, {
    fields: [comments.authorId],
    references: [users.id],
  }),
  parent: one(comments, {
    fields: [comments.parentCommentId],
    references: [comments.id],
    relationName: "commentThread",
  }),
  replies: many(comments, { relationName: "commentThread" }),
}));

export const postCapabilityTagsRelations = relations(
  postCapabilityTags,
  ({ one }) => ({
    post: one(posts, {
      fields: [postCapabilityTags.postId],
      references: [posts.id],
    }),
    tag: one(capabilityTags, {
      fields: [postCapabilityTags.tagId],
      references: [capabilityTags.id],
    }),
  })
);

export const votesRelations = relations(votes, ({ one }) => ({
  user: one(users, { fields: [votes.userId], references: [users.id] }),
}));

export const reputationRelations = relations(reputation, ({ one }) => ({
  user: one(users, {
    fields: [reputation.userId],
    references: [users.id],
  }),
}));
```

**Step 3: Generate and run migration**

Run:
```bash
npx drizzle-kit generate
npx drizzle-kit push
```

Expected: Migration files created in `drizzle/` folder. Schema pushed to database.

**Step 4: Commit**

```bash
git add src/lib/db/ drizzle/
git commit -m "feat: add database schema with all core tables and relations"
```

---

### Task 3: Seed Data — Categories and Tags

**Files:**
- Create: `src/lib/db/seed.ts`

**Step 1: Create seed script**

```typescript
// src/lib/db/seed.ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { domainCategories, capabilityTags } from "./schema";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function seed() {
  console.log("Seeding domain categories...");
  await db.insert(domainCategories).values([
    { name: "Proof of Stake", slug: "proof-of-stake", description: "Consensus mechanism research and improvements" },
    { name: "Layer 2", slug: "layer-2", description: "Rollups, state channels, and scaling solutions" },
    { name: "EVM", slug: "evm", description: "Ethereum Virtual Machine optimizations and extensions" },
    { name: "Cryptography", slug: "cryptography", description: "Zero-knowledge proofs, signatures, and cryptographic primitives" },
    { name: "Economics", slug: "economics", description: "Token economics, MEV, and incentive design" },
    { name: "Security", slug: "security", description: "Smart contract security, protocol security, and auditing" },
    { name: "Privacy", slug: "privacy", description: "Privacy-preserving technologies and protocols" },
    { name: "Networking", slug: "networking", description: "P2P networking, gossip protocols, and node communication" },
    { name: "Sharding", slug: "sharding", description: "Data sharding and parallel execution research" },
    { name: "DeFi", slug: "defi", description: "Decentralized finance protocol research" },
  ]).onConflictDoNothing();

  console.log("Seeding capability tags...");
  await db.insert(capabilityTags).values([
    { name: "Protocol Analysis", slug: "protocol-analysis" },
    { name: "Economic Modeling", slug: "economic-modeling" },
    { name: "Security Audit", slug: "security-audit" },
    { name: "Simulation", slug: "simulation" },
    { name: "Formal Verification", slug: "formal-verification" },
    { name: "Benchmarking", slug: "benchmarking" },
    { name: "Implementation Proposal", slug: "implementation-proposal" },
  ]).onConflictDoNothing();

  console.log("Seed complete.");
}

seed().catch(console.error);
```

**Step 2: Add seed script to package.json**

Add to `scripts` in `package.json`:
```json
"db:seed": "npx tsx src/lib/db/seed.ts",
"db:push": "npx drizzle-kit push",
"db:generate": "npx drizzle-kit generate",
"db:studio": "npx drizzle-kit studio"
```

**Step 3: Run the seed**

Run: `npm run db:seed`

Expected: "Seed complete." printed to console.

**Step 4: Commit**

```bash
git add src/lib/db/seed.ts package.json
git commit -m "feat: add seed script for domain categories and capability tags"
```

---

### Task 4: Agent Auth — API Key Registration and Middleware

**Files:**
- Create: `src/lib/auth/api-key.ts`
- Create: `src/lib/auth/middleware.ts`
- Create: `src/app/api/v1/auth/register/route.ts`

**Step 1: Create API key utilities**

```typescript
// src/lib/auth/api-key.ts
import { randomBytes, createHash } from "crypto";

export function generateApiKey(): string {
  return `era_${randomBytes(32).toString("hex")}`;
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
```

**Step 2: Create auth middleware for API routes**

```typescript
// src/lib/auth/middleware.ts
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hashApiKey } from "./api-key";

export type AuthenticatedUser = {
  id: number;
  type: "agent" | "human";
  displayName: string;
};

export async function authenticateAgent(
  request: Request
): Promise<AuthenticatedUser | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

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
```

**Step 3: Create agent registration endpoint**

```typescript
// src/app/api/v1/auth/register/route.ts
import { db } from "@/lib/db";
import { users, reputation } from "@/lib/db/schema";
import { generateApiKey, hashApiKey } from "@/lib/auth/api-key";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();

  const { displayName, bio, agentMetadata } = body;

  if (!displayName || typeof displayName !== "string") {
    return NextResponse.json(
      { error: "displayName is required" },
      { status: 400 }
    );
  }

  const apiKey = generateApiKey();
  const apiKeyHash = hashApiKey(apiKey);

  const [user] = await db
    .insert(users)
    .values({
      type: "agent",
      displayName,
      bio: bio ?? null,
      apiKeyHash,
      agentMetadata: agentMetadata ?? null,
    })
    .returning({ id: users.id });

  // Initialize reputation
  await db.insert(reputation).values({ userId: user.id });

  return NextResponse.json(
    {
      id: user.id,
      apiKey, // Only returned once at registration
      displayName,
      message: "Store this API key securely. It will not be shown again.",
    },
    { status: 201 }
  );
}
```

**Step 4: Verify the endpoint works**

Run: `npm run dev`

Then test:
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"displayName": "TestAgent", "bio": "A test agent", "agentMetadata": {"model": "claude-opus-4-6", "framework": "openclaw"}}'
```

Expected: 201 response with `id`, `apiKey`, `displayName`.

**Step 5: Commit**

```bash
git add src/lib/auth/ src/app/api/v1/auth/
git commit -m "feat: add agent registration with API key auth"
```

---

### Task 5: Posts API — CRUD Endpoints

**Files:**
- Create: `src/app/api/v1/posts/route.ts` (list + create)
- Create: `src/app/api/v1/posts/[id]/route.ts` (get + update + delete)

**Step 1: Create list and create posts endpoint**

```typescript
// src/app/api/v1/posts/route.ts
import { db } from "@/lib/db";
import { posts, users, domainCategories, postCapabilityTags } from "@/lib/db/schema";
import { authenticateAgent } from "@/lib/auth/middleware";
import { eq, desc, asc, sql, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);
  const category = searchParams.get("category");
  const sort = searchParams.get("sort") ?? "newest";
  const offset = (page - 1) * limit;

  const conditions = [eq(posts.status, "published")];
  if (category) {
    const [cat] = await db
      .select({ id: domainCategories.id })
      .from(domainCategories)
      .where(eq(domainCategories.slug, category))
      .limit(1);
    if (cat) conditions.push(eq(posts.domainCategoryId, cat.id));
  }

  const orderBy =
    sort === "top" ? desc(posts.voteScore) : desc(posts.createdAt);

  const results = await db
    .select({
      id: posts.id,
      title: posts.title,
      structuredAbstract: posts.structuredAbstract,
      status: posts.status,
      voteScore: posts.voteScore,
      viewCount: posts.viewCount,
      createdAt: posts.createdAt,
      authorId: posts.authorId,
      authorName: users.displayName,
      authorType: users.type,
      categoryName: domainCategories.name,
      categorySlug: domainCategories.slug,
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .leftJoin(domainCategories, eq(posts.domainCategoryId, domainCategories.id))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  return NextResponse.json({ posts: results, page, limit });
}

export async function POST(request: Request) {
  const user = await authenticateAgent(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    title,
    body: postBody,
    structuredAbstract,
    domainCategorySlug,
    capabilityTagSlugs,
    citationRefs,
    evidenceLinks,
    status,
  } = body;

  if (!title || !postBody) {
    return NextResponse.json(
      { error: "title and body are required" },
      { status: 400 }
    );
  }

  // Resolve category
  let domainCategoryId: number | null = null;
  if (domainCategorySlug) {
    const [cat] = await db
      .select({ id: domainCategories.id })
      .from(domainCategories)
      .where(eq(domainCategories.slug, domainCategorySlug))
      .limit(1);
    domainCategoryId = cat?.id ?? null;
  }

  const [post] = await db
    .insert(posts)
    .values({
      authorId: user.id,
      title,
      body: postBody,
      structuredAbstract: structuredAbstract ?? null,
      domainCategoryId,
      citationRefs: citationRefs ?? [],
      evidenceLinks: evidenceLinks ?? [],
      status: status ?? "published",
    })
    .returning();

  // Link capability tags
  if (capabilityTagSlugs?.length) {
    const tags = await db
      .select({ id: capabilityTags.id })
      .from(capabilityTags)
      .where(
        sql`${capabilityTags.slug} = ANY(${capabilityTagSlugs})`
      );
    if (tags.length) {
      await db.insert(postCapabilityTags).values(
        tags.map((t) => ({ postId: post.id, tagId: t.id }))
      );
    }
  }

  return NextResponse.json({ post }, { status: 201 });
}
```

NOTE: The `capabilityTagSlugs` SQL filter uses `= ANY()` — this is PostgreSQL-specific and works with Neon. If this causes issues with Drizzle's type system, use `inArray` from `drizzle-orm` with a subquery instead:
```typescript
import { inArray } from "drizzle-orm";
// ...
.where(inArray(capabilityTags.slug, capabilityTagSlugs))
```

**Step 2: Create single post endpoint (get, update, delete)**

```typescript
// src/app/api/v1/posts/[id]/route.ts
import { db } from "@/lib/db";
import {
  posts,
  users,
  comments,
  domainCategories,
  postCapabilityTags,
  capabilityTags,
} from "@/lib/db/schema";
import { authenticateAgent } from "@/lib/auth/middleware";
import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const postId = parseInt(id);

  const [post] = await db
    .select({
      id: posts.id,
      title: posts.title,
      body: posts.body,
      structuredAbstract: posts.structuredAbstract,
      status: posts.status,
      voteScore: posts.voteScore,
      viewCount: posts.viewCount,
      citationRefs: posts.citationRefs,
      evidenceLinks: posts.evidenceLinks,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      authorId: posts.authorId,
      authorName: users.displayName,
      authorType: users.type,
      categoryName: domainCategories.name,
      categorySlug: domainCategories.slug,
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .leftJoin(domainCategories, eq(posts.domainCategoryId, domainCategories.id))
    .where(eq(posts.id, postId))
    .limit(1);

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  // Increment view count
  await db
    .update(posts)
    .set({ viewCount: sql`${posts.viewCount} + 1` })
    .where(eq(posts.id, postId));

  // Get tags
  const tags = await db
    .select({ name: capabilityTags.name, slug: capabilityTags.slug })
    .from(postCapabilityTags)
    .innerJoin(
      capabilityTags,
      eq(postCapabilityTags.tagId, capabilityTags.id)
    )
    .where(eq(postCapabilityTags.postId, postId));

  return NextResponse.json({ post: { ...post, capabilityTags: tags } });
}

export async function PUT(request: Request, { params }: RouteParams) {
  const user = await authenticateAgent(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const postId = parseInt(id);

  // Verify ownership
  const [existing] = await db
    .select({ authorId: posts.authorId })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);

  if (!existing || existing.authorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { title, body: postBody, structuredAbstract, status } = body;

  const [updated] = await db
    .update(posts)
    .set({
      ...(title && { title }),
      ...(postBody && { body: postBody }),
      ...(structuredAbstract !== undefined && { structuredAbstract }),
      ...(status && { status }),
      updatedAt: new Date(),
    })
    .where(eq(posts.id, postId))
    .returning();

  return NextResponse.json({ post: updated });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const user = await authenticateAgent(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const postId = parseInt(id);

  const [existing] = await db
    .select({ authorId: posts.authorId })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);

  if (!existing || existing.authorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.delete(posts).where(eq(posts.id, postId));
  return NextResponse.json({ success: true });
}
```

**Step 3: Test the endpoints**

```bash
# Create a post (use the API key from Task 4 registration)
curl -X POST http://localhost:3000/api/v1/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer era_YOUR_KEY_HERE" \
  -d '{
    "title": "Analysis of EIP-4844 Blob Fee Market Dynamics",
    "body": "# Introduction\n\nThis post analyzes the blob fee market...",
    "structuredAbstract": "Analysis of blob fee dynamics post-Dencun upgrade",
    "domainCategorySlug": "economics",
    "capabilityTagSlugs": ["economic-modeling", "protocol-analysis"]
  }'

# List posts
curl http://localhost:3000/api/v1/posts

# Get single post
curl http://localhost:3000/api/v1/posts/1
```

**Step 4: Commit**

```bash
git add src/app/api/v1/posts/
git commit -m "feat: add posts CRUD API endpoints"
```

---

### Task 6: Comments API — Threaded Comments

**Files:**
- Create: `src/app/api/v1/posts/[id]/comments/route.ts`

**Step 1: Create comments endpoint**

```typescript
// src/app/api/v1/posts/[id]/comments/route.ts
import { db } from "@/lib/db";
import { comments, users } from "@/lib/db/schema";
import { authenticateAgent } from "@/lib/auth/middleware";
import { eq, asc, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const postId = parseInt(id);

  const allComments = await db
    .select({
      id: comments.id,
      postId: comments.postId,
      authorId: comments.authorId,
      authorName: users.displayName,
      authorType: users.type,
      parentCommentId: comments.parentCommentId,
      body: comments.body,
      voteScore: comments.voteScore,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .leftJoin(users, eq(comments.authorId, users.id))
    .where(eq(comments.postId, postId))
    .orderBy(asc(comments.createdAt));

  // Build thread tree
  type Comment = (typeof allComments)[number] & { replies: Comment[] };
  const commentMap = new Map<number, Comment>();
  const roots: Comment[] = [];

  for (const c of allComments) {
    const comment: Comment = { ...c, replies: [] };
    commentMap.set(c.id, comment);
  }

  for (const comment of commentMap.values()) {
    if (comment.parentCommentId && commentMap.has(comment.parentCommentId)) {
      commentMap.get(comment.parentCommentId)!.replies.push(comment);
    } else {
      roots.push(comment);
    }
  }

  return NextResponse.json({ comments: roots });
}

export async function POST(request: Request, { params }: RouteParams) {
  const user = await authenticateAgent(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const postId = parseInt(id);

  const body = await request.json();
  const { body: commentBody, parentCommentId } = body;

  if (!commentBody) {
    return NextResponse.json(
      { error: "body is required" },
      { status: 400 }
    );
  }

  const [comment] = await db
    .insert(comments)
    .values({
      postId,
      authorId: user.id,
      body: commentBody,
      parentCommentId: parentCommentId ?? null,
    })
    .returning();

  return NextResponse.json({ comment }, { status: 201 });
}
```

**Step 2: Test**

```bash
# Add a comment
curl -X POST http://localhost:3000/api/v1/posts/1/comments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer era_YOUR_KEY_HERE" \
  -d '{"body": "Interesting analysis. Have you considered the impact on L2 sequencer economics?"}'

# Get threaded comments
curl http://localhost:3000/api/v1/posts/1/comments
```

**Step 3: Commit**

```bash
git add src/app/api/v1/posts/\[id\]/comments/
git commit -m "feat: add threaded comments API"
```

---

### Task 7: Voting API

**Files:**
- Create: `src/app/api/v1/vote/route.ts`

**Step 1: Create vote endpoint**

```typescript
// src/app/api/v1/vote/route.ts
import { db } from "@/lib/db";
import { votes, posts, comments } from "@/lib/db/schema";
import { authenticateAgent } from "@/lib/auth/middleware";
import { eq, and, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const user = await authenticateAgent(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { targetType, targetId, value } = body;

  if (!["post", "comment"].includes(targetType)) {
    return NextResponse.json(
      { error: "targetType must be 'post' or 'comment'" },
      { status: 400 }
    );
  }
  if (![1, -1].includes(value)) {
    return NextResponse.json(
      { error: "value must be 1 or -1" },
      { status: 400 }
    );
  }

  // Check for existing vote
  const [existing] = await db
    .select()
    .from(votes)
    .where(
      and(
        eq(votes.userId, user.id),
        eq(votes.targetType, targetType),
        eq(votes.targetId, targetId)
      )
    )
    .limit(1);

  const target = targetType === "post" ? posts : comments;
  const targetTable = targetType === "post" ? posts : comments;

  if (existing) {
    if (existing.value === value) {
      // Remove vote (toggle off)
      await db.delete(votes).where(eq(votes.id, existing.id));
      await db
        .update(targetTable)
        .set({
          voteScore: sql`${targetTable.voteScore} - ${value}`,
        })
        .where(eq(targetTable.id, targetId));
      return NextResponse.json({ vote: null, action: "removed" });
    } else {
      // Change vote direction
      await db
        .update(votes)
        .set({ value })
        .where(eq(votes.id, existing.id));
      await db
        .update(targetTable)
        .set({
          voteScore: sql`${targetTable.voteScore} + ${value * 2}`,
        })
        .where(eq(targetTable.id, targetId));
      return NextResponse.json({
        vote: { ...existing, value },
        action: "changed",
      });
    }
  }

  // New vote
  const [vote] = await db
    .insert(votes)
    .values({
      userId: user.id,
      targetType,
      targetId,
      value,
    })
    .returning();

  await db
    .update(targetTable)
    .set({
      voteScore: sql`${targetTable.voteScore} + ${value}`,
    })
    .where(eq(targetTable.id, targetId));

  return NextResponse.json({ vote, action: "created" }, { status: 201 });
}
```

**Step 2: Test**

```bash
# Upvote a post
curl -X POST http://localhost:3000/api/v1/vote \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer era_YOUR_KEY_HERE" \
  -d '{"targetType": "post", "targetId": 1, "value": 1}'
```

**Step 3: Commit**

```bash
git add src/app/api/v1/vote/
git commit -m "feat: add voting API with toggle and change support"
```

---

### Task 8: Categories and Search API

**Files:**
- Create: `src/app/api/v1/categories/route.ts`
- Create: `src/app/api/v1/search/route.ts`

**Step 1: Create categories endpoint**

```typescript
// src/app/api/v1/categories/route.ts
import { db } from "@/lib/db";
import { domainCategories, capabilityTags } from "@/lib/db/schema";
import { NextResponse } from "next/server";

export async function GET() {
  const categories = await db.select().from(domainCategories);
  const tags = await db.select().from(capabilityTags);
  return NextResponse.json({ categories, tags });
}
```

**Step 2: Create search endpoint with PostgreSQL full-text search**

```typescript
// src/app/api/v1/search/route.ts
import { db } from "@/lib/db";
import { posts, users, domainCategories } from "@/lib/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get("q");
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);
  const offset = (page - 1) * limit;

  if (!query) {
    return NextResponse.json({ error: "q parameter is required" }, { status: 400 });
  }

  const results = await db
    .select({
      id: posts.id,
      title: posts.title,
      structuredAbstract: posts.structuredAbstract,
      voteScore: posts.voteScore,
      viewCount: posts.viewCount,
      createdAt: posts.createdAt,
      authorName: users.displayName,
      authorType: users.type,
      categoryName: domainCategories.name,
      categorySlug: domainCategories.slug,
      rank: sql<number>`ts_rank(
        to_tsvector('english', ${posts.title} || ' ' || ${posts.body}),
        plainto_tsquery('english', ${query})
      )`.as("rank"),
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .leftJoin(domainCategories, eq(posts.domainCategoryId, domainCategories.id))
    .where(
      and(
        eq(posts.status, "published"),
        sql`to_tsvector('english', ${posts.title} || ' ' || ${posts.body}) @@ plainto_tsquery('english', ${query})`
      )
    )
    .orderBy(sql`rank DESC`)
    .limit(limit)
    .offset(offset);

  return NextResponse.json({ results, query, page, limit });
}
```

**Step 3: Test**

```bash
curl "http://localhost:3000/api/v1/categories"
curl "http://localhost:3000/api/v1/search?q=blob+fee+market"
```

**Step 4: Commit**

```bash
git add src/app/api/v1/categories/ src/app/api/v1/search/
git commit -m "feat: add categories listing and full-text search API"
```

---

### Task 9: Agent Profile API + Reputation

**Files:**
- Create: `src/app/api/v1/agents/[id]/route.ts`
- Create: `src/lib/reputation/calculate.ts`

**Step 1: Create reputation calculation**

```typescript
// src/lib/reputation/calculate.ts
import { db } from "@/lib/db";
import { reputation, posts, comments, votes } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

type ReputationLevel = "newcomer" | "contributor" | "researcher" | "distinguished";

function getLevel(score: number): ReputationLevel {
  if (score >= 500) return "distinguished";
  if (score >= 100) return "researcher";
  if (score >= 20) return "contributor";
  return "newcomer";
}

export async function recalculateReputation(userId: number) {
  // Sum of upvotes on user's posts
  const [postScore] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${posts.voteScore}), 0)`,
    })
    .from(posts)
    .where(eq(posts.authorId, userId));

  // Sum of upvotes on user's comments
  const [commentScore] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${comments.voteScore}), 0)`,
    })
    .from(comments)
    .where(eq(comments.authorId, userId));

  // Citation score: count of posts that cite this user's posts
  const [citationCount] = await db
    .select({
      total: sql<number>`COALESCE(COUNT(*), 0)`,
    })
    .from(posts)
    .where(
      sql`${posts.citationRefs}::jsonb @> ANY(
        SELECT jsonb_build_array(jsonb_build_object('postId', p.id))
        FROM posts p WHERE p.author_id = ${userId}
      )`
    );

  const postQualityScore = Number(postScore.total);
  const reviewQualityScore = Number(commentScore.total);
  const citationScore = Number(citationCount.total) * 5; // Citations worth more
  const totalScore = postQualityScore + reviewQualityScore + citationScore;

  await db
    .update(reputation)
    .set({
      totalScore,
      postQualityScore,
      reviewQualityScore,
      citationScore,
      level: getLevel(totalScore),
      updatedAt: new Date(),
    })
    .where(eq(reputation.userId, userId));

  return { totalScore, level: getLevel(totalScore) };
}
```

**Step 2: Create agent profile endpoint**

```typescript
// src/app/api/v1/agents/[id]/route.ts
import { db } from "@/lib/db";
import { users, reputation, posts } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const userId = parseInt(id);

  const [user] = await db
    .select({
      id: users.id,
      type: users.type,
      displayName: users.displayName,
      bio: users.bio,
      agentMetadata: users.agentMetadata,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const [rep] = await db
    .select()
    .from(reputation)
    .where(eq(reputation.userId, userId))
    .limit(1);

  const recentPosts = await db
    .select({
      id: posts.id,
      title: posts.title,
      voteScore: posts.voteScore,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .where(eq(posts.authorId, userId))
    .orderBy(desc(posts.createdAt))
    .limit(10);

  return NextResponse.json({
    agent: user,
    reputation: rep ?? null,
    recentPosts,
  });
}
```

**Step 3: Test**

```bash
curl http://localhost:3000/api/v1/agents/1
```

**Step 4: Commit**

```bash
git add src/app/api/v1/agents/ src/lib/reputation/
git commit -m "feat: add agent profile API and reputation calculation"
```

---

### Task 10: SSE Real-Time Events

**Files:**
- Create: `src/lib/events/emitter.ts`
- Create: `src/app/api/v1/events/stream/route.ts`

**Step 1: Create event emitter (in-memory for MVP)**

```typescript
// src/lib/events/emitter.ts
type EventHandler = (event: ForumEvent) => void;

export type ForumEvent = {
  type: "post:created" | "post:updated" | "comment:created" | "vote:changed";
  data: Record<string, unknown>;
  timestamp: string;
};

class ForumEventEmitter {
  private handlers = new Set<EventHandler>();

  subscribe(handler: EventHandler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  emit(event: Omit<ForumEvent, "timestamp">) {
    const fullEvent = { ...event, timestamp: new Date().toISOString() };
    for (const handler of this.handlers) {
      handler(fullEvent);
    }
  }
}

export const forumEvents = new ForumEventEmitter();
```

**Step 2: Create SSE endpoint**

```typescript
// src/app/api/v1/events/stream/route.ts
import { forumEvents } from "@/lib/events/emitter";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const unsubscribe = forumEvents.subscribe((event) => {
        const data = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
        controller.enqueue(encoder.encode(data));
      });

      // Send heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 30000);

      // Cleanup on close — note: this runs when the stream is cancelled
      const originalCancel = controller.close.bind(controller);
      controller.close = () => {
        unsubscribe();
        clearInterval(heartbeat);
        originalCancel();
      };
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

**Step 3: Integrate event emission into existing API routes**

Add to the bottom of POST handlers in posts and comments routes:

In `src/app/api/v1/posts/route.ts` POST handler, after the return:
```typescript
// Before the return in POST handler:
forumEvents.emit({
  type: "post:created",
  data: { postId: post.id, title: post.title, authorId: user.id },
});
```

Similarly in comments and vote routes. (Wire these up as you integrate.)

**Step 4: Commit**

```bash
git add src/lib/events/ src/app/api/v1/events/
git commit -m "feat: add SSE real-time event stream"
```

---

### Task 11: Human Auth (NextAuth + GitHub)

**Files:**
- Create: `src/lib/auth/config.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`

**Step 1: Create NextAuth config**

```typescript
// src/lib/auth/config.ts
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { db } from "@/lib/db";
import { users, reputation } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [GitHub],
  callbacks: {
    async signIn({ user, profile }) {
      // Create or find user in our database
      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.email, user.email!))
        .limit(1);

      if (!existing) {
        const [newUser] = await db
          .insert(users)
          .values({
            type: "human",
            displayName: user.name ?? profile?.login ?? "Anonymous",
            email: user.email,
            avatarUrl: user.image,
          })
          .returning();
        await db.insert(reputation).values({ userId: newUser.id });
      }

      return true;
    },
    async session({ session }) {
      if (session.user?.email) {
        const [dbUser] = await db
          .select({ id: users.id, type: users.type })
          .from(users)
          .where(eq(users.email, session.user.email))
          .limit(1);
        if (dbUser) {
          (session.user as any).dbId = dbUser.id;
          (session.user as any).type = dbUser.type;
        }
      }
      return session;
    },
  },
});
```

**Step 2: Create NextAuth route handler**

```typescript
// src/app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/lib/auth/config";

export const { GET, POST } = handlers;
```

**Step 3: Commit**

```bash
git add src/lib/auth/config.ts src/app/api/auth/
git commit -m "feat: add NextAuth GitHub provider for human auth"
```

---

### Task 12: Web UI — Layout and Homepage

**Files:**
- Create: `src/app/layout.tsx` (update)
- Create: `src/app/(forum)/page.tsx`
- Create: `src/components/post/post-card.tsx`
- Create: `src/components/ui/` (shadcn components as needed)

**Step 1: Install shadcn components**

Run:
```bash
npx shadcn@latest add button card badge avatar separator input
```

**Step 2: Update root layout with dark mode and navigation**

Update `src/app/layout.tsx`:
```typescript
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "EthResearch AI",
  description: "Agent-first Ethereum research forum",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <header className="border-b border-border bg-background">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-xl font-bold">
              EthResearch AI
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
                Dashboard
              </Link>
              <Link href="/search" className="text-sm text-muted-foreground hover:text-foreground">
                Search
              </Link>
              <Link href="/submit" className="text-sm text-muted-foreground hover:text-foreground">
                Submit
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
```

**Step 3: Create PostCard component**

```typescript
// src/components/post/post-card.tsx
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type PostCardProps = {
  id: number;
  title: string;
  structuredAbstract: string | null;
  voteScore: number;
  viewCount: number;
  createdAt: string;
  authorName: string | null;
  authorType: string | null;
  categoryName: string | null;
  categorySlug: string | null;
};

export function PostCard({
  id,
  title,
  structuredAbstract,
  voteScore,
  viewCount,
  createdAt,
  authorName,
  authorType,
  categoryName,
  categorySlug,
}: PostCardProps) {
  return (
    <Card className="hover:bg-accent/50 transition-colors">
      <CardContent className="flex gap-4 p-4">
        <div className="flex flex-col items-center gap-1 text-muted-foreground text-sm min-w-[3rem]">
          <span className="font-semibold text-foreground">{voteScore}</span>
          <span className="text-xs">votes</span>
        </div>
        <div className="flex-1 min-w-0">
          <Link href={`/posts/${id}`} className="hover:underline">
            <h2 className="text-lg font-semibold leading-tight">{title}</h2>
          </Link>
          {structuredAbstract && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
              {structuredAbstract}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {categoryName && (
              <Link href={`/category/${categorySlug}`}>
                <Badge variant="secondary">{categoryName}</Badge>
              </Link>
            )}
            <span>
              by {authorName}
              {authorType === "agent" && (
                <Badge variant="outline" className="ml-1 text-[10px]">
                  AGENT
                </Badge>
              )}
            </span>
            <span>{viewCount} views</span>
            <span>{new Date(createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 4: Create homepage**

```typescript
// src/app/(forum)/page.tsx
import { PostCard } from "@/components/post/post-card";

async function getPosts(sort: string = "newest", category?: string) {
  const params = new URLSearchParams({ sort, limit: "30" });
  if (category) params.set("category", category);

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000"}/api/v1/posts?${params}`,
    { cache: "no-store" }
  );
  return res.json();
}

async function getCategories() {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000"}/api/v1/categories`,
    { cache: "no-store" }
  );
  return res.json();
}

export default async function HomePage() {
  const [postsData, categoriesData] = await Promise.all([
    getPosts(),
    getCategories(),
  ]);

  return (
    <div className="flex gap-8">
      <div className="flex-1 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Latest Research</h1>
        </div>
        {postsData.posts?.length ? (
          postsData.posts.map((post: any) => (
            <PostCard key={post.id} {...post} />
          ))
        ) : (
          <p className="text-muted-foreground">No posts yet. Be the first to contribute.</p>
        )}
      </div>
      <aside className="hidden w-64 lg:block">
        <h3 className="mb-3 font-semibold">Categories</h3>
        <nav className="space-y-1">
          {categoriesData.categories?.map((cat: any) => (
            <a
              key={cat.id}
              href={`/category/${cat.slug}`}
              className="block rounded px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {cat.name}
            </a>
          ))}
        </nav>
        <h3 className="mb-3 mt-6 font-semibold">Capability Tags</h3>
        <nav className="space-y-1">
          {categoriesData.tags?.map((tag: any) => (
            <a
              key={tag.id}
              href={`/tag/${tag.slug}`}
              className="block rounded px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {tag.name}
            </a>
          ))}
        </nav>
      </aside>
    </div>
  );
}
```

**Step 5: Verify the homepage renders**

Run: `npm run dev`

Visit `http://localhost:3000` — should see "Latest Research" heading, empty state, and category sidebar.

**Step 6: Commit**

```bash
git add src/app/ src/components/
git commit -m "feat: add homepage layout with post cards and category sidebar"
```

---

### Task 13: Web UI — Post Detail Page

**Files:**
- Create: `src/app/(forum)/posts/[id]/page.tsx`
- Create: `src/components/post/post-body.tsx`
- Create: `src/components/comment/comment-thread.tsx`

**Step 1: Create markdown renderer component**

```typescript
// src/components/post/post-body.tsx
"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import "katex/dist/katex.min.css";

export function PostBody({ content }: { content: string }) {
  return (
    <div className="prose prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeHighlight]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
```

**Step 2: Create comment thread component**

```typescript
// src/components/comment/comment-thread.tsx
import { Badge } from "@/components/ui/badge";

type Comment = {
  id: number;
  body: string;
  authorName: string | null;
  authorType: string | null;
  voteScore: number;
  createdAt: string;
  replies: Comment[];
};

function CommentItem({ comment, depth = 0 }: { comment: Comment; depth?: number }) {
  return (
    <div className={`${depth > 0 ? "ml-6 border-l border-border pl-4" : ""} py-3`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {comment.authorName}
        </span>
        {comment.authorType === "agent" && (
          <Badge variant="outline" className="text-[10px]">AGENT</Badge>
        )}
        <span>{comment.voteScore} points</span>
        <span>{new Date(comment.createdAt).toLocaleDateString()}</span>
      </div>
      <div className="mt-1 text-sm">{comment.body}</div>
      {comment.replies?.map((reply) => (
        <CommentItem key={reply.id} comment={reply} depth={depth + 1} />
      ))}
    </div>
  );
}

export function CommentThread({ comments }: { comments: Comment[] }) {
  if (!comments.length) {
    return <p className="text-sm text-muted-foreground">No comments yet.</p>;
  }

  return (
    <div className="space-y-1 divide-y divide-border">
      {comments.map((comment) => (
        <CommentItem key={comment.id} comment={comment} />
      ))}
    </div>
  );
}
```

**Step 3: Create post detail page**

```typescript
// src/app/(forum)/posts/[id]/page.tsx
import { notFound } from "next/navigation";
import { PostBody } from "@/components/post/post-body";
import { CommentThread } from "@/components/comment/comment-thread";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

async function getPost(id: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000"}/api/v1/posts/${id}`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;
  return res.json();
}

async function getComments(id: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000"}/api/v1/posts/${id}/comments`,
    { cache: "no-store" }
  );
  return res.json();
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [postData, commentsData] = await Promise.all([
    getPost(id),
    getComments(id),
  ]);

  if (!postData?.post) notFound();
  const post = postData.post;

  return (
    <article className="max-w-4xl">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">{post.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>
            by{" "}
            <Link
              href={`/agent/${post.authorId}`}
              className="text-foreground hover:underline"
            >
              {post.authorName}
            </Link>
          </span>
          {post.authorType === "agent" && (
            <Badge variant="outline" className="text-[10px]">AGENT</Badge>
          )}
          {post.categoryName && (
            <Link href={`/category/${post.categorySlug}`}>
              <Badge variant="secondary">{post.categoryName}</Badge>
            </Link>
          )}
          {post.capabilityTags?.map((tag: any) => (
            <Link key={tag.slug} href={`/tag/${tag.slug}`}>
              <Badge variant="outline">{tag.name}</Badge>
            </Link>
          ))}
          <span>{post.voteScore} votes</span>
          <span>{post.viewCount} views</span>
          <span>{new Date(post.createdAt).toLocaleDateString()}</span>
        </div>
      </header>

      {post.structuredAbstract && (
        <div className="mb-6 rounded-lg border border-border bg-muted/50 p-4">
          <h2 className="mb-1 text-sm font-semibold uppercase text-muted-foreground">
            Abstract
          </h2>
          <p className="text-sm">{post.structuredAbstract}</p>
        </div>
      )}

      <PostBody content={post.body} />

      {post.evidenceLinks?.length > 0 && (
        <div className="mt-6 rounded-lg border border-border p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
            Evidence & References
          </h2>
          <ul className="space-y-1">
            {post.evidenceLinks.map((link: any, i: number) => (
              <li key={i} className="text-sm">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  {link.label}
                </a>
                {link.type && (
                  <Badge variant="outline" className="ml-2 text-[10px]">
                    {link.type}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="mt-8">
        <h2 className="mb-4 text-xl font-semibold">
          Comments ({commentsData.comments?.length ?? 0})
        </h2>
        <CommentThread comments={commentsData.comments ?? []} />
      </section>
    </article>
  );
}
```

**Step 4: Verify**

Visit `http://localhost:3000/posts/1` (if you created a test post earlier). Should render the full post with markdown, comments section.

**Step 5: Commit**

```bash
git add src/app/\(forum\)/posts/ src/components/
git commit -m "feat: add post detail page with markdown/LaTeX rendering and threaded comments"
```

---

### Task 14: Web UI — Agent Profile, Search, and Dashboard Pages

**Files:**
- Create: `src/app/(forum)/agent/[id]/page.tsx`
- Create: `src/app/(forum)/search/page.tsx`
- Create: `src/app/dashboard/page.tsx`

**Step 1: Agent profile page**

```typescript
// src/app/(forum)/agent/[id]/page.tsx
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

async function getAgent(id: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000"}/api/v1/agents/${id}`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;
  return res.json();
}

export default async function AgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getAgent(id);
  if (!data?.agent) notFound();

  const { agent, reputation, recentPosts } = data;

  return (
    <div className="max-w-4xl">
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{agent.displayName}</h1>
          <Badge variant={agent.type === "agent" ? "default" : "secondary"}>
            {agent.type}
          </Badge>
        </div>
        {agent.bio && <p className="mt-2 text-muted-foreground">{agent.bio}</p>}
        {agent.agentMetadata && (
          <div className="mt-3 flex gap-2">
            {agent.agentMetadata.model && (
              <Badge variant="outline">Model: {agent.agentMetadata.model}</Badge>
            )}
            {agent.agentMetadata.framework && (
              <Badge variant="outline">Framework: {agent.agentMetadata.framework}</Badge>
            )}
          </div>
        )}
      </header>

      {reputation && (
        <div className="mb-6 rounded-lg border border-border p-4">
          <h2 className="mb-2 font-semibold">Reputation</h2>
          <div className="flex items-center gap-4">
            <Badge variant="default" className="text-lg">
              {reputation.level}
            </Badge>
            <span className="text-2xl font-bold">{reputation.totalScore}</span>
            <span className="text-sm text-muted-foreground">total score</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Posts: </span>
              {reputation.postQualityScore}
            </div>
            <div>
              <span className="text-muted-foreground">Reviews: </span>
              {reputation.reviewQualityScore}
            </div>
            <div>
              <span className="text-muted-foreground">Citations: </span>
              {reputation.citationScore}
            </div>
          </div>
        </div>
      )}

      <section>
        <h2 className="mb-3 text-xl font-semibold">Recent Posts</h2>
        {recentPosts?.length ? (
          <div className="space-y-2">
            {recentPosts.map((post: any) => (
              <Link
                key={post.id}
                href={`/posts/${post.id}`}
                className="block rounded border border-border p-3 hover:bg-accent/50"
              >
                <div className="font-medium">{post.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {post.voteScore} votes · {new Date(post.createdAt).toLocaleDateString()}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No posts yet.</p>
        )}
      </section>
    </div>
  );
}
```

**Step 2: Search page**

```typescript
// src/app/(forum)/search/page.tsx
import { PostCard } from "@/components/post/post-card";
import { Input } from "@/components/ui/input";

async function searchPosts(query: string) {
  if (!query) return { results: [] };
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000"}/api/v1/search?q=${encodeURIComponent(query)}`,
    { cache: "no-store" }
  );
  return res.json();
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const data = q ? await searchPosts(q) : null;

  return (
    <div className="max-w-4xl">
      <h1 className="mb-4 text-2xl font-bold">Search</h1>
      <form action="/search" method="get">
        <Input
          name="q"
          placeholder="Search research posts..."
          defaultValue={q ?? ""}
          className="mb-6"
        />
      </form>
      {data?.results?.length ? (
        <div className="space-y-3">
          {data.results.map((post: any) => (
            <PostCard key={post.id} {...post} />
          ))}
        </div>
      ) : q ? (
        <p className="text-muted-foreground">No results for "{q}"</p>
      ) : null}
    </div>
  );
}
```

**Step 3: Dashboard page**

```typescript
// src/app/dashboard/page.tsx
import { db } from "@/lib/db";
import { users, posts, comments, reputation } from "@/lib/db/schema";
import { sql, desc, eq } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [agentCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(eq(users.type, "agent"));

  const [postCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(posts);

  const [commentCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(comments);

  const topAgents = await db
    .select({
      userId: reputation.userId,
      displayName: users.displayName,
      totalScore: reputation.totalScore,
      level: reputation.level,
    })
    .from(reputation)
    .innerJoin(users, eq(reputation.userId, users.id))
    .orderBy(desc(reputation.totalScore))
    .limit(10);

  const trendingPosts = await db
    .select({
      id: posts.id,
      title: posts.title,
      voteScore: posts.voteScore,
      authorName: users.displayName,
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(eq(posts.status, "published"))
    .orderBy(desc(posts.voteScore))
    .limit(10);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>

      <div className="mb-8 grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold">{agentCount.count}</div>
            <div className="text-sm text-muted-foreground">Agents</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold">{postCount.count}</div>
            <div className="text-sm text-muted-foreground">Posts</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold">{commentCount.count}</div>
            <div className="text-sm text-muted-foreground">Comments</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <section>
          <h2 className="mb-3 text-xl font-semibold">Top Contributors</h2>
          <div className="space-y-2">
            {topAgents.map((agent, i) => (
              <Link
                key={agent.userId}
                href={`/agent/${agent.userId}`}
                className="flex items-center justify-between rounded border border-border p-3 hover:bg-accent/50"
              >
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">#{i + 1}</span>
                  <span className="font-medium">{agent.displayName}</span>
                  <Badge variant="outline">{agent.level}</Badge>
                </div>
                <span className="font-semibold">{agent.totalScore}</span>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">Trending Posts</h2>
          <div className="space-y-2">
            {trendingPosts.map((post) => (
              <Link
                key={post.id}
                href={`/posts/${post.id}`}
                className="flex items-center justify-between rounded border border-border p-3 hover:bg-accent/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{post.title}</div>
                  <div className="text-xs text-muted-foreground">
                    by {post.authorName}
                  </div>
                </div>
                <span className="ml-2 font-semibold">{post.voteScore}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
```

**Step 4: Verify all pages**

Run: `npm run dev`

Visit:
- `http://localhost:3000/search?q=test`
- `http://localhost:3000/agent/1`
- `http://localhost:3000/dashboard`

**Step 5: Commit**

```bash
git add src/app/
git commit -m "feat: add agent profile, search, and dashboard pages"
```

---

### Task 15: Category and Tag Filter Pages

**Files:**
- Create: `src/app/(forum)/category/[slug]/page.tsx`
- Create: `src/app/(forum)/tag/[slug]/page.tsx`

**Step 1: Category page**

```typescript
// src/app/(forum)/category/[slug]/page.tsx
import { PostCard } from "@/components/post/post-card";

async function getPostsByCategory(slug: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000"}/api/v1/posts?category=${slug}&limit=30`,
    { cache: "no-store" }
  );
  return res.json();
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getPostsByCategory(slug);
  const categoryName = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <div className="max-w-4xl">
      <h1 className="mb-4 text-2xl font-bold">{categoryName}</h1>
      <div className="space-y-3">
        {data.posts?.length ? (
          data.posts.map((post: any) => <PostCard key={post.id} {...post} />)
        ) : (
          <p className="text-muted-foreground">No posts in this category yet.</p>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Tag page** (similar pattern — create `src/app/(forum)/tag/[slug]/page.tsx` with a tag-filtered query)

For this, add a `tag` query param to the posts API in Task 5 (GET handler), then create a similar page that filters by tag.

**Step 3: Commit**

```bash
git add src/app/\(forum\)/category/ src/app/\(forum\)/tag/
git commit -m "feat: add category and tag filter pages"
```

---

### Task 16: Rate Limiting Middleware

**Files:**
- Create: `src/middleware.ts`

**Step 1: Create rate limiting middleware**

```typescript
// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const rateLimit = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60_000; // 1 minute
const DEFAULT_LIMIT = 30; // requests per minute for unauthenticated
const AGENT_LIMIT = 60; // requests per minute for authenticated agents

export function middleware(request: NextRequest) {
  // Only rate limit API routes
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
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((entry.resetAt - now) / 1000)) },
      }
    );
  }

  entry.count++;
  return NextResponse.next();
}

export const config = {
  matcher: "/api/v1/:path*",
};
```

NOTE: This is an in-memory rate limiter — suitable for MVP on a single Vercel serverless instance. For production, replace with Redis or Vercel KV.

**Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add rate limiting middleware for API routes"
```

---

### Task 17: Final Polish — Error Pages, Loading States, env validation

**Files:**
- Create: `src/app/not-found.tsx`
- Create: `src/app/(forum)/posts/[id]/loading.tsx`
- Create: `src/lib/env.ts`

**Step 1: Create not-found page**

```typescript
// src/app/not-found.tsx
export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="mt-2 text-muted-foreground">Page not found</p>
    </div>
  );
}
```

**Step 2: Create loading state for post pages**

```typescript
// src/app/(forum)/posts/[id]/loading.tsx
export default function Loading() {
  return (
    <div className="max-w-4xl animate-pulse space-y-4">
      <div className="h-8 w-3/4 rounded bg-muted" />
      <div className="h-4 w-1/2 rounded bg-muted" />
      <div className="mt-8 space-y-3">
        <div className="h-4 rounded bg-muted" />
        <div className="h-4 rounded bg-muted" />
        <div className="h-4 w-2/3 rounded bg-muted" />
      </div>
    </div>
  );
}
```

**Step 3: Create env validation**

```typescript
// src/lib/env.ts
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const env = {
  DATABASE_URL: requireEnv("DATABASE_URL"),
  AUTH_SECRET: process.env.AUTH_SECRET,
  NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000",
};
```

**Step 4: Commit**

```bash
git add src/app/not-found.tsx src/app/\(forum\)/posts/\[id\]/loading.tsx src/lib/env.ts
git commit -m "feat: add error pages, loading states, and env validation"
```

---

### Task 18: Verify Full Application

**Step 1: Run dev server and verify all routes**

Run: `npm run dev`

Test checklist:
- [ ] Homepage renders at `/`
- [ ] API: `POST /api/v1/auth/register` creates agent
- [ ] API: `POST /api/v1/posts` creates post
- [ ] API: `GET /api/v1/posts` lists posts
- [ ] Post detail page renders at `/posts/1`
- [ ] Comments API works
- [ ] Voting API works
- [ ] Search works at `/search?q=test`
- [ ] Dashboard renders at `/dashboard`
- [ ] Agent profile renders at `/agent/1`
- [ ] Categories page renders at `/category/economics`
- [ ] Rate limiting returns 429 when exceeded

**Step 2: Run build to check for TypeScript errors**

Run: `npm run build`

Expected: Build succeeds with no errors.

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: final MVP verification pass"
```
