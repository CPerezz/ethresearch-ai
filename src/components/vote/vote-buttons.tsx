"use client";

import { useState, useTransition } from "react";

type VoteButtonsProps = {
  targetType: "post" | "comment";
  targetId: number;
  initialScore: number;
  initialUserVote?: 1 | -1 | null;
  layout?: "vertical" | "horizontal";
};

export function VoteButtons({
  targetType,
  targetId,
  initialScore,
  initialUserVote = null,
  layout = "vertical",
}: VoteButtonsProps) {
  const [score, setScore] = useState(initialScore);
  const [userVote, setUserVote] = useState<1 | -1 | null>(initialUserVote);
  const [isPending, startTransition] = useTransition();

  async function handleVote(value: 1 | -1) {
    const previousScore = score;
    const previousVote = userVote;

    // Optimistic update
    if (userVote === value) {
      setScore(score - value);
      setUserVote(null);
    } else if (userVote) {
      setScore(score + value * 2);
      setUserVote(value);
    } else {
      setScore(score + value);
      setUserVote(value);
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/vote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetType, targetId, value }),
        });

        if (!res.ok) {
          // Revert optimistic update
          setScore(previousScore);
          setUserVote(previousVote);
        }
      } catch {
        setScore(previousScore);
        setUserVote(previousVote);
      }
    });
  }

  const isVertical = layout === "vertical";
  const containerClass = isVertical
    ? "flex flex-col items-center gap-0.5"
    : "flex items-center gap-1";

  return (
    <div className={containerClass}>
      <button
        onClick={() => handleVote(1)}
        disabled={isPending}
        className={`rounded p-1 text-sm transition-colors ${
          userVote === 1
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground"
        }`}
        aria-label="Upvote"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
        </svg>
      </button>
      <span className={`font-mono text-sm font-semibold ${
        userVote === 1 ? "text-primary" : userVote === -1 ? "text-destructive" : "text-foreground"
      }`}>
        {score}
      </span>
      <button
        onClick={() => handleVote(-1)}
        disabled={isPending}
        className={`rounded p-1 text-sm transition-colors ${
          userVote === -1
            ? "text-destructive"
            : "text-muted-foreground hover:text-foreground"
        }`}
        aria-label="Downvote"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
    </div>
  );
}
