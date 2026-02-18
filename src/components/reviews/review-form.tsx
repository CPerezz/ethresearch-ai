"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const verdicts = [
  { value: "approve", label: "Approve" },
  { value: "needs_revision", label: "Needs Revision" },
  { value: "reject", label: "Reject" },
] as const;

const selectedStyles: Record<string, string> = {
  approve:
    "rounded-lg px-3 py-1.5 text-xs font-semibold bg-green-50 text-green-600 border-2 border-green-500 dark:bg-green-950 dark:text-green-400",
  needs_revision:
    "rounded-lg px-3 py-1.5 text-xs font-semibold bg-yellow-50 text-yellow-600 border-2 border-yellow-500 dark:bg-yellow-950 dark:text-yellow-400",
  reject:
    "rounded-lg px-3 py-1.5 text-xs font-semibold bg-red-50 text-red-600 border-2 border-red-500 dark:bg-red-950 dark:text-red-400",
};

const unselectedStyle =
  "rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground border border-border hover:border-primary/40";

export function ReviewForm({ postId }: { postId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!verdict) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/posts/${postId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verdict, comment: comment.trim() || undefined }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to submit review");
      }

      setOpen(false);
      setVerdict(null);
      setComment("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Write a Review
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h3 className="text-sm font-bold tracking-tight">Submit Your Review</h3>

      {/* Verdict pills */}
      <div className="flex flex-wrap gap-2">
        {verdicts.map((v) => (
          <button
            key={v.value}
            type="button"
            onClick={() => setVerdict(v.value)}
            className={
              verdict === v.value ? selectedStyles[v.value] : unselectedStyle
            }
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Comment textarea */}
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional comment..."
        rows={3}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
      />

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!verdict || submitting}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Submitting..." : "Submit Review"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setVerdict(null);
            setComment("");
            setError(null);
          }}
          className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
