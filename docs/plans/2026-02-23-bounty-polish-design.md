# Bounty Polish: Rendering, Rankings, ETH Display & Licensing

## Context

After deploying ETH-backed bounties and testing the full flow, several UX and correctness issues surfaced:

1. Bounty descriptions render as plain text (no markdown/LaTeX)
2. Submissions lack review metrics and ranking
3. ETH amount and escrow status badges are duplicated
4. No licensing or copyright information
5. Fund recording has a race condition causing silent failures

## Design

### 1. Markdown/LaTeX Rendering for Bounty Descriptions

**Problem:** Bounty descriptions use `<p className="whitespace-pre-wrap">` — plain text. Posts use `<PostBody>` (ReactMarkdown + remark-gfm + rehype-katex + highlight.js).

**Fix:** Replace the plain `<p>` in `/bounties/[id]/page.tsx` with `<PostBody content={bounty.description} />`. One-line swap, no new dependencies.

### 2. Submission Ranking with Votes + Peer Reviews

**Problem:** Submissions show only title, vote count, author, and time. No peer review data, no ranking order.

**Ranking formula** (votes 40%, reviews 60%):

```
score = (0.4 * voteScore) + (0.6 * reviewScore)

reviewScore = (approvals * 2) - (rejections * 3) + (needs_revision * 0)
```

Rejections penalize more heavily than approvals reward. `needs_revision` is neutral.

**Each submission card displays:**
- Rank number (#1, #2, #3...) based on computed score
- Vote score with up/down arrows (existing `VoteButtons` component)
- Review summary — compact pills: `3 approved · 1 needs revision · 0 rejected`
- Combined ranking score (small text)
- Title, author, time (existing)

**Data:** Extend the bounty detail page query to fetch review verdict counts per submission via subqueries or a follow-up query joining the `reviews` table.

**Sort order:** Submissions sorted by computed score descending, with winner pinned to top regardless of score.

### 3. Unified ETH Badge with Expandable Tx Details

**Problem:** ETH amount badge and `EscrowStatusBadge` are separate, creating visual duplication. No Etherscan link on bounty detail page.

**Design:**

*Collapsed state:* A single badge showing `0.001 ETH · Funded ▾`. Clickable to expand. Replaces both the current purple ETH badge and the separate `EscrowStatusBadge` component on the bounty detail page.

*Expanded state* (toggles on click):
- Escrow status with colored indicator
- Deadline countdown (if funded and active)
- Tx hash (abbreviated) as clickable Etherscan link
- Funder address (abbreviated)
- If paid: winner address + payout tx link

**Data:** Fetch `bountyTransactions` for the bounty. Derive Etherscan URL from `chainId` (11155111 → sepolia.etherscan.io, 1 → etherscan.io). On-chain read via `useBountyOnChain` remains the source-of-truth for escrow status.

### 4. Licensing & Copyright

**License choices:** CC BY 4.0 for user-generated content, MIT for codebase.

**Changes:**
- `LICENSE` file in repo root — MIT license
- Footer: Add "Content licensed under CC BY 4.0" with link to deed, next to existing copyright
- Post/bounty submission forms: Small text below submit button — "By submitting, you agree your contribution is licensed under CC BY 4.0"

### 5. Fund Recording Race Condition Fix

**Problem:** The `useEffect` that records funding on the backend depends only on `[isSuccess]`. If wagmi delivers `hash` and `isSuccess` in the same render cycle, `txState` is still `"submitting"` when the recording effect runs. Since `isSuccess` doesn't change again, the effect never re-fires.

**Fix:** Add `txState` to the dependency array: `[isSuccess, txState]`. The guard `txState !== "confirming"` prevents double execution. Also improve error messages to surface the actual failure reason and tx hash.

## Files Affected

| Change | Files |
|--------|-------|
| Markdown rendering | `src/app/(forum)/bounties/[id]/page.tsx` |
| Submission ranking | `src/app/(forum)/bounties/[id]/page.tsx` (query + UI) |
| Unified ETH badge | New `src/components/bounty/eth-escrow-badge.tsx`, update `bounties/[id]/page.tsx` |
| Licensing | `LICENSE`, `src/components/footer.tsx`, `bounties/new/page.tsx`, `bounties/[id]/submit/page.tsx`, `posts/new/page.tsx` |
| Race condition fix | `src/app/(forum)/bounties/new/page.tsx` |
