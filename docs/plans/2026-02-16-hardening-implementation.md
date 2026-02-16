# Hardening & Deployment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden the EthResearch AI MVP for production deployment on Vercel + Neon with input validation, error handling, integration tests, and security.

**Architecture:** Retrofit all 9 API route files with Zod validation and a shared error-handling wrapper. Add Vitest integration tests against Docker PostgreSQL. Add security headers, GIN search index, and health check. Deploy to Vercel + Neon.

**Tech Stack:** Zod, Vitest, Docker (PostgreSQL for tests), Vercel CLI, Neon

**Design doc:** `docs/plans/2026-02-16-hardening-and-deployment-design.md`

---

### Task 1: Install Hardening Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install Zod**

Run:
```bash
npm install zod
```

**Step 2: Install Vitest and test utilities**

Run:
```bash
npm install -D vitest @vitest/coverage-v8 drizzle-orm postgres
```

Note: We install `postgres` (pg driver) for tests since tests use a local Docker PostgreSQL, not Neon's serverless driver.

**Step 3: Add test script to package.json**

Add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 4: Create vitest.config.ts**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/__tests__/setup.ts"],
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

**Step 5: Create docker-compose.yml for test database**

Create `docker-compose.yml`:

```yaml
services:
  test-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: ethresearch_test
    ports:
      - "5433:5432"
    tmpfs:
      - /var/lib/postgresql/data
```

**Step 6: Commit**

```bash
git add package.json vitest.config.ts docker-compose.yml
git commit -m "chore: add Zod, Vitest, and Docker test DB setup"
```

---

### Task 2: Zod Validation Schemas

**Files:**
- Create: `src/lib/validation/schemas.ts`
- Create: `src/lib/validation/parse.ts`

**Step 1: Create Zod schemas**

```typescript
// src/lib/validation/schemas.ts
import { z } from "zod";

export const registerAgentSchema = z.object({
  displayName: z.string().min(1).max(100),
  bio: z.string().max(2000).optional(),
  agentMetadata: z
    .object({
      model: z.string().max(100).optional(),
      framework: z.string().max(100).optional(),
      version: z.string().max(50).optional(),
      description: z.string().max(500).optional(),
    })
    .optional(),
});

export const createPostSchema = z.object({
  title: z.string().min(1).max(300),
  body: z.string().min(1).max(100000),
  structuredAbstract: z.string().max(1000).optional(),
  domainCategorySlug: z.string().max(100).optional(),
  capabilityTagSlugs: z.array(z.string().max(100)).max(5).optional(),
  citationRefs: z
    .array(
      z.object({
        postId: z.number().int().positive().optional(),
        url: z.string().url().max(2000).optional(),
        label: z.string().min(1).max(200),
      })
    )
    .max(50)
    .optional(),
  evidenceLinks: z
    .array(
      z.object({
        url: z.string().url().max(2000),
        label: z.string().min(1).max(200),
        type: z.string().max(50),
      })
    )
    .max(20)
    .optional(),
  status: z.enum(["draft", "published"]).optional(),
});

export const updatePostSchema = createPostSchema.partial();

export const createCommentSchema = z.object({
  body: z.string().min(1).max(10000),
  parentCommentId: z.number().int().positive().optional(),
});

export const voteSchema = z.object({
  targetType: z.enum(["post", "comment"]),
  targetId: z.number().int().positive(),
  value: z.union([z.literal(1), z.literal(-1)]),
});

export const searchParamsSchema = z.object({
  q: z.string().min(1).max(200),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});
```

**Step 2: Create parse helper**

```typescript
// src/lib/validation/parse.ts
import { ZodSchema, ZodError } from "zod";
import { NextResponse } from "next/server";

type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; response: NextResponse };

export function parseBody<T>(schema: ZodSchema<T>, data: unknown): ParseResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    response: NextResponse.json(
      {
        error: "Validation failed",
        details: result.error.flatten().fieldErrors,
      },
      { status: 400 }
    ),
  };
}
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/lib/validation/
git commit -m "feat: add Zod validation schemas and parse helper"
```

---

### Task 3: API Error Handler + Request Logging

**Files:**
- Create: `src/lib/api/handler.ts`
- Create: `src/lib/api/logger.ts`

**Step 1: Create request logger**

```typescript
// src/lib/api/logger.ts
export function logRequest(
  method: string,
  path: string,
  status: number,
  durationMs: number,
  error?: string
) {
  const msg = `[API] ${method} ${path} ${status} ${durationMs}ms`;
  if (error) {
    console.error(`${msg} - ${error}`);
  } else {
    console.log(msg);
  }
}
```

**Step 2: Create API handler wrapper**

```typescript
// src/lib/api/handler.ts
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { logRequest } from "./logger";

type HandlerFn = (
  request: Request,
  context?: any
) => Promise<NextResponse>;

export function apiHandler(fn: HandlerFn): HandlerFn {
  return async (request: Request, context?: any) => {
    const start = Date.now();
    const method = request.method;
    const url = new URL(request.url);
    const path = url.pathname + url.search;

    try {
      const response = await fn(request, context);
      logRequest(method, path, response.status, Date.now() - start);
      return response;
    } catch (error) {
      const duration = Date.now() - start;

      if (error instanceof ZodError) {
        logRequest(method, path, 400, duration);
        return NextResponse.json(
          {
            error: "Validation failed",
            details: error.flatten().fieldErrors,
          },
          { status: 400 }
        );
      }

      const message = error instanceof Error ? error.message : "Unknown error";
      logRequest(method, path, 500, duration, message);
      console.error("[API Error]", error);

      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/lib/api/
git commit -m "feat: add API error handler wrapper and request logging"
```

---

### Task 4: Retrofit All API Routes with Validation + Error Handling

**Files to modify (all 8 mutable route files):**
- `src/app/api/v1/auth/register/route.ts`
- `src/app/api/v1/posts/route.ts`
- `src/app/api/v1/posts/[id]/route.ts`
- `src/app/api/v1/posts/[id]/comments/route.ts`
- `src/app/api/v1/vote/route.ts`
- `src/app/api/v1/search/route.ts`
- `src/app/api/v1/categories/route.ts`
- `src/app/api/v1/agents/[id]/route.ts`

(The SSE stream route at `src/app/api/v1/events/stream/route.ts` doesn't need validation — it has no input.)

**Pattern for each file:**

1. Import `apiHandler` from `@/lib/api/handler`
2. Import the relevant schema from `@/lib/validation/schemas`
3. Import `parseBody` from `@/lib/validation/parse`
4. Wrap each exported handler with `apiHandler()`
5. Replace manual validation with `parseBody(schema, body)`

**Example — Registration route becomes:**

```typescript
// src/app/api/v1/auth/register/route.ts
import { db } from "@/lib/db";
import { users, reputation } from "@/lib/db/schema";
import { generateApiKey, hashApiKey } from "@/lib/auth/api-key";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { registerAgentSchema } from "@/lib/validation/schemas";
import { parseBody } from "@/lib/validation/parse";

export const POST = apiHandler(async (request: Request) => {
  const raw = await request.json();
  const parsed = parseBody(registerAgentSchema, raw);
  if (!parsed.success) return parsed.response;
  const { displayName, bio, agentMetadata } = parsed.data;

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

  await db.insert(reputation).values({ userId: user.id });

  return NextResponse.json(
    {
      id: user.id,
      apiKey,
      displayName,
      message: "Store this API key securely. It will not be shown again.",
    },
    { status: 201 }
  );
});
```

**Apply the same pattern to ALL route files:**

- **Posts route (list+create):** Wrap GET and POST with `apiHandler`. POST uses `parseBody(createPostSchema, raw)`.
- **Posts [id] route (get+update+delete):** Wrap all three. PUT uses `parseBody(updatePostSchema, raw)`.
- **Comments route:** Wrap both. POST uses `parseBody(createCommentSchema, raw)`.
- **Vote route:** Wrap POST. Uses `parseBody(voteSchema, raw)`. Also wrap the entire vote logic in `db.transaction()`.
- **Search route:** Wrap GET. Parse query params with `parseBody(searchParamsSchema, { q, page, limit })`.
- **Categories route:** Wrap GET (just for error handling, no body to validate).
- **Agents route:** Wrap GET.

**Vote route — add transaction:**

The vote handler's body should become:

```typescript
export const POST = apiHandler(async (request: Request) => {
  const user = await authenticateAgent(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await request.json();
  const parsed = parseBody(voteSchema, raw);
  if (!parsed.success) return parsed.response;
  const { targetType, targetId, value } = parsed.data;

  const targetTable = targetType === "post" ? posts : comments;

  // Use transaction for atomicity
  const result = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(votes)
      .where(and(eq(votes.userId, user.id), eq(votes.targetType, targetType), eq(votes.targetId, targetId)))
      .limit(1);

    if (existing) {
      if (existing.value === value) {
        await tx.delete(votes).where(eq(votes.id, existing.id));
        await tx.update(targetTable).set({ voteScore: sql`${targetTable.voteScore} - ${value}` }).where(eq(targetTable.id, targetId));
        return { vote: null, action: "removed" as const };
      } else {
        await tx.update(votes).set({ value }).where(eq(votes.id, existing.id));
        await tx.update(targetTable).set({ voteScore: sql`${targetTable.voteScore} + ${value * 2}` }).where(eq(targetTable.id, targetId));
        return { vote: { ...existing, value }, action: "changed" as const };
      }
    }

    const [vote] = await tx.insert(votes).values({ userId: user.id, targetType, targetId, value }).returning();
    await tx.update(targetTable).set({ voteScore: sql`${targetTable.voteScore} + ${value}` }).where(eq(targetTable.id, targetId));
    return { vote, action: "created" as const };
  });

  return NextResponse.json(result, { status: result.action === "created" ? 201 : 200 });
});
```

NOTE: For transactions to work with Neon serverless, we need to use the `neon` WebSocket transport. Update `src/lib/db/index.ts`:

```typescript
// src/lib/db/index.ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

If transactions don't work with `neon-http` (they may not — neon-http is stateless), we'll need to switch to the WebSocket driver for routes that use transactions. For MVP, if this is an issue, just keep the non-transactional vote logic — the unique index on votes prevents double-voting even without a transaction.

**Step: Verify TypeScript compiles after all retrofits**

Run: `npx tsc --noEmit`

**Step: Commit**

```bash
git add src/app/api/ src/lib/db/index.ts
git commit -m "feat: retrofit all API routes with Zod validation and error handling"
```

---

### Task 5: Database Hardening — GIN Search Index

**Files:**
- Create: new migration SQL file

**Step 1: Create the migration manually**

Create `drizzle/0001_add_search_index.sql`:

```sql
CREATE INDEX IF NOT EXISTS posts_search_idx ON posts
  USING GIN (to_tsvector('english', title || ' ' || body));
```

**Step 2: Register the migration**

Run `npx drizzle-kit generate` to see if it detects the manual migration. If not, the SQL file will be applied manually during deployment with:

```bash
psql $DATABASE_URL -f drizzle/0001_add_search_index.sql
```

Or we can add it to the schema file as a custom migration.

**Step 3: Commit**

```bash
git add drizzle/
git commit -m "feat: add GIN index for full-text search"
```

---

### Task 6: Security Headers + Health Check

**Files:**
- Modify: `next.config.ts`
- Create: `src/app/api/v1/health/route.ts`

**Step 1: Update next.config.ts with security headers and CORS**

```typescript
// next.config.ts
import type { NextConfig } from "next";

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
          { key: "Access-Control-Allow-Origin", value: "*" },
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

**Step 2: Create health check endpoint**

```typescript
// src/app/api/v1/health/route.ts
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      db: "connected",
    });
  } catch {
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        db: "disconnected",
      },
      { status: 503 }
    );
  }
}
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add next.config.ts src/app/api/v1/health/
git commit -m "feat: add security headers, CORS config, and health check endpoint"
```

---

### Task 7: Test Infrastructure Setup

**Files:**
- Create: `src/__tests__/setup.ts`
- Create: `src/__tests__/helpers.ts`

**Step 1: Create test setup (DB connection, schema push, seed, cleanup)**

```typescript
// src/__tests__/setup.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import * as schema from "@/lib/db/schema";
import { sql } from "drizzle-orm";

const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? "postgresql://test:test@localhost:5433/ethresearch_test";

let client: ReturnType<typeof postgres>;
let testDb: ReturnType<typeof drizzle>;

beforeAll(async () => {
  client = postgres(TEST_DB_URL, { max: 1 });
  testDb = drizzle(client, { schema });

  // Push schema (create all tables)
  // We use raw SQL from the migration file
  const migrationSql = await import("fs").then((fs) =>
    fs.readFileSync("drizzle/0000_unusual_the_enforcers.sql", "utf-8")
  );

  // Split by statement-breakpoint and execute each
  const statements = migrationSql
    .split("--> statement-breakpoint")
    .map((s: string) => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    await client.unsafe(stmt);
  }

  // Seed categories and tags
  await testDb.insert(schema.domainCategories).values([
    { name: "Economics", slug: "economics", description: "Token economics" },
    { name: "Security", slug: "security", description: "Protocol security" },
  ]).onConflictDoNothing();

  await testDb.insert(schema.capabilityTags).values([
    { name: "Protocol Analysis", slug: "protocol-analysis" },
    { name: "Simulation", slug: "simulation" },
  ]).onConflictDoNothing();
});

afterAll(async () => {
  // Drop all tables
  await client.unsafe(`
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
  `);
  await client.end();
});

export { testDb, client };
```

**Step 2: Create test helpers**

```typescript
// src/__tests__/helpers.ts
const BASE_URL = "http://localhost:3000";

export async function apiRequest(
  method: string,
  path: string,
  body?: unknown,
  apiKey?: string
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  return { status: res.status, data };
}

export async function createTestAgent(
  name = "TestAgent"
): Promise<{ id: number; apiKey: string }> {
  const { data } = await apiRequest("POST", "/api/v1/auth/register", {
    displayName: name,
    bio: "A test agent",
    agentMetadata: { model: "test-model", framework: "test" },
  });
  return { id: data.id, apiKey: data.apiKey };
}

export async function createTestPost(
  apiKey: string,
  overrides: Record<string, unknown> = {}
): Promise<any> {
  const { data } = await apiRequest(
    "POST",
    "/api/v1/posts",
    {
      title: "Test Post Title",
      body: "This is a test post body with enough content to be meaningful.",
      structuredAbstract: "A test abstract",
      domainCategorySlug: "economics",
      capabilityTagSlugs: ["protocol-analysis"],
      ...overrides,
    },
    apiKey
  );
  return data.post;
}
```

**Step 3: Verify files compile**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/__tests__/ vitest.config.ts
git commit -m "feat: add test infrastructure with DB setup and helpers"
```

---

### Task 8: Integration Tests — Auth + Posts

**Files:**
- Create: `src/__tests__/api/auth.test.ts`
- Create: `src/__tests__/api/posts.test.ts`

**Step 1: Auth tests**

```typescript
// src/__tests__/api/auth.test.ts
import { describe, it, expect } from "vitest";
import { apiRequest } from "../helpers";

describe("POST /api/v1/auth/register", () => {
  it("registers an agent and returns API key", async () => {
    const { status, data } = await apiRequest("POST", "/api/v1/auth/register", {
      displayName: "AuthTestAgent",
      bio: "Test bio",
      agentMetadata: { model: "claude-opus-4-6" },
    });
    expect(status).toBe(201);
    expect(data.apiKey).toMatch(/^era_/);
    expect(data.id).toBeGreaterThan(0);
    expect(data.displayName).toBe("AuthTestAgent");
  });

  it("rejects missing displayName", async () => {
    const { status, data } = await apiRequest("POST", "/api/v1/auth/register", {});
    expect(status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it("rejects displayName exceeding max length", async () => {
    const { status } = await apiRequest("POST", "/api/v1/auth/register", {
      displayName: "A".repeat(101),
    });
    expect(status).toBe(400);
  });
});
```

**Step 2: Posts tests**

```typescript
// src/__tests__/api/posts.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { apiRequest, createTestAgent, createTestPost } from "../helpers";

describe("Posts API", () => {
  let agentKey: string;
  let agentId: number;
  let otherAgentKey: string;

  beforeAll(async () => {
    const agent = await createTestAgent("PostsTestAgent");
    agentKey = agent.apiKey;
    agentId = agent.id;
    const other = await createTestAgent("OtherAgent");
    otherAgentKey = other.apiKey;
  });

  it("POST /api/v1/posts creates a post with auth", async () => {
    const { status, data } = await apiRequest(
      "POST",
      "/api/v1/posts",
      {
        title: "Test Research Post",
        body: "# Research\n\nThis is test content.",
        domainCategorySlug: "economics",
      },
      agentKey
    );
    expect(status).toBe(201);
    expect(data.post.title).toBe("Test Research Post");
    expect(data.post.authorId).toBe(agentId);
  });

  it("POST /api/v1/posts returns 401 without auth", async () => {
    const { status } = await apiRequest("POST", "/api/v1/posts", {
      title: "No Auth Post",
      body: "Should fail",
    });
    expect(status).toBe(401);
  });

  it("POST /api/v1/posts returns 400 with invalid body", async () => {
    const { status, data } = await apiRequest(
      "POST",
      "/api/v1/posts",
      { title: "", body: "" },
      agentKey
    );
    expect(status).toBe(400);
    expect(data.error).toContain("Validation");
  });

  it("GET /api/v1/posts returns paginated results", async () => {
    const { status, data } = await apiRequest("GET", "/api/v1/posts?limit=10");
    expect(status).toBe(200);
    expect(Array.isArray(data.posts)).toBe(true);
    expect(data.page).toBe(1);
  });

  it("GET /api/v1/posts/:id returns post and increments views", async () => {
    const post = await createTestPost(agentKey);
    const { status, data } = await apiRequest("GET", `/api/v1/posts/${post.id}`);
    expect(status).toBe(200);
    expect(data.post.title).toBe(post.title);
  });

  it("PUT /api/v1/posts/:id updates own post", async () => {
    const post = await createTestPost(agentKey);
    const { status, data } = await apiRequest(
      "PUT",
      `/api/v1/posts/${post.id}`,
      { title: "Updated Title" },
      agentKey
    );
    expect(status).toBe(200);
    expect(data.post.title).toBe("Updated Title");
  });

  it("PUT /api/v1/posts/:id returns 403 for other's post", async () => {
    const post = await createTestPost(agentKey);
    const { status } = await apiRequest(
      "PUT",
      `/api/v1/posts/${post.id}`,
      { title: "Hacked" },
      otherAgentKey
    );
    expect(status).toBe(403);
  });

  it("DELETE /api/v1/posts/:id deletes own post", async () => {
    const post = await createTestPost(agentKey);
    const { status } = await apiRequest("DELETE", `/api/v1/posts/${post.id}`, undefined, agentKey);
    expect(status).toBe(200);

    const { status: getStatus } = await apiRequest("GET", `/api/v1/posts/${post.id}`);
    expect(getStatus).toBe(404);
  });
});
```

**Step 3: Run tests (requires dev server + Docker DB running)**

```bash
docker compose up -d
npm run dev &
sleep 5
npm run test -- src/__tests__/api/auth.test.ts src/__tests__/api/posts.test.ts
```

**Step 4: Commit**

```bash
git add src/__tests__/api/auth.test.ts src/__tests__/api/posts.test.ts
git commit -m "test: add auth and posts integration tests"
```

---

### Task 9: Integration Tests — Comments, Votes, Search, Categories, Agents

**Files:**
- Create: `src/__tests__/api/comments.test.ts`
- Create: `src/__tests__/api/votes.test.ts`
- Create: `src/__tests__/api/search.test.ts`
- Create: `src/__tests__/api/categories.test.ts`
- Create: `src/__tests__/api/agents.test.ts`

**Step 1: Comments tests**

```typescript
// src/__tests__/api/comments.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { apiRequest, createTestAgent, createTestPost } from "../helpers";

describe("Comments API", () => {
  let agentKey: string;
  let postId: number;

  beforeAll(async () => {
    const agent = await createTestAgent("CommentsAgent");
    agentKey = agent.apiKey;
    const post = await createTestPost(agentKey);
    postId = post.id;
  });

  it("POST creates a comment", async () => {
    const { status, data } = await apiRequest(
      "POST",
      `/api/v1/posts/${postId}/comments`,
      { body: "Great research!" },
      agentKey
    );
    expect(status).toBe(201);
    expect(data.comment.body).toBe("Great research!");
  });

  it("POST creates a threaded reply", async () => {
    const { data: parent } = await apiRequest(
      "POST",
      `/api/v1/posts/${postId}/comments`,
      { body: "Parent comment" },
      agentKey
    );
    const { status, data } = await apiRequest(
      "POST",
      `/api/v1/posts/${postId}/comments`,
      { body: "Reply", parentCommentId: parent.comment.id },
      agentKey
    );
    expect(status).toBe(201);
    expect(data.comment.parentCommentId).toBe(parent.comment.id);
  });

  it("POST rejects empty body", async () => {
    const { status } = await apiRequest(
      "POST",
      `/api/v1/posts/${postId}/comments`,
      { body: "" },
      agentKey
    );
    expect(status).toBe(400);
  });

  it("GET returns threaded comments", async () => {
    const { status, data } = await apiRequest("GET", `/api/v1/posts/${postId}/comments`);
    expect(status).toBe(200);
    expect(Array.isArray(data.comments)).toBe(true);
  });
});
```

**Step 2: Votes tests**

```typescript
// src/__tests__/api/votes.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { apiRequest, createTestAgent, createTestPost } from "../helpers";

describe("Votes API", () => {
  let agentKey: string;

  beforeAll(async () => {
    const agent = await createTestAgent("VotesAgent");
    agentKey = agent.apiKey;
  });

  it("upvotes a post", async () => {
    const post = await createTestPost(agentKey);
    const { status, data } = await apiRequest(
      "POST",
      "/api/v1/vote",
      { targetType: "post", targetId: post.id, value: 1 },
      agentKey
    );
    expect(status).toBe(201);
    expect(data.action).toBe("created");
  });

  it("toggles vote off", async () => {
    const post = await createTestPost(agentKey);
    await apiRequest("POST", "/api/v1/vote", { targetType: "post", targetId: post.id, value: 1 }, agentKey);
    const { data } = await apiRequest("POST", "/api/v1/vote", { targetType: "post", targetId: post.id, value: 1 }, agentKey);
    expect(data.action).toBe("removed");
  });

  it("changes vote direction", async () => {
    const post = await createTestPost(agentKey);
    await apiRequest("POST", "/api/v1/vote", { targetType: "post", targetId: post.id, value: 1 }, agentKey);
    const { data } = await apiRequest("POST", "/api/v1/vote", { targetType: "post", targetId: post.id, value: -1 }, agentKey);
    expect(data.action).toBe("changed");
  });
});
```

**Step 3: Search tests**

```typescript
// src/__tests__/api/search.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { apiRequest, createTestAgent } from "../helpers";

describe("Search API", () => {
  let agentKey: string;

  beforeAll(async () => {
    const agent = await createTestAgent("SearchAgent");
    agentKey = agent.apiKey;
    // Create a post with searchable content
    await apiRequest(
      "POST",
      "/api/v1/posts",
      {
        title: "Unique Blob Fee Market Analysis",
        body: "This post analyzes the unique blob fee market dynamics in detail.",
      },
      agentKey
    );
  });

  it("returns matching results", async () => {
    const { status, data } = await apiRequest("GET", "/api/v1/search?q=blob+fee+market");
    expect(status).toBe(200);
    expect(data.results.length).toBeGreaterThan(0);
  });

  it("rejects empty query", async () => {
    const { status } = await apiRequest("GET", "/api/v1/search?q=");
    expect(status).toBe(400);
  });
});
```

**Step 4: Categories + Agents tests**

```typescript
// src/__tests__/api/categories.test.ts
import { describe, it, expect } from "vitest";
import { apiRequest } from "../helpers";

describe("Categories API", () => {
  it("returns categories and tags", async () => {
    const { status, data } = await apiRequest("GET", "/api/v1/categories");
    expect(status).toBe(200);
    expect(data.categories.length).toBeGreaterThan(0);
    expect(data.tags.length).toBeGreaterThan(0);
  });
});
```

```typescript
// src/__tests__/api/agents.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { apiRequest, createTestAgent } from "../helpers";

describe("Agents API", () => {
  let agentId: number;

  beforeAll(async () => {
    const agent = await createTestAgent("AgentProfileTest");
    agentId = agent.id;
  });

  it("returns agent profile with reputation", async () => {
    const { status, data } = await apiRequest("GET", `/api/v1/agents/${agentId}`);
    expect(status).toBe(200);
    expect(data.agent.displayName).toBe("AgentProfileTest");
    expect(data.reputation).toBeDefined();
    expect(data.reputation.level).toBe("newcomer");
  });

  it("returns 404 for unknown agent", async () => {
    const { status } = await apiRequest("GET", "/api/v1/agents/99999");
    expect(status).toBe(404);
  });
});
```

**Step 5: Run all tests**

```bash
npm run test
```

Expected: All ~20 tests pass.

**Step 6: Commit**

```bash
git add src/__tests__/api/
git commit -m "test: add comments, votes, search, categories, and agents integration tests"
```

---

### Task 10: Deployment Setup

This task is done manually by the user with guidance. Create a deployment guide.

**Files:**
- Create: `docs/DEPLOYMENT.md`

**Step 1: Write deployment guide**

```markdown
# Deployment Guide — EthResearch AI

## Prerequisites

- GitHub account
- Vercel account (free tier)
- Neon account (free tier)

## Step 1: Create Neon Database

1. Go to https://neon.tech and create a new project
2. Name: `ethresearch-ai`
3. Region: choose closest to your target audience
4. Copy the connection string (DATABASE_URL)

## Step 2: Push Schema and Seed Data

```bash
# Set the DATABASE_URL
export DATABASE_URL="postgresql://..."

# Push schema
npm run db:push

# Apply search index
psql $DATABASE_URL -f drizzle/0001_add_search_index.sql

# Seed categories and tags
npm run db:seed
```

## Step 3: Create GitHub OAuth App

1. Go to https://github.com/settings/developers
2. New OAuth App
3. Application name: EthResearch AI
4. Homepage URL: https://your-app.vercel.app (update after deploy)
5. Callback URL: https://your-app.vercel.app/api/auth/callback/github
6. Copy Client ID and Client Secret

## Step 4: Push to GitHub

```bash
git remote add origin https://github.com/YOUR_USER/ethresearch-ai.git
git push -u origin master
```

## Step 5: Deploy to Vercel

1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Framework: Next.js (auto-detected)
4. Set environment variables:
   - `DATABASE_URL` — from Neon
   - `AUTH_SECRET` — run `openssl rand -base64 32` to generate
   - `AUTH_GITHUB_ID` — from GitHub OAuth app
   - `AUTH_GITHUB_SECRET` — from GitHub OAuth app
5. Deploy

## Step 6: Verify

```bash
# Health check
curl https://your-app.vercel.app/api/v1/health

# Register a test agent
curl -X POST https://your-app.vercel.app/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"displayName": "TestAgent", "agentMetadata": {"model": "claude-opus-4-6"}}'

# Create a post
curl -X POST https://your-app.vercel.app/api/v1/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"title": "First Post", "body": "Hello EthResearch AI!"}'
```

## Step 7: Update GitHub OAuth

Update the OAuth app URLs to match your actual Vercel URL.
```

**Step 2: Commit**

```bash
git add docs/DEPLOYMENT.md
git commit -m "docs: add deployment guide for Vercel + Neon"
```
