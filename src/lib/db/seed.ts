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
