"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useFundBounty } from "@/lib/web3/use-bounty-escrow";
import { useAccount } from "wagmi";
import { WalletButton } from "@/components/wallet-button";
import { parseEther } from "viem";
import { DEFAULT_CHAIN_ID } from "@/lib/web3/config";

type TxState = "idle" | "submitting" | "confirming" | "recording" | "funded";

function fireConfetti() {
  const duration = 1500;
  const end = Date.now() + duration;
  const colors = ["#636efa", "#b066fe", "#22c55e", "#f59e0b", "#ffffff"];

  function frame() {
    const container = document.getElementById("confetti-container");
    if (!container || Date.now() > end) return;

    for (let i = 0; i < 3; i++) {
      const particle = document.createElement("div");
      const size = Math.random() * 8 + 4;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const startX = Math.random() * window.innerWidth;
      const drift = (Math.random() - 0.5) * 200;

      Object.assign(particle.style, {
        position: "fixed",
        left: `${startX}px`,
        top: "-10px",
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: color,
        borderRadius: Math.random() > 0.5 ? "50%" : "2px",
        pointerEvents: "none",
        zIndex: "9999",
        opacity: "1",
        transform: `rotate(${Math.random() * 360}deg)`,
        transition: "none",
      });

      container.appendChild(particle);

      const fallDuration = Math.random() * 1500 + 1000;
      const startTime = Date.now();

      function animateParticle() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / fallDuration, 1);
        const y = progress * window.innerHeight * 1.2;
        const x = startX + drift * progress + Math.sin(progress * 6) * 20;
        const opacity = 1 - progress;
        const rotation = progress * 720;

        particle.style.transform = `translate(${x - startX}px, ${y}px) rotate(${rotation}deg)`;
        particle.style.opacity = String(opacity);

        if (progress < 1) {
          requestAnimationFrame(animateParticle);
        } else {
          particle.remove();
        }
      }
      requestAnimationFrame(animateParticle);
    }
    requestAnimationFrame(frame);
  }
  frame();

  setTimeout(() => {
    const container = document.getElementById("confetti-container");
    if (container) container.innerHTML = "";
  }, duration + 2000);
}

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
        fireConfetti();
        setTimeout(() => {
          router.push(`/bounties/${pendingBountyId}`);
        }, 2000);
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

      // No ETH — celebrate and redirect
      fireConfetti();
      setTimeout(() => router.push(`/bounties/${bountyId}`), 1500);
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
    funded: "Bounty funded! Redirecting...",
  }[txState];

  const isFormDisabled = submitting || txState !== "idle";

  return (
    <div className="mx-auto max-w-2xl">
      <div id="confetti-container" className="pointer-events-none fixed inset-0 z-50" />
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

        {/* Full-screen transaction overlay */}
        {txState !== "idle" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="mx-4 w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-2xl text-center">
              {/* Ethereum diamond logo */}
              <div className="mx-auto mb-6 relative h-20 w-20">
                {txState === "funded" ? (
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
                    <svg className="h-10 w-10 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </div>
                ) : (
                  <>
                    <div className="absolute inset-0 animate-ping rounded-full bg-purple-400/20" />
                    <div className="absolute inset-2 animate-pulse rounded-full bg-gradient-to-br from-[#636efa]/20 to-[#b066fe]/20" />
                    <div className="relative flex h-full w-full items-center justify-center">
                      <svg className="h-12 w-12 animate-[spin_3s_linear_infinite]" viewBox="0 0 784 1277" fill="none">
                        <path d="M392.07 0L383.5 29.11v873.79l8.57 8.56 392.06-231.75z" fill="#636efa" fillOpacity="0.9" />
                        <path d="M392.07 0L0 679.71l392.07 231.75V496.26z" fill="#b066fe" fillOpacity="0.9" />
                        <path d="M392.07 981.29L387.24 987.2v289.41l4.83 14.1L784.13 749.54z" fill="#636efa" fillOpacity="0.9" />
                        <path d="M392.07 1290.71V981.29L0 749.54z" fill="#b066fe" fillOpacity="0.9" />
                        <path d="M392.07 911.46l392.06-231.75-392.06-183.45z" fill="#4c5bd4" fillOpacity="0.8" />
                        <path d="M0 679.71l392.07 231.75V496.26z" fill="#8c52d9" fillOpacity="0.8" />
                      </svg>
                    </div>
                  </>
                )}
              </div>

              {/* Status text */}
              <h3 className={`text-lg font-bold ${
                txState === "funded" ? "text-green-600 dark:text-green-400" : "text-foreground"
              }`}>
                {txState === "submitting" && "Waiting for Wallet"}
                {txState === "confirming" && "Confirming On-chain"}
                {txState === "recording" && "Recording Transaction"}
                {txState === "funded" && "Bounty Funded!"}
              </h3>

              <p className="mt-2 text-sm text-muted-foreground">
                {txState === "submitting" && "Please confirm the transaction in your wallet..."}
                {txState === "confirming" && "Transaction submitted. Waiting for block confirmation..."}
                {txState === "recording" && "Saving transaction details to the server..."}
                {txState === "funded" && "Your bounty is live with ETH escrow. Redirecting..."}
              </p>

              {/* Progress steps */}
              <div className="mt-6 flex items-center justify-center gap-2">
                {(["submitting", "confirming", "recording", "funded"] as const).map((step, i) => {
                  const stepOrder = { submitting: 0, confirming: 1, recording: 2, funded: 3 };
                  const current = stepOrder[txState];
                  const thisStep = stepOrder[step];
                  return (
                    <div key={step} className="flex items-center gap-2">
                      <div className={`h-2.5 w-2.5 rounded-full transition-colors duration-300 ${
                        thisStep < current
                          ? "bg-green-500"
                          : thisStep === current
                            ? txState === "funded" ? "bg-green-500" : "bg-purple-500 animate-pulse"
                            : "bg-muted"
                      }`} />
                      {i < 3 && (
                        <div className={`h-0.5 w-6 transition-colors duration-300 ${
                          thisStep < current ? "bg-green-500" : "bg-muted"
                        }`} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Tx hash link */}
              {hash && (
                <a
                  href={`https://sepolia.etherscan.io/tx/${hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-block text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  View on Etherscan &rarr;
                </a>
              )}
            </div>
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
