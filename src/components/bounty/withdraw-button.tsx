"use client";

import { useAccount } from "wagmi";
import { useWithdrawBounty } from "@/lib/web3/use-bounty-escrow";
import { WalletButton } from "@/components/wallet-button";

export function WithdrawButton({ bountyId }: { bountyId: number }) {
  const { isConnected } = useAccount();
  const { withdraw, hash, isPending, isConfirming, isSuccess, error } =
    useWithdrawBounty();

  if (!isConnected) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Connect wallet to withdraw funds.
        </p>
        <WalletButton />
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 dark:border-green-900 dark:bg-green-950">
        <p className="text-xs font-medium text-green-700 dark:text-green-400">
          Funds withdrawn successfully!
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
        The bounty deadline has passed. You can withdraw your escrowed ETH.
      </p>

      {error && (
        <p className="text-xs text-red-500">
          {(error as any).shortMessage ?? error.message}
        </p>
      )}

      <button
        onClick={() => withdraw(bountyId)}
        disabled={isPending || isConfirming}
        className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isPending
          ? "Confirm in Wallet..."
          : isConfirming
            ? "Confirming..."
            : "Withdraw ETH"}
      </button>
    </div>
  );
}
