"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface EvidenceLink {
  url: string;
  label: string;
  type: string;
}

interface BountyInfo {
  id: number;
  title: string;
  description: string;
  ethAmount: string | null;
  deadline: string | null;
  status: string;
}

function deadlineCountdown(deadline: string): string {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h remaining`;
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m remaining`;
}

export default function SubmitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [bounty, setBounty] = useState<BountyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [evidenceLinks, setEvidenceLinks] = useState<EvidenceLink[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchBounty() {
      try {
        const res = await fetch(`/api/v1/bounties/${id}`);
        if (!res.ok) {
          setError("Bounty not found");
          setLoading(false);
          return;
        }
        const data = await res.json();
        setBounty(data.bounty ?? data);
      } catch {
        setError("Failed to load bounty");
      } finally {
        setLoading(false);
      }
    }
    fetchBounty();
  }, [id]);

  function addEvidenceLink() {
    setEvidenceLinks((prev) => [...prev, { url: "", label: "", type: "webpage" }]);
  }

  function updateEvidenceLink(index: number, field: keyof EvidenceLink, value: string) {
    setEvidenceLinks((prev) => prev.map((link, i) => (i === index ? { ...link, [field]: value } : link)));
  }

  function removeEvidenceLink(index: number) {
    setEvidenceLinks((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          bountyId: parseInt(id, 10),
          status: "published",
          ...(evidenceLinks.filter((l) => l.url.trim() && l.label.trim()).length
            ? { evidenceLinks: evidenceLinks.filter((l) => l.url.trim() && l.label.trim()) }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setError("You must be signed in to submit research. Please sign in first.");
        } else {
          setError(data.error || "Failed to submit research");
        }
        return;
      }
      router.push(`/bounties/${id}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center text-muted-foreground">
        Loading bounty details...
      </div>
    );
  }

  if (!bounty) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center">
        <p className="text-muted-foreground">{error || "Bounty not found"}</p>
        <Link href="/bounties" className="mt-4 inline-block text-sm text-primary hover:underline">
          Back to Bounties
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link
          href={`/bounties/${id}`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; Back to Bounty
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Submit Research</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Submit your research for this bounty.
        </p>
      </div>

      {/* Bounty context card */}
      <div className="mb-6 rounded-xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-900 dark:bg-purple-950">
        <h2 className="text-sm font-bold text-purple-700 dark:text-purple-300">
          {bounty.title}
        </h2>
        {bounty.description && (
          <p className="mt-1 text-xs leading-relaxed text-purple-600 line-clamp-3 dark:text-purple-400">
            {bounty.description}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
          {bounty.ethAmount && (
            <span className="rounded-md bg-purple-100 px-2 py-0.5 font-semibold text-purple-700 dark:bg-purple-900 dark:text-purple-300">
              {bounty.ethAmount} ETH
            </span>
          )}
          {bounty.deadline && (
            <span className="text-purple-600 dark:text-purple-400">
              {deadlineCountdown(bounty.deadline)}
            </span>
          )}
          <span className="rounded-md bg-purple-100 px-2 py-0.5 font-semibold text-purple-700 dark:bg-purple-900 dark:text-purple-300">
            Bounty #{id}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-border bg-card p-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Bounty ID (read-only) */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Bounty ID
          </label>
          <input
            type="text"
            readOnly
            value={`#${id} — ${bounty.title}`}
            className="w-full rounded-xl border border-border bg-muted px-4 py-2.5 text-sm text-muted-foreground cursor-not-allowed"
          />
        </div>

        {/* Title */}
        <div>
          <label htmlFor="title" className="mb-1.5 block text-sm font-medium text-foreground">
            Title
          </label>
          <input
            id="title"
            type="text"
            required
            maxLength={300}
            placeholder="e.g. Analysis of Single-Slot Finality Using BLS Aggregation"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
          />
          <p className="mt-1 text-xs text-muted-foreground">{title.length}/300 characters</p>
        </div>

        {/* Body */}
        <div>
          <label htmlFor="body" className="mb-1.5 block text-sm font-medium text-foreground">
            Body <span className="font-normal text-muted-foreground">(Markdown supported)</span>
          </label>
          <textarea
            id="body"
            required
            maxLength={100000}
            placeholder="Write your research submission in Markdown. Include your methodology, findings, and conclusions."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-mono transition-colors placeholder:font-sans placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 min-h-[300px]"
          />
          <p className="mt-1 text-xs text-muted-foreground">{body.length}/100000 characters</p>
        </div>

        {/* Evidence Links */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Evidence Links <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          {evidenceLinks.map((link, i) => (
            <div key={i} className="mb-2 flex gap-2">
              <input
                type="url"
                placeholder="https://..."
                value={link.url}
                onChange={(e) => updateEvidenceLink(i, "url", e.target.value)}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
              />
              <input
                type="text"
                placeholder="Label"
                value={link.label}
                onChange={(e) => updateEvidenceLink(i, "label", e.target.value)}
                className="w-32 rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
              />
              <select
                value={link.type}
                onChange={(e) => updateEvidenceLink(i, "type", e.target.value)}
                className="w-28 rounded-lg border border-border bg-background px-2 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
              >
                <option value="webpage">Webpage</option>
                <option value="paper">Paper</option>
                <option value="github">GitHub</option>
                <option value="eip">EIP</option>
              </select>
              <button
                type="button"
                onClick={() => removeEvidenceLink(i)}
                className="rounded-lg px-2 py-2 text-muted-foreground hover:text-red-500 transition-colors"
              >
                &times;
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addEvidenceLink}
            className="text-sm text-primary hover:underline"
          >
            + Add evidence link
          </button>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href={`/bounties/${id}`}
            className="rounded-lg px-5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || !title.trim() || !body.trim()}
            className="rounded-lg bg-gradient-to-r from-[#636efa] to-[#b066fe] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Research"}
          </button>
        </div>
      </form>
    </div>
  );
}
