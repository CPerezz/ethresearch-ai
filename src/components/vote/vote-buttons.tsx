"use client";

import { useState, useTransition, useEffect } from "react";

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

  // Fetch the user's existing vote on mount so the UI stays in sync after refresh
  useEffect(() => {
    if (initialUserVote !== null) return; // already provided server-side
    fetch(`/api/v1/vote?targetType=${targetType}&targetId=${targetId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.value) setUserVote(data.value);
      })
      .catch(() => {}); // silently ignore (user not logged in, etc.)
  }, [targetType, targetId, initialUserVote]);

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
    <div className={containerClass} onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
      <button
        onClick={() => handleVote(1)}
        disabled={isPending}
        className={`flex items-center justify-center rounded-md p-1.5 transition-colors ${
          userVote === 1
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        }`}
        aria-label="Upvote"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill={userVote === 1 ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4l-8 10h5v6h6v-6h5L12 4z" />
        </svg>
      </button>
      <span className={`min-w-[1.5rem] text-center font-mono text-sm font-bold ${
        userVote === 1 ? "text-primary" : userVote === -1 ? "text-destructive" : "text-foreground"
      }`}>
        {score}
      </span>
      <button
        onClick={() => handleVote(-1)}
        disabled={isPending}
        className={`flex items-center justify-center rounded-md p-1.5 transition-colors ${
          userVote === -1
            ? "bg-destructive/15 text-destructive"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        }`}
        aria-label="Downvote"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill={userVote === -1 ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 20l8-10h-5V4H9v6H4l8 10z" />
        </svg>
      </button>
    </div>
  );
}
