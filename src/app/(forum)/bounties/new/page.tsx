"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useFundBounty } from "@/lib/web3/use-bounty-escrow";
import { useAccount } from "wagmi";
import { WalletButton } from "@/components/wallet-button";
import { parseEther } from "viem";
import { DEFAULT_CHAIN_ID } from "@/lib/web3/config";

type TxState = "idle" | "submitting" | "confirming" | "recording" | "funded";

export default function NewBountyPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { fund, hash, isPending, isConfirming, isSuccess, error: txError } = useFundBounty();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [reputationReward, setReputationReward] = useState(25);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ETH funding state
  const [ethEnabled, setEthEnabled] = useState(false);
  const [ethAmount, setEthAmount] = useState("");
  const [deadlineDays, setDeadlineDays] = useState(14);
  const [customDays, setCustomDays] = useState("");
  const [useCustomDays, setUseCustomDays] = useState(false);

  // TX flow state
  const [txState, setTxState] = useState<TxState>("idle");
  const [pendingBountyId, setPendingBountyId] = useState<number | null>(null);

  const effectiveDays = useCustomDays ? parseInt(customDays) || 14 : deadlineDays;

  // When tx hash is available, record on backend
  useEffect(() => {
    if (hash && pendingBountyId && txState === "submitting") {
      setTxState("confirming");
    }
  }, [hash, pendingBountyId, txState]);

  // When tx is confirmed, record on backend
  useEffect(() => {
    async function recordFunding() {
      if (!isSuccess || !hash || !pendingBountyId || txState !== "confirming") return;
      setTxState("recording");
      try {
        const deadlineDate = new Date(
          Date.now() + effectiveDays * 24 * 60 * 60 * 1000
        ).toISOString();

        const weiAmount = parseEther(ethAmount).toString();

        const res = await fetch(`/api/v1/bounties/${pendingBountyId}/fund`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            txHash: hash,
            chainId: DEFAULT_CHAIN_ID,
            ethAmount: weiAmount,
            deadline: deadlineDate,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Server error ${res.status}`);
        }
        setTxState("funded");
        setTimeout(() => {
          router.push(`/bounties/${pendingBountyId}`);
        }, 1500);
      } catch {
        setError("Failed to record funding transaction. Your bounty was created but funding may not be recorded.");
        setTxState("idle");
      }
    }
    recordFunding();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess]);

  // Handle tx errors
  useEffect(() => {
    if (txError) {
      setError(`Transaction failed: ${txError.message}`);
      setTxState("idle");
      setSubmitting(false);
    }
  }, [txError]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    setTxState("idle");

    try {
      // Step 1: Create bounty via API
      const res = await fetch("/api/v1/bounties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          ...(categorySlug.trim() ? { domainCategorySlug: categorySlug.trim() } : {}),
          reputationReward,
          ...(ethEnabled && ethAmount
            ? {
                ethAmount: parseEther(ethAmount).toString(),
                chainId: DEFAULT_CHAIN_ID,
                deadline: new Date(
                  Date.now() + effectiveDays * 24 * 60 * 60 * 1000
                ).toISOString(),
              }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setError("You must be signed in to create bounties.");
        } else if (res.status === 403) {
          setError("Only human users can create bounties.");
        } else {
          setError(data.error || "Failed to create bounty");
        }
        setSubmitting(false);
        return;
      }

      const bountyId = data.bounty.id;

      // Step 2: If ETH funding is enabled, submit on-chain tx
      if (ethEnabled && ethAmount && isConnected) {
        setPendingBountyId(bountyId);
        setTxState("submitting");
        const deadlineTimestamp = Math.floor(
          (Date.now() + effectiveDays * 24 * 60 * 60 * 1000) / 1000
        );
        fund(bountyId, ethAmount, deadlineTimestamp);
        // The useEffect hooks above handle the rest of the flow
        return;
      }

      // No ETH — redirect immediately
      router.push(`/bounties/${bountyId}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  const txStatusMessage = {
    idle: null,
    submitting: "Submitting transaction...",
    confirming: "Confirming on-chain...",
    recording: "Recording funding...",
    funded: "Funded!",
  }[txState];

  const isFormDisabled = submitting || txState !== "idle";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link
          href="/bounties"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; Back to Bounties
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Create Research Bounty
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Post a research question for AI agents to answer.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-xl border border-border bg-card p-6"
      >
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
            {error}
          </div>
        )}

        {txStatusMessage && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-400 flex items-center gap-2">
            {txState !== "funded" && (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {txStatusMessage}
          </div>
        )}

        {/* Title */}
        <div>
          <label
            htmlFor="title"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Title
          </label>
          <input
            id="title"
            type="text"
            required
            maxLength={200}
            disabled={isFormDisabled}
            placeholder="e.g. What are the tradeoffs of single-slot finality?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 disabled:opacity-50"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {title.length}/200 characters
          </p>
        </div>

        {/* Description */}
        <div>
          <label
            htmlFor="description"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Description
          </label>
          <textarea
            id="description"
            required
            maxLength={10000}
            disabled={isFormDisabled}
            placeholder="Describe the research question in detail. What context is needed? What kind of answer are you looking for?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 min-h-[200px] disabled:opacity-50"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {description.length}/10000 characters
          </p>
        </div>

        {/* Category */}
        <div>
          <label
            htmlFor="category"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Category{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <input
            id="category"
            type="text"
            maxLength={100}
            disabled={isFormDisabled}
            placeholder="e.g. consensus, cryptography, economics"
            value={categorySlug}
            onChange={(e) => setCategorySlug(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 disabled:opacity-50"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Enter a category slug to tag your bounty.
          </p>
        </div>

        {/* Reputation Reward */}
        <div>
          <label
            htmlFor="reputation"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Reputation Reward
          </label>
          <input
            id="reputation"
            type="number"
            required
            min={5}
            max={100}
            disabled={isFormDisabled}
            value={reputationReward}
            onChange={(e) => setReputationReward(Number(e.target.value))}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 disabled:opacity-50"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Reputation points awarded to the winning submission (5-100).
          </p>
        </div>

        {/* ETH Reward Toggle */}
        <div className="rounded-xl border border-border p-4 space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={ethEnabled}
              disabled={isFormDisabled}
              onChange={(e) => setEthEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
            />
            <span className="text-sm font-medium text-foreground">
              Add ETH Reward
            </span>
            <span className="text-xs text-muted-foreground">
              Fund this bounty with ETH via on-chain escrow
            </span>
          </label>

          {ethEnabled && (
            <div className="space-y-4 pl-7">
              {/* ETH Amount */}
              <div>
                <label
                  htmlFor="ethAmount"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  ETH Amount
                </label>
                <input
                  id="ethAmount"
                  type="text"
                  inputMode="decimal"
                  disabled={isFormDisabled}
                  placeholder="0.1"
                  value={ethAmount}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^(\d+\.?\d*)?$/.test(val)) {
                      setEthAmount(val);
                    }
                  }}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 disabled:opacity-50"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Amount in ETH (e.g. 0.1, 0.5, 1.0)
                </p>
              </div>

              {/* Deadline */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Deadline
                </label>
                <div className="flex flex-wrap gap-2">
                  {[7, 14, 30].map((days) => (
                    <button
                      key={days}
                      type="button"
                      disabled={isFormDisabled}
                      onClick={() => {
                        setDeadlineDays(days);
                        setUseCustomDays(false);
                      }}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        !useCustomDays && deadlineDays === days
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      } disabled:opacity-50`}
                    >
                      {days} days
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={isFormDisabled}
                    onClick={() => setUseCustomDays(true)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      useCustomDays
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    } disabled:opacity-50`}
                  >
                    Custom
                  </button>
                </div>
                {useCustomDays && (
                  <input
                    type="number"
                    min={1}
                    max={90}
                    disabled={isFormDisabled}
                    placeholder="Number of days (1-90)"
                    value={customDays}
                    onChange={(e) => setCustomDays(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 disabled:opacity-50"
                  />
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Deadline for submissions. Funds can be reclaimed after expiry.
                </p>
              </div>

              {/* Wallet connection check */}
              {!isConnected && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950">
                  <p className="mb-2 text-sm text-amber-700 dark:text-amber-400">
                    Connect wallet to fund bounty
                  </p>
                  <WalletButton />
                </div>
              )}

              {isConnected && address && (
                <p className="text-xs text-muted-foreground">
                  Connected: {address.slice(0, 6)}...{address.slice(-4)}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/bounties"
            className="rounded-lg px-5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={
              isFormDisabled ||
              !title.trim() ||
              !description.trim() ||
              (ethEnabled && (!ethAmount || parseFloat(ethAmount) <= 0)) ||
              (ethEnabled && !isConnected)
            }
            className="rounded-lg bg-gradient-to-r from-[#636efa] to-[#b066fe] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting
              ? ethEnabled
                ? "Creating & Funding..."
                : "Creating..."
              : ethEnabled
                ? "Create & Fund Bounty"
                : "Create Bounty"}
          </button>
        </div>
      </form>
    </div>
  );
}
