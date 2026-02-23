"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { usePayWinner } from "@/lib/web3/use-bounty-escrow";
import { WalletButton } from "@/components/wallet-button";

type AwardState = "idle" | "confirming" | "recording" | "wallet" | "onchain" | "syncing" | "done";

function fireConfetti() {
  const duration = 1500;
  const end = Date.now() + duration;
  const colors = ["#636efa", "#b066fe", "#22c55e", "#f59e0b", "#ffffff"];

  function frame() {
    const container = document.getElementById("award-confetti");
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

        particle.style.transform = `translate(${x - startX}px, ${y}px) rotate(${progress * 720}deg)`;
        particle.style.opacity = String(1 - progress);

        if (progress < 1) requestAnimationFrame(animateParticle);
        else particle.remove();
      }
      requestAnimationFrame(animateParticle);
    }
    requestAnimationFrame(frame);
  }
  frame();

  setTimeout(() => {
    const container = document.getElementById("award-confetti");
    if (container) container.innerHTML = "";
  }, duration + 2000);
}

export function AwardWinnerButton({
  bountyId,
  postId,
  postTitle,
  winnerAddress,
  hasEscrow,
}: {
  bountyId: number;
  postId: number;
  postTitle: string;
  winnerAddress: string | null;
  hasEscrow: boolean;
}) {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { pay, hash, isPending, isConfirming: isTxConfirming, isSuccess, error: txError } = usePayWinner();

  const [state, setState] = useState<AwardState>("idle");
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);

  // Whether on-chain payment is possible
  const canPayOnChain = hasEscrow && winnerAddress && isConnected;

  // Track on-chain tx progression
  useEffect(() => {
    if (hash && state === "wallet") {
      setState("onchain");
    }
  }, [hash, state]);

  useEffect(() => {
    if (isSuccess && state === "onchain") {
      // Record payout tx to backend
      setState("syncing");
      fetch(`/api/v1/bounties/${bountyId}/payout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash: hash, winnerAddress }),
      })
        .then((res) => {
          if (!res.ok) console.error("[Award] Failed to record payout tx");
        })
        .catch((err) => console.error("[Award] Payout sync error:", err))
        .finally(() => {
          setState("done");
          fireConfetti();
          setTimeout(() => router.refresh(), 2500);
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, state]);

  useEffect(() => {
    if (txError && (state === "wallet" || state === "onchain")) {
      setError(`Transaction failed: ${(txError as any).shortMessage ?? txError.message}`);
      setState("recording"); // Fall back — winner was already recorded in DB
    }
  }, [txError, state]);

  async function handleAward() {
    setError("");
    setState("recording");

    try {
      // Step 1: Record winner in DB
      const res = await fetch(`/api/v1/bounties/${bountyId}/winner`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to select winner");
        setState("idle");
        return;
      }

      // Step 2: If on-chain payment possible, trigger it
      if (canPayOnChain) {
        setState("wallet");
        pay(bountyId, winnerAddress!);
      } else {
        // No on-chain — done
        setState("done");
        fireConfetti();
        setTimeout(() => router.refresh(), 2000);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setState("idle");
    }
  }

  const overlaySteps = canPayOnChain
    ? (["recording", "wallet", "onchain", "done"] as const)
    : (["recording", "done"] as const);

  const stepLabels: Record<string, string> = {
    recording: "Recording Winner",
    wallet: "Waiting for Wallet",
    onchain: "Confirming On-chain",
    syncing: "Syncing Payout",
    done: "Winner Awarded!",
  };

  const stepDescriptions: Record<string, string> = {
    recording: "Selecting the winner and updating the bounty...",
    wallet: "Please confirm the payout transaction in your wallet...",
    onchain: "Transaction submitted. Waiting for block confirmation...",
    syncing: "Recording payout details...",
    done: canPayOnChain
      ? "Winner selected and paid on-chain!"
      : "Winner selected! You can pay them on-chain later.",
  };

  return (
    <>
      <div id="award-confetti" className="pointer-events-none fixed inset-0 z-[60]" />

      {/* Trigger button */}
      <button
        onClick={() => setShowModal(true)}
        disabled={state !== "idle"}
        className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        Award Winner
      </button>

      {/* Confirmation modal */}
      {showModal && state === "idle" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-foreground">Award Winner</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Select this submission as the winning answer:
            </p>
            <div className="mt-3 rounded-lg border border-border bg-muted/50 px-3 py-2">
              <p className="text-sm font-medium text-foreground">{postTitle}</p>
            </div>

            {canPayOnChain && (
              <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 dark:border-green-900 dark:bg-green-950">
                <p className="text-xs text-green-700 dark:text-green-400">
                  The ETH escrow will be paid to the winner on-chain automatically.
                </p>
                {winnerAddress && (
                  <p className="mt-1 font-mono text-[11px] text-green-600 dark:text-green-500">
                    Payout to: {winnerAddress.slice(0, 6)}...{winnerAddress.slice(-4)}
                  </p>
                )}
              </div>
            )}

            {hasEscrow && !winnerAddress && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900 dark:bg-amber-950">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  The winner doesn&apos;t have a wallet connected. You can pay them later once they connect one.
                </p>
              </div>
            )}

            {hasEscrow && winnerAddress && !isConnected && (
              <div className="mt-3 space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900 dark:bg-amber-950">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Connect your wallet to pay the winner on-chain.
                </p>
                <WalletButton />
              </div>
            )}

            {error && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowModal(false); setError(""); }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAward()}
                className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                {canPayOnChain ? "Award & Pay" : "Award Winner"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction overlay */}
      {state !== "idle" && showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-2xl text-center">
            {/* Animated icon */}
            <div className="mx-auto mb-6 relative h-20 w-20">
              {state === "done" ? (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
                  <svg className="h-10 w-10 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </div>
              ) : (
                <>
                  <div className="absolute inset-0 animate-ping rounded-full bg-amber-400/20" />
                  <div className="absolute inset-2 animate-pulse rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20" />
                  <div className="relative flex h-full w-full items-center justify-center">
                    <svg className="h-12 w-12 animate-[spin_3s_linear_infinite]" viewBox="0 0 784 1277" fill="none">
                      <path d="M392.07 0L383.5 29.11v873.79l8.57 8.56 392.06-231.75z" fill="#f59e0b" fillOpacity="0.9" />
                      <path d="M392.07 0L0 679.71l392.07 231.75V496.26z" fill="#ea580c" fillOpacity="0.9" />
                      <path d="M392.07 981.29L387.24 987.2v289.41l4.83 14.1L784.13 749.54z" fill="#f59e0b" fillOpacity="0.9" />
                      <path d="M392.07 1290.71V981.29L0 749.54z" fill="#ea580c" fillOpacity="0.9" />
                      <path d="M392.07 911.46l392.06-231.75-392.06-183.45z" fill="#d97706" fillOpacity="0.8" />
                      <path d="M0 679.71l392.07 231.75V496.26z" fill="#c2410c" fillOpacity="0.8" />
                    </svg>
                  </div>
                </>
              )}
            </div>

            <h3 className={`text-lg font-bold ${state === "done" ? "text-green-600 dark:text-green-400" : "text-foreground"}`}>
              {stepLabels[state] ?? "Processing..."}
            </h3>

            <p className="mt-2 text-sm text-muted-foreground">
              {stepDescriptions[state] ?? "Please wait..."}
            </p>

            {error && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
                {error} The winner was recorded — you can pay on-chain later.
              </div>
            )}

            {/* Progress steps */}
            <div className="mt-6 flex items-center justify-center gap-2">
              {overlaySteps.map((step, i) => {
                const stepOrder = Object.fromEntries(overlaySteps.map((s, idx) => [s, idx]));
                const current = stepOrder[state] ?? (state === "syncing" ? stepOrder["done"] - 0.5 : -1);
                const thisStep = stepOrder[step];
                return (
                  <div key={step} className="flex items-center gap-2">
                    <div className={`h-2.5 w-2.5 rounded-full transition-colors duration-300 ${
                      thisStep < current
                        ? "bg-green-500"
                        : thisStep === current
                          ? state === "done" ? "bg-green-500" : "bg-amber-500 animate-pulse"
                          : "bg-muted"
                    }`} />
                    {i < overlaySteps.length - 1 && (
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
    </>
  );
}
