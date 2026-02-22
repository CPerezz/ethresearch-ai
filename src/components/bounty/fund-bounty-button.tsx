"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { parseEther } from "viem";
import { useFundBounty } from "@/lib/web3/use-bounty-escrow";
import { WalletButton } from "@/components/wallet-button";
import { DEFAULT_CHAIN_ID } from "@/lib/web3/config";

const DEADLINE_PRESETS = [
  { label: "7 days", days: 7 },
  { label: "14 days", days: 14 },
  { label: "30 days", days: 30 },
] as const;

export function FundBountyButton({ bountyId }: { bountyId: number }) {
  const { isConnected } = useAccount();
  const { fund, hash, isPending, isConfirming, isSuccess, error } = useFundBounty();

  const [ethAmount, setEthAmount] = useState("0.01");
  const [deadlineDays, setDeadlineDays] = useState(14);
  const [customDays, setCustomDays] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [apiSynced, setApiSynced] = useState(false);

  // Sync the tx hash to the API after confirmation
  useEffect(() => {
    if (isSuccess && hash && !apiSynced) {
      const deadlineDate = new Date(
        Date.now() + deadlineDays * 24 * 60 * 60 * 1000
      );
      fetch(`/api/v1/bounties/${bountyId}/fund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txHash: hash,
          chainId: DEFAULT_CHAIN_ID,
          ethAmount: parseEther(ethAmount).toString(),
          deadline: deadlineDate.toISOString(),
        }),
      })
        .then(() => setApiSynced(true))
        .catch(() => {
          // Best effort — the on-chain tx is the source of truth
        });
    }
  }, [isSuccess, hash, apiSynced, bountyId, ethAmount, deadlineDays]);

  if (!isConnected) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-3 text-sm text-muted-foreground">
          Connect your wallet to fund this bounty with ETH.
        </p>
        <WalletButton />
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
        <p className="text-sm font-medium text-green-700 dark:text-green-400">
          Bounty funded successfully!
        </p>
        {hash && (
          <p className="mt-1 text-xs text-green-600 dark:text-green-500">
            Tx: {hash.slice(0, 10)}...{hash.slice(-8)}
          </p>
        )}
      </div>
    );
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="rounded-lg bg-gradient-to-r from-[#636efa] to-[#b066fe] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        Fund Bounty with ETH
      </button>
    );
  }

  function handleFund() {
    const days = isCustom ? parseInt(customDays) : deadlineDays;
    if (!days || days < 1 || days > 90) return;
    const deadlineTimestamp = Math.floor(Date.now() / 1000) + days * 86400;
    fund(bountyId, ethAmount, deadlineTimestamp);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Fund Bounty</h3>

      {/* ETH amount */}
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">
          ETH Amount
        </label>
        <input
          type="text"
          value={ethAmount}
          onChange={(e) => setEthAmount(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#636efa]/50"
          placeholder="0.01"
        />
      </div>

      {/* Deadline presets */}
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">
          Deadline
        </label>
        <div className="flex flex-wrap gap-2">
          {DEADLINE_PRESETS.map((preset) => (
            <button
              key={preset.days}
              onClick={() => {
                setDeadlineDays(preset.days);
                setIsCustom(false);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                !isCustom && deadlineDays === preset.days
                  ? "bg-[#636efa] text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              }`}
            >
              {preset.label}
            </button>
          ))}
          <button
            onClick={() => setIsCustom(true)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              isCustom
                ? "bg-[#636efa] text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }`}
          >
            Custom
          </button>
        </div>
        {isCustom && (
          <input
            type="number"
            min={1}
            max={90}
            value={customDays}
            onChange={(e) => setCustomDays(e.target.value)}
            placeholder="Days (1-90)"
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#636efa]/50"
          />
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-500">
          {(error as any).shortMessage ?? error.message}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleFund}
          disabled={isPending || isConfirming}
          className="rounded-lg bg-gradient-to-r from-[#636efa] to-[#b066fe] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending
            ? "Confirm in Wallet..."
            : isConfirming
              ? "Confirming..."
              : "Send ETH"}
        </button>
        <button
          onClick={() => setShowForm(false)}
          className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
