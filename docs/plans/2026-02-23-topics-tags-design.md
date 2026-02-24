# Topics & Tags: 2-Tier Category Rework

## Summary

Replace the flat 10-category system with a 2-tier structure:
- **Topics** (4 fixed): Scale L1, Scale L2, Hardening, Misc — exactly one per post/bounty, required
- **Tags** (open): any user can create any tag, many-to-many on posts/bounties

## Schema

### `topics` table (replaces `domain_categories`)

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| name | varchar(50) | "Scale L1", "Scale L2", "Hardening", "Misc" |
| slug | varchar(50) unique | "scale-l1", "scale-l2", "hardening", "misc" |
| description | text | Optional |
| color | varchar(20) | Hex color stored in DB |

Colors: Scale L1 `#636efa`, Scale L2 `#b066fe`, Hardening `#ef553b`, Misc `#00cc96`

### `tags` table (new)

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| name | varchar(80) | Display name |
| slug | varchar(80) unique | URL-safe |
| createdAt | timestamptz | |

### `post_tags` join table (new)

| Column | Type |
|--------|------|
| postId | integer FK -> posts |
| tagId | integer FK -> tags |
| PK: (postId, tagId) | |

### `bounty_tags` join table (new)

| Column | Type |
|--------|------|
| bountyId | integer FK -> bounties |
| tagId | integer FK -> tags |
| PK: (bountyId, tagId) | |

### Column renames
- `posts.domain_category_id` -> `posts.topic_id` (FK -> topics)
- `bounties.category_id` -> `bounties.topic_id` (FK -> topics)

## Migration

### Old category -> topic mapping

| Old Category | New Topic | Tag created |
|---|---|---|
| Proof of Stake | Scale L1 | proof-of-stake |
| Layer 2 | Scale L2 | layer-2 |
| EVM | Scale L1 | evm |
| Cryptography | Hardening | cryptography |
| Economics | Misc | economics |
| Security | Hardening | security |
| Privacy | Hardening | privacy |
| Networking | Scale L1 | networking |
| Sharding | Scale L1 | sharding |
| DeFi | Misc | defi |

Steps:
1. Create topics table with 4 rows
2. Create tags, post_tags, bounty_tags tables
3. Seed tags (migrated + additional)
4. For each post/bounty with a domainCategoryId: set topicId based on mapping, create post_tag/bounty_tag linking to the migrated tag
5. Rename FK columns
6. Drop domain_categories table

### Seeded tags

**Scale L1:** state-execution-separation, repricing, consensus, networking, sharding, evm, proof-of-stake, zkevm, statelessness, binary-trees, eip-analysis

**Scale L2:** rollups, bridges, data-availability, zk-rollups, optimistic-rollups, layer-2, blobs, eip-analysis

**Hardening:** zk-snarks, post-quantum, formal-verification, auditing, cryptography, security, privacy

**Misc:** governance, public-goods, identity, dex, economics, defi, mev

(eip-analysis is a single global tag usable in any topic)

## UI Changes

### Homepage
- Topic tabs replace category chips: All | Scale L1 | Scale L2 | Hardening | Misc
- Sidebar: 4 topics replace 10 categories
- Post cards: [topic badge] [tag chips] instead of single category badge

### Route change
- `/category/[slug]` -> `/topic/[slug]`

### Post cards
- Colored topic badge (color from DB)
- Small neutral tag chips (max 3 visible, "+N more" overflow)

### Bounties page
- BountyFilters category dropdown becomes topic dropdown (4 options)
- Bounty cards show topic + tags

### Post/bounty creation
- Topic: required dropdown (4 choices)
- Tags: free-text comma-separated input

## API Changes

### POST /api/v1/posts
- `domainCategorySlug` -> `topicSlug` (required string)
- Add `tags` (string array, optional)

### POST /api/v1/bounties
- `domainCategorySlug` -> `topicSlug` (required string)
- Add `tags` (string array, optional)

### GET /api/v1/categories -> GET /api/v1/topics
- Returns topics array + popular tags

### All GET endpoints
- Return `topicName`, `topicSlug`, `topicColor` instead of `categoryName`/`categorySlug`
- Include `tags: { name, slug }[]` on posts/bounties

## Color system
- Remove hardcoded `category-colors.ts`
- New `getTopicColor(slug)` reads from topic data (or a small static map for the 4 fixed topics)
- CSS variables for topics defined in globals.css

## Files affected (~20)

### Schema/DB: schema.ts, seed.ts, migration
### API: categories/route.ts -> topics/route.ts, posts/route.ts, bounties/route.ts, posts/[id]/route.ts, bounties/[id]/route.ts, search/route.ts
### Pages: page.tsx (home), category/[slug] -> topic/[slug], bounties/page.tsx, bounties/[id]/page.tsx, posts/[id]/page.tsx, search/page.tsx
### Components: post-card.tsx, bounty-filters.tsx
### Utils: category-colors.ts -> topic-colors.ts, validation/schemas.ts
### Other: sitemap.ts, welcome/page.tsx
