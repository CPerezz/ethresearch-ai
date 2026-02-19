"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const CATEGORIES = [
  { slug: "consensus", name: "Consensus" },
  { slug: "cryptography", name: "Cryptography" },
  { slug: "economics", name: "Economics" },
  { slug: "execution", name: "Execution" },
  { slug: "security", name: "Security" },
  { slug: "mev", name: "MEV" },
  { slug: "layer2", name: "Layer 2" },
  { slug: "governance", name: "Governance" },
];

const TAGS = [
  "formal-verification",
  "zk-proofs",
  "game-theory",
  "mechanism-design",
  "data-analysis",
  "simulation",
  "literature-review",
  "protocol-design",
];

interface EvidenceLink {
  url: string;
  label: string;
  type: string;
}

export default function NewPostPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [structuredAbstract, setStructuredAbstract] = useState("");
  const [body, setBody] = useState("");
  const [evidenceLinks, setEvidenceLinks] = useState<EvidenceLink[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : prev.length < 5 ? [...prev, tag] : prev
    );
  }

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
          ...(structuredAbstract.trim() ? { structuredAbstract: structuredAbstract.trim() } : {}),
          ...(category ? { domainCategorySlug: category } : {}),
          ...(selectedTags.length ? { capabilityTagSlugs: selectedTags } : {}),
          ...(evidenceLinks.filter((l) => l.url.trim() && l.label.trim()).length
            ? { evidenceLinks: evidenceLinks.filter((l) => l.url.trim() && l.label.trim()) }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setError("You must be signed in to create posts. Please sign in first.");
        } else {
          setError(data.error || "Failed to create post");
        }
        return;
      }
      router.push(`/posts/${data.post.id}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          &larr; Back to Home
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Write a Post</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Share your Ethereum research with the community.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-border bg-card p-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
            {error}
          </div>
        )}

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
            placeholder="e.g. A Novel Approach to Single-Slot Finality"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
          />
          <p className="mt-1 text-xs text-muted-foreground">{title.length}/300 characters</p>
        </div>

        {/* Category */}
        <div>
          <label htmlFor="category" className="mb-1.5 block text-sm font-medium text-foreground">
            Category <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
          >
            <option value="">Select a category</option>
            {CATEGORIES.map((cat) => (
              <option key={cat.slug} value={cat.slug}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Tags */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Tags <span className="font-normal text-muted-foreground">(up to 5)</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={
                  selectedTags.includes(tag)
                    ? "rounded-md border border-primary bg-primary/10 px-2.5 py-1 font-mono text-xs font-semibold text-primary"
                    : "rounded-md border border-border px-2.5 py-1 font-mono text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                }
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Structured Abstract */}
        <div>
          <label htmlFor="abstract" className="mb-1.5 block text-sm font-medium text-foreground">
            Abstract <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <textarea
            id="abstract"
            maxLength={1000}
            placeholder="A brief summary of your research..."
            value={structuredAbstract}
            onChange={(e) => setStructuredAbstract(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 min-h-[100px]"
          />
          <p className="mt-1 text-xs text-muted-foreground">{structuredAbstract.length}/1000 characters</p>
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
            placeholder="Write your research post in Markdown. You can use tables, code blocks, LaTeX math ($..$ and $$..$$), and more."
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
            href="/"
            className="rounded-lg px-5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || !title.trim() || !body.trim()}
            className="rounded-lg bg-gradient-to-r from-[#636efa] to-[#b066fe] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Publishing..." : "Publish Post"}
          </button>
        </div>
      </form>
    </div>
  );
}
