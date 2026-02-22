"use client";

import { useBountyOnChain } from "@/lib/web3/use-bounty-escrow";
import { formatEther } from "viem";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function deadlineCountdown(deadlineSeconds: bigint): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = Number(deadlineSeconds) - now;
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  if (days > 0) return `Expires in ${days}d ${hours}h`;
  const minutes = Math.floor((diff % 3600) / 60);
  if (hours > 0) return `Expires in ${hours}h ${minutes}m`;
  return `Expires in ${minutes}m`;
}

function deriveStatus(onChain: {
  amount: bigint;
  deadline: bigint;
  winner: string;
  paid: boolean;
  refunded: boolean;
}): "funded" | "paid" | "refunded" | "expired" | "unfunded" {
  if (onChain.refunded) return "refunded";
  if (onChain.paid) return "paid";
  if (onChain.amount === BigInt(0)) return "unfunded";
  const now = Math.floor(Date.now() / 1000);
  if (Number(onChain.deadline) > 0 && Number(onChain.deadline) < now) return "expired";
  return "funded";
}

const statusStyles: Record<string, string> = {
  funded: "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400",
  paid: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  expired: "bg-yellow-50 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400",
  refunded: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  unfunded: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

export function EscrowStatusBadge({
  bountyId,
  dbEscrowStatus,
}: {
  bountyId: number;
  dbEscrowStatus: string | null;
}) {
  const { onChain, isLoading } = useBountyOnChain(bountyId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-block h-5 w-16 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700" />
        <span className="inline-block h-5 w-24 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700" />
      </div>
    );
  }

  if (!onChain || onChain.amount === BigInt(0)) {
    // No on-chain data — fall back to DB status if available
    if (dbEscrowStatus) {
      return (
        <span
          className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${statusStyles[dbEscrowStatus] ?? statusStyles.unfunded}`}
        >
          {dbEscrowStatus.charAt(0).toUpperCase() + dbEscrowStatus.slice(1)}
        </span>
      );
    }
    return null;
  }

  const status = deriveStatus(onChain);
  const ethFormatted = formatEther(onChain.amount);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-600 dark:bg-purple-950 dark:text-purple-400">
        {ethFormatted} ETH
      </span>
      <span
        className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${statusStyles[status]}`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
      {status === "funded" && onChain.deadline > BigInt(0) && (
        <span className="text-[11px] text-muted-foreground">
          {deadlineCountdown(onChain.deadline)}
        </span>
      )}
      {onChain.winner && onChain.winner !== ZERO_ADDRESS && (
        <span className="text-[11px] text-muted-foreground">
          Winner: {onChain.winner.slice(0, 6)}...{onChain.winner.slice(-4)}
        </span>
      )}
    </div>
  );
}
