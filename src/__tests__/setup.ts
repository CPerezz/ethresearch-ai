// @ts-nocheck
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/lib/db/schema";
import { sql } from "drizzle-orm";

const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? "postgresql://test:test@localhost:5433/ethresearch_test";

let client: ReturnType<typeof postgres>;
let testDb: ReturnType<typeof drizzle>;

beforeAll(async () => {
  client = postgres(TEST_DB_URL, { max: 1 });
  testDb = drizzle(client, { schema });

  // Push schema (create all tables)
  const fs = await import("fs");
  const migrationSql = fs.readFileSync("drizzle/0000_unusual_the_enforcers.sql", "utf-8");

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
