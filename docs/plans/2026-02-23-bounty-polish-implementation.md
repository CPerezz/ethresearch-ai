# Bounty Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix bounty description rendering, add submission rankings with peer review metrics, unify ETH display with expandable tx details, add licensing, and fix the fund recording race condition.

**Architecture:** Five independent changes to the bounty system. Markdown rendering is a one-line swap. Submission ranking adds review count subqueries and a scoring function to the bounty detail page. The ETH badge is a new client component replacing the current dual-badge display. Licensing adds static files and footer text. The race condition is a dependency array fix.

**Tech Stack:** Next.js App Router, Drizzle ORM, React, viem, wagmi, ReactMarkdown, KaTeX

---

### Task 1: Fix Bounty Description Markdown/LaTeX Rendering

**Files:**
- Modify: `src/app/(forum)/bounties/[id]/page.tsx:1-14` (add import)
- Modify: `src/app/(forum)/bounties/[id]/page.tsx:190-194` (swap rendering)

**Step 1: Add PostBody import**

At `src/app/(forum)/bounties/[id]/page.tsx:8`, add:

```typescript
import { PostBody } from "@/components/post/post-body";
```

**Step 2: Replace plain text with PostBody**

Replace lines 190-194:

```tsx
{bounty.description && (
  <p className="mt-4 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
    {bounty.description}
  </p>
)}
```

With:

```tsx
{bounty.description && (
  <div className="mt-4 text-sm">
    <PostBody content={bounty.description} />
  </div>
)}
```

**Step 3: Verify**

Run: `npx next build`
Expected: Build passes. Visit `/bounties/8` — description should render markdown + LaTeX.

**Step 4: Commit**

```bash
git add src/app/\(forum\)/bounties/\[id\]/page.tsx
git commit -m "fix: render bounty descriptions with markdown and LaTeX"
```

---

### Task 2: Submission Ranking — Query Review Counts

**Files:**
- Modify: `src/app/(forum)/bounties/[id]/page.tsx:2-5` (add imports)
- Modify: `src/app/(forum)/bounties/[id]/page.tsx:83-97` (extend query)

**Step 1: Add reviews import and sql**

At the imports section, ensure `reviews` is imported from schema and `sql` from drizzle-orm:

```typescript
import { bounties, posts, users, domainCategories, reviews } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
```

**Step 2: Add review counts to submissions query**

Replace the submissions query (lines 83-97) with:

```typescript
const submissions = await db
  .select({
    id: posts.id,
    title: posts.title,
    voteScore: posts.voteScore,
    createdAt: posts.createdAt,
    authorId: posts.authorId,
    authorName: users.displayName,
    authorType: users.type,
    authorWallet: users.walletAddress,
    approvals: sql<number>`(SELECT COUNT(*) FROM reviews WHERE reviews.post_id = ${posts.id} AND reviews.verdict = 'approve')`.as("approvals"),
    rejections: sql<number>`(SELECT COUNT(*) FROM reviews WHERE reviews.post_id = ${posts.id} AND reviews.verdict = 'reject')`.as("rejections"),
    needsRevision: sql<number>`(SELECT COUNT(*) FROM reviews WHERE reviews.post_id = ${posts.id} AND reviews.verdict = 'needs_revision')`.as("needs_revision"),
  })
  .from(posts)
  .leftJoin(users, eq(posts.authorId, users.id))
  .where(eq(posts.bountyId, bountyId));
```

Note: removed `.orderBy(desc(posts.voteScore))` — we'll sort in JS after computing scores.

**Step 3: Add ranking computation**

After the query, add the scoring and sorting logic:

```typescript
// Compute ranking score: votes 40%, reviews 60%
// reviewScore = (approvals * 2) - (rejections * 3)
const rankedSubmissions = submissions
  .map((s) => ({
    ...s,
    reviewScore: (Number(s.approvals) * 2) - (Number(s.rejections) * 3),
    get rankScore() {
      return (0.4 * s.voteScore) + (0.6 * this.reviewScore);
    },
  }))
  .sort((a, b) => {
    // Winner always first
    if (bounty.winnerPostId === a.id) return -1;
    if (bounty.winnerPostId === b.id) return 1;
    return b.rankScore - a.rankScore;
  });
```

**Step 4: Verify**

Run: `npx next build`
Expected: Build passes.

**Step 5: Commit**

```bash
git add src/app/\(forum\)/bounties/\[id\]/page.tsx
git commit -m "feat: compute submission ranking scores from votes and reviews"
```

---

### Task 3: Submission Ranking — Update UI

**Files:**
- Modify: `src/app/(forum)/bounties/[id]/page.tsx:250-316` (submission cards)

**Step 1: Update submissions loop to use rankedSubmissions**

Replace `submissions.map((submission)` with `rankedSubmissions.map((submission, index)` in the JSX.

Also update the header count from `submissions.length` to `rankedSubmissions.length`.

**Step 2: Add rank number, review metrics, and score to each card**

Replace the submission card content (the inner div of each card) with this structure:

```tsx
{rankedSubmissions.length > 0 ? (
  <div className="space-y-3">
    {rankedSubmissions.map((submission, index) => {
      const isWinner = bounty.winnerPostId === submission.id;
      const rank = index + 1;
      const totalReviews = Number(submission.approvals) + Number(submission.rejections) + Number(submission.needsRevision);
      return (
        <div
          key={submission.id}
          className={`rounded-xl border bg-card p-4 ${
            isWinner
              ? "border-amber-300 dark:border-amber-700"
              : "border-border"
          }`}
        >
          <div className="flex items-start gap-3">
            {/* Rank number */}
            <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
              isWinner
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                : rank <= 3
                  ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                  : "bg-muted text-muted-foreground"
            }`}>
              {isWinner ? "★" : `#${rank}`}
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                {isWinner && (
                  <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                    Winner
                  </span>
                )}
                <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {submission.voteScore} vote{submission.voteScore !== 1 ? "s" : ""}
                </span>
                {totalReviews > 0 && (
                  <>
                    {Number(submission.approvals) > 0 && (
                      <span className="rounded-md bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-600 dark:bg-green-950 dark:text-green-400">
                        {submission.approvals} approved
                      </span>
                    )}
                    {Number(submission.needsRevision) > 0 && (
                      <span className="rounded-md bg-yellow-50 px-2 py-0.5 text-[11px] font-semibold text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400">
                        {submission.needsRevision} needs revision
                      </span>
                    )}
                    {Number(submission.rejections) > 0 && (
                      <span className="rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600 dark:bg-red-950 dark:text-red-400">
                        {submission.rejections} rejected
                      </span>
                    )}
                  </>
                )}
                <span className="text-[10px] text-muted-foreground">
                  score: {submission.rankScore.toFixed(1)}
                </span>
              </div>

              <Link
                href={`/posts/${submission.id}`}
                className="text-sm font-semibold leading-snug text-foreground hover:underline"
              >
                {submission.title}
              </Link>

              <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                {submission.authorName && (
                  <span>
                    by{" "}
                    <Link
                      href={`/user/${submission.authorId}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {submission.authorName}
                    </Link>
                    {submission.authorType === "agent" && (
                      <span className="ml-1 rounded bg-violet-100 px-1 py-0.5 text-[10px] font-semibold text-violet-600 dark:bg-violet-950 dark:text-violet-400">
                        AI
                      </span>
                    )}
                  </span>
                )}
                <span>{timeAgo(submission.createdAt)}</span>
              </div>
            </div>

            {canPickWinner && !isWinner && (
              <PickWinnerButton bountyId={bounty.id} postId={submission.id} />
            )}
          </div>
        </div>
      );
    })}
  </div>
) : (
  <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
    No submissions yet. Be the first to submit a response!
  </div>
)}
```

**Step 3: Verify**

Run: `npx next build`
Expected: Build passes. Visit `/bounties/8` — submissions show rank, vote count, review metrics, score.

**Step 4: Commit**

```bash
git add src/app/\(forum\)/bounties/\[id\]/page.tsx
git commit -m "feat: add submission ranking UI with votes and peer review metrics"
```

---

### Task 4: Unified ETH Badge with Expandable Tx Details

**Files:**
- Create: `src/components/bounty/eth-escrow-badge.tsx`
- Modify: `src/app/(forum)/bounties/[id]/page.tsx:146-150,179-187` (replace badges)

**Step 1: Create the new EthEscrowBadge component**

Create `src/components/bounty/eth-escrow-badge.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useBountyOnChain } from "@/lib/web3/use-bounty-escrow";
import { formatEther } from "viem";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function getEtherscanUrl(chainId: number): string {
  if (chainId === 1) return "https://etherscan.io";
  return "https://sepolia.etherscan.io";
}

function deadlineCountdown(deadlineSeconds: bigint): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = Number(deadlineSeconds) - now;
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h remaining`;
  const minutes = Math.floor((diff % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}

type DerivedStatus = "funded" | "paid" | "refunded" | "expired" | "unfunded";

function deriveStatus(onChain: {
  amount: bigint;
  deadline: bigint;
  paid: boolean;
  refunded: boolean;
}): DerivedStatus {
  if (onChain.refunded) return "refunded";
  if (onChain.paid) return "paid";
  if (onChain.amount === BigInt(0)) return "unfunded";
  const now = Math.floor(Date.now() / 1000);
  if (Number(onChain.deadline) > 0 && Number(onChain.deadline) < now) return "expired";
  return "funded";
}

const statusConfig: Record<DerivedStatus, { label: string; dot: string; text: string }> = {
  funded: { label: "Funded", dot: "bg-green-500", text: "text-green-600 dark:text-green-400" },
  paid: { label: "Paid", dot: "bg-blue-500", text: "text-blue-600 dark:text-blue-400" },
  expired: { label: "Expired", dot: "bg-yellow-500", text: "text-yellow-600 dark:text-yellow-400" },
  refunded: { label: "Refunded", dot: "bg-zinc-400", text: "text-zinc-500 dark:text-zinc-400" },
  unfunded: { label: "Unfunded", dot: "bg-zinc-400", text: "text-zinc-500 dark:text-zinc-400" },
};

interface Props {
  bountyId: number;
  chainId: number | null;
  dbEscrowStatus: string | null;
  dbEthAmount: string | null;
  transactions: {
    txHash: string;
    txType: string;
    fromAddress: string | null;
    toAddress: string | null;
    amount: string | null;
  }[];
}

export function EthEscrowBadge({ bountyId, chainId, dbEscrowStatus, dbEthAmount, transactions }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { onChain, isLoading } = useBountyOnChain(bountyId);

  const effectiveChainId = chainId ?? 11155111;
  const etherscanUrl = getEtherscanUrl(effectiveChainId);

  // Derive display values
  let ethFormatted = dbEthAmount ? formatEther(BigInt(dbEthAmount)) : null;
  let status: DerivedStatus = (dbEscrowStatus as DerivedStatus) ?? "unfunded";
  let deadline: bigint | null = null;
  let funder: string | null = null;
  let winner: string | null = null;

  if (onChain && onChain.amount > BigInt(0)) {
    ethFormatted = formatEther(onChain.amount);
    status = deriveStatus(onChain);
    deadline = onChain.deadline;
    funder = onChain.funder !== ZERO_ADDRESS ? onChain.funder : null;
    winner = onChain.winner !== ZERO_ADDRESS ? onChain.winner : null;
  }

  if (!ethFormatted && !dbEscrowStatus) return null;

  const cfg = statusConfig[status] ?? statusConfig.unfunded;
  const fundTx = transactions.find((t) => t.txType === "fund");
  const payTx = transactions.find((t) => t.txType === "payout");

  return (
    <div className="inline-block">
      {/* Collapsed badge */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center gap-1.5 rounded-md bg-purple-50 px-2.5 py-1 text-[11px] font-semibold text-purple-700 transition-colors hover:bg-purple-100 dark:bg-purple-950 dark:text-purple-300 dark:hover:bg-purple-900"
      >
        {isLoading ? (
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-purple-400" />
        ) : (
          <span className={`inline-block h-2 w-2 rounded-full ${cfg.dot}`} />
        )}
        {ethFormatted} ETH
        <span className="text-purple-500 dark:text-purple-400">&middot;</span>
        {cfg.label}
        <svg
          className={`h-3 w-3 text-purple-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-2 rounded-lg border border-border bg-card p-3 text-xs space-y-2">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <span className={`font-semibold ${cfg.text}`}>{cfg.label}</span>
          </div>

          {/* Deadline */}
          {deadline && deadline > BigInt(0) && status === "funded" && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Deadline</span>
              <span className="font-medium text-foreground">{deadlineCountdown(deadline)}</span>
            </div>
          )}

          {/* Funder */}
          {funder && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Funder</span>
              <a
                href={`${etherscanUrl}/address/${funder}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-primary hover:underline"
              >
                {funder.slice(0, 6)}...{funder.slice(-4)}
              </a>
            </div>
          )}

          {/* Winner */}
          {winner && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Winner</span>
              <a
                href={`${etherscanUrl}/address/${winner}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-primary hover:underline"
              >
                {winner.slice(0, 6)}...{winner.slice(-4)}
              </a>
            </div>
          )}

          {/* Fund tx */}
          {fundTx && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Fund tx</span>
              <a
                href={`${etherscanUrl}/tx/${fundTx.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-primary hover:underline"
              >
                {fundTx.txHash.slice(0, 10)}...{fundTx.txHash.slice(-6)}
              </a>
            </div>
          )}

          {/* Pay tx */}
          {payTx && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Payout tx</span>
              <a
                href={`${etherscanUrl}/tx/${payTx.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-primary hover:underline"
              >
                {payTx.txHash.slice(0, 10)}...{payTx.txHash.slice(-6)}
              </a>
            </div>
          )}

          {/* Etherscan contract link */}
          <div className="pt-1 border-t border-border">
            <a
              href={`${etherscanUrl}/address/${process.env.NEXT_PUBLIC_BOUNTY_ESCROW_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              View escrow contract &rarr;
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Fetch transactions in bounty detail page**

In `src/app/(forum)/bounties/[id]/page.tsx`, after the submissions query, add:

```typescript
import { bounties, posts, users, domainCategories, reviews, bountyTransactions } from "@/lib/db/schema";

// ... after submissions query:

const txs = await db
  .select({
    txHash: bountyTransactions.txHash,
    txType: bountyTransactions.txType,
    fromAddress: bountyTransactions.fromAddress,
    toAddress: bountyTransactions.toAddress,
    amount: bountyTransactions.amount,
  })
  .from(bountyTransactions)
  .where(eq(bountyTransactions.bountyId, bountyId));
```

**Step 3: Replace dual badges with unified EthEscrowBadge**

In the badges row, remove the old ETH amount badge (lines 146-150):

```tsx
// REMOVE THIS:
{bounty.ethAmount && (
  <span className="rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-600 dark:bg-purple-950 dark:text-purple-400">
    {formatEther(BigInt(bounty.ethAmount))} ETH
  </span>
)}
```

Replace the EscrowStatusBadge block (lines 179-187):

```tsx
// REPLACE:
{(bounty.escrowStatus || bounty.ethAmount) && (
  <div className="mt-3">
    <EscrowStatusBadge bountyId={bounty.id} dbEscrowStatus={bounty.escrowStatus} />
  </div>
)}

// WITH:
{(bounty.escrowStatus || bounty.ethAmount) && (
  <div className="mt-3">
    <EthEscrowBadge
      bountyId={bounty.id}
      chainId={bounty.chainId}
      dbEscrowStatus={bounty.escrowStatus}
      dbEthAmount={bounty.ethAmount}
      transactions={txs}
    />
  </div>
)}
```

Update imports: replace `EscrowStatusBadge` with `EthEscrowBadge`:

```typescript
import { EthEscrowBadge } from "@/components/bounty/eth-escrow-badge";
// Remove: import { EscrowStatusBadge } from "@/components/bounty/escrow-status-badge";
```

Also need to add `chainId` to the bounty select query if not already there. Check line 56-78 — add `chainId: bounties.chainId` to the select.

**Step 4: Verify**

Run: `npx next build`
Expected: Build passes. Visit `/bounties/8` — single purple badge "0.001 ETH · Funded ▾", expands on click to show tx details with Etherscan links.

**Step 5: Commit**

```bash
git add src/components/bounty/eth-escrow-badge.tsx src/app/\(forum\)/bounties/\[id\]/page.tsx
git commit -m "feat: unified ETH badge with expandable tx details and Etherscan links"
```

---

### Task 5: MIT License File

**Files:**
- Create: `LICENSE`

**Step 1: Create LICENSE**

Create `LICENSE` in repo root with MIT license text, copyright holder "EthResearch AI Contributors", year 2026.

**Step 2: Commit**

```bash
git add LICENSE
git commit -m "docs: add MIT license"
```

---

### Task 6: CC BY 4.0 in Footer + Submission Notices

**Files:**
- Modify: `src/components/footer.tsx:22-24`
- Modify: `src/app/(forum)/bounties/new/page.tsx` (above submit button)
- Modify: `src/app/(forum)/bounties/[id]/submit/page.tsx` (above submit button)
- Modify: `src/app/(forum)/posts/new/page.tsx` (above submit button)

**Step 1: Update footer**

Replace the copyright div (lines 22-24) in `src/components/footer.tsx`:

```tsx
<div className="text-xs text-muted-foreground">
  <p>&copy; {new Date().getFullYear()} EthResearch AI</p>
  <p className="mt-1">
    Content licensed under{" "}
    <a
      href="https://creativecommons.org/licenses/by/4.0/"
      target="_blank"
      rel="noopener noreferrer"
      className="underline hover:text-foreground"
    >
      CC BY 4.0
    </a>
    {" "}&middot;{" "}
    <a
      href="https://github.com/CPerezz/ethresearch-ai/blob/master/LICENSE"
      target="_blank"
      rel="noopener noreferrer"
      className="underline hover:text-foreground"
    >
      MIT License
    </a>
  </p>
</div>
```

**Step 2: Add license notice to submission forms**

In each of these three files, add this text just above the submit button div:

```tsx
<p className="text-[11px] text-muted-foreground">
  By submitting, you agree your contribution is licensed under{" "}
  <a
    href="https://creativecommons.org/licenses/by/4.0/"
    target="_blank"
    rel="noopener noreferrer"
    className="underline hover:text-foreground"
  >
    CC BY 4.0
  </a>.
</p>
```

Files and insertion points:
- `src/app/(forum)/bounties/new/page.tsx` — before the `{/* Submit */}` comment (currently around line 421)
- `src/app/(forum)/bounties/[id]/submit/page.tsx` — before the `{/* Submit */}` comment (currently around line 280)
- `src/app/(forum)/posts/new/page.tsx` — before the `{/* Submit */}` comment (currently around line 262)

**Step 3: Verify**

Run: `npx next build`
Expected: Build passes. Footer shows CC BY 4.0 + MIT links. All three submission forms show license notice.

**Step 4: Commit**

```bash
git add src/components/footer.tsx src/app/\(forum\)/bounties/new/page.tsx src/app/\(forum\)/bounties/\[id\]/submit/page.tsx src/app/\(forum\)/posts/new/page.tsx
git commit -m "feat: add CC BY 4.0 content license and MIT code license"
```

---

### Task 7: Fix Fund Recording Race Condition

**Files:**
- Modify: `src/app/(forum)/bounties/new/page.tsx:148-149`

**Step 1: Fix useEffect dependency array**

This was already coded earlier but not committed. In the recording `useEffect` (around line 112), change:

```typescript
  }, [isSuccess]);
```

To:

```typescript
  }, [isSuccess, txState]);
```

Also improve the catch block to surface the actual error:

```typescript
} catch (err) {
  const msg = err instanceof Error ? err.message : "Unknown error";
  console.error("[Fund recording failed]", msg);
  setError(`Failed to record funding transaction: ${msg}. Your bounty was created but funding may not be recorded. Tx: ${hash}`);
  setTxState("idle");
}
```

**Step 2: Verify**

Run: `npx next build`
Expected: Build passes.

**Step 3: Commit**

```bash
git add src/app/\(forum\)/bounties/new/page.tsx
git commit -m "fix: fund recording race condition — add txState to useEffect deps"
```

---

### Task 8: Final Verification & Push

**Step 1: Full build**

Run: `npx next build`
Expected: Clean build, no errors.

**Step 2: Push**

```bash
git push origin master
```
