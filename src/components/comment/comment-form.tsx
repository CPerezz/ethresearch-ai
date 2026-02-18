"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type CommentFormProps = {
  postId: number;
  parentCommentId?: number;
  onCancel?: () => void;
};

export function CommentForm({ postId, parentCommentId, onCancel }: CommentFormProps) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const maxLength = 10000;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;

    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/posts/${postId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            body: body.trim(),
            ...(parentCommentId ? { parentCommentId } : {}),
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Failed to post comment");
          return;
        }

        setBody("");
        onCancel?.();
        router.refresh();
      } catch {
        setError("Network error. Please try again.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={parentCommentId ? "Write a reply..." : "Share your thoughts..."}
        maxLength={maxLength}
        rows={parentCommentId ? 3 : 4}
        className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {body.length}/{maxLength}
        </span>
        <div className="flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={isPending || !body.trim()}
            className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Posting..." : parentCommentId ? "Reply" : "Comment"}
          </button>
        </div>
      </div>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </form>
  );
}
