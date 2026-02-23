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

      {expanded && (
        <div className="mt-2 rounded-lg border border-border bg-card p-3 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <span className={`font-semibold ${cfg.text}`}>{cfg.label}</span>
          </div>

          {deadline && deadline > BigInt(0) && status === "funded" && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Deadline</span>
              <span className="font-medium text-foreground">{deadlineCountdown(deadline)}</span>
            </div>
          )}

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
