# Deadline Race Condition, Spinner Fix, & Topic Visibility — Design

## Problem Summary

Three issues need fixing:

1. **Deadline race condition**: ETH bounty funding txs revert because the on-chain deadline falls a few seconds short of `block.timestamp + MIN_DEADLINE_OFFSET`. Root cause: deadline is computed 3 times independently (for API creation, on-chain call, and funding recording), with only the on-chain call having a buffer — and that buffer was never deployed.

2. **Number input spinners**: CSS to hide spinners exists in `globals.css` but may not be deployed. Needs verification.

3. **Topic visibility gaps**: The 2-tier topic/tag system was added but topics are missing from the site header, unstyled on user profiles and welcome page, and tags aren't passed to PostCard in search results or bounty pages.

---

## Fix 1: Robust Single-Computation Deadline

### Architecture

Compute the buffered deadline **once** at form submission time and reuse it everywhere:

```
Form submit → compute deadlineMs (with 600s buffer)
  ├─ POST /api/v1/bounties  → deadline: new Date(deadlineMs).toISOString()
  ├─ fundBounty(bountyId, deadlineSecs)  → deadlineSecs = Math.floor(deadlineMs / 1000)
  └─ POST /api/v1/bounties/:id/fund → deadline: new Date(deadlineMs).toISOString()
                                        (from stored ref, not recomputed)
```

### Changes

**`src/app/(forum)/bounties/new/page.tsx`:**
- Add `deadlineMsRef = useRef<number>(0)` to store the computed deadline
- In `handleSubmit`: compute `deadlineMsRef.current = Date.now() + effectiveDays * 86400000 + 600000` once
- Use `deadlineMsRef.current` for the API creation call (line ~201)
- Use `Math.floor(deadlineMsRef.current / 1000)` for the contract call (line ~231)
- In the `recordFunding` useEffect (line ~119): use `deadlineMsRef.current` instead of recomputing `Date.now()`
- Add pre-flight check before tx submission: if `deadlineSecs < Math.floor(Date.now()/1000) + 86460`, show error
- Restore min deadline to 1 day (matching contract's `MIN_DEADLINE_OFFSET`)

### Why 600 seconds (10 min)?

- Typical Sepolia block time: ~12 seconds
- Worst case mempool delay: several minutes
- 600 seconds is 0.7% of 1 day — negligible for the user
- Covers even extreme network congestion scenarios

---

## Fix 2: Number Input Spinners

### Current State

`globals.css` lines 129-137 already contain correct spinner-hiding CSS for WebKit and Firefox. 4 number inputs exist across the app:
- Reputation reward (`bounties/new/page.tsx:480`)
- Custom days (`bounties/new/page.tsx:581`)
- Custom ETH filter (`bounty-filters.tsx:215`)
- Fund button custom days (`fund-bounty-button.tsx:163`)

### Action

Verify CSS is applied after deployment. No code changes needed — this is a build/deploy issue.

---

## Fix 3: Topic Visibility

### Current Audit

| Location | Topic Visible? | Tags Visible? | Issue |
|---|---|---|---|
| Homepage | Yes (tabs + sidebar) | Yes | Working |
| PostCard component | Yes (colored badge) | Yes (max 3) | Working |
| Post detail page | Yes (colored badge) | Yes | Working |
| Bounties listing | Yes (colored badge) | No | Missing tags |
| Bounty detail page | Yes (colored badge) | No | Missing tags |
| **Site header/nav** | **No** | **No** | **No topic navigation** |
| **Search results** | **Queried, not rendered** | **Not passed to PostCard** | **Missing from UI** |
| **User profile** | **Plain text, no color** | **No** | **Unstyled** |
| **Welcome page** | **Plain text, no color** | **No** | **Unstyled** |

### Changes

#### 3a. Header Topic Tabs

Add a secondary nav row below the main header bar in `src/app/(forum)/layout.tsx`:

```
┌─────────────────────────────────────────────────┐
│ Logo   [Search...]   New Post  Bounties  ...    │  ← existing header
├─────────────────────────────────────────────────┤
│   Scale L1 · Scale L2 · Hardening · Misc       │  ← new topic tabs
└─────────────────────────────────────────────────┘
```

- Each tab links to `/topic/<slug>` with the topic's color as underline/indicator
- Active state based on current path
- Desktop: horizontal tabs below header
- Mobile: included in MobileNav component

**Files:** `src/app/(forum)/layout.tsx`, `src/components/mobile-nav.tsx`

#### 3b. Search Results — Pass Tags to PostCard

In `src/app/(forum)/search/page.tsx`, the SQL query already joins topics. Add a tags sub-query (same pattern as homepage) and pass `tags` to PostCard.

**Files:** `src/app/(forum)/search/page.tsx`

#### 3c. User Profile — Styled Topic Badges

Replace plain-text topic rendering with `getTopicColor()` styled badges matching PostCard.

**Files:** `src/app/(forum)/user/[id]/page.tsx`

#### 3d. Welcome Page — Styled Topic Badges

Same as user profile — use `getTopicColor()` for the trending research section.

**Files:** `src/app/welcome/page.tsx`

#### 3e. Bounty Pages — Add Tags

Add tags display to bounty listing cards and bounty detail page. The SQL queries already join bountyTags in listing; need to fetch and render them.

**Files:** `src/app/(forum)/bounties/page.tsx`, `src/app/(forum)/bounties/[id]/page.tsx`
