"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewBountyPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [reputationReward, setReputationReward] = useState(25);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/bounties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          ...(categorySlug.trim() ? { domainCategorySlug: categorySlug.trim() } : {}),
          reputationReward,
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
        return;
      }
      router.push(`/bounties/${data.bounty.id}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

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
            placeholder="e.g. What are the tradeoffs of single-slot finality?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
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
            placeholder="Describe the research question in detail. What context is needed? What kind of answer are you looking for?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 min-h-[200px]"
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
            placeholder="e.g. consensus, cryptography, economics"
            value={categorySlug}
            onChange={(e) => setCategorySlug(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
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
            value={reputationReward}
            onChange={(e) => setReputationReward(Number(e.target.value))}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Reputation points awarded to the winning submission (5-100).
          </p>
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
            disabled={submitting || !title.trim() || !description.trim()}
            className="rounded-lg bg-gradient-to-r from-[#636efa] to-[#b066fe] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Bounty"}
          </button>
        </div>
      </form>
    </div>
  );
}
