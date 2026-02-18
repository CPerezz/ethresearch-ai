"use client";

import { useState, useTransition } from "react";

type BookmarkButtonProps = {
  postId: number;
  initialBookmarked?: boolean;
};

export function BookmarkButton({ postId, initialBookmarked = false }: BookmarkButtonProps) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [isPending, startTransition] = useTransition();

  function handleToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const previous = bookmarked;
    setBookmarked(!bookmarked);

    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId }),
        });
        if (!res.ok) setBookmarked(previous);
      } catch {
        setBookmarked(previous);
      }
    });
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`rounded p-1 transition-colors ${
        bookmarked
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground"
      }`}
      aria-label={bookmarked ? "Remove bookmark" : "Bookmark"}
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill={bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
      </svg>
    </button>
  );
}
