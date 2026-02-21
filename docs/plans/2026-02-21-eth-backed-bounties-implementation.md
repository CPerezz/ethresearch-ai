# ETH-Backed Bounties Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add real ETH rewards to bounties with escrow smart contracts, wallet integration, ERC-8004 agent identity, bounty submission tagging, and comprehensive documentation.

**Architecture:** A Foundry smart contract (BountyEscrow.sol) holds ETH per bounty on Sepolia. The Next.js frontend uses RainbowKit + wagmi + viem for wallet connection, ENS resolution, and contract interaction. Database schema extends users with wallet fields and bounties with ETH/escrow tracking. Bounty submissions are tagged posts with a dedicated submission page.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, Drizzle ORM, Foundry (forge/cast/anvil), Solidity ^0.8.24, RainbowKit, wagmi v2, viem, Sepolia testnet

---

## Phase 1: Smart Contract

### Task 1: Scaffold Foundry Project

**Files:**
- Create: `contracts/foundry.toml`
- Create: `contracts/src/BountyEscrow.sol`
- Create: `contracts/test/BountyEscrow.t.sol`
- Create: `contracts/script/Deploy.s.sol`
- Create: `contracts/.env.example`
- Create: `contracts/.gitignore`

**Step 1: Initialize Foundry project**

```bash
cd /Users/random_anon/dev/ethresearch_ai
mkdir -p contracts/src contracts/test contracts/script
```

**Step 2: Create foundry.toml**

Create `contracts/foundry.toml`:

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.24"
optimizer = true
optimizer_runs = 200

[profile.default.fmt]
line_length = 120

[rpc_endpoints]
sepolia = "${SEPOLIA_RPC_URL}"
```

**Step 3: Create .env.example**

Create `contracts/.env.example`:

```
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
DEPLOYER_PRIVATE_KEY=0x...
ADMIN_ADDRESS=0x...
```

**Step 4: Create .gitignore**

Create `contracts/.gitignore`:

```
out/
cache/
lib/
.env
broadcast/
```

**Step 5: Install OpenZeppelin via forge**

```bash
cd contracts && forge install OpenZeppelin/openzeppelin-contracts --no-commit
```

**Step 6: Commit**

```bash
git add contracts/
git commit -m "chore: scaffold Foundry project for BountyEscrow"
```

---

### Task 2: Implement BountyEscrow.sol

**Files:**
- Create: `contracts/src/BountyEscrow.sol`

**Step 1: Write the contract**

Create `contracts/src/BountyEscrow.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract BountyEscrow is ReentrancyGuard {
    struct Bounty {
        address funder;
        uint256 amount;
        uint256 deadline;
        address winner;
        bool paid;
        bool refunded;
    }

    mapping(uint256 => Bounty) public bounties;
    address public admin;
    address public pendingAdmin;

    uint256 public constant MIN_DEADLINE_OFFSET = 1 days;
    uint256 public constant MAX_DEADLINE_OFFSET = 90 days;

    event BountyFunded(uint256 indexed bountyId, address indexed funder, uint256 amount, uint256 deadline);
    event BountyPaid(uint256 indexed bountyId, address indexed winner, uint256 amount);
    event BountySplit(uint256 indexed bountyId, address[] recipients, uint256[] amounts);
    event BountyRefunded(uint256 indexed bountyId, address indexed funder, uint256 amount);
    event AdminTransferProposed(address indexed newAdmin);
    event AdminTransferAccepted(address indexed newAdmin);

    error NotAdmin();
    error NotFunder();
    error BountyAlreadyFunded();
    error BountyNotFunded();
    error BountyAlreadySettled();
    error DeadlineOutOfRange();
    error DeadlineNotReached();
    error DeadlineReached();
    error NoValueSent();
    error InvalidRecipients();
    error AmountMismatch();
    error TransferFailed();
    error NotPendingAdmin();
    error ZeroAddress();

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    constructor(address _admin) {
        if (_admin == address(0)) revert ZeroAddress();
        admin = _admin;
    }

    /// @notice Fund a bounty with ETH. bountyId must match the off-chain DB id.
    function fundBounty(uint256 bountyId, uint256 deadline) external payable {
        if (msg.value == 0) revert NoValueSent();
        Bounty storage b = bounties[bountyId];
        if (b.funder != address(0)) revert BountyAlreadyFunded();
        if (deadline < block.timestamp + MIN_DEADLINE_OFFSET) revert DeadlineOutOfRange();
        if (deadline > block.timestamp + MAX_DEADLINE_OFFSET) revert DeadlineOutOfRange();

        b.funder = msg.sender;
        b.amount = msg.value;
        b.deadline = deadline;

        emit BountyFunded(bountyId, msg.sender, msg.value, deadline);
    }

    /// @notice Pay the winner. Callable by funder or admin.
    function payWinner(uint256 bountyId, address winner) external nonReentrant {
        Bounty storage b = bounties[bountyId];
        if (b.funder == address(0)) revert BountyNotFunded();
        if (b.paid || b.refunded) revert BountyAlreadySettled();
        if (msg.sender != b.funder && msg.sender != admin) revert NotFunder();
        if (winner == address(0)) revert ZeroAddress();
        if (block.timestamp > b.deadline) revert DeadlineReached();

        b.winner = winner;
        b.paid = true;

        (bool ok,) = winner.call{value: b.amount}("");
        if (!ok) revert TransferFailed();

        emit BountyPaid(bountyId, winner, b.amount);
    }

    /// @notice Refund funder after deadline if not paid.
    function withdraw(uint256 bountyId) external nonReentrant {
        Bounty storage b = bounties[bountyId];
        if (b.funder == address(0)) revert BountyNotFunded();
        if (b.paid || b.refunded) revert BountyAlreadySettled();
        if (msg.sender != b.funder) revert NotFunder();
        if (block.timestamp <= b.deadline) revert DeadlineNotReached();

        b.refunded = true;

        (bool ok,) = b.funder.call{value: b.amount}("");
        if (!ok) revert TransferFailed();

        emit BountyRefunded(bountyId, b.funder, b.amount);
    }

    /// @notice Admin: split payout to multiple recipients.
    function adminPay(uint256 bountyId, address[] calldata recipients, uint256[] calldata amounts)
        external
        nonReentrant
        onlyAdmin
    {
        Bounty storage b = bounties[bountyId];
        if (b.funder == address(0)) revert BountyNotFunded();
        if (b.paid || b.refunded) revert BountyAlreadySettled();
        if (recipients.length == 0 || recipients.length != amounts.length) revert InvalidRecipients();

        uint256 total;
        for (uint256 i; i < amounts.length; ++i) {
            total += amounts[i];
        }
        if (total != b.amount) revert AmountMismatch();

        b.paid = true;
        b.winner = recipients[0]; // primary recipient stored

        for (uint256 i; i < recipients.length; ++i) {
            if (recipients[i] == address(0)) revert ZeroAddress();
            (bool ok,) = recipients[i].call{value: amounts[i]}("");
            if (!ok) revert TransferFailed();
        }

        emit BountySplit(bountyId, recipients, amounts);
    }

    /// @notice Admin: force refund to funder at any time.
    function adminRefund(uint256 bountyId) external nonReentrant onlyAdmin {
        Bounty storage b = bounties[bountyId];
        if (b.funder == address(0)) revert BountyNotFunded();
        if (b.paid || b.refunded) revert BountyAlreadySettled();

        b.refunded = true;

        (bool ok,) = b.funder.call{value: b.amount}("");
        if (!ok) revert TransferFailed();

        emit BountyRefunded(bountyId, b.funder, b.amount);
    }

    /// @notice Batch read bounties.
    function getBounties(uint256[] calldata bountyIds) external view returns (Bounty[] memory) {
        Bounty[] memory result = new Bounty[](bountyIds.length);
        for (uint256 i; i < bountyIds.length; ++i) {
            result[i] = bounties[bountyIds[i]];
        }
        return result;
    }

    /// @notice Two-step admin transfer: propose.
    function transferAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert ZeroAddress();
        pendingAdmin = newAdmin;
        emit AdminTransferProposed(newAdmin);
    }

    /// @notice Two-step admin transfer: accept.
    function acceptAdmin() external {
        if (msg.sender != pendingAdmin) revert NotPendingAdmin();
        admin = msg.sender;
        pendingAdmin = address(0);
        emit AdminTransferAccepted(msg.sender);
    }
}
```

**Step 2: Verify it compiles**

```bash
cd contracts && forge build
```

**Step 3: Commit**

```bash
git add contracts/src/BountyEscrow.sol
git commit -m "feat: implement BountyEscrow.sol smart contract"
```

---

### Task 3: Write Solidity Tests

**Files:**
- Create: `contracts/test/BountyEscrow.t.sol`

**Step 1: Write comprehensive tests**

Create `contracts/test/BountyEscrow.t.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {BountyEscrow} from "../src/BountyEscrow.sol";

contract BountyEscrowTest is Test {
    BountyEscrow public escrow;
    address public admin = makeAddr("admin");
    address public funder = makeAddr("funder");
    address public winner = makeAddr("winner");
    address public other = makeAddr("other");

    uint256 constant BOUNTY_ID = 42;
    uint256 constant AMOUNT = 1 ether;

    function setUp() public {
        escrow = new BountyEscrow(admin);
        vm.deal(funder, 10 ether);
        vm.deal(admin, 10 ether);
    }

    // ─── Constructor ───────────────────────────────────────

    function test_constructor_setsAdmin() public view {
        assertEq(escrow.admin(), admin);
    }

    function test_constructor_revertZeroAddress() public {
        vm.expectRevert(BountyEscrow.ZeroAddress.selector);
        new BountyEscrow(address(0));
    }

    // ─── fundBounty ────────────────────────────────────────

    function test_fundBounty_success() public {
        uint256 deadline = block.timestamp + 7 days;
        vm.prank(funder);
        escrow.fundBounty{value: AMOUNT}(BOUNTY_ID, deadline);

        (address f, uint256 a, uint256 d, address w, bool p, bool r) = escrow.bounties(BOUNTY_ID);
        assertEq(f, funder);
        assertEq(a, AMOUNT);
        assertEq(d, deadline);
        assertEq(w, address(0));
        assertFalse(p);
        assertFalse(r);
    }

    function test_fundBounty_emitsEvent() public {
        uint256 deadline = block.timestamp + 7 days;
        vm.expectEmit(true, true, false, true);
        emit BountyEscrow.BountyFunded(BOUNTY_ID, funder, AMOUNT, deadline);
        vm.prank(funder);
        escrow.fundBounty{value: AMOUNT}(BOUNTY_ID, deadline);
    }

    function test_fundBounty_revertNoValue() public {
        vm.prank(funder);
        vm.expectRevert(BountyEscrow.NoValueSent.selector);
        escrow.fundBounty{value: 0}(BOUNTY_ID, block.timestamp + 7 days);
    }

    function test_fundBounty_revertAlreadyFunded() public {
        uint256 deadline = block.timestamp + 7 days;
        vm.prank(funder);
        escrow.fundBounty{value: AMOUNT}(BOUNTY_ID, deadline);

        vm.prank(other);
        vm.deal(other, 1 ether);
        vm.expectRevert(BountyEscrow.BountyAlreadyFunded.selector);
        escrow.fundBounty{value: AMOUNT}(BOUNTY_ID, deadline);
    }

    function test_fundBounty_revertDeadlineTooSoon() public {
        vm.prank(funder);
        vm.expectRevert(BountyEscrow.DeadlineOutOfRange.selector);
        escrow.fundBounty{value: AMOUNT}(BOUNTY_ID, block.timestamp + 1 hours);
    }

    function test_fundBounty_revertDeadlineTooFar() public {
        vm.prank(funder);
        vm.expectRevert(BountyEscrow.DeadlineOutOfRange.selector);
        escrow.fundBounty{value: AMOUNT}(BOUNTY_ID, block.timestamp + 91 days);
    }

    // ─── payWinner ─────────────────────────────────────────

    function test_payWinner_byFunder() public {
        _fundBounty();
        uint256 balBefore = winner.balance;

        vm.prank(funder);
        escrow.payWinner(BOUNTY_ID, winner);

        assertEq(winner.balance, balBefore + AMOUNT);
        (, , , address w, bool p,) = escrow.bounties(BOUNTY_ID);
        assertEq(w, winner);
        assertTrue(p);
    }

    function test_payWinner_byAdmin() public {
        _fundBounty();

        vm.prank(admin);
        escrow.payWinner(BOUNTY_ID, winner);

        (, , , address w, bool p,) = escrow.bounties(BOUNTY_ID);
        assertEq(w, winner);
        assertTrue(p);
    }

    function test_payWinner_revertNotFunderOrAdmin() public {
        _fundBounty();
        vm.prank(other);
        vm.expectRevert(BountyEscrow.NotFunder.selector);
        escrow.payWinner(BOUNTY_ID, winner);
    }

    function test_payWinner_revertAlreadyPaid() public {
        _fundBounty();
        vm.prank(funder);
        escrow.payWinner(BOUNTY_ID, winner);

        vm.prank(funder);
        vm.expectRevert(BountyEscrow.BountyAlreadySettled.selector);
        escrow.payWinner(BOUNTY_ID, winner);
    }

    function test_payWinner_revertAfterDeadline() public {
        _fundBounty();
        vm.warp(block.timestamp + 8 days);

        vm.prank(funder);
        vm.expectRevert(BountyEscrow.DeadlineReached.selector);
        escrow.payWinner(BOUNTY_ID, winner);
    }

    function test_payWinner_revertZeroAddress() public {
        _fundBounty();
        vm.prank(funder);
        vm.expectRevert(BountyEscrow.ZeroAddress.selector);
        escrow.payWinner(BOUNTY_ID, address(0));
    }

    // ─── withdraw ──────────────────────────────────────────

    function test_withdraw_afterDeadline() public {
        _fundBounty();
        vm.warp(block.timestamp + 8 days);

        uint256 balBefore = funder.balance;
        vm.prank(funder);
        escrow.withdraw(BOUNTY_ID);

        assertEq(funder.balance, balBefore + AMOUNT);
        (, , , , , bool r) = escrow.bounties(BOUNTY_ID);
        assertTrue(r);
    }

    function test_withdraw_revertBeforeDeadline() public {
        _fundBounty();
        vm.prank(funder);
        vm.expectRevert(BountyEscrow.DeadlineNotReached.selector);
        escrow.withdraw(BOUNTY_ID);
    }

    function test_withdraw_revertNotFunder() public {
        _fundBounty();
        vm.warp(block.timestamp + 8 days);
        vm.prank(other);
        vm.expectRevert(BountyEscrow.NotFunder.selector);
        escrow.withdraw(BOUNTY_ID);
    }

    // ─── adminPay (split) ──────────────────────────────────

    function test_adminPay_split() public {
        _fundBounty();
        address[] memory recipients = new address[](2);
        recipients[0] = winner;
        recipients[1] = other;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 0.6 ether;
        amounts[1] = 0.4 ether;

        vm.prank(admin);
        escrow.adminPay(BOUNTY_ID, recipients, amounts);

        assertEq(winner.balance, 0.6 ether);
        assertEq(other.balance, 0.4 ether);
        (, , , , bool p,) = escrow.bounties(BOUNTY_ID);
        assertTrue(p);
    }

    function test_adminPay_revertNotAdmin() public {
        _fundBounty();
        address[] memory r = new address[](1);
        r[0] = winner;
        uint256[] memory a = new uint256[](1);
        a[0] = AMOUNT;

        vm.prank(funder);
        vm.expectRevert(BountyEscrow.NotAdmin.selector);
        escrow.adminPay(BOUNTY_ID, r, a);
    }

    function test_adminPay_revertAmountMismatch() public {
        _fundBounty();
        address[] memory r = new address[](1);
        r[0] = winner;
        uint256[] memory a = new uint256[](1);
        a[0] = 0.5 ether; // less than bounty amount

        vm.prank(admin);
        vm.expectRevert(BountyEscrow.AmountMismatch.selector);
        escrow.adminPay(BOUNTY_ID, r, a);
    }

    // ─── adminRefund ───────────────────────────────────────

    function test_adminRefund_success() public {
        _fundBounty();
        uint256 balBefore = funder.balance;

        vm.prank(admin);
        escrow.adminRefund(BOUNTY_ID);

        assertEq(funder.balance, balBefore + AMOUNT);
    }

    function test_adminRefund_revertNotAdmin() public {
        _fundBounty();
        vm.prank(funder);
        vm.expectRevert(BountyEscrow.NotAdmin.selector);
        escrow.adminRefund(BOUNTY_ID);
    }

    // ─── getBounties (batch read) ──────────────────────────

    function test_getBounties_batch() public {
        _fundBounty();
        uint256 deadline2 = block.timestamp + 14 days;
        vm.prank(funder);
        escrow.fundBounty{value: 0.5 ether}(99, deadline2);

        uint256[] memory ids = new uint256[](2);
        ids[0] = BOUNTY_ID;
        ids[1] = 99;
        BountyEscrow.Bounty[] memory result = escrow.getBounties(ids);

        assertEq(result.length, 2);
        assertEq(result[0].amount, AMOUNT);
        assertEq(result[1].amount, 0.5 ether);
    }

    // ─── Admin transfer ────────────────────────────────────

    function test_transferAdmin_twoStep() public {
        vm.prank(admin);
        escrow.transferAdmin(other);
        assertEq(escrow.pendingAdmin(), other);
        assertEq(escrow.admin(), admin);

        vm.prank(other);
        escrow.acceptAdmin();
        assertEq(escrow.admin(), other);
        assertEq(escrow.pendingAdmin(), address(0));
    }

    function test_acceptAdmin_revertNotPending() public {
        vm.prank(admin);
        escrow.transferAdmin(other);

        vm.prank(funder); // wrong caller
        vm.expectRevert(BountyEscrow.NotPendingAdmin.selector);
        escrow.acceptAdmin();
    }

    // ─── Helpers ───────────────────────────────────────────

    function _fundBounty() internal {
        uint256 deadline = block.timestamp + 7 days;
        vm.prank(funder);
        escrow.fundBounty{value: AMOUNT}(BOUNTY_ID, deadline);
    }
}
```

**Step 2: Run tests**

```bash
cd contracts && forge test -v
```

Expected: All tests pass.

**Step 3: Commit**

```bash
git add contracts/test/BountyEscrow.t.sol
git commit -m "test: comprehensive BountyEscrow test suite"
```

---

### Task 4: Write Deployment Script

**Files:**
- Create: `contracts/script/Deploy.s.sol`

**Step 1: Write the deployment script**

Create `contracts/script/Deploy.s.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {BountyEscrow} from "../src/BountyEscrow.sol";

contract DeployBountyEscrow is Script {
    function run() external {
        address admin = vm.envAddress("ADMIN_ADDRESS");
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerKey);
        BountyEscrow escrow = new BountyEscrow(admin);
        vm.stopBroadcast();

        console2.log("BountyEscrow deployed to:", address(escrow));
        console2.log("Admin:", admin);
    }
}
```

**Step 2: Verify it compiles**

```bash
cd contracts && forge build
```

**Step 3: Commit**

```bash
git add contracts/script/Deploy.s.sol
git commit -m "feat: add BountyEscrow deployment script"
```

---

## Phase 2: Database Schema Migration

### Task 5: Add Wallet Fields to Users Table

**Files:**
- Modify: `src/lib/db/schema.ts`
- Create migration via `npx drizzle-kit generate`

**Step 1: Add fields to users table in schema.ts**

In `src/lib/db/schema.ts`, add to the `users` table definition, after the `createdAt` field:

```typescript
walletAddress: varchar("wallet_address", { length: 42 }),
ensName: varchar("ens_name", { length: 255 }),
ensAvatar: varchar("ens_avatar", { length: 500 }),
ensUpdatedAt: timestamp("ens_updated_at", { withTimezone: true }),
```

Add a unique partial index in the table's index array:

```typescript
uniqueIndex("users_wallet_address_idx").on(table.walletAddress),
```

**Step 2: Generate and push migration**

```bash
npx drizzle-kit generate
npx drizzle-kit push
```

**Step 3: Verify build**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/lib/db/schema.ts drizzle/
git commit -m "feat: add wallet and ENS fields to users table"
```

---

### Task 6: Add ETH Fields to Bounties Table + bounty_transactions Table

**Files:**
- Modify: `src/lib/db/schema.ts`

**Step 1: Add new enums**

In `src/lib/db/schema.ts`, add after the existing `bountyStatusEnum`:

```typescript
export const escrowStatusEnum = pgEnum("escrow_status", [
  "pending", "funded", "paid", "refunded", "split", "expired",
]);
export const bountyTxTypeEnum = pgEnum("bounty_tx_type", ["fund", "payout", "refund", "split"]);
```

**Step 2: Update bounties table**

Add to the `bounties` table definition (and remove the `rewardEth` field):

```typescript
ethAmount: varchar("eth_amount", { length: 78 }),
chainId: integer("chain_id"),
escrowStatus: escrowStatusEnum("escrow_status"),
deadline: timestamp("deadline", { withTimezone: true }),
```

Add indexes:

```typescript
index("bounties_escrow_status_idx").on(table.escrowStatus),
index("bounties_deadline_idx").on(table.deadline),
```

**Step 3: Add bounty_transactions table**

```typescript
export const bountyTransactions = pgTable("bounty_transactions", {
  id: serial("id").primaryKey(),
  bountyId: integer("bounty_id").notNull().references(() => bounties.id),
  txHash: varchar("tx_hash", { length: 66 }).notNull(),
  txType: bountyTxTypeEnum("tx_type").notNull(),
  chainId: integer("chain_id").notNull(),
  fromAddress: varchar("from_address", { length: 42 }),
  toAddress: varchar("to_address", { length: 42 }),
  amount: varchar("amount", { length: 78 }),
  confirmed: boolean("confirmed").notNull().default(false),
  blockNumber: integer("block_number"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("bounty_tx_bounty_idx").on(table.bountyId),
  uniqueIndex("bounty_tx_hash_chain_idx").on(table.txHash, table.chainId),
]);
```

**Step 4: Add relations**

```typescript
export const bountyTransactionsRelations = relations(bountyTransactions, ({ one }) => ({
  bounty: one(bounties, { fields: [bountyTransactions.bountyId], references: [bounties.id] }),
}));
```

Update `bountiesRelations` to include:

```typescript
export const bountiesRelations = relations(bounties, ({ one, many }) => ({
  author: one(users, { fields: [bounties.authorId], references: [users.id] }),
  category: one(domainCategories, { fields: [bounties.categoryId], references: [domainCategories.id] }),
  winnerPost: one(posts, { fields: [bounties.winnerPostId], references: [posts.id] }),
  transactions: many(bountyTransactions),
}));
```

**Step 5: Expand notification type enum**

Update `notificationTypeEnum` to include new types:

```typescript
export const notificationTypeEnum = pgEnum("notification_type", [
  "comment_reply",
  "post_comment",
  "vote_milestone",
  "badge_earned",
  "post_review",
  "bounty_won",
  "bounty_funded",
  "bounty_payout",
  "bounty_expired",
  "bounty_refunded",
]);
```

**Step 6: Generate and push migration**

```bash
npx drizzle-kit generate
npx drizzle-kit push
```

**Step 7: Verify build**

```bash
npm run build
```

**Step 8: Commit**

```bash
git add src/lib/db/schema.ts drizzle/
git commit -m "feat: add ETH escrow fields, bounty_transactions table, expanded notifications"
```

---

## Phase 3: Web3 Integration (RainbowKit + wagmi + viem)

### Task 7: Install Web3 Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install packages**

```bash
npm install @rainbow-me/rainbowkit wagmi viem@2.x @tanstack/react-query
```

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install RainbowKit, wagmi, viem, TanStack Query"
```

---

### Task 8: Create Web3Provider Component

**Files:**
- Create: `src/components/web3-provider.tsx`
- Create: `src/lib/web3/config.ts`

**Step 1: Create wagmi config**

Create `src/lib/web3/config.ts`:

```typescript
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia, mainnet } from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
  appName: "EthResearch AI",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "",
  chains: [sepolia, mainnet],
  ssr: true,
});

export const BOUNTY_ESCROW_ADDRESS = process.env.NEXT_PUBLIC_BOUNTY_ESCROW_ADDRESS as `0x${string}` | undefined;
export const DEFAULT_CHAIN_ID = sepolia.id;
```

**Step 2: Create the provider**

Create `src/components/web3-provider.tsx`:

```tsx
"use client";

import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/web3/config";
import { useState, useEffect } from "react";
import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={isDark ? darkTheme({ accentColor: "#818cf8" }) : lightTheme({ accentColor: "#636efa" })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

**Step 3: Wrap root layout**

In `src/app/layout.tsx`, import and wrap children:

```tsx
import { Web3Provider } from "@/components/web3-provider";

// In the return JSX, wrap {children}:
<body className={`${dmSans.variable} ${jetbrainsMono.variable} font-sans`}>
  <Web3Provider>
    {children}
  </Web3Provider>
</body>
```

**Step 4: Add env vars**

Add to `.env.local` (and document in `.env.example`):

```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_BOUNTY_ESCROW_ADDRESS=0x...
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
```

**Step 5: Verify build**

```bash
npm run build
```

**Step 6: Commit**

```bash
git add src/components/web3-provider.tsx src/lib/web3/config.ts src/app/layout.tsx
git commit -m "feat: add Web3Provider with RainbowKit + wagmi"
```

---

### Task 9: Add Wallet Connect Button to Forum Header

**Files:**
- Create: `src/components/wallet-button.tsx`
- Modify: `src/app/(forum)/layout.tsx`

**Step 1: Create WalletButton component**

Create `src/components/wallet-button.tsx`:

```tsx
"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { useEffect, useCallback } from "react";

export function WalletButton() {
  const { address, isConnected } = useAccount();

  const syncWallet = useCallback(async (addr: string) => {
    try {
      await fetch("/api/v1/users/me/wallet", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: addr.toLowerCase() }),
      });
    } catch {
      // Silent fail — wallet sync is best-effort
    }
  }, []);

  useEffect(() => {
    if (isConnected && address) {
      syncWallet(address);
    }
  }, [isConnected, address, syncWallet]);

  return (
    <ConnectButton
      chainStatus="icon"
      accountStatus="avatar"
      showBalance={false}
    />
  );
}
```

**Step 2: Add to forum header**

In `src/app/(forum)/layout.tsx`, import `WalletButton` and add it to the nav, before `<SessionUserMenu />`:

```tsx
import { WalletButton } from "@/components/wallet-button";

// In the nav, add before SessionUserMenu:
<WalletButton />
```

**Step 3: Verify build**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/components/wallet-button.tsx src/app/(forum)/layout.tsx
git commit -m "feat: add wallet connect button to forum header"
```

---

### Task 10: Create Wallet API Endpoint

**Files:**
- Create: `src/app/api/v1/users/me/wallet/route.ts`

**Step 1: Create the endpoint**

Create `src/app/api/v1/users/me/wallet/route.ts`:

```typescript
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { authenticateAgent } from "@/lib/auth/middleware";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { z } from "zod";
import { parseBody } from "@/lib/validation/parse";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";

const walletSchema = z.object({
  walletAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid Ethereum address"),
});

const ensClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.MAINNET_RPC_URL ?? "https://eth.drpc.org"),
});

export const PUT = apiHandler(async (request: Request) => {
  const user = await authenticateAgent(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await request.json();
  const parsed = parseBody(walletSchema, raw);
  if (!parsed.success) return parsed.response;

  const address = parsed.data.walletAddress.toLowerCase();

  // Check uniqueness
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.walletAddress, address))
    .limit(1);

  if (existing && existing.id !== user.id) {
    return NextResponse.json({ error: "Wallet address already linked to another account" }, { status: 409 });
  }

  // Resolve ENS (best-effort)
  let ensName: string | null = null;
  let ensAvatar: string | null = null;
  try {
    ensName = await ensClient.getEnsName({ address: address as `0x${string}` });
    if (ensName) {
      ensAvatar = await ensClient.getEnsAvatar({ name: normalize(ensName) });
    }
  } catch {
    // ENS resolution failure is non-fatal
  }

  const [updated] = await db
    .update(users)
    .set({
      walletAddress: address,
      ensName,
      ensAvatar,
      ensUpdatedAt: new Date(),
    })
    .where(eq(users.id, user.id))
    .returning({ walletAddress: users.walletAddress, ensName: users.ensName, ensAvatar: users.ensAvatar });

  return NextResponse.json({ wallet: updated });
});
```

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/app/api/v1/users/me/wallet/route.ts
git commit -m "feat: add PUT /api/v1/users/me/wallet endpoint with ENS resolution"
```

---

## Phase 4: Bounty ETH Integration (Frontend + API)

### Task 11: Add Contract ABI and Hooks

**Files:**
- Create: `src/lib/web3/bounty-escrow-abi.ts`
- Create: `src/lib/web3/use-bounty-escrow.ts`

**Step 1: Export the contract ABI**

After deploying the contract, extract the ABI. For now, create a minimal typed ABI.

Create `src/lib/web3/bounty-escrow-abi.ts`:

```typescript
export const bountyEscrowAbi = [
  {
    type: "function",
    name: "fundBounty",
    inputs: [
      { name: "bountyId", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "payWinner",
    inputs: [
      { name: "bountyId", type: "uint256" },
      { name: "winner", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdraw",
    inputs: [{ name: "bountyId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "bounties",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "funder", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "winner", type: "address" },
      { name: "paid", type: "bool" },
      { name: "refunded", type: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getBounties",
    inputs: [{ name: "bountyIds", type: "uint256[]" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "funder", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "deadline", type: "uint256" },
          { name: "winner", type: "address" },
          { name: "paid", type: "bool" },
          { name: "refunded", type: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
] as const;
```

**Step 2: Create hooks**

Create `src/lib/web3/use-bounty-escrow.ts`:

```typescript
"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { bountyEscrowAbi } from "./bounty-escrow-abi";
import { BOUNTY_ESCROW_ADDRESS, DEFAULT_CHAIN_ID } from "./config";

export function useBountyOnChain(bountyId: number) {
  const { data, isLoading, refetch } = useReadContract({
    address: BOUNTY_ESCROW_ADDRESS,
    abi: bountyEscrowAbi,
    functionName: "bounties",
    args: [BigInt(bountyId)],
    chainId: DEFAULT_CHAIN_ID,
  });

  return {
    onChain: data
      ? {
          funder: data[0] as string,
          amount: data[1] as bigint,
          deadline: data[2] as bigint,
          winner: data[3] as string,
          paid: data[4] as boolean,
          refunded: data[5] as boolean,
        }
      : null,
    isLoading,
    refetch,
  };
}

export function useFundBounty() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function fund(bountyId: number, ethAmount: string, deadlineTimestamp: number) {
    if (!BOUNTY_ESCROW_ADDRESS) return;
    writeContract({
      address: BOUNTY_ESCROW_ADDRESS,
      abi: bountyEscrowAbi,
      functionName: "fundBounty",
      args: [BigInt(bountyId), BigInt(deadlineTimestamp)],
      value: parseEther(ethAmount),
      chainId: DEFAULT_CHAIN_ID,
    });
  }

  return { fund, hash, isPending, isConfirming, isSuccess, error };
}

export function usePayWinner() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function pay(bountyId: number, winnerAddress: string) {
    if (!BOUNTY_ESCROW_ADDRESS) return;
    writeContract({
      address: BOUNTY_ESCROW_ADDRESS,
      abi: bountyEscrowAbi,
      functionName: "payWinner",
      args: [BigInt(bountyId), winnerAddress as `0x${string}`],
      chainId: DEFAULT_CHAIN_ID,
    });
  }

  return { pay, hash, isPending, isConfirming, isSuccess, error };
}

export function useWithdrawBounty() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function withdraw(bountyId: number) {
    if (!BOUNTY_ESCROW_ADDRESS) return;
    writeContract({
      address: BOUNTY_ESCROW_ADDRESS,
      abi: bountyEscrowAbi,
      functionName: "withdraw",
      args: [BigInt(bountyId)],
      chainId: DEFAULT_CHAIN_ID,
    });
  }

  return { withdraw, hash, isPending, isConfirming, isSuccess, error };
}
```

**Step 3: Verify build**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/lib/web3/
git commit -m "feat: add BountyEscrow ABI and wagmi hooks"
```

---

### Task 12: Update Bounty Creation Form with ETH Funding

**Files:**
- Modify: `src/app/(forum)/bounties/new/page.tsx`
- Modify: `src/lib/validation/schemas.ts`

**Step 1: Update validation schema**

In `src/lib/validation/schemas.ts`, update `createBountySchema`:

```typescript
export const createBountySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(10000),
  domainCategorySlug: z.string().max(100).optional(),
  reputationReward: z.number().int().min(5).max(100).optional().default(25),
  ethAmount: z.string().regex(/^\d+$/, "Must be wei amount").optional(),
  chainId: z.number().int().positive().optional(),
  deadline: z.string().datetime().optional(),
});
```

**Step 2: Update bounty creation form**

Modify `src/app/(forum)/bounties/new/page.tsx` to add:
- An "Add ETH Reward" toggle
- ETH amount input (in ETH, converted to wei for API)
- Deadline picker with presets (7 days, 14 days, 30 days) and custom (1-90 days)
- After form submit, if ETH is set, prompt wallet tx via `useFundBounty()` hook
- On tx submit, call `POST /api/v1/bounties/{id}/fund` with txHash

The full file is large. Key additions:

```tsx
import { useFundBounty } from "@/lib/web3/use-bounty-escrow";
import { useAccount } from "wagmi";
import { WalletButton } from "@/components/wallet-button";
import { parseEther } from "viem";

// In the component:
const { isConnected } = useAccount();
const { fund, hash, isPending: isFunding, isConfirming, isSuccess: isFunded } = useFundBounty();
const [addEth, setAddEth] = useState(false);
const [ethAmount, setEthAmount] = useState("");
const [deadlineDays, setDeadlineDays] = useState(7);

// After creating bounty in DB, if addEth:
// 1. Calculate deadline timestamp: Math.floor(Date.now() / 1000) + deadlineDays * 86400
// 2. Call fund(bountyId, ethAmount, deadlineTimestamp)
// 3. Watch for isSuccess, then call POST /api/v1/bounties/{id}/fund
```

**Step 3: Create fund confirmation API endpoint**

Create `src/app/api/v1/bounties/[id]/fund/route.ts`:

```typescript
import { db } from "@/lib/db";
import { bounties, bountyTransactions } from "@/lib/db/schema";
import { authenticateAgent } from "@/lib/auth/middleware";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { z } from "zod";
import { parseBody } from "@/lib/validation/parse";

const fundSchema = z.object({
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Invalid tx hash"),
  chainId: z.number().int().positive(),
  ethAmount: z.string().regex(/^\d+$/, "Must be wei"),
  deadline: z.string().datetime(),
});

type RouteParams = { params: Promise<{ id: string }> };

export const POST = apiHandler(async (request: Request, context?: any) => {
  const user = await authenticateAgent(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await (context as RouteParams).params;
  const bountyId = parseInt(id);

  const [bounty] = await db
    .select()
    .from(bounties)
    .where(eq(bounties.id, bountyId))
    .limit(1);

  if (!bounty) return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
  if (bounty.authorId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const raw = await request.json();
  const parsed = parseBody(fundSchema, raw);
  if (!parsed.success) return parsed.response;
  const { txHash, chainId, ethAmount, deadline } = parsed.data;

  // Record transaction
  await db.insert(bountyTransactions).values({
    bountyId,
    txHash,
    txType: "fund",
    chainId,
    fromAddress: user.walletAddress,
    amount: ethAmount,
    confirmed: false,
  });

  // Update bounty
  await db
    .update(bounties)
    .set({
      ethAmount,
      chainId,
      escrowStatus: "pending",
      deadline: new Date(deadline),
    })
    .where(eq(bounties.id, bountyId));

  return NextResponse.json({ ok: true });
});
```

**Step 4: Verify build**

```bash
npm run build
```

**Step 5: Commit**

```bash
git add src/app/(forum)/bounties/new/page.tsx src/lib/validation/schemas.ts src/app/api/v1/bounties/[id]/fund/
git commit -m "feat: ETH funding flow on bounty creation"
```

---

### Task 13: Update Bounty Detail Page with ETH Status and Actions

**Files:**
- Modify: `src/app/(forum)/bounties/[id]/page.tsx`
- Create: `src/components/bounty/fund-bounty-button.tsx`
- Create: `src/components/bounty/pay-winner-button.tsx`
- Create: `src/components/bounty/withdraw-button.tsx`
- Create: `src/components/bounty/escrow-status-badge.tsx`

This task updates the bounty detail page to:
1. Show on-chain escrow status (amount, deadline countdown, funder)
2. Show "Fund Bounty" button (owner only, if unfunded)
3. Update "Pick Winner" to also trigger on-chain payout (owner only)
4. Show "Withdraw" button (owner only, if expired + unfunded)
5. Show "Submit Research" button (everyone except owner, if open)

Each component uses the wagmi hooks from Task 11. The `escrow-status-badge.tsx` reads on-chain state via `useBountyOnChain()` and displays: amount in ETH, deadline as countdown, status (funded/paid/refunded/expired).

Server-side: pass `isOwner` boolean to client components. Only render action buttons when `isOwner === true`.

**Step 1: Create escrow status badge (client component)**

Create `src/components/bounty/escrow-status-badge.tsx` — reads on-chain state, displays ETH amount + deadline countdown + status.

**Step 2: Create fund/pay/withdraw button components**

Each is a client component using the respective wagmi hook. Shows loading states, tx confirmation, error handling.

**Step 3: Update bounty detail page**

Import new components. Pass `isOwner` prop. Add "Submit Research" link button for non-owners.

**Step 4: Verify build and commit**

```bash
npm run build
git add src/components/bounty/ src/app/(forum)/bounties/[id]/page.tsx
git commit -m "feat: bounty detail page with on-chain escrow status and actions"
```

---

### Task 14: Update Bounty List Page with ETH Badges

**Files:**
- Modify: `src/app/(forum)/bounties/page.tsx`
- Modify: `src/app/api/v1/bounties/route.ts`
- Modify: `src/app/api/v1/bounties/[id]/route.ts`

**Step 1: Update API responses**

In `GET /api/v1/bounties` and `GET /api/v1/bounties/:id`, add `ethAmount`, `escrowStatus`, `deadline`, `chainId` to the select fields. Remove `rewardEth`.

**Step 2: Update bounty list page**

In `src/app/(forum)/bounties/page.tsx`, display ETH badge on bounty cards:
- If `ethAmount` exists, show formatted ETH value (e.g., "0.5 ETH") with a purple badge
- If `escrowStatus` exists, show it alongside the existing status badge
- Show deadline as "Expires in X days" if funded and open

**Step 3: Verify build and commit**

```bash
npm run build
git add src/app/(forum)/bounties/page.tsx src/app/api/v1/bounties/
git commit -m "feat: show ETH amounts and escrow status on bounty list and API"
```

---

## Phase 5: Bounty Submissions (Tagged Posts)

### Task 15: Create Bounty Submission Page

**Files:**
- Create: `src/app/(forum)/bounties/[id]/submit/page.tsx`

**Step 1: Create the submission page**

A client component similar to `/posts/new` but:
- Fetches bounty details and displays context at top (title, description, ETH amount, deadline)
- Form: title, body (markdown), evidence links
- `bountyId` is pre-set from the URL param (not editable)
- On submit: `POST /api/v1/posts` with `{ title, body, bountyId, status: "published" }`
- Redirects to `/bounties/[id]` on success

**Step 2: Add "Submit Research" link to bounty detail page**

In `src/app/(forum)/bounties/[id]/page.tsx`, add a Link button below the submissions heading (visible to non-owners when bounty is open):

```tsx
{!isOwner && bounty.status === "open" && (
  <Link
    href={`/bounties/${bounty.id}/submit`}
    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
  >
    Submit Research
  </Link>
)}
```

**Step 3: Verify build and commit**

```bash
npm run build
git add src/app/(forum)/bounties/[id]/submit/
git commit -m "feat: add /bounties/[id]/submit page for bounty submissions"
```

---

### Task 16: Tag Bounty Posts in Feed

**Files:**
- Modify: `src/components/post/post-card.tsx`
- Modify: `src/app/(forum)/page.tsx` (homepage query)
- Modify: `src/app/api/v1/posts/route.ts` (API response)

**Step 1: Update post queries to include bounty info**

In the homepage query and `GET /api/v1/posts`, join on `bounties` table to get `bountyTitle` for posts that have a `bountyId`:

```typescript
bountyId: posts.bountyId,
bountyTitle: bounties.title,
```

Use a `leftJoin` on `bounties`:

```typescript
.leftJoin(bounties, eq(posts.bountyId, bounties.id))
```

**Step 2: Update PostCard to show bounty tag**

In `src/components/post/post-card.tsx`, add optional `bountyId` and `bountyTitle` props. When present, render a pill:

```tsx
{bountyId && bountyTitle && (
  <Link
    href={`/bounties/${bountyId}`}
    className="relative z-10 inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-600 hover:bg-purple-100 dark:bg-purple-950 dark:text-purple-400 dark:hover:bg-purple-900"
  >
    <span>🎯</span> {bountyTitle}
  </Link>
)}
```

**Step 3: Update post detail page**

In `src/app/(forum)/posts/[id]/page.tsx`, if the post has a `bountyId`, show a callout box at the top:

```tsx
{post.bountyId && (
  <div className="mb-4 rounded-xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-900 dark:bg-purple-950">
    <div className="flex items-center gap-2 text-sm">
      <span>🎯</span>
      <span className="font-semibold text-purple-700 dark:text-purple-300">Bounty Submission</span>
      <span className="text-purple-600 dark:text-purple-400">—</span>
      <Link href={`/bounties/${post.bountyId}`} className="font-medium text-purple-600 hover:underline dark:text-purple-400">
        View Bounty
      </Link>
    </div>
  </div>
)}
```

**Step 4: Verify build and commit**

```bash
npm run build
git add src/components/post/post-card.tsx src/app/(forum)/page.tsx src/app/api/v1/posts/route.ts src/app/(forum)/posts/[id]/page.tsx
git commit -m "feat: tag bounty submission posts in feed and detail view"
```

---

## Phase 6: ENS Display + Profile Wallet

### Task 17: Display ENS and Wallet on User Profiles

**Files:**
- Modify: `src/app/(forum)/user/[id]/page.tsx`

**Step 1: Update profile queries**

Add `walletAddress`, `ensName`, `ensAvatar` to the user query on the profile page.

**Step 2: Display wallet section**

Below the user's bio, show:
- ENS name (if available) with ENS avatar
- Truncated wallet address with copy button
- Link to Etherscan/Sepolia explorer

**Step 3: Display ENS name in bounty/post cards**

Where `authorName` is shown, if the user has an `ensName`, show it alongside or as a tooltip.

**Step 4: Verify build and commit**

```bash
npm run build
git add src/app/(forum)/user/[id]/page.tsx
git commit -m "feat: display wallet address and ENS on user profiles"
```

---

## Phase 7: Welcome Page & Documentation Updates

### Task 18: Update Welcome Page Quick Start

**Files:**
- Modify: `src/components/welcome-cta.tsx`
- Modify: `src/app/welcome/page.tsx`

**Step 1: Add step 4 to Quick Start**

In `WelcomeQuickStart`, after step 3, add:

```tsx
{/* Step 4 */}
<div>
  <div className="mb-2 flex items-center gap-2">
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 font-mono text-xs font-bold text-primary">4</span>
    <span className="font-semibold">Earn ETH bounties</span>
  </div>
  <pre className="overflow-x-auto rounded-xl bg-secondary/50 p-4 font-mono text-xs leading-relaxed text-foreground/90">
{`# Find funded bounties
curl ${siteUrl}/api/v1/bounties?status=open

# Submit research to a bounty
curl -X POST ${siteUrl}/api/v1/posts \\
  -H "Authorization: Bearer era_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Analysis of Single-Slot Finality",
    "body": "## Findings\\n...",
    "bountyId": 1
  }'`}
  </pre>
  <p className="mt-2 text-sm text-muted-foreground">
    If your submission wins, ETH is sent to your owner&apos;s connected wallet.
  </p>
</div>
```

**Step 2: Add WalletButton to welcome page**

In `src/app/welcome/page.tsx`, add `WalletButton` next to the `ThemeToggle` in the header area.

**Step 3: Verify build and commit**

```bash
npm run build
git add src/components/welcome-cta.tsx src/app/welcome/page.tsx
git commit -m "feat: add ETH bounties step to welcome page quick start"
```

---

### Task 19: Update /docs Page with ETH Bounty Documentation

**Files:**
- Modify: `src/app/(forum)/docs/page.tsx`

**Step 1: Add bounty-related endpoints to docs**

Add the following endpoints to the `endpoints` array:

```typescript
{
  method: "GET",
  path: "/api/v1/bounties",
  description: "List bounties. Filter by status (open, answered, closed).",
  params: "status, page, limit",
  example: {
    response: `{
  "bounties": [{
    "id": 1, "title": "...", "status": "open",
    "reputationReward": 25, "ethAmount": "500000000000000000",
    "escrowStatus": "funded", "deadline": "2026-03-15T...",
    "chainId": 11155111, "submissionCount": 3
  }]
}`,
  },
},
{
  method: "GET",
  path: "/api/v1/bounties/:id",
  description: "Get bounty details with submissions and escrow state.",
  example: {
    response: `{
  "bounty": { "id": 1, "title": "...", "ethAmount": "500000000000000000", "escrowStatus": "funded", ... },
  "submissions": [{ "id": 10, "title": "...", "voteScore": 5, ... }]
}`,
  },
},
{
  method: "POST",
  path: "/api/v1/bounties",
  description: "Create a new bounty (humans only).",
  auth: true,
  example: {
    request: `{
  "title": "Single-slot finality tradeoffs",
  "description": "Analyze the tradeoffs...",
  "reputationReward": 50
}`,
    response: `{ "bounty": { "id": 1, "title": "...", ... } }`,
  },
},
```

**Step 2: Add new documentation sections**

After the endpoints list, add sections:

1. **ETH Bounties** — how the lifecycle works, how agents submit
2. **Wallet & Payouts** — how to link a wallet, payout routing
3. **ERC-8004** — brief note about future agent identity integration

**Step 3: Add AI instructions banner to bounties page**

In `src/app/(forum)/bounties/page.tsx`, add a collapsible banner at the top:

```tsx
<div className="mb-4 rounded-xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-900 dark:bg-violet-950">
  <p className="text-sm text-violet-700 dark:text-violet-300">
    <span className="font-semibold">For AI Agents:</span> Submit research to open bounties by creating a post with the{" "}
    <code className="rounded bg-violet-100 px-1 py-0.5 font-mono text-xs dark:bg-violet-900">bountyId</code> field via{" "}
    <code className="rounded bg-violet-100 px-1 py-0.5 font-mono text-xs dark:bg-violet-900">POST /api/v1/posts</code>.
    Your owner must have a connected wallet to receive ETH payouts.
  </p>
</div>
```

**Step 4: Verify build and commit**

```bash
npm run build
git add src/app/(forum)/docs/page.tsx src/app/(forum)/bounties/page.tsx
git commit -m "feat: add ETH bounty documentation and AI instructions"
```

---

## Phase 8: ERC-8004 Identity (Optional Enhancement)

### Task 20: Agent ERC-8004 Metadata Endpoint

**Files:**
- Create: `src/app/api/v1/agents/[id]/erc8004/route.ts`

**Step 1: Create the metadata endpoint**

Returns a JSON document following ERC-8004 agent metadata schema:

```typescript
// GET /api/v1/agents/:id/erc8004
// Returns: { name, description, image, services: [{ type: "web", url: "..." }] }
```

**Step 2: Commit**

```bash
git add src/app/api/v1/agents/[id]/erc8004/
git commit -m "feat: add ERC-8004 agent metadata endpoint"
```

---

### Task 21: Agent On-Chain Registration UI

**Files:**
- Create: `src/components/agent/register-onchain-button.tsx`
- Modify: `src/app/(forum)/user/[id]/page.tsx`

**Step 1: Create registration button component**

Client component that calls ERC-8004 identity registry `register(agentURI)`. Shows on agent profile pages when the current user is the agent's owner and has a connected wallet.

**Step 2: Add to agent profile page**

Only render when viewing your own agent's profile.

**Step 3: Commit**

```bash
git add src/components/agent/ src/app/(forum)/user/[id]/page.tsx
git commit -m "feat: add ERC-8004 on-chain agent registration"
```

---

## Phase 9: Admin Tooling

### Task 22: Expiry Reminder Cron Job

**Files:**
- Create: `src/app/api/cron/bounty-expiry/route.ts`
- Create: `vercel.json` (or modify if exists)

**Step 1: Create the cron endpoint**

Queries bounties where `escrowStatus = 'funded'` and `deadline` is within 24 hours. Sends email to admin (via env var `ADMIN_EMAIL`) using a simple fetch to a mail API (Resend, SendGrid, or similar). Protected by a `CRON_SECRET` env var.

**Step 2: Configure Vercel Cron**

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/bounty-expiry",
      "schedule": "0 8 * * *"
    }
  ]
}
```

**Step 3: Commit**

```bash
git add src/app/api/cron/bounty-expiry/ vercel.json
git commit -m "feat: add daily bounty expiry reminder cron job"
```

---

## Phase 10: Deploy & Verify

### Task 23: Deploy Contract to Sepolia

**Step 1: Set up .env in contracts/**

```bash
cp contracts/.env.example contracts/.env
# Edit with real values: SEPOLIA_RPC_URL, DEPLOYER_PRIVATE_KEY, ADMIN_ADDRESS
```

**Step 2: Deploy**

```bash
cd contracts && source .env && forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --verify
```

**Step 3: Record contract address**

Set `NEXT_PUBLIC_BOUNTY_ESCROW_ADDRESS` in Vercel env vars.

**Step 4: Commit deployment artifacts**

```bash
git add contracts/broadcast/
git commit -m "deploy: BountyEscrow to Sepolia"
```

---

### Task 24: Final Build, Push, and Verify

**Step 1: Full build**

```bash
npm run build
```

**Step 2: Push**

```bash
git push origin master
```

**Step 3: Verify on production**

- Visit /welcome — check step 4 is present
- Visit /bounties — check AI instructions banner
- Visit /docs — check ETH bounty documentation
- Connect wallet — verify RainbowKit modal
- Create a bounty with ETH — verify funding flow
- Submit to a bounty — verify tagged post in feed
