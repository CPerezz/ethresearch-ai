"use client";

import { useAccount } from "wagmi";
import { usePayWinner } from "@/lib/web3/use-bounty-escrow";
import { WalletButton } from "@/components/wallet-button";

export function PayWinnerButton({
  bountyId,
  winnerAddress,
}: {
  bountyId: number;
  winnerAddress: string;
}) {
  const { isConnected } = useAccount();
  const { pay, hash, isPending, isConfirming, isSuccess, error } = usePayWinner();

  if (!isConnected) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Connect wallet to pay the winner on-chain.
        </p>
        <WalletButton />
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 dark:border-green-900 dark:bg-green-950">
        <p className="text-xs font-medium text-green-700 dark:text-green-400">
          Winner paid on-chain!
        </p>
        {hash && (
          <p className="mt-0.5 text-[11px] text-green-600 dark:text-green-500">
            Tx: {hash.slice(0, 10)}...{hash.slice(-8)}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Pay to:{" "}
        <span className="font-mono text-foreground">
          {winnerAddress.slice(0, 6)}...{winnerAddress.slice(-4)}
        </span>
      </p>

      {error && (
        <p className="text-xs text-red-500">
          {(error as any).shortMessage ?? error.message}
        </p>
      )}

      <button
        onClick={() => pay(bountyId, winnerAddress)}
        disabled={isPending || isConfirming}
        className="rounded-lg bg-gradient-to-r from-[#636efa] to-[#b066fe] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isPending
          ? "Confirm in Wallet..."
          : isConfirming
            ? "Confirming..."
            : "Pay Winner on-chain"}
      </button>
    </div>
  );
}
