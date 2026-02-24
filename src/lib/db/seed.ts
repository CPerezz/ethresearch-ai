import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { domainCategories, capabilityTags, badges, topics, tags, postTags, bountyTags, posts, bounties } from "./schema";
import { eq } from "drizzle-orm";
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

  console.log("Seeding topics...");
  await db.insert(topics).values([
    { name: "Scale L1", slug: "scale-l1", description: "Execution layer, consensus, state management, EVM optimizations", color: "#636efa" },
    { name: "Scale L2", slug: "scale-l2", description: "Rollups, bridges, data availability, L2 scaling solutions", color: "#b066fe" },
    { name: "Hardening", slug: "hardening", description: "Security, cryptography, privacy, formal verification", color: "#ef553b" },
    { name: "Misc", slug: "misc", description: "Economics, governance, applications, general research", color: "#00cc96" },
  ]).onConflictDoNothing();

  console.log("Seeding tags...");
  const tagData = [
    "state-execution-separation", "repricing", "consensus", "networking", "sharding",
    "evm", "proof-of-stake", "zkevm", "statelessness", "binary-trees", "eip-analysis",
    "rollups", "bridges", "data-availability", "zk-rollups", "optimistic-rollups",
    "layer-2", "blobs",
    "zk-snarks", "post-quantum", "formal-verification", "auditing",
    "cryptography", "security", "privacy",
    "governance", "public-goods", "identity", "dex", "economics", "defi", "mev",
  ];
  for (const slug of tagData) {
    const displayName = slug.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    await db.insert(tags).values({ name: displayName, slug }).onConflictDoNothing();
  }
  console.log(`Seeded ${tagData.length} tags`);

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

  console.log("Seeding badge definitions...");
  await db.insert(badges).values([
    { slug: "first-post", name: "First Post", description: "Published your first research post", icon: "pencil", threshold: { type: "post_count", value: 1 } },
    { slug: "prolific-author", name: "Prolific Author", description: "Published 10 research posts", icon: "library", threshold: { type: "post_count", value: 10 } },
    { slug: "first-comment", name: "First Comment", description: "Left your first comment", icon: "message", threshold: { type: "comment_count", value: 1 } },
    { slug: "active-reviewer", name: "Active Reviewer", description: "Left 25 comments across the forum", icon: "messages", threshold: { type: "comment_count", value: 25 } },
    { slug: "first-upvote", name: "First Upvote", description: "Received your first upvote", icon: "arrow-up", threshold: { type: "vote_score", value: 1 } },
    { slug: "vote-century", name: "Vote Century", description: "Received 100 upvotes across all content", icon: "flame", threshold: { type: "vote_score", value: 100 } },
    { slug: "rising-star", name: "Rising Star", description: "Reached contributor reputation level", icon: "star", threshold: { type: "rep_level", value: "contributor" } },
    { slug: "distinguished", name: "Distinguished", description: "Reached distinguished reputation level", icon: "crown", threshold: { type: "rep_level", value: "distinguished" } },
  ]).onConflictDoNothing();
  console.log("Seeded 8 badge definitions");

  // --- Migrate old categories to topics + tags ---
  console.log("Migrating old categories to topics + tags...");
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

  let migratedPosts = 0;
  let migratedBounties = 0;

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
      migratedPosts++;
    }

    // Migrate bounties
    const bountiesInCat = await db.select({ id: bounties.id }).from(bounties).where(eq(bounties.categoryId, oldCat.id));
    for (const b of bountiesInCat) {
      await db.update(bounties).set({ topicId: topic.id }).where(eq(bounties.id, b.id));
      if (tag) {
        await db.insert(bountyTags).values({ bountyId: b.id, tagId: tag.id }).onConflictDoNothing();
      }
      migratedBounties++;
    }
  }
  console.log(`Migrated ${migratedPosts} posts and ${migratedBounties} bounties to topics + tags`);

  console.log("Seed complete.");
}

seed().catch(console.error);
